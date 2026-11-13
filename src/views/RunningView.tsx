import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TimerStatus } from '../../modules/sleep-timer';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { VolumeMeter } from '../components/VolumeMeter';
import { formatClock, formatCountdown } from '../format';
import { useNow } from '../hooks';
import { colors, radius } from '../theme';

type Props = {
  status: TimerStatus;
  canLock: boolean;
  /** Accesibilidad activada pero parada por Android. */
  lockStopped: boolean;
  onExtend: () => void;
  onCancel: () => void;
  onOpenApp: () => void;
  onEnableAccessibility: () => void;
};

export function RunningView({
  status,
  canLock,
  lockStopped,
  onExtend,
  onCancel,
  onOpenApp,
  onEnableAccessibility,
}: Props) {
  const insets = useSafeAreaInsets();
  const now = useNow(250);
  const appName = status.appName ?? 'La reproducción';
  const fading = status.phase === 'fading';
  const finishing = status.phase === 'finishing';

  const remaining = Math.max(0, status.endsAt - now);
  const total = Math.max(1, status.endsAt - status.startedAt);
  const progress = finishing ? 1 : Math.min(1, Math.max(0, 1 - remaining / total));
  const volumeLevel = finishing ? 0 : fading ? remaining / Math.max(1, status.fadeMs) : 1;

  const pulse = usePulse(fading);

  const message = finishing
    ? canLock
      ? `Cerrando ${appName} y bloqueando el móvil…`
      : `Pausando ${appName}…`
    : fading
      ? 'Bajando el volumen poco a poco…'
      : canLock
        ? `En el último minuto el volumen bajará poco a poco. Después ${appName} se cerrará y el móvil se bloqueará.`
        : `En el último minuto el volumen bajará poco a poco y después ${appName} se pausará.`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 }]}>
      <Header />

      <View style={styles.center}>
        <Text style={styles.kicker}>{finishing ? 'Buenas noches' : `${appName} se apagará en`}</Text>
        <Animated.Text
          style={[styles.countdown, { opacity: pulse }]}
          allowFontScaling={false}
          accessibilityLabel={`Quedan ${formatCountdown(remaining)}`}
          accessibilityLiveRegion="none"
        >
          {formatCountdown(remaining)}
        </Animated.Text>
        <Text style={styles.until}>a las {formatClock(status.endsAt)}</Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.meter}>
          <VolumeMeter level={volumeLevel} />
        </View>
        <Text style={[styles.message, fading && styles.messageActive]}>{message}</Text>

        {!canLock && !finishing ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              {lockStopped
                ? 'Android ha parado el permiso de Accesibilidad y el móvil no se bloqueará. Desactívalo y vuelve a activarlo.'
                : 'Sin el permiso de Accesibilidad el móvil no se bloqueará al terminar.'}
            </Text>
            <Button label={lockStopped ? 'Reactivar' : 'Activar'} onPress={onEnableAccessibility} compact />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.row}>
          <Button label="+15 min" onPress={onExtend} disabled={finishing} style={styles.half} />
          <Button
            label={`Abrir ${status.appName ?? 'la app'}`}
            onPress={onOpenApp}
            disabled={finishing || !status.packageName}
            style={styles.half}
          />
        </View>
        <Button label="Cancelar temporizador" onPress={onCancel} variant="danger" disabled={finishing} />
      </View>
    </View>
  );
}

/** Respira mientras baja el volumen, salvo con «Reducir movimiento». */
function usePulse(active: boolean) {
  const value = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, value]);

  return value;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  countdown: {
    color: colors.text,
    fontSize: 76,
    fontWeight: '200',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    marginTop: 4,
  },
  until: {
    color: colors.textMuted,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  track: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 28,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.moon,
  },
  meter: {
    marginTop: 32,
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 320,
  },
  messageActive: {
    color: colors.moon,
    fontWeight: '600',
  },
  warning: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  warningText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
    paddingHorizontal: 12,
  },
});
