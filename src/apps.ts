export type AppId = 'youtube' | 'netflix';

export type TargetApp = {
  id: AppId;
  name: string;
  packageName: string;
  brand: string;
};

/** Para añadir otra app: una entrada aquí y su paquete en `<queries>` del AndroidManifest del módulo. */
export const TARGET_APPS: readonly TargetApp[] = [
  { id: 'youtube', name: 'YouTube', packageName: 'com.google.android.youtube', brand: '#FF0033' },
  { id: 'netflix', name: 'Netflix', packageName: 'com.netflix.mediaclient', brand: '#E50914' },
];

export function getApp(id: AppId): TargetApp {
  return TARGET_APPS.find((app) => app.id === id) ?? TARGET_APPS[0];
}

export function appIdForPackage(packageName: string | null | undefined): AppId {
  return TARGET_APPS.find((app) => app.packageName === packageName)?.id ?? 'youtube';
}
