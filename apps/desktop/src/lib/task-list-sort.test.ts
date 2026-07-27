import { describe, expect, it } from 'vitest';
import { resolveDoneTaskSortBy, resolveNonDoneTaskSortBy } from './task-list-sort';

describe('task list sort preferences', () => {
    it('keeps legacy completion sorting in Done and out of every ordinary view', () => {
        expect(resolveDoneTaskSortBy('completed')).toBe('completed');
        expect(resolveNonDoneTaskSortBy('completed')).toBe('default');
    });

    it('keeps the device-local Done preference separate from the synced ordinary preference', () => {
        expect(resolveDoneTaskSortBy('title', 'completed')).toBe('completed');
        expect(resolveDoneTaskSortBy('title')).toBe('default');
        expect(resolveNonDoneTaskSortBy('title')).toBe('title');
    });
});
