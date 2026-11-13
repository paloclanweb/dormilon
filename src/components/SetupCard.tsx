import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TimerPermissions } from '../../modules/sleep-timer';
import { batteryRequired, isReady, isXiaomi } from '../permissions';
import { colors, radius } from '../theme';
import { Button } from './Button';
import { CheckBadge } from './Marks';

type Props = {
  permissions: TimerPermissions;
  onEnableAccessibility: () => void;
  onOpenAppDetails: () => void;
  onEnableNotifications: () => void;
  onOpenBattery: () => void;
};

/**
 * Lo que hace falta activar una vez. Con todo listo se queda en una línea. La batería es opcional,
 * salvo en las marcas que cierran apps en segundo plano (Xiaomi y compañía).
 */
export function SetupCard({
  permissions,
  onEnableAccessibility,
  onOpenAppDetails,
  onEnableNotifications,
  onOpenBattery,
}: Props) {
  const [showRestrictedHelp, setShowRestrictedHelp] = useState(false);
  const lockStopped = permissions.accessibilityStopped;
  const xiaomi = isXiaomi(permissions);
  const batteryNeeded = batteryRequired(permissions);

  if (isReady(permissions)) {
    return (
      <View style={styles.readyCard}>
        <View style={styles.readyRow}>
          <CheckBadge />
          <Text style={styles.readyText}>Listo para bajar el volumen, cerrar la app y bloquear el móvil.</Text>
        </View>
        {!permissions.batteryUnrestricted ? (
          <View style={styles.batteryRow}>
            <Text style={styles.batteryText}>
              Opcional: quita el ahorro de batería si alguna vez no se apaga a su hora.
            </Text>
            <Button label="Ajustar" onPress={onOpenBattery} compact variant="secondary" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Para que funcione cada noche</Text>

      <SetupItem
        done={permissions.accessibility}
        title={lockStopped ? 'El bloqueo está parado' : 'Bloquear el móvil al terminar'}
        text={
          lockStopped
            ? `Está activado, pero Android lo ha parado${xiaomi ? ' (Xiaomi lo hace al cerrar la app en segundo plano)' : ''}, y así no puede salir de la app ni bloquear. Entra en «Dormilón», desactívalo y vuelve a activarlo.`
            : permissions.canLockScreen
              ? 'Android solo deja apagar la pantalla desde una app a través de Accesibilidad. Busca «Dormilón» y actívalo. No lee nada de lo que ves.'
              : 'Con Accesibilidad puede salir de la app al terminar. Tu versión de Android no deja bloquear la pantalla: se apagará sola.'
        }
        action={lockStopped ? 'Reactivar' : 'Activar'}
        onAction={onEnableAccessibility}
      >
        {!permissions.accessibility && !lockStopped ? (
          showRestrictedHelp ? (
            <View style={styles.help}>
              <Text style={styles.helpText}>
                Si instalaste el APK a mano, Android lo bloquea la primera vez: abre la información de la app,
                toca ⋮ arriba a la derecha y elige «Permitir ajustes restringidos». Después vuelve a activarlo.
              </Text>
              <Button label="Información de la app" onPress={onOpenAppDetails} compact />
            </View>
          ) : (
            <Pressable onPress={() => setShowRestrictedHelp(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>¿Sale como «ajuste restringido»?</Text>
            </Pressable>
          )
        ) : null}
      </SetupItem>

      <SetupItem
        done={permissions.notifications}
        title="Cuenta atrás en las notificaciones"
        text="Para ver cuánto queda y añadir tiempo o cancelar sin abrir la app."
        action="Permitir"
        onAction={onEnableNotifications}
      />

      <SetupItem
        done={permissions.batteryUnrestricted}
        optional={!batteryNeeded}
        title="Sin ahorro de batería"
        text={
          xiaomi
            ? 'Xiaomi cierra Dormilón en segundo plano y entonces no baja el volumen ni bloquea a su hora. Quita el ahorro de batería y activa también «Inicio automático».'
            : batteryNeeded
              ? 'Tu móvil cierra las apps en segundo plano y entonces no se apagaría a su hora.'
              : 'Recomendado en Xiaomi, Huawei u Oppo, que cierran apps en segundo plano.'
        }
        action="Ajustar"
        onAction={onOpenBattery}
        last
      >
        {xiaomi && !permissions.batteryUnrestricted ? <AutostartLink onPress={onOpenAppDetails} /> : null}
      </SetupItem>
    </View>
  );
}

/** El «Inicio automático» de Xiaomi está en la información de la app; no se puede comprobar desde aquí. */
function AutostartLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.link}>Abrir información de la app para «Inicio automático»</Text>
    </Pressable>
  );
}

type ItemProps = {
  done: boolean;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  optional?: boolean;
  last?: boolean;
  children?: ReactNode;
};

function SetupItem({ done, title, text, action, onAction, optional, last, children }: ItemProps) {
  return (
    <View style={[styles.item, last && styles.itemLast]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitle, done && styles.itemTitleDone]}>
          {title}
          {optional && !done ? <Text style={styles.optional}> · opcional</Text> : null}
        </Text>
        {done ? <CheckBadge /> : <Button label={action} onPress={onAction} compact variant="secondary" />}
      </View>
      {!done ? <Text style={styles.itemText}>{text}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.moon,
    padding: 20,
  },
  title: {
    color: colors.moon,
    fontSize: 14,
    fontWeight: '700',
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  itemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  itemTitleDone: {
    color: colors.textMuted,
  },
  optional: {
    color: colors.textSubtle,
    fontWeight: '400',
  },
  itemText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    color: colors.moon,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  help: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    padding: 12,
    gap: 10,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  readyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readyText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  batteryText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
