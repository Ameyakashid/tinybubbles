import { describe, expect, it } from 'vitest';
import { resolveThemeColorScheme, STATUS_COLORS_BY_THEME, getStatusColor } from './theme-scheme';
import type { AppTheme, TaskStatus } from './types';

const TASK_STATUSES: TaskStatus[] = ['inbox', 'next', 'waiting', 'someday', 'reference', 'done', 'archived'];
const THEME_STATUS_KEYS = ['light', 'dark', 'nord', 'sepia', 'eink', 'oled'] as const;

describe('resolveThemeColorScheme', () => {
    it('classifies each concrete theme regardless of system scheme', () => {
        const darkThemes: AppTheme[] = ['dark', 'nord', 'oled', 'material3-dark'];
        const lightThemes: AppTheme[] = ['light', 'eink', 'sepia', 'material3-light'];
        for (const theme of darkThemes) {
            expect(resolveThemeColorScheme(theme, 'light')).toBe('dark');
            expect(resolveThemeColorScheme(theme, 'dark')).toBe('dark');
        }
        for (const theme of lightThemes) {
            expect(resolveThemeColorScheme(theme, 'light')).toBe('light');
            expect(resolveThemeColorScheme(theme, 'dark')).toBe('light');
        }
    });

    it('defers to systemScheme for system', () => {
        expect(resolveThemeColorScheme('system', 'dark')).toBe('dark');
        expect(resolveThemeColorScheme('system', 'light')).toBe('light');
    });
});

describe('STATUS_COLORS_BY_THEME', () => {
    it('resolves every theme x status pair to a defined color, including archived and oled', () => {
        for (const key of THEME_STATUS_KEYS) {
            for (const status of TASK_STATUSES) {
                const color = STATUS_COLORS_BY_THEME[key][status];
                expect(color.bg).toBeTruthy();
                expect(color.text).toBeTruthy();
                expect(color.border).toBeTruthy();
            }
        }
    });

    it('keeps light identical to getStatusColor (unchanged public API)', () => {
        for (const status of TASK_STATUSES) {
            expect(STATUS_COLORS_BY_THEME.light[status]).toEqual(getStatusColor(status));
        }
    });

    it('derives oled from dark rather than a bespoke palette', () => {
        expect(STATUS_COLORS_BY_THEME.oled).toEqual(STATUS_COLORS_BY_THEME.dark);
    });
});
