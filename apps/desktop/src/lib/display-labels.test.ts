import { describe, expect, it } from 'vitest';

import {
    DISPLAY_LABEL_KEY_CONTRACT,
    DISPLAY_LABEL_TABLES,
    displayLabel,
} from './display-labels';

// A translate function that "knows" one key, like a loaded core locale would.
const tWith = (known: Record<string, string>) => (key: string) => known[key] ?? key;

describe('displayLabel', () => {
    it('overrides English with the kid word', () => {
        const t = tWith({ 'agenda.nextActions': 'Next Actions' });
        expect(displayLabel(t, 'en', 'agenda.nextActions', 'Next Actions')).toBe('To do');
    });

    it('overrides covered locales with their own kid words, not translated English', () => {
        const t = tWith({});
        expect(displayLabel(t, 'de', 'agenda.nextActions', 'Next Actions')).toBe('Zu tun');
        expect(displayLabel(t, 'ja', 'process.btn', 'Process Inbox')).toBe('おかたづけ');
        expect(displayLabel(t, 'zh', 'status.someday', 'Someday')).toBe('以后再说');
        expect(displayLabel(t, 'pt', 'projects.activeSection', 'Active Projects')).toBe('Minhas listas');
    });

    it('falls back per key to the core translation when a locale omits a key', () => {
        // de deliberately omits calendar.deadline — the core word stands.
        const t = tWith({ 'calendar.deadline': 'Fällig' });
        expect(displayLabel(t, 'de', 'calendar.deadline', 'Deadline')).toBe('Fällig');
    });

    it('leaves locales without a table entirely on their core translations', () => {
        // cs / ar / fa / hi / vi have no kid-register table (see DESIGN.md);
        // a wrong-register guess would be worse than the adult word.
        const t = tWith({ 'agenda.nextActions': 'Další kroky' });
        expect(displayLabel(t, 'cs', 'agenda.nextActions', 'Next Actions')).toBe('Další kroky');
        expect(DISPLAY_LABEL_TABLES.cs).toBeUndefined();
        expect(DISPLAY_LABEL_TABLES.ar).toBeUndefined();
        expect(DISPLAY_LABEL_TABLES.fa).toBeUndefined();
        expect(DISPLAY_LABEL_TABLES.hi).toBeUndefined();
        expect(DISPLAY_LABEL_TABLES.vi).toBeUndefined();
    });

    it('uses the fallback string when neither an override nor a translation exists', () => {
        const t = tWith({});
        expect(displayLabel(t, 'sv', 'calendar.deadline', 'Deadline')).toBe('Deadline');
    });

    it('keeps every locale table inside the English key contract', () => {
        // The English table is the roster of surfaces the shell re-words. A key
        // that exists only in a locale table is either a typo or an unreviewed
        // new surface — both should fail loudly here.
        const contractKeys = new Set(Object.keys(DISPLAY_LABEL_KEY_CONTRACT));
        for (const [language, table] of Object.entries(DISPLAY_LABEL_TABLES)) {
            if (!table) continue;
            for (const key of Object.keys(table)) {
                expect(
                    contractKeys.has(key),
                    `${language} overrides '${key}', which is not in the English contract table`,
                ).toBe(true);
            }
        }
    });

    it('gives every override a non-empty value', () => {
        for (const table of Object.values(DISPLAY_LABEL_TABLES)) {
            if (!table) continue;
            for (const value of Object.values(table)) {
                expect(value.trim().length).toBeGreaterThan(0);
            }
        }
    });
});
