import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  appName: string;
  canLock: boolean;
  restoreVolume: boolean;
  onRestoreVolumeChange: (value: boolean) => void;
};

/** Qué pasa al llegar la hora, en el orden en que pasa. */
export function EndSequenceCard({ appName, canLock, restoreVolume, onRestoreVolumeChange }: Props) {
  const steps = [
    { title: 'Último minuto', text: 'El volumen baja poco a poco hasta silenciarse.' },
    { title: `Se cierra ${appName}`, text: 'Se pausa la reproducción y sale de la app.' },
    canLock
      ? { title: 'Se bloquea el móvil', text: 'La pantalla se apaga. Desbloqueas como siempre.' }
      : { title: 'La pantalla se apaga sola', text: 'Activa el bloqueo para que se apague al momento.' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Al llegar la hora</Text>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.node, index === steps.length - 1 && styles.nodeLast]}>
                <Text style={styles.nodeText}>{index + 1}</Text>
              </View>
              {index < steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Recuperar el volumen después</Text>
          <Text style={styles.toggleHint}>
            Cuando ya no suena nada, lo deja como estaba para mañana. Las alarmas no se tocan.
          </Text>
        </View>
        <Switch
          value={restoreVolume}
          onValueChange={onRestoreVolumeChange}
          trackColor={{ false: colors.borderStrong, true: colors.moon }}
          thumbColor={restoreVolume ? colors.text : colors.textMuted}
          accessibilityLabel="Recuperar el volumen después"
        />
      </View>
    </View>
  );
}

const NODE = 24;

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
  steps: {
    marginTop: 14,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    width: NODE,
    alignItems: 'center',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: colors.moonSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLast: {
    backgroundColor: colors.moon,
  },
  nodeText: {
    color: colors.moon,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 14,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 14,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: NODE,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
