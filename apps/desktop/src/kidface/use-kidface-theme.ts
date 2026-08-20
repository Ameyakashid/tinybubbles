import { useEffect } from 'react';
import { useTaskStore } from '@tinybubbles/core';
import {
    THEME_STORAGE_KEY,
    applyThemeMode,
    resolveDesktopThemeMode,
    watchSystemThemePreference,
} from '@/lib/theme';

/**
 * Keep the kid face in sync with the user's chosen theme.
 *
 * The stock shell already owns the full theme pipeline; this is a shallow
 * connector that reads the same persisted settings and local-storage override
 * and applies the matching CSS mode. It also watches the system preference when
 * the user has picked "system", so the face follows the device without adding
 * any new theme infra.
 */
export function useKidFaceTheme() {
    const settingsTheme = useTaskStore((state) => state.settings?.theme);

    useEffect(() => {
        const stored = typeof localStorage !== 'undefined'
            ? localStorage.getItem(THEME_STORAGE_KEY)
            : null;
        const mode = resolveDesktopThemeMode(settingsTheme, stored);
        applyThemeMode(mode);

        if (mode !== 'system') return undefined;

        return watchSystemThemePreference((theme) => {
            applyThemeMode('system', theme);
        });
    }, [settingsTheme]);
}
