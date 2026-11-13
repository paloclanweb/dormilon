package expo.modules.sleeptimer

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.text.format.DateFormat
import android.util.Log
import android.view.KeyEvent
import java.util.Date
import kotlin.math.ceil

/**
 * Servicio en primer plano que lleva la cuenta atrás aunque delante esté YouTube o Netflix.
 *
 * En el tramo final (`fadeMs`) baja el volumen multimedia poco a poco hasta 0. Al terminar:
 *  1. pide el foco de audio y envía «pausa»: YouTube y Netflix se paran;
 *  2. pulsa Inicio y bloquea el móvil (servicio de accesibilidad), con lo que la pantalla se apaga;
 *  3. intenta cerrar la app (Android 13 o anterior; desde Android 14 no se puede);
 *  4. devuelve el volumen a como estaba, solo si ya no suena nada.
 */
class SleepTimerService : Service() {

  companion object {
    private const val TAG = "SleepTimer"

    private const val ACTION_START = "expo.modules.sleeptimer.action.START"
    private const val ACTION_EXTEND = "expo.modules.sleeptimer.action.EXTEND"
    private const val ACTION_CANCEL = "expo.modules.sleeptimer.action.CANCEL"

    private const val EXTRA_DURATION_MS = "durationMs"
    private const val EXTRA_FADE_MS = "fadeMs"
    private const val EXTRA_PACKAGE = "packageName"
    private const val EXTRA_APP_NAME = "appName"
    private const val EXTRA_RESTORE_VOLUME = "restoreVolume"
    private const val EXTRA_EXTEND_MS = "extendMs"

    private const val CHANNEL_ID = "sleep_timer"
    private const val NOTIFICATION_ID = 4107

    /** Botón «+15 min» de la notificación. */
    private const val NOTIFICATION_EXTEND_MS = 15 * 60_000L

    /** Cada cuánto se ajusta el volumen mientras baja. */
    private const val FADE_STEP_MS = 250L

    /** Antes de la bajada, como mucho se espera esto entre comprobaciones. */
    private const val MAX_WAIT_MS = 30_000L

    /** Pasos del final, contados desde la pausa. */
    private const val HOME_AFTER_MS = 700L
    private const val LOCK_AFTER_MS = 1_500L
    private const val CLOSE_AFTER_MS = 2_000L
    private const val COMPLETE_AFTER_MS = 5_000L

    /**
     * Sin interrupciones el final llega a los pocos ms. Si llega bastante más tarde es que Android
     * tuvo la app parada o congelada, y no ha habido bajada de volumen.
     */
    private const val LATE_ISSUE_MS = 15_000L

    fun start(
      context: Context,
      durationMs: Long,
      fadeMs: Long,
      packageName: String?,
      appName: String?,
      restoreVolume: Boolean,
    ) {
      val intent = Intent(context, SleepTimerService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_DURATION_MS, durationMs)
        .putExtra(EXTRA_FADE_MS, fadeMs)
        .putExtra(EXTRA_PACKAGE, packageName)
        .putExtra(EXTRA_APP_NAME, appName)
        .putExtra(EXTRA_RESTORE_VOLUME, restoreVolume)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun extend(context: Context, extendMs: Long) {
      sendIfRunning(
        context,
        Intent(context, SleepTimerService::class.java)
          .setAction(ACTION_EXTEND)
          .putExtra(EXTRA_EXTEND_MS, extendMs),
      )
    }

    fun cancel(context: Context) {
      sendIfRunning(context, Intent(context, SleepTimerService::class.java).setAction(ACTION_CANCEL))
    }

    private fun sendIfRunning(context: Context, intent: Intent) {
      if (TimerState.snapshot.phase == Phase.IDLE) return
      context.startService(intent)
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private val audio by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
  private val power by lazy { getSystemService(Context.POWER_SERVICE) as PowerManager }
  private val notifications by lazy { getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager }

  private var run: RunState? = null
  private var phase = Phase.IDLE
  private var endElapsed = 0L
  private var wakeLock: PowerManager.WakeLock? = null
  private var focusRequest: AudioFocusRequest? = null
  private val focusListener = AudioManager.OnAudioFocusChangeListener { }
  private val tick = Runnable { onTick() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> begin(runFrom(intent))
      ACTION_EXTEND -> extend(intent.getLongExtra(EXTRA_EXTEND_MS, NOTIFICATION_EXTEND_MS))
      ACTION_CANCEL -> cancel()
      // Android reinició el servicio tras matar el proceso (START_STICKY)
      null -> resumeAfterRestart()
    }
    if (run == null) stopSelf()
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (run != null) {
      // Lo han parado desde fuera con el temporizador en marcha
      stopCurrent(restoreVolume = true)
      publish()
    }
    abandonAudioFocus()
    releaseWakeLock()
    super.onDestroy()
  }

  // region Ciclo del temporizador

  private fun runFrom(intent: Intent): RunState {
    val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L).coerceAtLeast(1_000L)
    val now = System.currentTimeMillis()
    return RunState(
      startedAt = now,
      endsAt = now + durationMs,
      fadeMs = intent.getLongExtra(EXTRA_FADE_MS, 60_000L).coerceIn(0L, durationMs),
      packageName = intent.getStringExtra(EXTRA_PACKAGE),
      appName = intent.getStringExtra(EXTRA_APP_NAME),
      restoreVolume = intent.getBooleanExtra(EXTRA_RESTORE_VOLUME, true),
    )
  }

  private fun begin(next: RunState) {
    stopCurrent(restoreVolume = true)
    run = next
    phase = Phase.RUNNING
    endElapsed = SystemClock.elapsedRealtime() + (next.endsAt - System.currentTimeMillis()).coerceAtLeast(0L)
    goForeground()
    holdWakeLock()
    Prefs.saveRun(this, next)
    publish()
    handler.post(tick)
  }

  private fun resumeAfterRestart() {
    if (run != null) return
    // Demasiado tarde: se apunta como que no llegó a apagarse y no se toca nada ahora.
    Prefs.recordMissedIfStale(this)
    val saved = Prefs.loadRun(this) ?: return
    Log.w(TAG, "Android reinició el servicio con el temporizador en marcha")
    val remaining = saved.endsAt - System.currentTimeMillis()
    run = saved
    phase = Phase.RUNNING
    endElapsed = SystemClock.elapsedRealtime() + remaining.coerceAtLeast(0L)
    goForeground()
    holdWakeLock()
    publish()
    handler.post(tick)
  }

  private fun onTick() {
    val current = run ?: return
    if (phase == Phase.FINISHING) return
    val remaining = endElapsed - SystemClock.elapsedRealtime()
    if (remaining <= 0L) {
      finish()
      return
    }
    if (remaining <= current.fadeMs) {
      if (phase != Phase.FADING) {
        if (current.volumeBeforeFade < 0) current.volumeBeforeFade = currentVolume()
        phase = Phase.FADING
        Prefs.saveRun(this, current)
        publish()
      }
      // Lineal en pasos de volumen: la escala de Android ya es logarítmica, así que se oye uniforme.
      lowerVolumeTo(ceil(current.volumeBeforeFade * remaining.toDouble() / current.fadeMs).toInt())
      handler.postDelayed(tick, FADE_STEP_MS)
    } else {
      handler.postDelayed(tick, (remaining - current.fadeMs).coerceIn(50L, MAX_WAIT_MS))
    }
  }

  private fun finish() {
    val current = run ?: return
    if (current.volumeBeforeFade < 0) current.volumeBeforeFade = currentVolume()
    phase = Phase.FINISHING
    Prefs.saveRun(this, current)
    publish()

    val issues = mutableListOf<Issue>()
    if (System.currentTimeMillis() - current.endsAt > LATE_ISSUE_MS) issues += Issue.LATE

    setVolume(0)
    val minVolume = minVolume()
    if (current.volumeBeforeFade > minVolume && currentVolume() > minVolume) {
      issues += if (isDndOn()) Issue.VOLUME_DND else Issue.VOLUME
    }
    pausePlayback()

    // En plena llamada no se toca nada más; con la pantalla ya apagada no hace falta.
    val inCall = isInCall()
    when {
      inCall -> issues += Issue.CALL
      !power.isInteractive -> Unit
      SleepLockService.instance == null ->
        issues += if (SleepLockService.isEnabled(this)) Issue.LOCK_STOPPED else Issue.LOCK_OFF
      else -> {
        handler.postDelayed({ SleepLockService.instance?.goHome() }, HOME_AFTER_MS)
        handler.postDelayed({
          if (power.isInteractive) SleepLockService.instance?.lockScreen()
        }, LOCK_AFTER_MS)
      }
    }
    if (!inCall) handler.postDelayed({ closeApp(current.packageName) }, CLOSE_AFTER_MS)
    if (issues.isNotEmpty()) Log.w(TAG, "Final con problemas: ${issues.joinToString { it.id }}")
    handler.postDelayed({ complete(issues) }, COMPLETE_AFTER_MS)
  }

  private fun complete(issues: List<Issue>) {
    val current = run
    abandonAudioFocus()
    // Solo si de verdad se ha parado: si algo sigue sonando, mejor dejarlo en silencio.
    if (current != null && current.restoreVolume && current.volumeBeforeFade > 0 && !audio.isMusicActive) {
      setVolume(current.volumeBeforeFade)
    }
    Prefs.saveLast(
      this,
      LastRun(
        finishedAt = System.currentTimeMillis(),
        scheduledAt = current?.endsAt ?: 0L,
        screenOff = !power.isInteractive,
        issues = issues,
      ),
    )
    run = null
    phase = Phase.IDLE
    Prefs.clearRun(this)
    publish()
    shutdown()
  }

  private fun extend(extraMs: Long) {
    val current = run ?: return
    if (phase == Phase.FINISHING || extraMs <= 0L) return
    endElapsed += extraMs
    current.endsAt += extraMs
    if (phase == Phase.FADING) {
      // Si ya estaba bajando, se devuelve el volumen y vuelve a esperar
      if (current.volumeBeforeFade >= 0) setVolume(current.volumeBeforeFade)
      current.volumeBeforeFade = -1
      phase = Phase.RUNNING
    }
    holdWakeLock()
    Prefs.saveRun(this, current)
    handler.removeCallbacks(tick)
    handler.post(tick)
    publish()
  }

  private fun cancel() {
    stopCurrent(restoreVolume = true)
    publish()
    shutdown()
  }

  /** Para lo que hubiera en marcha. Si ya había empezado a bajar el volumen, lo devuelve. */
  private fun stopCurrent(restoreVolume: Boolean) {
    handler.removeCallbacksAndMessages(null)
    val current = run
    if (restoreVolume && current != null && phase != Phase.RUNNING && current.volumeBeforeFade >= 0) {
      setVolume(current.volumeBeforeFade)
    }
    abandonAudioFocus()
    run = null
    phase = Phase.IDLE
    Prefs.clearRun(this)
  }

  private fun shutdown() {
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  @SuppressLint("MissingPermission")
  private fun publish() {
    val current = run
    TimerState.publish(
      TimerSnapshot(
        phase = phase,
        startedAt = current?.startedAt ?: 0L,
        endsAt = current?.endsAt ?: 0L,
        fadeMs = current?.fadeMs ?: 0L,
        packageName = current?.packageName,
        appName = current?.appName,
        last = Prefs.loadLast(this),
      ),
    )
    if (current != null) {
      try {
        notifications.notify(NOTIFICATION_ID, buildNotification())
      } catch (e: Exception) {
        Log.w(TAG, "No se pudo actualizar la notificación", e)
      }
    }
  }

  // endregion

  // region Audio

  private fun currentVolume(): Int =
    try {
      audio.getStreamVolume(AudioManager.STREAM_MUSIC)
    } catch (e: Exception) {
      0
    }

  private fun minVolume(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      runCatching { audio.getStreamMinVolume(AudioManager.STREAM_MUSIC) }.getOrDefault(0)
    } else {
      0
    }

  private fun isDndOn(): Boolean =
    runCatching { notifications.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL }
      .getOrDefault(false)

  private fun lowerVolumeTo(target: Int) {
    if (currentVolume() > target) setVolume(target)
  }

  /** Sin FLAG_SHOW_UI: que no aparezca el panel de volumen (ni encienda nada) de madrugada. */
  private fun setVolume(index: Int) {
    try {
      audio.setStreamVolume(AudioManager.STREAM_MUSIC, index.coerceAtLeast(0), 0)
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo cambiar el volumen", e)
    }
  }

  /**
   * Pedir el foco de audio de forma permanente hace que YouTube y Netflix se pausen (y desde
   * Android 12 el sistema silencia a quien lo pierde). Además se envía la tecla multimedia «pausa»
   * a la sesión que estaba sonando. Nunca PLAY_PAUSE: si ya estaba en pausa, volvería a sonar.
   */
  private fun pausePlayback() {
    requestAudioFocus()
    val now = SystemClock.uptimeMillis()
    try {
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE, 0))
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE, 0))
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo enviar la pausa", e)
    }
  }

  private fun requestAudioFocus() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
          .build()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(attributes)
          .setOnAudioFocusChangeListener(focusListener, handler)
          .build()
        focusRequest = request
        audio.requestAudioFocus(request)
      } else {
        @Suppress("DEPRECATION")
        audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      }
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo pedir el foco de audio", e)
    }
  }

  private fun abandonAudioFocus() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { audio.abandonAudioFocusRequest(it) }
      } else {
        @Suppress("DEPRECATION")
        audio.abandonAudioFocus(focusListener)
      }
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo soltar el foco de audio", e)
    }
    focusRequest = null
  }

  private fun isInCall(): Boolean =
    audio.mode == AudioManager.MODE_IN_CALL || audio.mode == AudioManager.MODE_IN_COMMUNICATION

  /**
   * Cierra el proceso de la app, que a estas alturas ya está en segundo plano. Funciona hasta
   * Android 13; desde Android 14 el sistema solo deja cerrar los procesos propios y esto no hace nada.
   */
  private fun closeApp(target: String?) {
    if (target.isNullOrEmpty() || target == packageName) return
    try {
      (getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).killBackgroundProcesses(target)
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo cerrar $target", e)
    }
  }

  // endregion

  // region Primer plano, notificación y wakelock

  private fun goForeground() {
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo pasar a primer plano", e)
    }
  }

  /** Mantiene la CPU despierta hasta la hora (con margen) para que no se retrase el final. */
  private fun holdWakeLock() {
    releaseWakeLock()
    val timeout = (endElapsed - SystemClock.elapsedRealtime()).coerceAtLeast(0L) + 2 * 60_000L
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Dormilon:SleepTimer").apply {
      setReferenceCounted(false)
      acquire(timeout)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      getString(R.string.sleep_timer_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = getString(R.string.sleep_timer_channel_description)
      setShowBadge(false)
      setSound(null, null)
      enableVibration(false)
    }
    notifications.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val current = run
    val appName = current?.appName ?: getString(R.string.sleep_timer_generic_app)
    val endsAt = current?.endsAt ?: System.currentTimeMillis()
    val endClock = DateFormat.getTimeFormat(this).format(Date(endsAt))

    val builder = newNotificationBuilder()
      .setSmallIcon(R.drawable.sleep_timer_ic_moon)
      .setColor(0xFFF4C979.toInt())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
    openAppIntent()?.let { builder.setContentIntent(it) }

    when (phase) {
      Phase.FINISHING -> builder
        .setContentTitle(getString(R.string.sleep_timer_notif_finishing, appName))
        .setShowWhen(false)

      Phase.FADING -> builder
        .setContentTitle(getString(R.string.sleep_timer_notif_fading))
        .setContentText(getString(R.string.sleep_timer_notif_fading_text, appName, endClock))
        .countdownTo(endsAt)
        .addTimerActions()

      else -> builder
        .setContentTitle(getString(R.string.sleep_timer_notif_running, appName, endClock))
        .setContentText(
          getString(
            if (SleepLockService.isRunning) {
              R.string.sleep_timer_notif_running_text_lock
            } else {
              R.string.sleep_timer_notif_running_text_nolock
            },
          ),
        )
        .countdownTo(endsAt)
        .addTimerActions()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }

  @Suppress("DEPRECATION")
  private fun newNotificationBuilder(): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this).setPriority(Notification.PRIORITY_LOW)
    }

  private fun Notification.Builder.countdownTo(endsAt: Long): Notification.Builder =
    setShowWhen(true)
      .setWhen(endsAt)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)

  private fun Notification.Builder.addTimerActions(): Notification.Builder {
    val icon = Icon.createWithResource(this@SleepTimerService, R.drawable.sleep_timer_ic_moon)
    addAction(
      Notification.Action.Builder(icon, getString(R.string.sleep_timer_action_extend), serviceIntent(ACTION_EXTEND, 1))
        .build(),
    )
    addAction(
      Notification.Action.Builder(icon, getString(R.string.sleep_timer_action_cancel), serviceIntent(ACTION_CANCEL, 2))
        .build(),
    )
    return this
  }

  private fun serviceIntent(action: String, requestCode: Int): PendingIntent =
    PendingIntent.getService(
      this,
      requestCode,
      Intent(this, SleepTimerService::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun openAppIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // endregion
}
