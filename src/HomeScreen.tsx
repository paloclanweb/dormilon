import { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid } from 'react-native';

import SleepTimer from '../modules/sleep-timer';
import { appIdForPackage, getApp, TARGET_APPS, type AppId } from './apps';
import { clampMinutes } from './components/MinutePicker';
import { useInstalledApps, usePermissions, useTimerStatus } from './hooks';
import { IdleView } from './views/IdleView';
import { RunningView } from './views/RunningView';

/** El volumen baja durante el último minuto. */
const FADE_MS = 60_000;
/** «Probar ahora»: todo el recorrido en 20 s, con 15 s de bajada. */
const TEST_DURATION_MS = 20_000;
const TEST_FADE_MS = 15_000;
const EXTEND_MINUTES = 15;

export function HomeScreen() {
  const status = useTimerStatus();
  const { permissions, refresh: refreshPermissions } = usePermissions();
  const installed = useInstalledApps();

  const [initial] = useState(() => SleepTimer.getPreferences());
  const [minutes, setMinutes] = useState(() => clampMinutes(initial.minutes));
  const [appId, setAppId] = useState<AppId>(() => appIdForPackage(initial.packageName));
  const [restoreVolume, setRestoreVolume] = useState(initial.restoreVolume);

  // Si la elegida no está instalada y la otra sí, se pasa a la otra.
  useEffect(() => {
    if (installed[appId]) return;
    const other = TARGET_APPS.find((app) => installed[app.id]);
    if (other) setAppId(other.id);
  }, [installed, appId]);

  const app = getApp(appId);

  const savePreferences = (overrides: { restoreVolume?: boolean } = {}) =>
    SleepTimer.savePreferences({
      minutes,
      packageName: app.packageName,
      restoreVolume: overrides.restoreVolume ?? restoreVolume,
    });

  const launch = (durationMs: number, fadeMs: number) => {
    savePreferences();
    SleepTimer.start({ durationMs, fadeMs, packageName: app.packageName, appName: app.name, restoreVolume });
    if (!SleepTimer.openApp(app.packageName)) {
      Alert.alert(`No se pudo abrir ${app.name}`, 'El temporizador está en marcha igualmente.');
    }
  };

  /** Sin Accesibilidad funcionando no se puede bloquear el móvil: se avisa antes de empezar. */
  const startChecked = (durationMs: number, fadeMs: number) => {
    if (permissions.accessibility) {
      launch(durationMs, fadeMs);
      return;
    }
    const stopped = permissions.accessibilityStopped;
    Alert.alert(
      stopped ? 'El bloqueo está parado' : 'El móvil no se bloqueará',
      stopped
        ? 'El permiso de Accesibilidad sigue activado, pero Android lo ha parado. Desactívalo y vuelve a activarlo; si no, puedo bajar el volumen y pausar, pero la pantalla seguirá encendida.'
        : 'Sin el permiso de Accesibilidad puedo bajar el volumen y pausar, pero la pantalla seguirá encendida hasta que se apague sola.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: stopped ? 'Reactivar' : 'Activar', onPress: () => SleepTimer.openAccessibilitySettings() },
        { text: 'Empezar igual', onPress: () => launch(durationMs, fadeMs) },
      ],
    );
  };

  const enableNotifications = async () => {
    if (permissions.notificationsNeedRuntime) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) SleepTimer.openNotificationSettings();
    } else {
      SleepTimer.openNotificationSettings();
    }
    refreshPermissions();
  };

  if (status.phase !== 'idle') {
    return (
      <RunningView
        status={status}
        canLock={permissions.accessibility && permissions.canLockScreen}
        lockStopped={permissions.accessibilityStopped}
        onExtend={() => SleepTimer.extend(EXTEND_MINUTES)}
        onCancel={() => SleepTimer.cancel()}
        onOpenApp={() => {
          if (status.packageName) SleepTimer.openApp(status.packageName);
        }}
        onEnableAccessibility={() => SleepTimer.openAccessibilitySettings()}
      />
    );
  }

  return (
    <IdleView
      minutes={minutes}
      onMinutesChange={setMinutes}
      appId={appId}
      onAppChange={setAppId}
      installed={installed}
      restoreVolume={restoreVolume}
      onRestoreVolumeChange={(value) => {
        setRestoreVolume(value);
        savePreferences({ restoreVolume: value });
      }}
      permissions={permissions}
      lastFinishedAt={status.lastFinishedAt}
      lastScheduledAt={status.lastScheduledAt}
      lastScreenOff={status.lastScreenOff}
      lastIssues={status.lastIssues}
      onStart={() => startChecked(minutes * 60_000, FADE_MS)}
      onTest={() => startChecked(TEST_DURATION_MS, TEST_FADE_MS)}
      onEnableAccessibility={() => SleepTimer.openAccessibilitySettings()}
      onOpenAppDetails={() => SleepTimer.openAppDetails()}
      onEnableNotifications={enableNotifications}
      onOpenBattery={() => SleepTimer.openBatterySettings()}
    />
  );
}
