const pad = (value: number) => String(value).padStart(2, '0');

/** 44:59, o 1:05:09 a partir de una hora. Redondea hacia arriba: no enseña 00:00 antes de tiempo. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Hora de reloj en 24 h. Sin Intl: en Hermes el formato depende de la plataforma. */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 45 min · 1 h · 1 h 30 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** «hoy a las 00:32», «ayer a las 23:50» o «el 3/11 a las 01:10». */
export function formatLastRun(timestamp: number, now: number): string {
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const date = new Date(timestamp);
  const day =
    timestamp >= startOfToday
      ? 'hoy'
      : timestamp >= startOfToday - 24 * 60 * 60 * 1000
        ? 'ayer'
        : `el ${date.getDate()}/${date.getMonth() + 1}`;
  return `${day} a las ${formatClock(timestamp)}`;
}
