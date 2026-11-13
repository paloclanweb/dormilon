package expo.modules.sleeptimer

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

internal class StartOptions : Record {
  @Field
  var durationMs: Double = 0.0

  @Field
  var fadeMs: Double = 60_000.0

  @Field
  var packageName: String? = null

  @Field
  var appName: String? = null

  @Field
  var restoreVolume: Boolean = true
}

internal class PreferencesRecord : Record {
  @Field
  var minutes: Int = 45

  @Field
  var packageName: String? = null

  @Field
  var restoreVolume: Boolean = true
}

class SleepTimerModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val statusListener: (TimerSnapshot) -> Unit = { snapshot ->
    sendEvent(EVENT_STATUS, snapshot.toMap())
  }

  private val permissionsListener: () -> Unit = {
    appContext.reactContext?.applicationContext?.let { sendEvent(EVENT_PERMISSIONS, permissions(it)) }
  }

  override fun definition() = ModuleDefinition {
    Name("SleepTimer")

    Events(EVENT_STATUS, EVENT_PERMISSIONS)

    OnStartObserving(EVENT_STATUS) { TimerState.addListener(statusListener) }
    OnStopObserving(EVENT_STATUS) { TimerState.removeListener(statusListener) }
    OnStartObserving(EVENT_PERMISSIONS) { SleepLockService.addListener(permissionsListener) }
    OnStopObserving(EVENT_PERMISSIONS) { SleepLockService.removeListener(permissionsListener) }
    OnDestroy {
      TimerState.removeListener(statusListener)
      SleepLockService.removeListener(permissionsListener)
    }

    // region Temporizador

    Function("getStatus") { TimerState.current(context).toMap() }

    Function("start") { options: StartOptions ->
      SleepTimerService.start(
        context,
        durationMs = options.durationMs.toLong(),
        fadeMs = options.fadeMs.toLong(),
        packageName = options.packageName,
        appName = options.appName,
        restoreVolume = options.restoreVolume,
      )
    }

    Function("extend") { minutes: Double ->
      SleepTimerService.extend(context, (minutes * 60_000).toLong())
    }

    Function("cancel") { SleepTimerService.cancel(context) }

    // endregion

    // region Apps de vídeo

    Function("isInstalled") { packageName: String -> launchIntentFor(packageName) != null }

    Function("openApp") { packageName: String ->
      val intent = launchIntentFor(packageName)
      intent != null && launch(intent)
    }

    // endregion

    // region Permisos y ajustes

    Function("getPermissions") { permissions(context) }

    Function("openAccessibilitySettings") {
      val ctx = context
      // Android 13+: directo a la ficha del servicio; si no se puede, a la lista de Accesibilidad.
      val details = Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS")
        .putExtra(Intent.EXTRA_COMPONENT_NAME, ComponentName(ctx, SleepLockService::class.java).flattenToString())
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && launch(details)) ||
        launch(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    Function("openNotificationSettings") {
      val ctx = context
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      } else {
        appDetailsIntent(ctx)
      }
      launch(intent) || launch(appDetailsIntent(ctx))
    }

    Function("openBatterySettings") {
      val ctx = context
      launch(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))) ||
        launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /** Para «Permitir ajustes restringidos» (menú ⋮) si se instaló el APK a mano en Android 13+. */
    Function("openAppDetails") { launch(appDetailsIntent(context)) }

    // endregion

    // region Preferencias

    Function("getPreferences") { Prefs.loadUi(context) }

    Function("savePreferences") { preferences: PreferencesRecord ->
      Prefs.saveUi(context, preferences.minutes, preferences.packageName, preferences.restoreVolume)
    }

    // endregion
  }

  private fun permissions(ctx: Context): Map<String, Any?> {
    val notificationManager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val powerManager = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val lockRunning = SleepLockService.isRunning
    return mapOf(
      // Lo que cuenta es que esté funcionando, no solo activado en Ajustes.
      "accessibility" to lockRunning,
      "accessibilityStopped" to (!lockRunning && SleepLockService.isEnabled(ctx)),
      "canLockScreen" to SleepLockService.canLockScreen,
      "notifications" to notificationManager.areNotificationsEnabled(),
      "notificationsNeedRuntime" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU),
      "batteryUnrestricted" to powerManager.isIgnoringBatteryOptimizations(ctx.packageName),
      "manufacturer" to Build.MANUFACTURER.lowercase(),
    )
  }

  private fun launchIntentFor(packageName: String): Intent? =
    context.packageManager.getLaunchIntentForPackage(packageName)

  private fun appDetailsIntent(ctx: Context): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))

  /** Abre desde la actividad actual si la hay, para que «atrás» vuelva a Dormilón. */
  private fun launch(intent: Intent): Boolean {
    val activity = appContext.currentActivity
    return try {
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      true
    } catch (e: ActivityNotFoundException) {
      false
    } catch (e: SecurityException) {
      false
    }
  }
}
