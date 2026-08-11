import { describe, expect, it } from 'vitest';
import { resolveThemeColorScheme, STATUS_COLORS_BY_THEME, getStatusColor } from './theme-scheme';
import type { AppTheme, TaskStatus } from './types';

const TASK_STATUSES: TaskStatus[] = ['inbox', 'next', 'waiting', 'someday', 'reference', 'done', 'archived'];
const THEME_STATUS_KEYS = ['light', 'dark', 'nord', 'sepia', 'eink', 'oled', 'catppuccin-macchiato', 'dracula'] as const;

describe('resolveThemeColorScheme', () => {
    it('classifies each concrete theme regardless of system scheme', () => {
        const darkThemes: AppTheme[] = ['dark', 'nord', 'oled', 'material3-dark', 'catppuccin-macchiato', 'dracula'];
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

    it('gives catppuccin-macchiato and dracula bespoke hues drawn from their own palettes', () => {
        expect(STATUS_COLORS_BY_THEME['catppuccin-macchiato'].next.text).toBe('#8aadf4');
        expect(STATUS_COLORS_BY_THEME['catppuccin-macchiato'].someday.text).toBe('#c6a0f6');
        expect(STATUS_COLORS_BY_THEME['catppuccin-macchiato'].done.text).toBe('#a6da95');
        expect(STATUS_COLORS_BY_THEME.dracula.next.text).toBe('#bd93f9');
        expect(STATUS_COLORS_BY_THEME.dracula.reference.text).toBe('#8be9fd');
        expect(STATUS_COLORS_BY_THEME.dracula.done.text).toBe('#50fa7b');
    });

    it('keeps every status distinguishable within each new theme', () => {
        for (const key of ['catppuccin-macchiato', 'dracula'] as const) {
            // archived deliberately mirrors inbox, as it does in every other theme.
            const hues = TASK_STATUSES.filter((status) => status !== 'archived')
                .map((status) => STATUS_COLORS_BY_THEME[key][status].text);
            expect(new Set(hues).size).toBe(hues.length);
            expect(STATUS_COLORS_BY_THEME[key].archived).toEqual(STATUS_COLORS_BY_THEME[key].inbox);
        }
    });
});
