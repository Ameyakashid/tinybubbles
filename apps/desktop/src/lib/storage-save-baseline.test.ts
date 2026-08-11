import { describe, expect, it } from 'vitest';
import type { AppData } from '@tinybubbles/core';
import {
    advanceSaveProvenance,
    buildChangedEntityBaseline,
    rebaseQueuedSettings,
} from './storage-save-baseline';

const snapshot = (): AppData => ({
    tasks: [
        { id: 'task-changed', title: 'Task', attachments: [{ id: 'old' }] },
        { id: 'task-unchanged', title: 'Same' },
    ],
    projects: [{ id: 'project-removed', title: 'Removed' }],
    sections: [],
    areas: [{ id: 'area-unchanged', title: 'Area' }],
    people: [],
    settings: {},
}) as unknown as AppData;

describe('buildChangedEntityBaseline', () => {
    it('includes originals for nested changes and omissions only', () => {
        const baseline = snapshot();
        const target = {
            ...baseline,
            tasks: [
                { ...baseline.tasks[0], attachments: [] },
                baseline.tasks[1],
                { id: 'task-new', title: 'New' },
            ],
            projects: [],
        } as unknown as AppData;

        expect(buildChangedEntityBaseline(baseline, target)).toEqual({
            tasks: [baseline.tasks[0]],
            projects: [baseline.projects[0]],
            observedEntityIds: {
                tasks: ['task-changed', 'task-unchanged'],
                projects: ['project-removed'],
                sections: [],
                areas: ['area-unchanged'],
                people: [],
            },
        });
    });

    it('records observed rows even when they are unchanged', () => {
        const baseline = snapshot();
        expect(buildChangedEntityBaseline(baseline, baseline)).toEqual({
            observedEntityIds: {
                tasks: ['task-changed', 'task-unchanged'],
                projects: ['project-removed'],
                sections: [],
                areas: ['area-unchanged'],
                people: [],
            },
        });
    });

    it('includes the original settings document when settings changed', () => {
        const baseline = snapshot();
        const target = {
            ...baseline,
            settings: { theme: 'dark' },
        } as AppData;

        expect(buildChangedEntityBaseline(baseline, target)).toEqual({
            settings: baseline.settings,
            observedEntityIds: {
                tasks: ['task-changed', 'task-unchanged'],
                projects: ['project-removed'],
                sections: [],
                areas: ['area-unchanged'],
                people: [],
            },
        });
    });
});

describe('advanceSaveProvenance', () => {
    it('promotes only confirmed target rows while retaining conflicting same-revision originals', () => {
        const original = { id: 'task-original', title: 'Original', rev: 1 };
        const local = { ...original, title: 'Local' };
        const conflict = { ...original, title: 'External' };
        const created = { id: 'task-created', title: 'Created', rev: 1 };
        const canonicalCreated = {
            ...created,
            showFutureRecurrence: false,
            isFocusedToday: false,
            suppressTinyBubblesReminders: false,
        };
        const provenance = {
            tasks: [original], projects: [], sections: [], areas: [], people: [], settings: {},
        } as unknown as AppData;
        const attempted = {
            ...provenance,
            tasks: [local, created],
        } as AppData;
        const canonical = {
            ...provenance,
            tasks: [conflict, canonicalCreated],
        } as AppData;

        expect(advanceSaveProvenance(provenance, attempted, canonical).tasks).toEqual([
            original,
            canonicalCreated,
        ]);
    });
});

describe('rebaseQueuedSettings', () => {
    it('merges stable-id arrays without erasing concurrent additions or edits', () => {
        const rootA = { id: 'a', name: 'A', icon: 'root' };
        const rootDelete = { id: 'delete', name: 'Delete' };
        const rootConflictDelete = { id: 'keep', name: 'Keep' };
        const localA = { ...rootA, name: 'Local A' };
        const localAdd = { id: 'local', name: 'Local add' };
        const canonicalA = { ...rootA, icon: 'canonical' };
        const canonicalKeep = { ...rootConflictDelete, name: 'Concurrent keep' };
        const canonicalAdd = { id: 'canonical', name: 'Canonical add' };

        expect(rebaseQueuedSettings(
            { savedFilters: [rootA, rootDelete, rootConflictDelete] } as any,
            { savedFilters: [localA, localAdd] } as any,
            { savedFilters: [canonicalA, rootDelete, canonicalKeep, canonicalAdd] } as any,
        )).toEqual({
            savedFilters: [
                { ...localA, icon: 'canonical' },
                canonicalKeep,
                canonicalAdd,
                localAdd,
            ],
        });
    });

    it('preserves a same-leaf canonical conflict while applying an independent nested change', () => {
        expect(rebaseQueuedSettings(
            { theme: 'light', ai: { model: 'root', thinkingBudget: 1 } } as any,
            { theme: 'dark', ai: { model: 'root', thinkingBudget: 2 } } as any,
            { theme: 'system', ai: { model: 'canonical', thinkingBudget: 1 } } as any,
        )).toEqual({
            theme: 'system',
            ai: { model: 'canonical', thinkingBudget: 2 },
        });
    });
});
