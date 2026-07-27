import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Project, Task } from '@mindwtr/core';
import { useTaskStore } from '@mindwtr/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../contexts/language-context';
import { KeybindingProvider } from '../../contexts/keybinding-context';
import { TrashView } from './TrashView';

const initialTaskState = useTaskStore.getState();

const recentTask: Task = {
    id: 'recent-task',
    title: 'Recently deleted task',
    status: 'inbox',
    tags: [],
    contexts: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-13T12:00:00.000Z',
    deletedAt: '2026-07-13T12:00:00.000Z',
};

const olderProject: Project = {
    id: 'older-project',
    title: 'Older deleted project',
    status: 'archived',
    color: '#64748b',
    order: 0,
    tagIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    deletedAt: '2026-07-01T12:00:00.000Z',
};

describe('TrashView', () => {
    beforeEach(() => {
        useTaskStore.setState(initialTaskState, true);
        useTaskStore.setState({
            tasks: [],
            projects: [],
            _allTasks: [recentTask],
            _allProjects: [olderProject],
            _tasksById: new Map([[recentTask.id, recentTask]]),
            settings: {},
        });
    });

    it('shows tasks and projects in one newest-deleted-first timeline', () => {
        const { getByText } = render(
            <LanguageProvider>
                <TrashView />
            </LanguageProvider>
        );

        const taskTitle = getByText(recentTask.title);
        const projectTitle = getByText(olderProject.title);

        expect(taskTitle.compareDocumentPosition(projectTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('bulk restores selected trashed tasks and projects', async () => {
        render(
            <LanguageProvider>
                <TrashView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('button', { name: /Select all/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

        await waitFor(() => {
            expect(useTaskStore.getState()._allTasks.find((task) => task.id === recentTask.id)?.deletedAt).toBeUndefined();
            expect(useTaskStore.getState()._allProjects.find((project) => project.id === olderProject.id)?.deletedAt).toBeUndefined();
        });
    });

    // Trash registered no task-list scope at all, so every key that works in the
    // seven other lists silently did nothing here.
    describe('keyboard scope', () => {
        const olderTask: Task = {
            ...recentTask,
            id: 'older-task',
            title: 'Older deleted task',
            deletedAt: '2026-06-20T12:00:00.000Z',
        };

        const renderWithKeys = () => {
            useTaskStore.setState({
                _allTasks: [recentTask, olderTask],
                _tasksById: new Map([
                    [recentTask.id, recentTask],
                    [olderTask.id, olderTask],
                ]),
                settings: { keybindingStyle: 'vim' },
            });
            return render(
                <LanguageProvider>
                    <KeybindingProvider currentView="trash" onNavigate={vi.fn()}>
                        <TrashView />
                    </KeybindingProvider>
                </LanguageProvider>
            );
        };

        const focusedTaskId = () => (
            document.activeElement instanceof HTMLElement
                ? document.activeElement.closest<HTMLElement>('[data-task-id]')?.dataset.taskId
                : undefined
        );

        it('moves between trashed task rows with j/k, skipping project rows', () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 'j' });
            expect(focusedTaskId()).toBe(olderTask.id);

            fireEvent.keyDown(window, { key: 'k' });
            expect(focusedTaskId()).toBe(recentTask.id);
        });

        it('restores the selected task with e', async () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 'e' });

            await waitFor(() => {
                expect(useTaskStore.getState()._tasksById.get(recentTask.id)?.deletedAt).toBeUndefined();
            });
        });

        // updateTask writes to a tombstone happily, so an unmodified scope would
        // mark a deleted task done / move its status while the row sat unchanged
        // in Trash. Restore and purge are the only writes this view offers.
        it('leaves the status chords unbound rather than mutating a deleted task', () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 's' });
            fireEvent.keyDown(window, { key: 'n' });

            const task = useTaskStore.getState()._tasksById.get(recentTask.id);
            expect(task?.status).toBe('inbox');
            expect(task?.deletedAt).toBe(recentTask.deletedAt);
        });

        it('purges the selected task with dd, after confirmation', async () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 'd' });
            fireEvent.keyDown(window, { key: 'd' });

            fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

            await waitFor(() => {
                expect(useTaskStore.getState()._allTasks.find((task) => task.id === recentTask.id)?.purgedAt).toBeTruthy();
            });
        });
    });

    it('bulk purges selected trashed items after confirmation', async () => {
        render(
            <LanguageProvider>
                <TrashView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('checkbox', { name: `Select ${recentTask.title}` }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Permanently' }));

        await waitFor(() => {
            const purgedTask = useTaskStore.getState()._allTasks.find((task) => task.id === recentTask.id);
            expect(purgedTask?.purgedAt).toBeTruthy();
        });
        // The unselected project stays in the trash untouched.
        expect(useTaskStore.getState()._allProjects.find((project) => project.id === olderProject.id)?.purgedAt).toBeUndefined();
    });
});
