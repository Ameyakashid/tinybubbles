import type { SettingsSyncPreferences } from '@tinybubbles/core';

/**
 * Parent-flavour default for the settings-sync groups.
 *
 * The parent app and the child's device share one sync namespace, and settings
 * groups sync by default (absent = on, sync-merge-settings.ts). Task data
 * crossing over is the whole point; the parent's theme, text size and language
 * hopping onto the child's device is not — each surface keeps its own register
 * (the kid app's "Sunlit Rockpool" vs the parent's full UI). So the parent
 * flavour opts its device out of the appearance and language groups once, on
 * first run. Only groups the user has never set are touched, and a marker key
 * keeps this from ever overriding a later manual choice.
 */

export const PARENT_SYNC_DEFAULTS_APPLIED_KEY = 'tinybubbles:parent:sync-defaults:v1';

const DEVICE_LOCAL_GROUPS = ['appearance', 'language'] as const;

/** Returns the preferences to write, or null when nothing needs changing. */
export function computeParentSyncPreferenceDefaults(
    current: SettingsSyncPreferences | undefined,
): SettingsSyncPreferences | null {
    const next: SettingsSyncPreferences = { ...(current ?? {}) };
    let changed = false;
    for (const group of DEVICE_LOCAL_GROUPS) {
        if (next[group] === undefined) {
            next[group] = false;
            changed = true;
        }
    }
    return changed ? next : null;
}

export function wereParentSyncDefaultsApplied(storage: Storage): boolean {
    try {
        return storage.getItem(PARENT_SYNC_DEFAULTS_APPLIED_KEY) !== null;
    } catch {
        // No storage — treat as applied so we never loop trying.
        return true;
    }
}

export function markParentSyncDefaultsApplied(storage: Storage): void {
    try {
        storage.setItem(PARENT_SYNC_DEFAULTS_APPLIED_KEY, new Date().toISOString());
    } catch {
        // Best effort; worst case the no-op compute runs again next launch.
    }
}
