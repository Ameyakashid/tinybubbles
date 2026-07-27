import { describe, expect, it } from 'vitest';

import { getEnglishI18nValue } from './i18n';
import {
    getSettingsSearchPageEnglishText,
    resolveSettingsSearchI18nKey,
    SETTINGS_SEARCH_MOBILE_EXCLUSIONS,
    SETTINGS_SEARCH_PAGE_KEYS,
    type SettingsSearchPageId,
} from './settings-search-keys';

const ALL_PAGE_IDS = Object.keys(SETTINGS_SEARCH_PAGE_KEYS) as SettingsSearchPageId[];

describe('settings search key roster', () => {
    it('resolves every page key (excluded or not) to a real English string', () => {
        // This is the original bug: a key that exists in the roster but has no
        // translation is worse than a missing key — search looks broken.
        const unresolved: string[] = [];
        for (const keys of Object.values(SETTINGS_SEARCH_PAGE_KEYS)) {
            for (const key of keys) {
                const value = getEnglishI18nValue(resolveSettingsSearchI18nKey(key));
                if (!value || !value.trim()) unresolved.push(key);
            }
        }
        expect(unresolved).toEqual([]);
    });

    it('has no stale exclusion-list entries', () => {
        const known = new Set(Object.values(SETTINGS_SEARCH_PAGE_KEYS).flat());
        for (const [key, reason] of Object.entries(SETTINGS_SEARCH_MOBILE_EXCLUSIONS)) {
            expect(known.has(key), `exclusion "${key}" is not a real page key`).toBe(true);
            expect(reason.trim().length > 0, `exclusion "${key}" needs a reason`).toBe(true);
        }
    });

    // The coverage-direction invariant this task exists for: every key is
    // either accounted for (excluded with a reason) or actually contributes
    // text to its page — never silently neither. Demonstrated below with a
    // synthetic fixture, since the real roster is expected to hold (that's
    // the whole point of the exclusion list) and can't itself exercise the
    // failure path.
    function findUnaccountedKeys(
        keys: readonly string[],
        exclusions: Record<string, string>,
        resolve: (key: string) => string | undefined,
    ): string[] {
        return keys.filter((key) => !(key in exclusions) && !resolve(key));
    }

    it('every real page key is indexed or deliberately excluded', () => {
        for (const pageId of ALL_PAGE_IDS) {
            const unaccounted = findUnaccountedKeys(
                SETTINGS_SEARCH_PAGE_KEYS[pageId],
                SETTINGS_SEARCH_MOBILE_EXCLUSIONS,
                (key) => getEnglishI18nValue(resolveSettingsSearchI18nKey(key)),
            );
            expect(unaccounted, `page "${pageId}" has unaccounted keys`).toEqual([]);
        }
    });

    it('the coverage check actually fails on a key that is neither indexed nor excluded', () => {
        // Mutation test of the checker itself: an unresolvable, non-excluded
        // key must be flagged.
        const fixtureKeys = ['knownGood', 'orphanKey'];
        const fixtureExclusions = {};
        const resolve = (key: string) => (key === 'knownGood' ? 'Known Good' : undefined);
        expect(findUnaccountedKeys(fixtureKeys, fixtureExclusions, resolve)).toEqual(['orphanKey']);

        // Excluding it clears the failure, proving exclusion is the intended escape hatch.
        expect(findUnaccountedKeys(fixtureKeys, { orphanKey: 'test fixture' }, resolve)).toEqual([]);
    });

    it('getSettingsSearchPageEnglishText drops excluded keys and returns real text', () => {
        const gtdText = getSettingsSearchPageEnglishText('gtd');
        expect(gtdText).toContain('Pomodoro timer');
        // 'projectFlowParallel' -> "Parallel" is excluded; must not leak into the text list.
        expect(gtdText).not.toContain('Parallel');
    });
});
