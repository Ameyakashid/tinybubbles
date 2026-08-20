import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTaskStore, type Task } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { OpenTaskView } from '../OpenTaskView';

const baseTask: Task = {
    id: 'task-1',
    title: 'Brush teeth',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
};

const renderView = (props: {
    task?: Task;
    onClose?: () => void;
    onToggleTask?: (task: Task) => void;
    onToggleChecklistItem?: (taskId: string, itemId: string) => void;
}) => render(
    <LanguageProvider>
        <OpenTaskView
            task={props.task ?? baseTask}
            onClose={props.onClose ?? vi.fn()}
            onToggleTask={props.onToggleTask ?? vi.fn()}
            onToggleChecklistItem={props.onToggleChecklistItem ?? vi.fn()}
        />
    </LanguageProvider>
);

describe('OpenTaskView', () => {
    it('renders the task title and a back button', () => {
        renderView({});

        expect(screen.getByRole('dialog', { name: 'Brush teeth' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Brush teeth')).toBeInTheDocument();
    });

    it('lets the child fix the task title', async () => {
        const updateTask = vi.spyOn(useTaskStore.getState(), 'updateTask');
        renderView({});

        const input = screen.getByLabelText('Task title') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Brush teeth really well' } });
        fireEvent.blur(input);

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith('task-1', { title: 'Brush teeth really well' });
        });
    });

    it('lets the child add their own checklist step', async () => {
        const updateTask = vi.spyOn(useTaskStore.getState(), 'updateTask');
        renderView({});

        const input = screen.getByLabelText('Add a step');
        fireEvent.change(input, { target: { value: 'Rinse mouth' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith(
                'task-1',
                expect.objectContaining({
                    checklist: expect.arrayContaining([
                        expect.objectContaining({ title: 'Rinse mouth', isCompleted: false }),
                    ]),
                }),
            );
        });
    });

    it('calls onClose when the back button is clicked', () => {
        const onClose = vi.fn();
        renderView({ onClose });

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed', () => {
        const onClose = vi.fn();
        renderView({ onClose });

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onToggleTask when the main checkbox is clicked', () => {
        const onToggleTask = vi.fn();
        renderView({ onToggleTask });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Brush teeth as done' }));

        expect(onToggleTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
    });

    it('renders checklist items and calls onToggleChecklistItem when one is clicked', () => {
        const onToggleChecklistItem = vi.fn();
        const task: Task = {
            ...baseTask,
            checklist: [
                { id: 'item-1', title: 'Get toothbrush', isCompleted: false },
                { id: 'item-2', title: 'Put toothpaste on', isCompleted: true },
            ],
        };
        renderView({ task, onToggleChecklistItem });

        expect(screen.getByText('Get toothbrush')).toBeInTheDocument();
        expect(screen.getByText('Put toothpaste on')).toBeInTheDocument();
        expect(screen.getByText('1 / 2')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Get toothbrush' }));

        expect(onToggleChecklistItem).toHaveBeenCalledWith('task-1', 'item-1');
    });

    it('exposes each checklist item as a checkbox with an aria-checked state', () => {
        const task: Task = {
            ...baseTask,
            checklist: [
                { id: 'item-1', title: 'Get toothbrush', isCompleted: false },
                { id: 'item-2', title: 'Put toothpaste on', isCompleted: true },
            ],
        };
        renderView({ task });

        expect(screen.getByRole('checkbox', { name: 'Get toothbrush' })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('checkbox', { name: 'Put toothpaste on' })).toHaveAttribute('aria-checked', 'true');
    });

    it('shows a friendly empty state when the task has no checklist', () => {
        renderView({});

        expect(screen.getByText('Nothing to check off — just do it.')).toBeInTheDocument();
    });

    it('shows a focus star when the task is focused today', () => {
        const task: Task = { ...baseTask, isFocusedToday: true };
        renderView({ task });

        expect(screen.getByLabelText('Focused today')).toBeInTheDocument();
    });

    it('moves focus into the sheet on open', () => {
        renderView({});

        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('keeps Tab cycling inside the sheet', () => {
        renderView({});

        const back = screen.getByRole('button', { name: 'Back' });
        const last = screen.getByLabelText('Add a step');

        back.focus();
        fireEvent.keyDown(back, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();

        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(back).toHaveFocus();
    });

    it('restores focus to the opener when the sheet closes', () => {
        const trigger = document.createElement('button');
        document.body.append(trigger);
        trigger.focus();

        const onClose = vi.fn();
        const { unmount } = renderView({ onClose });

        unmount();

        expect(trigger).toHaveFocus();
        trigger.remove();
    });
});
