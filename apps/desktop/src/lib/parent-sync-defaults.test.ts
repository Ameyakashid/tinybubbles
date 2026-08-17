import { describe, expect, it } from 'vitest';
import { computeParentSyncPreferenceDefaults } from './parent-sync-defaults';

describe('computeParentSyncPreferenceDefaults', () => {
    it('opts appearance and language out of sync when never set', () => {
        expect(computeParentSyncPreferenceDefaults(undefined)).toEqual({
            appearance: false,
            language: false,
        });
    });

    it('never overrides a choice the user already made', () => {
        expect(computeParentSyncPreferenceDefaults({ appearance: true })).toEqual({
            appearance: true,
            language: false,
        });
    });

    it('leaves other groups untouched and returns null when nothing to do', () => {
        const current = { appearance: false, language: true, gtd: true };
        expect(computeParentSyncPreferenceDefaults(current)).toBeNull();
    });
});
