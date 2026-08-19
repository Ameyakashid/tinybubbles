import { useMemo, useRef, useState, useEffect } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import {
    buildTrashTimeline,
    projectMatchesAreaFilterSelection,
    safeFormatDate,
    shallow,
    taskMatchesAreaFilterSelection,
    useTaskStore,
} from '@tinybubbles/core';
import type { Task } from '@tinybubbles/core';
import { Undo2 } from 'lucide-react';
import { useLanguage } from '../../contexts/language-context';
import { displayLabel } from '../../lib/display-labels';
import { useOptionalKeybindings } from '../../contexts/keybinding-context';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { checkBudget } from '../../config/performanceBudgets';
import { createTaskListScope } from './list/task-list-scope';
import { LIST_END_GAP } from './list/list-toolbar';
import { useAreaVisibility } from '../../hooks/useVisibleTaskContext';

// Simplified shell (see DESIGN.md): this page can only RESCUE things. Clear
// Trash, bulk Select, per-row permanent delete, the delete keybinding and the
// search bar are gone — permanent deletion is a parent-app capability, and a
// child's Deleted page offers exactly one action per row: put it back. The
// store's purge machinery is untouched; the parent flavour keeps the full
// view. Restore is always visible (no hover-reveal — tablets have no hover).
export function TrashView() {
    const perf = usePerformanceMonitor('TrashView');
    const {
        _allTasks,
        _allProjects,
        restoreTask,
        restoreProject,
    } = useTaskStore(
        (state) => ({
            _allTasks: state._allTasks,
            _allProjects: state._allProjects,
            restoreTask: state.restoreTask,
            restoreProject: state.restoreProject,
        }),
        shallow
    );
    const { t, language } = useLanguage();
    const { areaById, projectById, resolvedAreaFilter } = useAreaVisibility();

    useEffect(() => {
        if (!perf.enabled) return;
        const timer = window.setTimeout(() => {
            checkBudget('TrashView', perf.metrics, 'simple');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [perf.enabled]);

    // The area filter applies here as it does everywhere else, and as it does
    // on mobile's Trash. `isTaskVisibleInArea` cannot be used: it hides deleted
    // tasks, which are the only ones Trash shows.
    const trashedTasks = useMemo(() => (
        _allTasks.filter((task) => (
            task.deletedAt
            && !task.purgedAt
            && taskMatchesAreaFilterSelection(task, resolvedAreaFilter, projectById, areaById)
        ))
    ), [_allTasks, areaById, projectById, resolvedAreaFilter]);

    const trashedProjects = useMemo(() => (
        _allProjects.filter((project) => (
            project.deletedAt
            && !project.purgedAt
            && projectMatchesAreaFilterSelection(project, resolvedAreaFilter, areaById)
        ))
    ), [_allProjects, areaById, resolvedAreaFilter]);

    const trashItems = useMemo(
        () => buildTrashTimeline(trashedTasks, trashedProjects),
        [trashedProjects, trashedTasks]
    );

    // The scope navigates tasks only, but it walks them in the order they are
    // rendered — the deleted-at timeline, not the raw store order.
    const timelineTasks = useMemo(
        () => trashItems.flatMap((item) => (item.type === 'task' ? [item.task] : [])),
        [trashItems]
    );

    const trashedItemCount = trashItems.length;

    // Trash registers the shared scope by hand instead of through
    // useTaskListScope: `updateTask`/`moveTask` write to a tombstone just fine,
    // so the generic "mark done" and the s-chords would silently mutate a task
    // while its row sat unchanged in Trash. Here the done key restores — the
    // one thing this view does. The delete key is deliberately a no-op: the
    // base scope's delete soft-deletes, which is meaningless on an already
    // deleted row, and the kid shell has no purge to bind it to.
    const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
    const scopeRef = useRef({ timelineTasks, selectedTaskIndex, restoreTask, t });
    scopeRef.current = { timelineTasks, selectedTaskIndex, restoreTask, t };

    const trashScope = useMemo(() => {
        // Same resolution rule as the shared scope: DOM focus wins over the
        // stored index, so the keys act on the row the user is actually on.
        const actingTask = (): Task | null => {
            const { timelineTasks: tasks, selectedTaskIndex: index } = scopeRef.current;
            if (tasks.length === 0) return null;
            const focused = document.activeElement instanceof HTMLElement
                ? document.activeElement.closest<HTMLElement>('[data-task-id]')?.dataset.taskId
                : undefined;
            return tasks.find((task) => task.id === focused)
                ?? tasks[Math.min(Math.max(index, 0), tasks.length - 1)]
                ?? null;
        };
        return {
            ...createTaskListScope({
                getTasks: () => scopeRef.current.timelineTasks,
                getSelectedIndex: () => scopeRef.current.selectedTaskIndex,
                setSelectedIndex: setSelectedTaskIndex,
                t: (key) => scopeRef.current.t(key),
            }),
            toggleDoneSelected: () => {
                const task = actingTask();
                if (task) void scopeRef.current.restoreTask(task.id);
            },
            deleteSelected: () => {
                // Intentionally nothing: no destructive action exists on the
                // kid Deleted page, by keyboard or otherwise.
            },
            setStatusSelected: undefined,
        };
    }, []);

    const keybindings = useOptionalKeybindings();
    const registerTaskListScope = keybindings?.registerTaskListScope;
    useEffect(() => {
        if (!registerTaskListScope) return;
        registerTaskListScope(trashScope);
        return () => registerTaskListScope(null);
    }, [registerTaskListScope, trashScope]);

    const renderDeletedAt = (deletedAt?: string) => (
        deletedAt ? [t('trash.deletedAt'), safeFormatDate(deletedAt, 'P')].join(': ') : null
    );

    const restoreButtonClass = 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

    return (
        <ErrorBoundary>
            <div className={`space-y-6 ${LIST_END_GAP}`} data-list-end>
            <header className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">
                    {displayLabel(t, language, 'nav.trash', 'Deleted')}
                </h2>
                <div className="text-sm text-muted-foreground">
                    {trashedTasks.length} {t('common.tasks')} · {trashedProjects.length}{' '}
                    {displayLabel(t, language, 'projects.title', 'lists')}
                </div>
            </header>

            <div className="space-y-6">
                {trashedItemCount === 0 ? (
                    <div className="px-1 py-8 text-left text-sm text-muted-foreground">
                        <p>{t('trash.noTasksFound')}</p>
                        <p className="text-xs mt-2">{t('trash.emptyHintWithProjects')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {trashItems.map((item) => {
                            if (item.type === 'project') {
                                const { project } = item;
                                return (
                                    <div
                                        key={`project-${project.id}`}
                                        className="rounded-lg px-3 py-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-foreground line-through opacity-70">{project.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('trash.projectType')} · {renderDeletedAt(project.deletedAt)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => restoreProject(project.id)}
                                            className={restoreButtonClass}
                                            title={t('trash.restoreProject')}
                                        >
                                            <Undo2 className="w-4 h-4" aria-hidden="true" />
                                            {t('trash.restore')}
                                        </button>
                                    </div>
                                );
                            }

                            const { task } = item;
                            return (
                                // data-task-id is what the shared task-list scope resolves
                                // keyboard actions against; project rows carry none because
                                // the scope navigates tasks only.
                                <div
                                    key={`task-${task.id}`}
                                    data-task-id={task.id}
                                    className="rounded-lg px-3 py-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <h4 className="font-medium text-foreground line-through opacity-70">{task.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('trash.taskType')} · {renderDeletedAt(task.deletedAt)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => restoreTask(task.id)}
                                        // A trashed task has no editor, so `e` maps to the
                                        // one row action it has.
                                        data-task-edit-trigger
                                        className={restoreButtonClass}
                                        title={t('trash.restore')}
                                    >
                                        <Undo2 className="w-4 h-4" aria-hidden="true" />
                                        {t('trash.restore')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </div>
        </ErrorBoundary>
    );
}
