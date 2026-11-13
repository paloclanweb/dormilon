import { NativeModule, requireNativeModule } from 'expo';

export type TimerPhase = 'idle' | 'running' | 'fading' | 'finishing';

export type TimerStatus = {
  phase: TimerPhase;
  /** Horas de reloj en ms (epoch). 0 cuando no hay temporizador. */
  startedAt: number;
  endsAt: number;
  /** Duración del tramo final en el que baja el volumen. */
  fadeMs: number;
  packageName: string | null;
  appName: string | null;
  /** Cuándo terminó el último temporizador (0 si nunca) y si la pantalla quedó apagada. */
  lastFinishedAt: number;
  /** A qué hora tocaba terminar el último. */
  lastScheduledAt: number;
  lastScreenOff: boolean;
  /** Lo que salió mal la última vez (vacío si nada). */
  lastIssues: LastRunIssue[];
};

/**
 * - `missed`: Android cerró Dormilón y no volvió a tiempo; no se hizo nada.
 * - `late`: Android lo tuvo parado; terminó tarde y sin bajar el volumen.
 * - `lockStopped`: Accesibilidad activada pero parada por Android; no salió ni bloqueó.
 * - `lockOff`: Accesibilidad desactivada.
 * - `volume` / `volumeDnd`: Android no dejó cambiar el volumen (con «No molestar» en el segundo).
 * - `call`: había una llamada; solo se pausó.
 */
export type LastRunIssue = 'missed' | 'late' | 'lockStopped' | 'lockOff' | 'volume' | 'volumeDnd' | 'call';

export type TimerPermissions = {
  /** Servicio de accesibilidad funcionando: hace falta para pulsar Inicio y bloquear el móvil. */
  accessibility: boolean;
  /** Activado en Ajustes pero parado por Android: hay que desactivarlo y volver a activarlo. */
  accessibilityStopped: boolean;
  /** Android 9+: el bloqueo de pantalla desde accesibilidad existe. */
  canLockScreen: boolean;
  notifications: boolean;
  /** Android 13+: las notificaciones se piden en tiempo de ejecución. */
  notificationsNeedRuntime: boolean;
  batteryUnrestricted: boolean;
  /** `Build.MANUFACTURER` en minúsculas («xiaomi», «samsung»…). */
  manufacturer: string;
};

export type TimerPreferences = {
  minutes: number;
  packageName: string | null;
  restoreVolume: boolean;
};

export type StartOptions = {
  durationMs: number;
  fadeMs: number;
  packageName: string | null;
  appName: string | null;
  restoreVolume: boolean;
};

type SleepTimerEvents = {
  onStatusChange: (status: TimerStatus) => void;
  /** El servicio de accesibilidad se ha conectado o parado. */
  onPermissionsChange: (permissions: TimerPermissions) => void;
};

declare class SleepTimerNativeModule extends NativeModule<SleepTimerEvents> {
  getStatus(): TimerStatus;
  start(options: StartOptions): void;
  extend(minutes: number): void;
  cancel(): void;

  isInstalled(packageName: string): boolean;
  openApp(packageName: string): boolean;

  getPermissions(): TimerPermissions;
  openAccessibilitySettings(): boolean;
  openNotificationSettings(): boolean;
  openBatterySettings(): boolean;
  openAppDetails(): boolean;

  getPreferences(): TimerPreferences;
  savePreferences(preferences: TimerPreferences): void;
}

export default requireNativeModule<SleepTimerNativeModule>('SleepTimer');
