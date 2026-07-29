import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Project, Task } from '@mindwtr/core';
import { safeFormatDate, useTaskStore } from '@mindwtr/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../contexts/language-context';
import { KeybindingProvider } from '../../contexts/keybinding-context';
import { useUiStore } from '../../store/ui-store';
import { ArchiveView } from './ArchiveView';

const initialTaskState = useTaskStore.getState();
const initialUiState = useUiStore.getState();

const archivedTask: Task = {
    id: 'task-1',
    title: 'Archived task',
    status: 'archived',
    tags: [],
    contexts: [],
    completedAt: '2026-05-12T08:30:00.000Z',
    createdAt: '2026-05-10T08:30:00.000Z',
    updatedAt: '2026-05-12T08:30:00.000Z',
};

const archivedProject: Project = {
    id: 'project-1',
    title: 'Archived project',
    status: 'archived',
    color: '#6B7280',
    order: 0,
    tagIds: [],
    createdAt: '2026-05-01T08:30:00.000Z',
    updatedAt: '2026-05-11T08:30:00.000Z',
};

describe('ArchiveView', () => {
    beforeEach(() => {
        // The list filter criteria and the group/sort axes live in the shared UI
        // store, so a test that picks one would otherwise narrow every test after it.
        useUiStore.setState(initialUiState, true);
        useTaskStore.setState(initialTaskState, true);
        useTaskStore.setState({
            tasks: [],
            _allTasks: [archivedTask],
            _tasksById: new Map([[archivedTask.id, archivedTask]]),
            projects: [],
            _allProjects: [],
            settings: {},
        });
    });

    it('shows the archived task completion date and time', () => {
        const completionLabel = safeFormatDate(archivedTask.completedAt, 'Pp');

        const { getByText } = render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        expect(getByText('Archived task')).toBeInTheDocument();
        expect(getByText(`Completed: ${completionLabel}`)).toBeInTheDocument();
    });

    it('moves an archived task to Trash instead of purging it', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByTitle('Delete'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deletedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(deletedTask?.deletedAt).toBeTruthy();
            expect(deletedTask?.purgedAt).toBeUndefined();
        });
    });

    it('bulk restores selected archived tasks to Inbox', async () => {
        const secondArchivedTask: Task = {
            ...archivedTask,
            id: 'task-2',
            title: 'Second archived task',
        };
        useTaskStore.setState({
            _allTasks: [archivedTask, secondArchivedTask],
            _tasksById: new Map([
                [archivedTask.id, archivedTask],
                [secondArchivedTask.id, secondArchivedTask],
            ]),
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('button', { name: /Select all/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Restore to Inbox' }));

        await waitFor(() => {
            expect(useTaskStore.getState()._tasksById.get(archivedTask.id)?.status).toBe('inbox');
            expect(useTaskStore.getState()._tasksById.get(secondArchivedTask.id)?.status).toBe('inbox');
        });
    });

    it('bulk moves selected archived tasks back to Done without changing completion time', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Archived task' }));
        fireEvent.click(screen.getByRole('button', { name: 'Move to Done' }));

        await waitFor(() => {
            const movedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(movedTask?.status).toBe('done');
            expect(movedTask?.completedAt).toBe(archivedTask.completedAt);
        });
    });

    it('bulk moves selected archived tasks to Trash', async () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Archived task' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deletedTask = useTaskStore.getState()._tasksById.get(archivedTask.id);
            expect(deletedTask?.deletedAt).toBeTruthy();
            expect(deletedTask?.purgedAt).toBeUndefined();
        });
    });

    it('lists archived projects when the Projects segment is selected', () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        expect(screen.queryByText('Archived project')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        expect(screen.getByText('Archived project')).toBeInTheDocument();
    });

    it('shows the projects empty state when there are no archived projects', () => {
        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        expect(screen.getByText('No archived projects')).toBeInTheDocument();
    });

    it('restores an archived project via updateProject with active status', async () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.click(screen.getByTitle('Restore project'));

        await waitFor(() => {
            const restored = useTaskStore.getState()._allProjects.find((p) => p.id === archivedProject.id);
            expect(restored?.status).toBe('active');
            expect(restored?.deletedAt).toBeUndefined();
        });
    });

    it('soft-deletes an archived project after confirmation', async () => {
        useTaskStore.setState({
            projects: [archivedProject],
            _allProjects: [archivedProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.click(screen.getByTitle('Delete'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            const deleted = useTaskStore.getState()._allProjects.find((p) => p.id === archivedProject.id);
            expect(deleted?.deletedAt).toBeTruthy();
            expect(deleted?.purgedAt).toBeUndefined();
        });
    });

    // Archive registered no task-list scope at all, so every key that works in
    // the seven other lists silently did nothing here.
    describe('keyboard scope', () => {
        const secondTask: Task = { ...archivedTask, id: 'task-2', title: 'Second archived task' };

        const renderWithKeys = () => {
            useTaskStore.setState({
                _allTasks: [archivedTask, secondTask],
                _tasksById: new Map([
                    [archivedTask.id, archivedTask],
                    [secondTask.id, secondTask],
                ]),
                settings: { keybindingStyle: 'vim' },
            });
            return render(
                <LanguageProvider>
                    <KeybindingProvider currentView="archived" onNavigate={vi.fn()}>
                        <ArchiveView />
                    </KeybindingProvider>
                </LanguageProvider>
            );
        };

        const focusedTaskId = () => (
            document.activeElement instanceof HTMLElement
                ? document.activeElement.closest<HTMLElement>('[data-task-id]')?.dataset.taskId
                : undefined
        );

        it('moves between archived rows with j/k', () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 'j' });
            expect(focusedTaskId()).toBe(secondTask.id);

            fireEvent.keyDown(window, { key: 'k' });
            expect(focusedTaskId()).toBe(archivedTask.id);
        });

        it('opens the completion-time editor with e', () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 'e' });

            expect(screen.getByRole('dialog')).toHaveTextContent('Completion time');
        });

        it('moves the selected task to another status with an s-chord', async () => {
            renderWithKeys();

            fireEvent.keyDown(window, { key: 's' });
            fireEvent.keyDown(window, { key: 'n' });

            await waitFor(() => {
                expect(useTaskStore.getState()._tasksById.get(archivedTask.id)?.status).toBe('next');
            });
        });

        it('does not act on archived tasks while the projects segment is showing', () => {
            renderWithKeys();

            fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
            fireEvent.keyDown(window, { key: 'j' });

            expect(focusedTaskId()).toBeUndefined();
        });
    });

    describe('filter, sort and grouping toolbar', () => {
        const homeTask: Task = {
            ...archivedTask,
            id: 'task-2',
            title: 'Tidy the garage',
            contexts: ['@home'],
            projectId: 'project-9',
            completedAt: '2026-05-14T08:30:00.000Z',
            updatedAt: '2026-05-14T08:30:00.000Z',
        };
        const activeProject: Project = {
            ...archivedProject,
            id: 'project-9',
            title: 'House',
            status: 'active',
        };

        const renderWithBoth = () => {
            useTaskStore.setState({
                _allTasks: [archivedTask, homeTask],
                _tasksById: new Map([
                    [archivedTask.id, archivedTask],
                    [homeTask.id, homeTask],
                ]),
                projects: [activeProject],
                _allProjects: [activeProject],
            });
            return render(
                <LanguageProvider>
                    <ArchiveView />
                </LanguageProvider>
            );
        };

        const rowTitles = () => Array.from(document.querySelectorAll('[data-task-id] h3')).map((el) => el.textContent);

        const pickOption = (selectName: string, optionName: string) => {
            fireEvent.click(screen.getByRole('combobox', { name: selectName }));
            fireEvent.click(screen.getByRole('option', { name: optionName }));
        };

        it('narrows the archive to a context picked in the Filters panel', () => {
            renderWithBoth();

            fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
            fireEvent.click(screen.getByRole('button', { name: /@home/ }));

            expect(screen.getByText('Tidy the garage')).toBeInTheDocument();
            expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
            expect(screen.getByText('1 tasks')).toBeInTheDocument();
        });

        // The criteria are one selection shared by every desktop list (#956), so
        // a token picked in Next can be active here while matching nothing
        // archived. Without the union the panel would list no chip to switch it
        // back off and the archive would look empty for no visible reason.
        it('offers a token set in another view even when nothing archived matches it', () => {
            useUiStore.setState((state) => ({
                listFilters: { ...state.listFilters, criteria: { contexts: ['@office'] } },
            }));
            renderWithBoth();

            expect(rowTitles()).toEqual([]);

            fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
            fireEvent.click(screen.getByRole('button', { name: /@office/ }));

            expect(rowTitles()).toHaveLength(2);
        });

        it('defaults to newest completion first and re-sorts by title on request', () => {
            renderWithBoth();

            expect(rowTitles()).toEqual(['Tidy the garage', 'Archived task']);

            pickOption('Sort', 'Title');

            expect(rowTitles()).toEqual(['Archived task', 'Tidy the garage']);
        });

        it('groups archived tasks by the chosen axis', () => {
            renderWithBoth();

            expect(screen.queryByText('House')).not.toBeInTheDocument();

            pickOption('Group', 'Project');

            expect(screen.getByText('House')).toBeInTheDocument();
            expect(screen.getByText('No Project')).toBeInTheDocument();
        });

        it('keeps the toolbar out of the Projects segment', () => {
            renderWithBoth();

            fireEvent.click(screen.getByRole('button', { name: 'Projects' }));

            expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
            expect(screen.queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument();
        });
    });

    it('filters archived projects by title search', () => {
        const secondProject: Project = { ...archivedProject, id: 'project-2', title: 'Second archived project' };
        useTaskStore.setState({
            projects: [archivedProject, secondProject],
            _allProjects: [archivedProject, secondProject],
        });

        render(
            <LanguageProvider>
                <ArchiveView />
            </LanguageProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
        fireEvent.change(screen.getByPlaceholderText('Search archived projects...'), {
            target: { value: 'Second' },
        });

        expect(screen.getByText('Second archived project')).toBeInTheDocument();
        expect(screen.queryByText('Archived project')).not.toBeInTheDocument();
    });
});
