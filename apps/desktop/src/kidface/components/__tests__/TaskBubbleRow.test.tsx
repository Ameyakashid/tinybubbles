import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Task } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { CelebrationProvider } from '../CelebrationContext';
import { TaskBubbleRow } from '../TaskBubbleRow';

const baseTask: Task = {
    id: 'task-1',
    title: 'Brush teeth',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
};

const renderRow = (props: {
    task?: Task;
    onToggle?: (task: Task) => void;
    onOpen?: (task: Task) => void;
}) => render(
    <LanguageProvider>
        <CelebrationProvider>
            <TaskBubbleRow
                task={props.task ?? baseTask}
                onToggle={props.onToggle ?? vi.fn()}
                onOpen={props.onOpen ?? vi.fn()}
            />
        </CelebrationProvider>
    </LanguageProvider>
);

describe('TaskBubbleRow', () => {
    it('opens the task when the title area is clicked', () => {
        const onOpen = vi.fn();
        renderRow({ onOpen });

        fireEvent.click(screen.getByRole('button', { name: 'Open Brush teeth' }));

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
    });

    it('completes the task when the checkbox is clicked without opening', () => {
        vi.useFakeTimers();
        const onToggle = vi.fn();
        const onOpen = vi.fn();
        renderRow({ onToggle, onOpen });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));

        // The toggle is queued so the completion burst can play before the row unmounts.
        expect(onToggle).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
        expect(onOpen).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('commits the toggle if the row unmounts during the completion burst', () => {
        vi.useFakeTimers();
        const onToggle = vi.fn();
        const { unmount } = renderRow({ onToggle });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));
        expect(onToggle).not.toHaveBeenCalled();

        act(() => {
            unmount();
        });

        expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
        vi.useRealTimers();
    });

    it('shows checklist progress when the task has checklist items', () => {
        const task: Task = {
            ...baseTask,
            checklist: [
                { id: 'item-1', title: 'Get toothbrush', isCompleted: true },
                { id: 'item-2', title: 'Put toothpaste on', isCompleted: false },
            ],
        };
        renderRow({ task });

        expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    it('shows the focus star when the task is focused today', () => {
        const task: Task = { ...baseTask, isFocusedToday: true };
        renderRow({ task });

        expect(screen.getByLabelText('Focused today')).toBeInTheDocument();
    });

    it('shows the pulse ring only when the task is focused today', () => {
        const { rerender } = renderRow({ task: baseTask });

        expect(screen.queryByTestId('focus-pulse-ring')).not.toBeInTheDocument();

        rerender(
            <LanguageProvider>
                <CelebrationProvider>
                    <TaskBubbleRow
                        task={{ ...baseTask, isFocusedToday: true }}
                        onToggle={vi.fn()}
                        onOpen={vi.fn()}
                    />
                </CelebrationProvider>
            </LanguageProvider>,
        );

        expect(screen.getByTestId('focus-pulse-ring')).toBeInTheDocument();
        expect(screen.getByTestId('focus-pulse-ring')).toHaveClass('kidface-pulse-ring-slow');
    });

    it('keeps the open-row touch target at least 88px tall', () => {
        renderRow({});

        expect(screen.getByRole('button', { name: 'Open Brush teeth' })).toHaveClass('min-h-[88px]');
    });
});
