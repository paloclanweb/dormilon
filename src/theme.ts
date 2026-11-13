/**
 * Paleta de noche: la app se usa a oscuras, así que fondo casi negro, texto cálido y acento
 * color luna (ámbar) en lugar de azules, que deslumbran más.
 */
export const colors = {
  bg: '#0C0E13',
  surface: '#14171F',
  surfaceHigh: '#1C2029',
  border: '#272C38',
  borderStrong: '#3A4050',
  text: '#F1EDE6',
  textMuted: '#ABA69D',
  textSubtle: '#8C877F',
  moon: '#F4C979',
  moonInk: '#2B1F08',
  moonSoft: 'rgba(244, 201, 121, 0.12)',
  danger: '#FF9384',
  dangerSoft: 'rgba(255, 147, 132, 0.10)',
  ok: '#8FD6A6',
  okSoft: 'rgba(143, 214, 166, 0.12)',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
