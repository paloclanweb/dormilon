import type { TimerPermissions } from '../modules/sleep-timer';

const XIAOMI = ['xiaomi', 'redmi', 'poco'];

/** Marcas que cierran apps en segundo plano aunque tengan un servicio en primer plano. */
const AGGRESSIVE = [...XIAOMI, 'huawei', 'honor', 'oppo', 'realme', 'oneplus', 'vivo', 'meizu'];

/** En Xiaomi, además de la batería, hace falta el «Inicio automático» (en la información de la app). */
export const isXiaomi = (permissions: TimerPermissions) => XIAOMI.includes(permissions.manufacturer);

/** En estas marcas, sin quitar el ahorro de batería no se apaga a su hora: no es opcional. */
export const batteryRequired = (permissions: TimerPermissions) => AGGRESSIVE.includes(permissions.manufacturer);

/** Todo lo necesario para bajar el volumen, cerrar la app y bloquear el móvil a su hora. */
export const isReady = (permissions: TimerPermissions) =>
  permissions.accessibility &&
  permissions.notifications &&
  (permissions.batteryUnrestricted || !batteryRequired(permissions));
