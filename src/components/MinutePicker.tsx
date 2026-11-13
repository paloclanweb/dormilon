import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock, formatDuration } from '../format';
import { colors, radius } from '../theme';

const PRESETS = [15, 30, 45, 60, 90, 120];
const STEP = 5;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 240;

export function clampMinutes(value: number): number {
  const stepped = Math.round(value / STEP) * STEP;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, stepped));
}

type Props = {
  value: number;
  onChange: (minutes: number) => void;
  now: number;
};

export function MinutePicker({ value, onChange, now }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>¿Cuánto tiempo?</Text>

      <View style={styles.stepper}>
        <StepButton
          symbol="−"
          accessibilityLabel={`Quitar ${STEP} minutos`}
          disabled={value <= MIN_MINUTES}
          onStep={() => onChange(clampMinutes(value - STEP))}
        />
        <View
          style={styles.valueBox}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${value} minutos`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) =>
            onChange(clampMinutes(value + (event.nativeEvent.actionName === 'increment' ? STEP : -STEP)))
          }
        >
          <Text style={styles.value} allowFontScaling={false}>
            {value}
          </Text>
          <Text style={styles.unit}>min</Text>
        </View>
        <StepButton
          symbol="+"
          accessibilityLabel={`Añadir ${STEP} minutos`}
          disabled={value >= MAX_MINUTES}
          onStep={() => onChange(clampMinutes(value + STEP))}
        />
      </View>

      <Text style={styles.hint}>
        Se apagará a las <Text style={styles.hintStrong}>{formatClock(now + value * 60_000)}</Text>
      </Text>

      <View style={styles.presets}>
        {PRESETS.map((preset) => {
          const selected = preset === value;
          return (
            <Pressable
              key={preset}
              onPress={() => onChange(preset)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.preset, selected && styles.presetSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{formatDuration(preset)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type StepButtonProps = {
  symbol: string;
  accessibilityLabel: string;
  disabled: boolean;
  onStep: () => void;
};

/** Botón − / +: un toque suma 5 min; si se mantiene, sigue sumando. */
function StepButton({ symbol, accessibilityLabel, disabled, onStep }: StepButtonProps) {
  const latest = useRef(onStep);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = onStep;
  });

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const repeat = () => {
    latest.current();
    timer.current = setTimeout(repeat, 90);
  };

  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  useEffect(() => stop, []);

  return (
    <Pressable
      onPress={() => latest.current()}
      onLongPress={repeat}
      onPressOut={stop}
      delayLongPress={350}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.stepSymbol} allowFontScaling={false}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  step: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSymbol: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '300',
    includeFontPadding: false,
  },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '500',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  hintStrong: {
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  preset: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  presetSelected: {
    backgroundColor: colors.moonSoft,
    borderColor: colors.moon,
  },
  presetText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  presetTextSelected: {
    color: colors.moon,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
});
