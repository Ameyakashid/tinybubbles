import { useMemo } from 'react';
import { normalizeWeekStartSetting, useTaskStore } from '@mindwtr/core';

import { useLanguage } from '../contexts/language-context';
import { resolveNativeDateInputLocale } from '../lib/native-date-input-locale';

/**
 * Locale tag and date-format setting that the shared date controls need.
 *
 * Lives in a hook so every surface showing a date field resolves them the same
 * way — the task editor, the quick-action menu, and the completion-time dialog
 * would otherwise each grow their own copy and drift.
 */
export function useNativeDateInputLocale(): {
    nativeDateInputLocale: string;
    dateFormatSetting: string | null | undefined;
} {
    const { language } = useLanguage();
    const dateFormat = useTaskStore((state) => state.settings?.dateFormat);
    const calendarSystem = useTaskStore((state) => state.settings?.calendarSystem);
    const timeFormat = useTaskStore((state) => state.settings?.timeFormat);
    const weekStart = useTaskStore((state) => state.settings?.weekStart);

    const nativeDateInputLocale = useMemo(() => {
        const systemLocale = typeof navigator !== 'undefined'
            ? String(navigator.languages?.[0] || navigator.language || '').trim()
            : '';
        return resolveNativeDateInputLocale({
            language,
            dateFormat,
            calendarSystem,
            timeFormat,
            weekStart: normalizeWeekStartSetting(weekStart),
            systemLocale,
        });
    }, [language, calendarSystem, dateFormat, timeFormat, weekStart]);

    return { nativeDateInputLocale, dateFormatSetting: dateFormat };
}
