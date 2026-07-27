/**
 * Single source of truth for "is this theme dark, and what colors does it use?"
 *
 * Desktop, mobile, and the iOS widget each need to answer this from an `AppTheme`
 * value (see types.ts) plus, for 'system', the platform's actual light/dark
 * preference. Keep that classification here — do not re-derive it per platform.
 */
import type { AppTheme, TaskStatus } from './types';

export type ThemeColorScheme = 'light' | 'dark';

/** The four themes with a bespoke, non-Material color identity. */
export type ThemeStatusPreset = 'eink' | 'nord' | 'sepia' | 'oled';

export type StatusColorSet = { bg: string; text: string; border: string };
export type StatusPalette = Record<TaskStatus, StatusColorSet>;

const DARK_THEMES = new Set<AppTheme>(['dark', 'nord', 'oled', 'material3-dark']);
const LIGHT_THEMES = new Set<AppTheme>(['light', 'eink', 'sepia', 'material3-light']);

/**
 * Resolves an `AppTheme` to the color scheme it renders in. `'system'` (and any
 * value this function doesn't recognize) defers to `systemScheme`.
 */
export function resolveThemeColorScheme(theme: AppTheme, systemScheme: ThemeColorScheme): ThemeColorScheme {
    if (DARK_THEMES.has(theme)) return 'dark';
    if (LIGHT_THEMES.has(theme)) return 'light';
    return systemScheme;
}

const TASK_STATUSES: TaskStatus[] = ['inbox', 'next', 'waiting', 'someday', 'reference', 'done', 'archived'];

/** Badge tone from a single hue: translucent background, solid text/border. */
export const tone = (hex: string): StatusColorSet => ({ bg: `${hex}26`, text: hex, border: hex });

const buildPalette = (hues: Record<TaskStatus, string>): StatusPalette => {
    const palette = {} as StatusPalette;
    for (const status of TASK_STATUSES) palette[status] = tone(hues[status]);
    return palette;
};

/**
 * Standard task colors for each status, tuned for light backgrounds.
 * Used for badges, borders, and highlights across the app.
 */
export const STATUS_COLORS: StatusPalette = {
    'inbox': { bg: '#6B728020', text: '#6B7280', border: '#6B7280' },
    'next': { bg: '#3B82F620', text: '#2563EB', border: '#2563EB' },
    'waiting': { bg: '#F59E0B20', text: '#F59E0B', border: '#F59E0B' },
    'someday': { bg: '#8B5CF620', text: '#8B5CF6', border: '#8B5CF6' },
    'reference': { bg: '#0EA5E920', text: '#0EA5E9', border: '#0EA5E9' },
    'done': { bg: '#22C55E20', text: '#22C55E', border: '#22C55E' },
    'archived': { bg: '#6B728020', text: '#6B7280', border: '#6B7280' },
};

export function getStatusColor(status: TaskStatus): StatusColorSet {
    return STATUS_COLORS[status] || STATUS_COLORS['inbox'];
}

const DARK_STATUS_COLORS = buildPalette({
    inbox: '#9CA3AF',
    next: '#60A5FA',
    waiting: '#FBBF24',
    someday: '#A78BFA',
    reference: '#38BDF8',
    done: '#4ADE80',
    archived: '#9CA3AF',
});

// Nord frost/aurora hues so badges sit inside the theme's own palette.
const NORD_STATUS_COLORS = buildPalette({
    inbox: '#81A1C1',
    next: '#88C0D0',
    waiting: '#EBCB8B',
    someday: '#B48EAD',
    reference: '#8FBCBB',
    done: '#A3BE8C',
    archived: '#81A1C1',
});

// Earthy tones on cream; mirrors desktop's sepia --status-* values.
const SEPIA_STATUS_COLORS = buildPalette({
    inbox: '#9C6F3C',
    next: '#509550',
    waiting: '#C38E22',
    someday: '#8C5EBA',
    reference: '#2E8CB8',
    done: '#725A5A',
    archived: '#9C6F3C',
});

const EINK_STATUS_COLORS = buildPalette({
    inbox: '#000000',
    next: '#000000',
    waiting: '#000000',
    someday: '#000000',
    reference: '#000000',
    done: '#000000',
    archived: '#000000',
});

/**
 * Status badge palette for every theme scheme/preset mobile and desktop support.
 * `oled` has no bespoke hue set of its own — it's dark mode with a black
 * background, so it reuses `dark`'s palette rather than inventing new colors.
 */
export const STATUS_COLORS_BY_THEME: Record<ThemeStatusPreset | ThemeColorScheme, StatusPalette> = {
    light: STATUS_COLORS,
    dark: DARK_STATUS_COLORS,
    nord: NORD_STATUS_COLORS,
    sepia: SEPIA_STATUS_COLORS,
    eink: EINK_STATUS_COLORS,
    oled: DARK_STATUS_COLORS,
};
