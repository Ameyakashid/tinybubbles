import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Task } from '@tinybubbles/core';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { CalendarView } from '../CalendarView';

const initialState = useTaskStore.getState();

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

const renderView = () => render(
    <LanguageProvider>
        <CalendarView />
    </LanguageProvider>,
);

describe('CalendarView', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 3, 3, 12, 0, 0));
        act(() => {
            useTaskStore.setState(initialState, true);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the calendar title and current month', () => {
        renderView();

        expect(screen.getByText('Calendar')).toBeInTheDocument();
        expect(screen.getByText('April 2026')).toBeInTheDocument();
    });

    it('shows short weekday headers', () => {
        renderView();

        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('highlights today in the month grid', () => {
        renderView();

        const todayNumber = screen.getByText('3');
        expect(todayNumber).toHaveClass('bg-primary');
        expect(todayNumber).toHaveClass('text-primary-foreground');
    });

    it('moves to the previous month when the back arrow is pressed', () => {
        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

        expect(screen.getByText('March 2026')).toBeInTheDocument();
    });

    it('moves to the next month when the forward arrow is pressed', () => {
        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

        expect(screen.getByText('May 2026')).toBeInTheDocument();
    });

    it('shows a count chip on a day with a scheduled task', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Swim practice', startTime: '2026-04-05' }),
                ],
            });
        });

        renderView();

        const cell = document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement;
        expect(cell).toBeTruthy();
        expect(cell.querySelector('[data-task-count]')).toHaveTextContent('1');
    });

    it('shows a count chip on a day with a task due that day', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Book report', dueDate: '2026-04-07' }),
                ],
            });
        });

        renderView();

        const cell = document.querySelector('[data-calendar-day="2026-04-07"]') as HTMLElement;
        expect(cell).toBeTruthy();
        expect(cell.querySelector('[data-task-count]')).toHaveTextContent('1');
    });

    it('does not show a count chip for deleted or finished tasks', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-deleted', title: 'Gone', startTime: '2026-04-05', deletedAt: new Date().toISOString() }),
                    buildTask({ id: 'task-done', title: 'Finished', startTime: '2026-04-06', status: 'done', completedAt: new Date().toISOString() }),
                ],
            });
        });

        renderView();

        expect(document.querySelector('[data-calendar-day="2026-04-05"]')?.querySelector('[data-task-count]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-calendar-day="2026-04-06"]')?.querySelector('[data-task-count]')).not.toBeInTheDocument();
    });

    it('caps the count chip at 9+ so ten plans do not look like three', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: Array.from({ length: 12 }, (_, index) =>
                    buildTask({ id: `task-${index}`, title: `Plan ${index}`, startTime: '2026-04-05' }),
                ),
            });
        });

        renderView();

        const cell = document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement;
        expect(cell.querySelector('[data-task-count]')).toHaveTextContent('9+');
    });

    it('announces how many tasks are on a day with plans', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Swim practice', startTime: '2026-04-05' }),
                    buildTask({ id: 'task-2', title: 'Pack bag', startTime: '2026-04-05' }),
                ],
            });
        });

        renderView();

        const cell = document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement;
        expect(cell).toHaveAttribute('aria-label', expect.stringContaining('2 things'));
    });

    it('announces a quiet day when a cell has no tasks', () => {
        renderView();

        const cell = document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement;
        expect(cell).toHaveAttribute('aria-label', expect.stringContaining('nothing to do'));
    });

    it('opens a day plan sheet when a day with tasks is tapped', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Swim practice', startTime: '2026-04-05' }),
                ],
            });
        });

        renderView();

        fireEvent.click(document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement);

        expect(screen.getByRole('dialog', { name: /Sunday, April 5/ })).toBeInTheDocument();
        expect(screen.getByText('Swim practice')).toBeInTheDocument();
    });

    it('opens a day plan sheet with an empty state when a quiet day is tapped', () => {
        renderView();

        fireEvent.click(document.querySelector('[data-calendar-day="2026-04-05"]') as HTMLElement);

        expect(screen.getByRole('dialog', { name: /Sunday, April 5/ })).toBeInTheDocument();
        expect(screen.getByText('No plans for this day.')).toBeInTheDocument();
    });

    it('shows a friendly empty state when the month has no dated tasks', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'No date' }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('No big plans this month.')).toBeInTheDocument();
    });
});
