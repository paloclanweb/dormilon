import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Texto pequeño a la derecha (p. ej. «45 min»). */
  detail?: string;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  detail,
  disabled = false,
  compact = false,
  accessibilityHint,
  style,
}: Props) {
  const palette = PALETTES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: palette.ripple }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.content, detail ? styles.contentSplit : null]}>
        <Text style={[styles.label, compact && styles.labelCompact, { color: palette.text }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={[styles.detail, { color: palette.text }]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const PALETTES: Record<Variant, { background: string; border: string; text: string; ripple: string }> = {
  primary: { background: colors.moon, border: colors.moon, text: colors.moonInk, ripple: 'rgba(0,0,0,0.12)' },
  secondary: {
    background: colors.surfaceHigh,
    border: colors.border,
    text: colors.text,
    ripple: 'rgba(255,255,255,0.08)',
  },
  ghost: { background: 'transparent', border: 'transparent', text: colors.textMuted, ripple: 'rgba(255,255,255,0.06)' },
  danger: { background: colors.dangerSoft, border: 'transparent', text: colors.danger, ripple: 'rgba(255,147,132,0.12)' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  contentSplit: {
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  labelCompact: {
    fontSize: 14,
  },
  detail: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
