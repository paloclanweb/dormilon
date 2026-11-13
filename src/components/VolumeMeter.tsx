import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

const BARS = 14;

/** Barras de volumen: se van apagando durante la bajada. `level` va de 0 a 1. */
export function VolumeMeter({ level }: { level: number }) {
  const lit = Math.ceil(Math.min(1, Math.max(0, level)) * BARS);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Volumen al ${Math.round(level * 100)} %`}
    >
      {Array.from({ length: BARS }, (_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { height: 6 + (index / (BARS - 1)) * 22 },
            index < lit ? styles.barOn : styles.barOff,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    height: 28,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  barOn: {
    backgroundColor: colors.moon,
  },
  barOff: {
    backgroundColor: colors.border,
  },
});
