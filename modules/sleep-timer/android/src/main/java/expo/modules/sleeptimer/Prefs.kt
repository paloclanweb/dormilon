package expo.modules.sleeptimer

import android.content.Context
import android.content.SharedPreferences

/**
 * Persistencia mínima: lo último que eligió el usuario, el temporizador en marcha (por si Android
 * mata el proceso y reinicia el servicio) y cuándo terminó la última vez.
 */
internal object Prefs {
  private const val FILE = "sleep_timer"

  private const val UI_MINUTES = "ui.minutes"
  private const val UI_PACKAGE = "ui.package"
  private const val UI_RESTORE_VOLUME = "ui.restoreVolume"

  private const val RUN_ACTIVE = "run.active"
  private const val RUN_STARTED_AT = "run.startedAt"
  private const val RUN_ENDS_AT = "run.endsAt"
  private const val RUN_FADE_MS = "run.fadeMs"
  private const val RUN_PACKAGE = "run.package"
  private const val RUN_APP_NAME = "run.appName"
  private const val RUN_RESTORE_VOLUME = "run.restoreVolume"
  private const val RUN_VOLUME_BEFORE_FADE = "run.volumeBeforeFade"

  private const val LAST_FINISHED_AT = "last.finishedAt"
  private const val LAST_SCHEDULED_AT = "last.scheduledAt"
  private const val LAST_SCREEN_OFF = "last.screenOff"
  private const val LAST_ISSUES = "last.issues"

  private const val DEFAULT_MINUTES = 45

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun loadUi(context: Context): Map<String, Any?> {
    val p = prefs(context)
    return mapOf(
      "minutes" to p.getInt(UI_MINUTES, DEFAULT_MINUTES),
      "packageName" to p.getString(UI_PACKAGE, null),
      "restoreVolume" to p.getBoolean(UI_RESTORE_VOLUME, true),
    )
  }

  fun saveUi(context: Context, minutes: Int, packageName: String?, restoreVolume: Boolean) {
    prefs(context).edit()
      .putInt(UI_MINUTES, minutes)
      .putString(UI_PACKAGE, packageName)
      .putBoolean(UI_RESTORE_VOLUME, restoreVolume)
      .apply()
  }

  fun saveRun(context: Context, run: RunState) {
    prefs(context).edit()
      .putBoolean(RUN_ACTIVE, true)
      .putLong(RUN_STARTED_AT, run.startedAt)
      .putLong(RUN_ENDS_AT, run.endsAt)
      .putLong(RUN_FADE_MS, run.fadeMs)
      .putString(RUN_PACKAGE, run.packageName)
      .putString(RUN_APP_NAME, run.appName)
      .putBoolean(RUN_RESTORE_VOLUME, run.restoreVolume)
      .putInt(RUN_VOLUME_BEFORE_FADE, run.volumeBeforeFade)
      .apply()
  }

  fun loadRun(context: Context): RunState? {
    val p = prefs(context)
    if (!p.getBoolean(RUN_ACTIVE, false)) return null
    return RunState(
      startedAt = p.getLong(RUN_STARTED_AT, 0L),
      endsAt = p.getLong(RUN_ENDS_AT, 0L),
      fadeMs = p.getLong(RUN_FADE_MS, 0L),
      packageName = p.getString(RUN_PACKAGE, null),
      appName = p.getString(RUN_APP_NAME, null),
      restoreVolume = p.getBoolean(RUN_RESTORE_VOLUME, true),
      volumeBeforeFade = p.getInt(RUN_VOLUME_BEFORE_FADE, -1),
    )
  }

  fun clearRun(context: Context) {
    prefs(context).edit().putBoolean(RUN_ACTIVE, false).apply()
  }

  fun saveLast(context: Context, last: LastRun) {
    prefs(context).edit()
      .putLong(LAST_FINISHED_AT, last.finishedAt)
      .putLong(LAST_SCHEDULED_AT, last.scheduledAt)
      .putBoolean(LAST_SCREEN_OFF, last.screenOff)
      .putString(LAST_ISSUES, last.issues.joinToString(",") { it.id })
      .apply()
  }

  fun loadLast(context: Context): LastRun {
    val p = prefs(context)
    return LastRun(
      finishedAt = p.getLong(LAST_FINISHED_AT, 0L),
      scheduledAt = p.getLong(LAST_SCHEDULED_AT, 0L),
      screenOff = p.getBoolean(LAST_SCREEN_OFF, false),
      issues = p.getString(LAST_ISSUES, null)
        ?.split(',')
        ?.mapNotNull { Issue.fromId(it) }
        .orEmpty(),
    )
  }

  /**
   * Un temporizador guardado cuya hora pasó hace rato sin que nadie lo terminara: Android cerró la
   * app y no la reinició a tiempo. Se apunta como fallo y se olvida.
   */
  fun recordMissedIfStale(context: Context, now: Long = System.currentTimeMillis()) {
    val run = loadRun(context) ?: return
    if (now - run.endsAt <= LATE_FINISH_GRACE_MS) return
    saveLast(context, LastRun(finishedAt = run.endsAt, scheduledAt = run.endsAt, issues = listOf(Issue.MISSED)))
    clearRun(context)
  }
}
