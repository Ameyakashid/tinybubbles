import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@mindwtr/core';

import { useCalendarViewController } from './useCalendarViewController';

const mocks = vi.hoisted(() => {
  const alert = vi.fn();
  return {
    alert,
    storeState: {
      tasks: [] as Task[],
      _allTasks: null as Task[] | null,
      projects: [] as any[],
      areas: [] as any[],
      settings: { calendar: {}, weekStart: 'sunday' } as any,
      addProject: vi.fn(async () => null),
      addTask: vi.fn(async () => ({ success: true, id: 'task-new' })),
      updateTask: vi.fn(async () => ({ success: true })),
      deleteTask: vi.fn(async () => ({ success: true })),
      updateSettings: vi.fn(async () => undefined),
    },
  };
});

vi.mock('@mindwtr/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mindwtr/core')>();
  return {
    ...actual,
    shallow: (a: unknown, b: unknown) => a === b,
    useTaskStore: (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
  };
});

vi.mock('react-native', async () => {
  const actual = await vi.importActual<any>('react-native');
  return {
    ...actual,
    Alert: { ...actual.Alert, alert: mocks.alert },
  };
});

vi.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
}));

vi.mock('../../../contexts/theme-context', () => ({
  useTheme: () => ({ isDark: false, themePreset: 'default' }),
}));

vi.mock('../../../contexts/toast-context', () => ({
  useToast: () => ({ showToast: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('../../../contexts/language-context', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({}),
}));

vi.mock('@/hooks/use-mobile-area-filter', () => ({
  useMobileAreaFilter: () => ({
    areaById: new Map(),
    resolvedAreaFilter: '__all__',
  }),
}));

vi.mock('../../../lib/external-calendar', () => ({
  canOpenExternalCalendarEvent: () => false,
  fetchExternalCalendarEvents: vi.fn(async () => ({ calendars: [], events: [] })),
  openExternalCalendarEvent: vi.fn(async () => false),
}));

vi.mock('../../../lib/app-log', () => ({
  logError: vi.fn(async () => null),
}));

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-recurring-daily',
  title: 'Daily standup',
  status: 'next',
  tags: [],
  contexts: [],
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

/** Bare host so the hook can be exercised without rendering the whole
 *  (much heavier) calendar-view screen -- this repo has no renderHook
 *  helper for mobile, so the host component stands in for one. */
function ControllerHost({ onResult }: { onResult: (value: ReturnType<typeof useCalendarViewController>) => void }) {
  const controller = useCalendarViewController();
  onResult(controller);
  return null;
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useCalendarViewController recurrence range projection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T14:48:00.000Z'));
    mocks.storeState.tasks = [];
    mocks.storeState._allTasks = null;
    mocks.storeState.updateTask.mockClear();
    mocks.storeState.deleteTask.mockClear();
    mocks.alert.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('paints a daily recurring task into every visible day of the month, read-only', async () => {
    mocks.storeState.tasks = [
      makeTask({ dueDate: '2026-04-02', recurrence: 'daily', showFutureRecurrence: true }),
    ];

    let controller!: ReturnType<typeof useCalendarViewController>;
    await act(async () => {
      create(<ControllerHost onResult={(value) => { controller = value; }} />);
    });
    await flush();

    // The real occurrence (the task on its own dueDate, 04-02) plus a
    // projected occurrence for every remaining day of April.
    const paintedDays: { date: number; hasReal: boolean; hasProjected: boolean }[] = [];
    for (let day = 2; day <= 30; day += 1) {
      const items = controller.getCalendarItemsForDate(new Date(2026, 3, day));
      const taskItems = items.filter((item): item is Extract<typeof item, { task: Task }> => 'task' in item);
      paintedDays.push({
        date: day,
        hasReal: taskItems.some((item) => item.task.id === 'task-recurring-daily'),
        hasProjected: taskItems.some((item) => item.task.id.startsWith('task-recurring-daily:projected-recurrence:')),
      });
    }

    expect(paintedDays.find((entry) => entry.date === 2)?.hasReal).toBe(true);
    const projectedDayCount = paintedDays.filter((entry) => entry.hasProjected).length;
    // Every remaining day of the visible month should have its own projected
    // occurrence -- a range, not a single "next occurrence" preview.
    expect(projectedDayCount).toBeGreaterThan(20);

    // Read-only: acting on a projected occurrence is a no-op / explanatory
    // alert, never a write to the store.
    const projectedItem = controller.getCalendarItemsForDate(new Date(2026, 3, 10))
      .find((item): item is Extract<typeof item, { task: Task }> => 'task' in item && item.task.id.startsWith('task-recurring-daily:projected-recurrence:'));
    expect(projectedItem).toBeDefined();

    await act(async () => {
      controller.commitTaskDrag(projectedItem!.task.id, Date.now(), 60, 30);
    });
    expect(mocks.storeState.updateTask).not.toHaveBeenCalled();

    await act(async () => {
      controller.openTaskActions(projectedItem!.task.id);
    });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    expect(mocks.storeState.updateTask).not.toHaveBeenCalled();
    expect(mocks.storeState.deleteTask).not.toHaveBeenCalled();
  });
});
