import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Task } from '@tinybubbles/core';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { DoneView } from '../DoneView';

const initialState = useTaskStore.getState();

function buildTask(overrides: Partial<Task> & { id: string; title: string }): Task {
    const now = new Date();
    return {
        status: 'done',
        tags: [],
        contexts: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        completedAt: overrides.completedAt ?? now.toISOString(),
        ...overrides,
    };
}

const renderView = () => render(
    <LanguageProvider>
        <DoneView />
    </LanguageProvider>
);

describe('DoneView', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState(initialState, true);
        });
    });

    it('shows a friendly empty state when nothing is finished', () => {
        renderView();

        expect(screen.getByText('Trophy case')).toBeInTheDocument();
        expect(screen.getByText('No trophies yet')).toBeInTheDocument();
        expect(screen.getByText('Finish something and it will show up here.')).toBeInTheDocument();
    });

    it('renders finished tasks grouped by day', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Brush teeth' }),
                    buildTask({ id: 'task-2', title: 'Make bed', completedAt: yesterday.toISOString() }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Brush teeth')).toBeInTheDocument();
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
        expect(screen.getByText('Make bed')).toBeInTheDocument();
    });

    it('shows a trophy summary when there are finished tasks', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Brush teeth' }),
                    buildTask({ id: 'task-2', title: 'Make bed' }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('2 trophies today')).toBeInTheDocument();
        expect(screen.getByText('2 trophies total')).toBeInTheDocument();
    });

    it('uses singular summary labels for one trophy', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [buildTask({ id: 'task-1', title: 'Brush teeth' })],
            });
        });

        renderView();

        expect(screen.getByText('1 trophy today')).toBeInTheDocument();
        expect(screen.getByText('1 trophy total')).toBeInTheDocument();
    });

    it('puts a task back on the list when undo is clicked', () => {
        const updateTask = vi.spyOn(useTaskStore.getState(), 'updateTask');

        act(() => {
            useTaskStore.setState({
                _allTasks: [buildTask({ id: 'task-1', title: 'Brush teeth' })],
            });
        });

        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Put Brush teeth back on the list' }));

        expect(updateTask).toHaveBeenCalledWith('task-1', { status: 'next', completedAt: undefined });
    });

    it('ignores deleted and unfinished tasks', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Finished' }),
                    buildTask({ id: 'task-2', title: 'Not done', status: 'next', completedAt: undefined }),
                    buildTask({ id: 'task-3', title: 'Deleted', deletedAt: new Date().toISOString() }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('Finished')).toBeInTheDocument();
        expect(screen.queryByText('Not done')).not.toBeInTheDocument();
        expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
    });
});
