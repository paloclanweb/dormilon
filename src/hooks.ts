import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import SleepTimer, { type TimerPermissions, type TimerStatus } from '../modules/sleep-timer';
import { TARGET_APPS, type AppId } from './apps';

/** Llama a `callback` cada vez que la app vuelve a primer plano (p. ej. al volver de Ajustes). */
export function useOnForeground(callback: () => void) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') latest.current();
    });
    return () => subscription.remove();
  }, []);
}

/** Estado del temporizador nativo: llega por evento y se relee al volver a la app. */
export function useTimerStatus(): TimerStatus {
  const [status, setStatus] = useState<TimerStatus>(() => SleepTimer.getStatus());
  useEffect(() => {
    const subscription = SleepTimer.addListener('onStatusChange', setStatus);
    setStatus(SleepTimer.getStatus());
    return () => subscription.remove();
  }, []);
  useOnForeground(() => setStatus(SleepTimer.getStatus()));
  return status;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<TimerPermissions>(() => SleepTimer.getPermissions());
  const refresh = useCallback(() => setPermissions(SleepTimer.getPermissions()), []);
  useEffect(() => {
    const subscription = SleepTimer.addListener('onPermissionsChange', setPermissions);
    refresh();
    return () => subscription.remove();
  }, [refresh]);
  useOnForeground(refresh);
  return { permissions, refresh };
}

function checkInstalled(): Record<AppId, boolean> {
  return Object.fromEntries(
    TARGET_APPS.map((app) => [app.id, SleepTimer.isInstalled(app.packageName)]),
  ) as Record<AppId, boolean>;
}

export function useInstalledApps(): Record<AppId, boolean> {
  const [installed, setInstalled] = useState(checkInstalled);
  useOnForeground(() => setInstalled(checkInstalled()));
  return installed;
}

/** Hora actual, refrescada cada `intervalMs` mientras `enabled`. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
