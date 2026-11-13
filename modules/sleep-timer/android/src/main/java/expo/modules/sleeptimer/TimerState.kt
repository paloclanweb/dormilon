package expo.modules.sleeptimer

import android.content.Context
import java.util.concurrent.CopyOnWriteArraySet

internal const val EVENT_STATUS = "onStatusChange"
internal const val EVENT_PERMISSIONS = "onPermissionsChange"

/** Si Android reinicia el servicio después de la hora, solo se termina si no llega tarde de más. */
internal const val LATE_FINISH_GRACE_MS = 5 * 60_000L

internal enum class Phase(val id: String) {
  IDLE("idle"),
  RUNNING("running"),
  FADING("fading"),
  FINISHING("finishing"),
}

/**
 * Lo que salió mal la última vez. En el móvil no hay logs a mano, así que se guarda para que la
 * app pueda explicar qué pasó y cómo arreglarlo.
 */
internal enum class Issue(val id: String) {
  /** Android cerró Dormilón y no volvió a tiempo: no se hizo nada. */
  MISSED("missed"),
  /** Android tuvo Dormilón parado o congelado: el final llegó tarde y sin bajar el volumen. */
  LATE("late"),
  /** Accesibilidad activada en Ajustes, pero Android había parado el servicio. */
  LOCK_STOPPED("lockStopped"),
  /** Accesibilidad desactivada. */
  LOCK_OFF("lockOff"),
  /** Android no dejó cambiar el volumen. */
  VOLUME("volume"),
  /** Lo mismo, con «No molestar» activado. */
  VOLUME_DND("volumeDnd"),
  /** En plena llamada solo se pausa. */
  CALL("call");

  companion object {
    fun fromId(id: String): Issue? = entries.firstOrNull { it.id == id }
  }
}

internal data class LastRun(
  /** Cuándo terminó (0 si nunca). */
  val finishedAt: Long = 0L,
  /** A qué hora tocaba terminar. */
  val scheduledAt: Long = 0L,
  val screenOff: Boolean = false,
  val issues: List<Issue> = emptyList(),
)

/**
 * Temporizador en marcha. Las horas son de reloj (ms desde epoch) para poder enseñarlas y
 * guardarlas; el servicio cuenta con `elapsedRealtime`, que no cambia si se ajusta la hora.
 */
internal class RunState(
  val startedAt: Long,
  var endsAt: Long,
  val fadeMs: Long,
  val packageName: String?,
  val appName: String?,
  val restoreVolume: Boolean,
  /** Volumen multimedia justo antes de empezar a bajarlo; -1 mientras no ha empezado. */
  var volumeBeforeFade: Int = -1,
)

internal data class TimerSnapshot(
  val phase: Phase = Phase.IDLE,
  val startedAt: Long = 0L,
  val endsAt: Long = 0L,
  val fadeMs: Long = 0L,
  val packageName: String? = null,
  val appName: String? = null,
  val last: LastRun = LastRun(),
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "phase" to phase.id,
    "startedAt" to startedAt.toDouble(),
    "endsAt" to endsAt.toDouble(),
    "fadeMs" to fadeMs.toDouble(),
    "packageName" to packageName,
    "appName" to appName,
    "lastFinishedAt" to last.finishedAt.toDouble(),
    "lastScheduledAt" to last.scheduledAt.toDouble(),
    "lastScreenOff" to last.screenOff,
    "lastIssues" to last.issues.map { it.id },
  )
}

/** Estado compartido entre el servicio del temporizador y el módulo de JS (mismo proceso). */
internal object TimerState {
  private val listeners = CopyOnWriteArraySet<(TimerSnapshot) -> Unit>()

  @Volatile
  var snapshot = TimerSnapshot()
    private set

  fun publish(next: TimerSnapshot) {
    snapshot = next
    listeners.forEach { listener -> runCatching { listener(next) } }
  }

  /**
   * Lo que ve JS al abrir la app. Sin temporizador en marcha, lo último sale de disco; y si quedó
   * uno a medias porque Android cerró la app, se apunta como que no llegó a apagarse.
   */
  fun current(context: Context): TimerSnapshot {
    val current = snapshot
    if (current.phase != Phase.IDLE) return current
    Prefs.recordMissedIfStale(context)
    return current.copy(last = Prefs.loadLast(context))
  }

  fun addListener(listener: (TimerSnapshot) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (TimerSnapshot) -> Unit) {
    listeners.remove(listener)
  }
}
