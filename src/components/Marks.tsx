import { StyleSheet, Text, View } from 'react-native';

import type { AppId } from '../apps';
import { colors } from '../theme';

type MoonProps = { size?: number; color?: string; background?: string };

/** Luna creciente: un círculo tapado por otro del color del fondo sobre el que va. */
export function Moon({ size = 28, color = colors.moon, background = colors.bg }: MoonProps) {
  const cut = size * 0.8;
  return (
    <View
      style={{ width: size, height: size, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      <View
        style={[
          styles.disc,
          {
            width: cut,
            height: cut,
            borderRadius: cut / 2,
            backgroundColor: background,
            top: -size * 0.12,
            left: size * 0.36,
          },
        ]}
      />
    </View>
  );
}

function YouTubeMark({ size }: { size: number }) {
  const height = size * 0.7;
  const triangle = height * 0.44;
  return (
    <View style={[styles.youtube, { width: size, height, borderRadius: height * 0.3 }]}>
      <View
        style={[
          styles.triangle,
          {
            marginLeft: triangle * 0.18,
            borderTopWidth: triangle / 2,
            borderBottomWidth: triangle / 2,
            borderLeftWidth: triangle * 0.86,
          },
        ]}
      />
    </View>
  );
}

function NetflixMark({ size }: { size: number }) {
  return (
    <Text style={[styles.netflix, { fontSize: size * 0.82, lineHeight: size * 0.9 }]} allowFontScaling={false}>
      N
    </Text>
  );
}

/** Marca simplificada de cada app, siempre en una caja de `size` × `size`. */
export function AppMark({ id, size = 40 }: { id: AppId; size?: number }) {
  return (
    <View
      style={[styles.markBox, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {id === 'youtube' ? <YouTubeMark size={size} /> : <NetflixMark size={size} />}
    </View>
  );
}

export function CheckBadge({ size = 22 }: { size?: number }) {
  return (
    <View style={[styles.check, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.checkMark, { fontSize: size * 0.6 }]} allowFontScaling={false}>
        ✓
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  markBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtube: {
    backgroundColor: '#FF0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  netflix: {
    color: '#E50914',
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
  },
  check: {
    backgroundColor: colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: colors.ok,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
