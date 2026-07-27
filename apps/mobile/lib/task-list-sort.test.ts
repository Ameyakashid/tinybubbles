import { describe, expect, it } from 'vitest';
import { resolveDoneTaskSortBy, resolveNonDoneTaskSortBy, resolveTaskListSortBy } from './task-list-sort';

describe('resolveTaskListSortBy', () => {
  it('keeps the legacy completed preference in Done without leaking it after navigation', () => {
    expect(resolveTaskListSortBy({
      globalSortBy: 'completed',
      statusFilter: 'done',
    })).toBe('completed');
    expect(resolveTaskListSortBy({
      globalSortBy: 'completed',
      statusFilter: 'inbox',
    })).toBe('default');
  });

  it('uses a separate Done view preference without changing ordinary lists', () => {
    expect(resolveTaskListSortBy({
      globalSortBy: 'title',
      statusFilter: 'done',
      viewSortBy: 'completed',
    })).toBe('completed');
    expect(resolveTaskListSortBy({
      globalSortBy: 'title',
      statusFilter: 'next',
    })).toBe('title');
    expect(resolveTaskListSortBy({
      globalSortBy: 'title',
      statusFilter: 'done',
    })).toBe('default');
  });

  it('provides explicit helpers for standalone Done and ordinary views', () => {
    expect(resolveDoneTaskSortBy('completed')).toBe('completed');
    expect(resolveDoneTaskSortBy('title', 'completed')).toBe('completed');
    expect(resolveNonDoneTaskSortBy('completed')).toBe('default');
    expect(resolveNonDoneTaskSortBy('title')).toBe('title');
  });
});
