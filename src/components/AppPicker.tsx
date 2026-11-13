import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TARGET_APPS, type AppId } from '../apps';
import { colors, radius } from '../theme';
import { AppMark } from './Marks';

type Props = {
  selectedId: AppId;
  installed: Record<AppId, boolean>;
  onSelect: (id: AppId) => void;
};

export function AppPicker({ selectedId, installed, onSelect }: Props) {
  return (
    <View style={styles.card} accessibilityRole="radiogroup">
      <Text style={styles.label}>¿Qué vas a ver?</Text>
      <View style={styles.options}>
        {TARGET_APPS.map((app) => {
          const selected = app.id === selectedId;
          const available = installed[app.id];
          return (
            <Pressable
              key={app.id}
              onPress={() => onSelect(app.id)}
              disabled={!available}
              accessibilityRole="radio"
              accessibilityLabel={available ? app.name : `${app.name}, no instalada`}
              accessibilityState={{ selected, disabled: !available }}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
              style={({ pressed }) => [
                styles.option,
                selected && { borderColor: app.brand, backgroundColor: `${app.brand}14` },
                pressed && styles.pressed,
                !available && styles.unavailable,
              ]}
            >
              <View style={[styles.radio, selected && { borderColor: app.brand }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: app.brand }]} /> : null}
              </View>
              <AppMark id={app.id} size={44} />
              <Text style={styles.name}>{app.name}</Text>
              <Text style={styles.status}>{available ? ' ' : 'No instalada'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  options: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  radio: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  status: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  unavailable: {
    opacity: 0.45,
  },
});
