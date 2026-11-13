# Dormilón

Temporizador para dormirte con YouTube o Netflix (solo Android). Eliges los minutos y la app, pulsas **Empezar** y Dormilón abre la app. Cuando llega la hora:

1. **Último minuto:** el volumen multimedia baja poco a poco hasta 0.
2. **Se cierra la app:** se pausa la reproducción y se sale al inicio.
3. **Se bloquea el móvil:** la pantalla se apaga (como al pulsar el botón de encendido; desbloqueas con huella como siempre).
4. **Recupera el volumen** (opcional, activado por defecto), solo si ya no suena nada, para que mañana no esté en silencio. Las alarmas usan otro volumen y no se tocan.

Mientras corre hay una notificación con la cuenta atrás y los botones **+15 min** y **Cancelar**.

## Instalarla en el móvil

Hace falta el móvil con la **depuración USB** activada (Ajustes → Información del teléfono → pulsar 7 veces «Número de compilación» → Opciones de desarrollador → Depuración USB).

**Opción A, con el APK ya compilado** (`android/app/build/outputs/apk/release/app-release.apk`, solo arm64, que es lo que llevan los móviles de los últimos años):

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

**Opción B, compilar e instalar de una vez** con el móvil conectado:

```bash
npm run android:release
```

Para desarrollar (recarga en caliente con Metro): `npm run android`. No funciona en Expo Go, porque lleva código nativo propio.

Si cambias `app.json` o el `AndroidManifest.xml` del módulo, regenera la carpeta nativa con `npm run android:prebuild` (la carpeta `android/` es generada y está en `.gitignore`). Para solo sacar el APK: `npm run apk`.

## La primera vez

La pantalla principal muestra lo que falta activar:

- **Accesibilidad** (imprescindible para bloquear): Ajustes → Accesibilidad → Apps instaladas → *Dormilón (bloquear al terminar)* → activar. Android solo deja apagar la pantalla desde una app así. El servicio no recibe eventos ni lee la pantalla (`canRetrieveWindowContent=false`, sin tipos de evento): solo pulsa Inicio y bloquea.
  - Si sale como **«Ajuste restringido»** (pasa al instalar el APK copiándolo al móvil en Android 13+): Ajustes → Aplicaciones → Dormilón → ⋮ → **Permitir ajustes restringidos**, y vuelve a activarlo. Instalando con `adb` no suele pasar.
  - Si Android mata el proceso (Xiaomi lo hace con las apps sin *Inicio automático*), el servicio se queda **parado aunque siga apareciendo como activado**. La app lo detecta (solo da por bueno el permiso si el servicio está conectado) y pide **desactivarlo y volver a activarlo**.
- **Notificaciones**: para ver la cuenta atrás. Sin ellas funciona igual.
- **Batería sin restricciones**: opcional en general, pero **obligatoria en Xiaomi, Huawei, Honor, Oppo, Realme, OnePlus, Vivo y Meizu**, que cierran apps en segundo plano aunque tengan un servicio en primer plano. En Xiaomi activa además el **Inicio automático** (información de la app → *Inicio automático*), que la app no puede comprobar.

Luego pulsa **«Probar ahora en 20 segundos»**: abre la app, baja el volumen en 15 s, la cierra y bloquea el móvil. Si al volver ves «la pantalla quedó apagada», está todo listo.

## Cómo funciona

Todo el trabajo lo hace código nativo (Kotlin) en `modules/sleep-timer/android`:

| Pieza | Qué hace |
| --- | --- |
| `SleepTimerService` | Servicio en primer plano (`specialUse`) con la cuenta atrás. Sigue vivo con YouTube o Netflix delante, con un wakelock parcial hasta la hora. Baja `STREAM_MUSIC` cada 250 ms durante el tramo final. |
| Pausa | Pide el foco de audio permanente (YouTube y Netflix se pausan al perderlo; desde Android 12 el sistema además silencia a quien lo pierde) y envía la tecla multimedia **PAUSE** (nunca PLAY_PAUSE, que reanudaría). |
| `SleepLockService` | Servicio de accesibilidad mínimo: `GLOBAL_ACTION_HOME` y `GLOBAL_ACTION_LOCK_SCREEN` (Android 9+). |
| Volumen | Al terminar lo devuelve a su valor solo si `isMusicActive` es falso: si algo siguiera sonando, se queda en silencio. Cancelar o «+15 min» durante la bajada lo devuelven al momento. |
| `SleepTimerModule` | Módulo de Expo que expone todo a JS (`modules/sleep-timer/index.ts`). |

Si Android mata el proceso a mitad, el servicio (`START_STICKY`) retoma la cuenta desde lo guardado en `SharedPreferences`. Durante una llamada no sale al inicio ni bloquea: solo pausa.

### Qué falló la última vez

En el móvil no hay logs a mano, así que cada final guarda qué salió mal (`Issue` en `TimerState.kt`) y la pantalla principal lo explica con el arreglo:

| Fallo | Cuándo |
| --- | --- |
| `missed` | Android cerró la app y no la reinició hasta más de 5 min después de la hora: no se hizo nada. |
| `late` | El final llegó más de 15 s tarde: Android tuvo la app parada o congelada y no hubo bajada de volumen. |
| `lockStopped` | Accesibilidad activada en Ajustes pero con el servicio parado: no salió ni bloqueó. |
| `lockOff` | Accesibilidad desactivada. |
| `volume` / `volumeDnd` | Tras ponerlo a 0, el volumen seguía igual (el segundo, con «No molestar»). |
| `call` | Había una llamada: solo pausó (no es un fallo). |

En logcat salen con la etiqueta `SleepTimer` (`adb logcat -s SleepTimer`).

## Limitaciones (de Android, no de la app)

- **Cerrar del todo otra app**: desde **Android 14** ninguna app normal puede cerrar procesos de otras (`killBackgroundProcesses` solo afecta a los propios). Dormilón pausa, sale al inicio y bloquea, que en la práctica es lo mismo: no suena y la pantalla está apagada. En Android 13 o anterior además cierra el proceso.
- **Bloquear la pantalla** necesita Android 9 o superior. En versiones anteriores pausa, y la pantalla se apaga cuando le toca.
- Algunas apps de bancos avisan si hay servicios de accesibilidad de terceros activados. Si te molesta, desactívalo cuando no lo uses.

## Personalizar

- **Duración de la bajada de volumen**: `FADE_MS` en `src/HomeScreen.tsx` (60 s).
- **«+15 min»**: `EXTEND_MINUTES` en `src/HomeScreen.tsx` y `NOTIFICATION_EXTEND_MS` en `SleepTimerService.kt`.
- **Otra app** (YouTube Kids, Prime Video…): una entrada en `TARGET_APPS` (`src/apps.ts`), su paquete en `<queries>` del `AndroidManifest.xml` del módulo y su marca en `src/components/Marks.tsx`.
- **Iconos**: `npm run icons` los regenera desde `scripts/generate-icons.js`.

## Estructura

```
App.tsx                      Raíz (SafeAreaProvider + StatusBar)
src/HomeScreen.tsx           Estado y acciones; elige entre las dos vistas
src/views/IdleView.tsx       Configurar: minutos, app, qué pasa al final, permisos
src/views/RunningView.tsx    Cuenta atrás, barras de volumen, +15 min, cancelar
src/components/              Piezas de UI
modules/sleep-timer/         Módulo nativo (Kotlin) + tipos de JS
scripts/generate-icons.js    Iconos de la luna, sin dependencias
```
