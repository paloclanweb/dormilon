package expo.modules.sleeptimer

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Servicio de accesibilidad mínimo: no recibe eventos ni lee la pantalla.
 *
 * Android no deja a una app normal apagar la pantalla; con este servicio el temporizador puede
 * pulsar «Inicio» y bloquear el móvil igual que el botón de encendido (Android 9+), así que luego
 * se desbloquea con la huella como siempre.
 */
class SleepLockService : AccessibilityService() {

  companion object {
    @Volatile
    internal var instance: SleepLockService? = null
      private set(value) {
        field = value
        listeners.forEach { listener -> runCatching { listener() } }
      }

    private val listeners = CopyOnWriteArraySet<() -> Unit>()

    /** GLOBAL_ACTION_LOCK_SCREEN existe desde Android 9. */
    internal val canLockScreen: Boolean
      get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P

    /** Conectado de verdad: es lo único que garantiza poder pulsar Inicio y bloquear. */
    internal val isRunning: Boolean
      get() = instance != null

    /**
     * Activado en Ajustes. Puede estarlo sin funcionar: si Android mata el proceso (Xiaomi lo hace
     * con las apps que no tienen «Inicio automático»), el servicio se queda parado pero sigue
     * apareciendo como activado hasta que se desactiva y se vuelve a activar.
     */
    internal fun isEnabled(context: Context): Boolean {
      if (instance != null) return true
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: return false
      val self = ComponentName(context, SleepLockService::class.java)
      return enabled.split(':').any { ComponentName.unflattenFromString(it) == self }
    }

    /** Avisa cuando el servicio se conecta o se para. */
    internal fun addListener(listener: () -> Unit) {
      listeners.add(listener)
    }

    internal fun removeListener(listener: () -> Unit) {
      listeners.remove(listener)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

  override fun onInterrupt() = Unit

  override fun onUnbind(intent: Intent?): Boolean {
    if (instance === this) instance = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    super.onDestroy()
  }

  internal fun goHome(): Boolean = performGlobalAction(GLOBAL_ACTION_HOME)

  internal fun lockScreen(): Boolean = canLockScreen && performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
}
