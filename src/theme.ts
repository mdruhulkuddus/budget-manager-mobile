import type { BarStatus } from './lib/calc';

export const colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E3E6EA',
  text: '#1B1F24',
  textMuted: '#6B7280',
  primary: '#208AEF',
  onPrimary: '#FFFFFF',
  ok: '#22A35A',
  warn: '#E5A400',
  over: '#D93A3A',
  overSoft: '#FDECEC',
  done: '#22A35A',
  progress: '#208AEF',
  track: '#E9ECF0',
} as const;

/** Bar / label color per status: expense ok·warn·over, saving progress·done. */
export const statusColor: Record<BarStatus, string> = {
  ok: colors.ok,
  warn: colors.warn,
  over: colors.over,
  progress: colors.progress,
  done: colors.done,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export const fontSize = {
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
} as const;
