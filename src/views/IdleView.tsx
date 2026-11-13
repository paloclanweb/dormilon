import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LastRunIssue, TimerPermissions } from '../../modules/sleep-timer';
import { getApp, type AppId } from '../apps';
import { AppPicker } from '../components/AppPicker';
import { Button } from '../components/Button';
import { EndSequenceCard } from '../components/EndSequenceCard';
import { Header } from '../components/Header';
import { LastRunCard, lastRunFailed } from '../components/LastRunCard';
import { MinutePicker } from '../components/MinutePicker';
import { SetupCard } from '../components/SetupCard';
import { formatDuration } from '../format';
import { useNow } from '../hooks';
import { isReady } from '../permissions';
import { colors } from '../theme';

type Props = {
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  appId: AppId;
  onAppChange: (id: AppId) => void;
  installed: Record<AppId, boolean>;
  restoreVolume: boolean;
  onRestoreVolumeChange: (value: boolean) => void;
  permissions: TimerPermissions;
  lastFinishedAt: number;
  lastScheduledAt: number;
  lastScreenOff: boolean;
  lastIssues: LastRunIssue[];
  onStart: () => void;
  onTest: () => void;
  onEnableAccessibility: () => void;
  onOpenAppDetails: () => void;
  onEnableNotifications: () => void;
  onOpenBattery: () => void;
};

export function IdleView(props: Props) {
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const app = getApp(props.appId);
  const appAvailable = props.installed[props.appId];
  const ready = isReady(props.permissions);
  const canLock = props.permissions.accessibility && props.permissions.canLockScreen;

  const setup = (
    <SetupCard
      permissions={props.permissions}
      onEnableAccessibility={props.onEnableAccessibility}
      onOpenAppDetails={props.onOpenAppDetails}
      onEnableNotifications={props.onEnableNotifications}
      onOpenBattery={props.onOpenBattery}
    />
  );

  const lastRun = (
    <LastRunCard
      finishedAt={props.lastFinishedAt}
      scheduledAt={props.lastScheduledAt}
      screenOff={props.lastScreenOff}
      issues={props.lastIssues}
      now={now}
      permissions={props.permissions}
      onOpenBattery={props.onOpenBattery}
      onOpenAppDetails={props.onOpenAppDetails}
      onEnableAccessibility={props.onEnableAccessibility}
    />
  );
  // Si la última vez falló, se explica lo primero; si fue bien, basta una línea al final.
  const lastFailed = lastRunFailed(props.lastIssues);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Header subtitle="Apaga YouTube o Netflix cuando te duermas" />

        {lastFailed ? lastRun : null}

        {/* Mientras falte algo importante, va lo primero */}
        {!ready ? setup : null}

        <MinutePicker value={props.minutes} onChange={props.onMinutesChange} now={now} />
        <AppPicker selectedId={props.appId} installed={props.installed} onSelect={props.onAppChange} />
        <EndSequenceCard
          appName={app.name}
          canLock={canLock}
          restoreVolume={props.restoreVolume}
          onRestoreVolumeChange={props.onRestoreVolumeChange}
        />

        {ready ? setup : null}

        {!lastFailed ? lastRun : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Button
          variant="primary"
          label={appAvailable ? `Empezar y abrir ${app.name}` : `${app.name} no está instalada`}
          detail={appAvailable ? formatDuration(props.minutes) : undefined}
          onPress={props.onStart}
          disabled={!appAvailable}
        />
        <Button
          variant="ghost"
          compact
          label="Probar ahora en 20 segundos"
          accessibilityHint={`Abre ${app.name}, baja el volumen y bloquea el móvil en 20 segundos`}
          onPress={props.onTest}
          disabled={!appAvailable}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 4,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
