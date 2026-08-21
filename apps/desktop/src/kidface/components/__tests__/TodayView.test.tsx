import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Task } from '@tinybubbles/core';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { CelebrationProvider } from '../CelebrationContext';
import { TodayView } from '../TodayView';

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

const renderView = (props: { onSeeAllDone?: () => void; onSeeCalendar?: () => void } = {}) => render(
    <LanguageProvider>
        <CelebrationProvider>
            <TodayView
                onSeeAllDone={props.onSeeAllDone ?? vi.fn()}
                onSeeCalendar={props.onSeeCalendar ?? vi.fn()}
            />
        </CelebrationProvider>
    </LanguageProvider>,
);

describe('TodayView', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState(initialState, true);
        });
    });

    it('shows open tasks and the done-today section', () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Brush teeth' }),
                    buildTask({ id: 'task-2', title: 'Make bed', status: 'done', completedAt: new Date().toISOString() }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('Brush teeth')).toBeInTheDocument();
        expect(screen.getByText('Done today')).toBeInTheDocument();
        expect(screen.getByText('Make bed')).toBeInTheDocument();
    });

    it('caps done today to the three most recent with a see-all link', () => {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60_000);
        const twoMinutesAgo = new Date(now.getTime() - 120_000);
        const threeMinutesAgo = new Date(now.getTime() - 180_000);
        const fourMinutesAgo = new Date(now.getTime() - 240_000);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'One', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Two', status: 'done', completedAt: oneMinuteAgo.toISOString() }),
                    buildTask({ id: 'task-3', title: 'Three', status: 'done', completedAt: twoMinutesAgo.toISOString() }),
                    buildTask({ id: 'task-4', title: 'Four', status: 'done', completedAt: threeMinutesAgo.toISOString() }),
                    buildTask({ id: 'task-5', title: 'Five', status: 'done', completedAt: fourMinutesAgo.toISOString() }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('One')).toBeInTheDocument();
        expect(screen.getByText('Two')).toBeInTheDocument();
        expect(screen.getByText('Three')).toBeInTheDocument();
        expect(screen.queryByText('Four')).not.toBeInTheDocument();
        expect(screen.queryByText('Five')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'See all 5 done' })).toBeInTheDocument();
    });

    it('calls onSeeAllDone when the see-all button is pressed', () => {
        const onSeeAllDone = vi.fn();
        const now = new Date();

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'One', status: 'done', completedAt: now.toISOString() }),
                    buildTask({ id: 'task-2', title: 'Two', status: 'done', completedAt: new Date(now.getTime() - 60_000).toISOString() }),
                    buildTask({ id: 'task-3', title: 'Three', status: 'done', completedAt: new Date(now.getTime() - 120_000).toISOString() }),
                    buildTask({ id: 'task-4', title: 'Four', status: 'done', completedAt: new Date(now.getTime() - 180_000).toISOString() }),
                ],
            });
        });

        renderView({ onSeeAllDone });

        fireEvent.click(screen.getByRole('button', { name: 'See all 4 done' }));

        expect(onSeeAllDone).toHaveBeenCalled();
    });

    it('shows a gentle undo toast when a task is completed', async () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [buildTask({ id: 'task-1', title: 'Brush teeth' })],
            });
        });

        renderView();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));

        await waitFor(() => {
            expect(screen.getByText('Done! Tap to undo.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
        });
    });

    it('shows an all-done payoff when the last open task is finished', async () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [buildTask({ id: 'task-1', title: 'Brush teeth' })],
            });
        });

        const onSeeAllDone = vi.fn();
        renderView({ onSeeAllDone });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));

        await waitFor(() => {
            expect(screen.getByText('All done!')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'See your trophies' })).toBeInTheDocument();
        });
    });

    it('moves a task into done today when its checkbox is toggled', async () => {
        act(() => {
            useTaskStore.setState({
                _allTasks: [buildTask({ id: 'task-1', title: 'Brush teeth' })],
            });
        });

        renderView();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));

        await waitFor(() => {
            expect(screen.getByText('Done today')).toBeInTheDocument();
            expect(screen.getByText('Brush teeth')).toBeInTheDocument();
        });
    });

    it('shows a scheduled empty state when every open task is planned for the future', () => {
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Future plan', startTime: nextWeek.toISOString() }),
                ],
            });
        });

        renderView();

        expect(screen.getByText('Free today')).toBeInTheDocument();
        expect(screen.getByText('You have 1 thing coming up.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: "See what's coming" })).toBeInTheDocument();
        expect(screen.queryByText('Future plan')).not.toBeInTheDocument();
    });

    it('calls onSeeCalendar when the scheduled-empty action is pressed', () => {
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const onSeeCalendar = vi.fn();

        act(() => {
            useTaskStore.setState({
                _allTasks: [
                    buildTask({ id: 'task-1', title: 'Future plan', startTime: nextWeek.toISOString() }),
                ],
            });
        });

        renderView({ onSeeCalendar });

        fireEvent.click(screen.getByRole('button', { name: "See what's coming" }));

        expect(onSeeCalendar).toHaveBeenCalled();
    });

    it('shows ambient motion behind empty states', () => {
        act(() => {
            useTaskStore.setState({ _allTasks: [] });
        });

        renderView();

        expect(screen.getByTestId('ambient-field')).toBeInTheDocument();
    });

    it('tells the child the Add button is below, not above', () => {
        act(() => {
            useTaskStore.setState({ _allTasks: [] });
        });

        renderView();

        expect(screen.getByText('Tap the big + below if something needs doing.')).toBeInTheDocument();
        expect(screen.queryByText('Tap the big + above if something needs doing.')).not.toBeInTheDocument();
    });
});
