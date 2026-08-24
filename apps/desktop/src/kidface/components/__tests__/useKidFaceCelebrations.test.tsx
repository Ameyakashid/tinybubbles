import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import type { Task } from '@tinybubbles/core';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { useKidFaceCelebrations } from '../../useKidFaceCelebrations';

function buildTask(overrides: Partial<Task> & { id: string; title: string }): Task {
    const now = new Date();
    return {
        status: 'next',
        tags: [],
        contexts: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...overrides,
    };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
);

describe('useKidFaceCelebrations', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState({ _allTasks: [], settings: {} });
        });
    });

    it('returns no celebrations when there are no completions', () => {
        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toEqual([]);
    });

    it('celebrates the first completion and variety of days', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({
                        id: 'task-1',
                        title: 'Brush teeth',
                        status: 'done',
                        completedAt: new Date().toISOString(),
                    }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toContain('You finished your first thing!');
        expect(result.current.items).toContain('You have finished things on 1 different days.');
    });

    it('celebrates a day with many completions', () => {
        const now = new Date();
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'One', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Two', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-3', title: 'Three', status: 'done', completedAt: now.toISOString() }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toContain('You finished 3 things today!');
        expect(result.current.items).toContain('You have finished things on 1 different days.');
    });

    it('celebrates a gentle streak of consecutive days', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Today', status: 'done', completedAt: today.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Yesterday', status: 'done', completedAt: yesterday.toISOString() }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toContain('You have finished things 2 days in a row.');
    });

    it('keeps the streak current when today is empty but yesterday had completions', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Yesterday', status: 'done', completedAt: yesterday.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Two days ago', status: 'done', completedAt: twoDaysAgo.toISOString() }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toContain('You have finished things 2 days in a row.');
    });

    it('shows longest run or variety after a gap, never a broken streak', () => {
        const today = new Date();
        const fourDaysAgo = new Date(today);
        fourDaysAgo.setDate(today.getDate() - 4);
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(today.getDate() - 5);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Four days ago', status: 'done', completedAt: fourDaysAgo.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Five days ago', status: 'done', completedAt: fiveDaysAgo.toISOString() }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        const joined = result.current.items.join(' ');
        expect(joined).not.toMatch(/broken/i);
        expect(joined).not.toMatch(/0/);
        expect(joined).not.toMatch(/streak.*ended/i);
        expect(result.current.items.some((item) => item.includes('2 days') || item.includes('different days'))).toBe(true);
    });

    it('ignores deleted tasks', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({
                        id: 'task-1',
                        title: 'Done',
                        status: 'done',
                        completedAt: new Date().toISOString(),
                        deletedAt: new Date().toISOString(),
                    }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        expect(result.current.items).toEqual([]);
    });

    it('never returns a percentage or expected-level string', () => {
        const now = new Date();
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'One', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Two', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-3', title: 'Three', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-4', title: 'Four', status: 'done', completedAt: now.toISOString() }),
                ],
            });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        const joined = result.current.items.join(' ');
        expect(joined).not.toContain('%');
        expect(joined).not.toMatch(/average/i);
        expect(joined).not.toMatch(/expected/i);
    });

    it('does not mutate the task list', () => {
        const tasks = [
            buildTask({ id: 'task-1', title: 'One', status: 'done', completedAt: new Date().toISOString() }),
        ];

        act(() => {
            useTaskStore.setState({ _allTasks: tasks });
        });

        const { result } = renderHook(() => useKidFaceCelebrations(), { wrapper });

        // Force a recompute by re-rendering.
        expect(result.current.items.length).toBeGreaterThan(0);
        expect(tasks[0].status).toBe('done');
        expect(tasks[0].completedAt).toBeTruthy();
    });
});
