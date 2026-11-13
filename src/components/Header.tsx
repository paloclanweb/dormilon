import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { Moon } from './Marks';

export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Moon size={30} />
      <View style={styles.text}>
        <Text style={styles.title} accessibilityRole="header">
          Dormilón
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  text: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
});
