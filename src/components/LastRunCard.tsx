import { StyleSheet, Text, View } from 'react-native';

import type { LastRunIssue, TimerPermissions } from '../../modules/sleep-timer';
import { formatClock, formatLastRun } from '../format';
import { isXiaomi } from '../permissions';
import { colors, radius } from '../theme';
import { Button } from './Button';

type Props = {
  finishedAt: number;
  scheduledAt: number;
  screenOff: boolean;
  issues: LastRunIssue[];
  now: number;
  permissions: TimerPermissions;
  onOpenBattery: () => void;
  onOpenAppDetails: () => void;
  onEnableAccessibility: () => void;
};

/** Una llamada no es un fallo: solo se pausa a propósito. */
export const lastRunFailed = (issues: LastRunIssue[]) => issues.some((issue) => issue !== 'call');

/** Cómo fue la última vez. Si algo falló, dice qué y cómo evitarlo. */
export function LastRunCard({ finishedAt, scheduledAt, screenOff, issues, now, permissions, ...actions }: Props) {
  if (finishedAt <= 0) return null;
  const when = formatLastRun(finishedAt, now);

  if (!lastRunFailed(issues)) {
    return (
      <Text style={styles.summary}>
        {issues.includes('call')
          ? `La última vez se pausó ${when} sin bloquear el móvil, porque estabas en una llamada.`
          : screenOff
            ? `La última vez se apagó ${when} y la pantalla quedó apagada.`
            : `La última vez se pausó ${when}, pero la pantalla siguió encendida.`}
      </Text>
    );
  }

  const failures = issues.filter((issue) => issue !== 'call');
  const fix = fixFor(failures, permissions, actions);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>
        {failures.includes('missed') ? 'La última vez no se apagó' : `La última vez (${when}) algo falló`}
      </Text>
      {failures.map((issue) => (
        <Text key={issue} style={styles.item}>
          {describe(issue, finishedAt, scheduledAt, now)}
        </Text>
      ))}
      {fix ? (
        <View style={styles.fix}>
          <Text style={styles.fixText}>{fix.text}</Text>
          {fix.action ? <Button label={fix.action.label} onPress={fix.action.onPress} compact /> : null}
        </View>
      ) : null}
    </View>
  );
}

function describe(issue: LastRunIssue, finishedAt: number, scheduledAt: number, now: number): string {
  switch (issue) {
    case 'missed':
      return `Android cerró Dormilón antes de la hora (${formatLastRun(scheduledAt, now)}) y no lo dejó volver: no bajó el volumen, ni cerró la app, ni bloqueó el móvil.`;
    case 'late':
      return `Android tuvo Dormilón parado: tocaba a las ${formatClock(scheduledAt)} y no pudo hasta las ${formatClock(finishedAt)}, sin bajar antes el volumen.`;
    case 'lockStopped':
      return 'El permiso de Accesibilidad seguía activado, pero Android lo había parado: no pudo salir de la app ni bloquear el móvil.';
    case 'lockOff':
      return 'Sin el permiso de Accesibilidad no pudo salir de la app ni bloquear el móvil.';
    case 'volume':
      return 'Android no dejó bajar el volumen.';
    case 'volumeDnd':
      return 'Android no dejó bajar el volumen con «No molestar» activado.';
    case 'call':
      return 'Estabas en una llamada, así que solo se pausó.';
  }
}

type Fix = { text: string; action?: { label: string; onPress: () => void } };

/** El arreglo más importante. Si Android cierra la app, eso va primero: también para el bloqueo. */
function fixFor(
  failures: LastRunIssue[],
  permissions: TimerPermissions,
  actions: Pick<Props, 'onOpenBattery' | 'onOpenAppDetails' | 'onEnableAccessibility'>,
): Fix | null {
  const appDetails = { label: 'Abrir información de la app', onPress: actions.onOpenAppDetails };
  const xiaomi = isXiaomi(permissions);

  if (failures.includes('missed') || failures.includes('late')) {
    if (xiaomi) {
      return {
        text: 'Para que no vuelva a pasar, en la información de la app activa «Inicio automático» y pon «Ahorro de batería» en «Sin restricciones».',
        action: appDetails,
      };
    }
    if (!permissions.batteryUnrestricted) {
      return {
        text: 'Para que no vuelva a pasar, quita el ahorro de batería a Dormilón.',
        action: { label: 'Ajustar', onPress: actions.onOpenBattery },
      };
    }
    return {
      text: 'Para que no vuelva a pasar, revisa en la información de la app que Android no la restrinja en segundo plano.',
      action: appDetails,
    };
  }

  if (failures.includes('lockStopped')) {
    if (permissions.accessibilityStopped) {
      return {
        text: 'Sigue parado: entra en Accesibilidad, desactiva Dormilón y vuelve a activarlo.',
        action: { label: 'Reactivar', onPress: actions.onEnableAccessibility },
      };
    }
    return xiaomi
      ? {
          text: 'Ya vuelve a funcionar. Para que Android no lo pare otra vez, activa «Inicio automático».',
          action: appDetails,
        }
      : null;
  }

  if (failures.includes('lockOff') && !permissions.accessibility) {
    return {
      text: 'Actívalo para que bloquee el móvil al terminar.',
      action: { label: 'Activar', onPress: actions.onEnableAccessibility },
    };
  }

  if (failures.includes('volumeDnd')) {
    return { text: 'Si vuelve a pasar, prueba con «No molestar» desactivado.' };
  }

  return null;
}

const styles = StyleSheet.create({
  summary: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  item: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  fix: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
    alignItems: 'flex-start',
  },
  fixText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
