import {
    useState,
    useMemo,
    useEffect,
    useLayoutEffect,
    useRef,
    useCallback,
    type RefObject,
} from 'react';
import { updateRangeSelection } from '@mindwtr/core';
import type {
    StoreActionResult,
    Task,
    TaskPriority,
    TaskStatus,
    TimeEstimate,
    RangeSelectionOptions,
} from '@mindwtr/core';

import { reportError } from '../../../lib/report-error';
import { registerUndoableAction } from '../../../lib/undo-registry';
import type { TaskListScope } from '../../../contexts/keybinding-context';
import { useRegisteredTaskListScope } from './task-list-scope';
import type { NextGroupBy } from './next-grouping';

type ShowToast = (
    message: string,
    tone?: 'success' | 'error' | 'info',
    durationMs?: number,
    action?: { label: string; onClick: () => void }
) => void;

type UseListSelectionOptions = {
    activeNextGroupBy: NextGroupBy;
    addInputRef: RefObject<HTMLInputElement | null>;
    batchDeleteTasks: (taskIds: string[]) => Promise<unknown> | unknown;
    batchMoveTasks: (taskIds: string[], newStatus: TaskStatus) => Promise<unknown> | unknown;
    batchUpdateTasks: (
        updates: Array<{ id: string; updates: Partial<Task> }>
    ) => Promise<unknown> | unknown;
    filteredTasks: Task[];
    highlightTaskId: string | null;
    isProcessing: boolean;
    prioritiesEnabled: boolean;
    registerTaskListScope: (scope: TaskListScope | null) => void;
    restoreTask: (taskId: string) => Promise<StoreActionResult>;
    scrollToVirtualIndex: (index: number, align: 'auto' | 'center') => void;
    selectedPriorities: TaskPriority[];
    selectedTimeEstimates: TimeEstimate[];
    selectedTokens: string[];
    selectedWaitingPerson: string;
    setHighlightTask: (taskId: string | null) => void;
    shouldVirtualize: boolean;
    showToast: ShowToast;
    statusFilter: TaskStatus | 'all';
    t: (key: string) => string;
    tasksById: Map<string, Task>;
    timeEstimatesEnabled: boolean;
    translateWithFallback: (key: string, fallback: string) => string;
    undoNotificationsEnabled: boolean;
};

type UseListSelectionResult = {
    contextPromptMode: 'add' | 'remove';
    contextPromptOpen: boolean;
    exitSelectionMode: () => void;
    handleBatchAddContext: () => void;
    handleBatchAddTag: () => void;
    handleBatchAssignArea: (areaId: string | null) => Promise<void>;
    handleBatchDelete: () => Promise<void>;
    handleBatchMove: (newStatus: TaskStatus) => Promise<void>;
    handleBatchRemoveContext: () => void;
    handleConfirmContextPrompt: (value: string) => Promise<void>;
    handleConfirmTagPrompt: (value: string) => Promise<void>;
    handleSelectIndex: (index: number) => void;
    isBatchDeleting: boolean;
    allVisibleTasksSelected: boolean;
    clearTaskSelection: () => void;
    multiSelectedIds: Set<string>;
    selectedIdsArray: string[];
    selectedIndex: number;
    selectAllVisibleTasks: () => void;
    selectionMode: boolean;
    setContextPromptOpen: (open: boolean) => void;
    setTagPromptOpen: (open: boolean) => void;
    tagPromptOpen: boolean;
    toggleMultiSelect: (taskId: string, options?: RangeSelectionOptions) => void;
    toggleSelectionMode: () => void;
};

export async function restoreDeletedTasksWithFeedback(
    taskIds: string[],
    restoreTask: (taskId: string) => Promise<StoreActionResult>,
    showToast: ShowToast,
): Promise<void> {
    const results = await Promise.allSettled(taskIds.map((taskId) => restoreTask(taskId)));
    const failedRestore = results.find(
        (result): result is PromiseRejectedResult | PromiseFulfilledResult<StoreActionResult> =>
            result.status === 'rejected' || !result.value.success,
    );

    if (!failedRestore) return;

    const message = failedRestore.status === 'rejected'
        ? (failedRestore.reason instanceof Error ? failedRestore.reason.message : 'Failed to restore deleted tasks')
        : (failedRestore.value.error || 'Failed to restore deleted tasks');
    const error = failedRestore.status === 'rejected'
        ? failedRestore.reason
        : new Error(message);

    reportError('Failed to restore deleted tasks', error);
    showToast(message, 'error');
}

export function useListSelection({
    activeNextGroupBy,
    addInputRef,
    batchDeleteTasks,
    batchMoveTasks,
    batchUpdateTasks,
    filteredTasks,
    highlightTaskId,
    isProcessing,
    prioritiesEnabled,
    registerTaskListScope,
    restoreTask,
    scrollToVirtualIndex,
    selectedPriorities,
    selectedTimeEstimates,
    selectedTokens,
    selectedWaitingPerson,
    setHighlightTask,
    shouldVirtualize,
    showToast,
    statusFilter,
    t,
    tasksById,
    timeEstimatesEnabled,
    translateWithFallback,
    undoNotificationsEnabled,
}: UseListSelectionOptions): UseListSelectionResult {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectionMode, setSelectionMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const [tagPromptOpen, setTagPromptOpen] = useState(false);
    const [tagPromptIds, setTagPromptIds] = useState<string[]>([]);
    const [contextPromptOpen, setContextPromptOpen] = useState(false);
    const [contextPromptMode, setContextPromptMode] = useState<'add' | 'remove'>('add');
    const [contextPromptIds, setContextPromptIds] = useState<string[]>([]);
    const [selectionScrollVersion, setSelectionScrollVersion] = useState(0);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const lastFilterKeyRef = useRef('');
    const multiSelectAnchorIdRef = useRef<string | null>(null);
    const pendingSelectionScrollRef = useRef(false);
    // Set by keyboard navigation (selectNext/Prev/First/Last) to request that
    // DOM focus follow the selection. The follow only happens when focus was
    // already inside a task title toggle (checked at settle time), so j/k
    // navigation from the sidebar/body keeps working without focus side effects.
    const pendingSelectionFocusRef = useRef(false);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setMultiSelectedIds(new Set());
        multiSelectAnchorIdRef.current = null;
    }, []);

    const requestSelectionScroll = useCallback(() => {
        pendingSelectionScrollRef.current = true;
        setSelectionScrollVersion((current) => current + 1);
    }, []);

    const selectedIdsArray = useMemo(() => Array.from(multiSelectedIds), [multiSelectedIds]);
    const filteredTaskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks]);
    const selectedVisibleCount = useMemo(
        () => filteredTaskIds.filter((id) => multiSelectedIds.has(id)).length,
        [filteredTaskIds, multiSelectedIds],
    );
    const allVisibleTasksSelected = filteredTaskIds.length > 0 && selectedVisibleCount === filteredTaskIds.length;

    useEffect(() => {
        setMultiSelectedIds((prev) => {
            const visible = new Set(filteredTaskIds);
            const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
            if (next.size === prev.size) return prev;
            return next;
        });
        if (multiSelectAnchorIdRef.current && !filteredTaskIds.includes(multiSelectAnchorIdRef.current)) {
            multiSelectAnchorIdRef.current = null;
        }
    }, [filteredTaskIds]);

    useEffect(() => {
        const filterKey = [
            statusFilter,
            prioritiesEnabled ? '1' : '0',
            timeEstimatesEnabled ? '1' : '0',
            selectedTokens.join('|'),
            selectedPriorities.join('|'),
            selectedTimeEstimates.join('|'),
            selectedWaitingPerson,
            activeNextGroupBy,
        ].join('::');

        if (lastFilterKeyRef.current !== filterKey) {
            lastFilterKeyRef.current = filterKey;
            requestSelectionScroll();
            setSelectedIndex(0);
            exitSelectionMode();
            return;
        }

        if (filteredTasks.length === 0) {
            if (selectedIndex !== 0) {
                setSelectedIndex(0);
            }
            return;
        }

        if (selectedIndex >= filteredTasks.length) {
            requestSelectionScroll();
            setSelectedIndex(filteredTasks.length - 1);
        }
    }, [
        activeNextGroupBy,
        exitSelectionMode,
        filteredTasks,
        prioritiesEnabled,
        requestSelectionScroll,
        selectedIndex,
        selectedPriorities,
        selectedTimeEstimates,
        selectedTokens,
        selectedWaitingPerson,
        statusFilter,
        timeEstimatesEnabled,
    ]);

    useLayoutEffect(() => {
        if (!pendingSelectionScrollRef.current) return;
        pendingSelectionScrollRef.current = false;
        const task = filteredTasks[selectedIndex];
        if (!task) return;

        if (shouldVirtualize) {
            scrollToVirtualIndex(selectedIndex, 'auto');
            return;
        }

        const element = document.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null;
        if (element && typeof (element as { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }).scrollIntoView === 'function') {
            element.scrollIntoView({ block: 'nearest' });
        }
    }, [filteredTasks, scrollToVirtualIndex, selectedIndex, selectionScrollVersion, shouldVirtualize]);

    // Keyboard navigation moves DOM focus to the newly selected task's title
    // toggle so no stale input-looking ring lingers on the previously focused
    // row (#860). We only follow focus when the active element is (or is inside)
    // a task title toggle: navigating from the sidebar/body leaves focus alone.
    // Scrolling is handled by the layout effect above, so we focus with
    // preventScroll to avoid fighting it.
    useLayoutEffect(() => {
        if (!pendingSelectionFocusRef.current) return;
        pendingSelectionFocusRef.current = false;
        if (typeof document === 'undefined') return;

        const active = document.activeElement;
        const activeToggle = active && typeof active.closest === 'function'
            ? (active.closest('[data-task-view-toggle]') as HTMLElement | null)
            : null;
        if (!activeToggle) return;

        const task = filteredTasks[selectedIndex];
        if (!task) return;

        const focusTarget = (): boolean => {
            const toggle = document.querySelector(
                `[data-task-id="${task.id}"] [data-task-view-toggle]`,
            ) as HTMLElement | null;
            if (!toggle || typeof toggle.focus !== 'function') return false;
            if (toggle === activeToggle) return true;
            toggle.focus({ preventScroll: true });
            return true;
        };

        if (focusTarget()) return;

        // A virtualized target row may not be mounted this frame. Retry after
        // the layout effect's scroll mounts it; if it still cannot be found,
        // blur the stale toggle so no lingering ring remains on the old row.
        if (typeof requestAnimationFrame !== 'function') {
            if (typeof activeToggle.blur === 'function') activeToggle.blur();
            return;
        }
        const frame = requestAnimationFrame(() => {
            if (focusTarget()) return;
            if (typeof activeToggle.blur === 'function') activeToggle.blur();
        });
        return () => cancelAnimationFrame(frame);
    }, [filteredTasks, selectedIndex, selectionScrollVersion]);

    useEffect(() => {
        if (!highlightTaskId) return;
        const index = filteredTasks.findIndex((task) => task.id === highlightTaskId);
        if (index < 0) return;

        setSelectedIndex(index);
        if (shouldVirtualize) {
            scrollToVirtualIndex(index, 'center');
        } else {
            let retryTimer: number | null = null;
            let cancelled = false;
            let attempts = 0;
            const scrollHighlightedTask = () => {
                if (cancelled) return;
                const element = document.querySelector(`[data-task-id="${highlightTaskId}"]`) as HTMLElement | null;
                if (element && typeof (element as { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }).scrollIntoView === 'function') {
                    element.scrollIntoView({ block: 'center' });
                    return;
                }
                if (attempts >= 8) return;
                attempts += 1;
                retryTimer = window.setTimeout(scrollHighlightedTask, 50);
            };
            scrollHighlightedTask();
            const timer = window.setTimeout(() => setHighlightTask(null), 4000);
            return () => {
                cancelled = true;
                if (retryTimer !== null) window.clearTimeout(retryTimer);
                window.clearTimeout(timer);
            };
        }

        const timer = window.setTimeout(() => setHighlightTask(null), 4000);
        return () => window.clearTimeout(timer);
    }, [filteredTasks, highlightTaskId, scrollToVirtualIndex, setHighlightTask, shouldVirtualize]);

    // Keyboard navigation only requests the follow-up: the layout effects above
    // own the virtualization-aware scroll and the #860 rule that focus follows
    // the selection only when it already sits on a task title.
    const revealSelected = useCallback(() => {
        requestSelectionScroll();
        pendingSelectionFocusRef.current = true;
    }, [requestSelectionScroll]);

    // Entering the list from the sidebar (ArrowRight / `l`) must land DOM focus
    // on the selected task's title so its highlight shows and the container
    // does not paint a focus ring around the whole list (#890). The row is
    // already highlighted via `selectedIndex`; here we move focus and scroll it
    // into view. Returns false only when there is nothing to select.
    const focusSelected = useCallback((): boolean => {
        if (filteredTasks.length === 0) return false;
        const index = selectedIndex >= 0 && selectedIndex < filteredTasks.length
            ? selectedIndex
            : 0;
        if (index !== selectedIndex) setSelectedIndex(index);
        requestSelectionScroll();
        const task = filteredTasks[index];
        const toggle = document.querySelector(
            `[data-task-id="${task.id}"] [data-task-view-toggle]`,
        ) as HTMLElement | null;
        if (toggle && typeof toggle.focus === 'function') toggle.focus();
        return true;
    }, [filteredTasks, requestSelectionScroll, selectedIndex]);

    // Keyboard multi-select: entering selection mode on first select and
    // leaving it when the selection empties keeps the mode invisible unless
    // it is actually in use.
    const toggleSelectTask = useCallback((task: Task) => {
        const result = updateRangeSelection({
            anchorId: multiSelectAnchorIdRef.current,
            selectedIds: multiSelectedIds,
            targetId: task.id,
            visibleIds: filteredTaskIds,
        });
        multiSelectAnchorIdRef.current = result.anchorId;
        setMultiSelectedIds(result.selectedIds);
        setSelectionMode(result.selectedIds.size > 0);
    }, [filteredTaskIds, multiSelectedIds]);

    useRegisteredTaskListScope(registerTaskListScope, {
        addInputRef,
        enabled: !isProcessing,
        focusSelected,
        getSelectedIndex: () => selectedIndex,
        getTasks: () => filteredTasks,
        revealSelected,
        setSelectedIndex,
        t,
        toggleSelect: toggleSelectTask,
    });

    const toggleMultiSelect = useCallback((taskId: string, options: RangeSelectionOptions = {}) => {
        setMultiSelectedIds((previous) => {
            const result = updateRangeSelection({
                anchorId: multiSelectAnchorIdRef.current,
                range: options.range,
                selectedIds: previous,
                targetId: taskId,
                visibleIds: filteredTaskIds,
            });
            multiSelectAnchorIdRef.current = result.anchorId;
            return result.selectedIds;
        });
    }, [filteredTaskIds]);

    const selectAllVisibleTasks = useCallback(() => {
        multiSelectAnchorIdRef.current = filteredTaskIds[0] ?? null;
        setMultiSelectedIds(new Set(filteredTaskIds));
    }, [filteredTaskIds]);

    const clearTaskSelection = useCallback(() => {
        multiSelectAnchorIdRef.current = null;
        setMultiSelectedIds(new Set());
    }, []);

    const handleSelectIndex = useCallback((index: number) => {
        if (!selectionMode) setSelectedIndex(index);
    }, [selectionMode]);

    const handleBatchMove = useCallback(async (newStatus: TaskStatus) => {
        if (selectedIdsArray.length === 0) return;
        try {
            await Promise.resolve(batchMoveTasks(selectedIdsArray, newStatus));
            exitSelectionMode();
        } catch (error) {
            reportError('Failed to batch move tasks', error);
            showToast(translateWithFallback('bulk.moveFailed', 'Failed to update selected tasks'), 'error');
        }
    }, [batchMoveTasks, exitSelectionMode, selectedIdsArray, showToast, translateWithFallback]);

    const handleBatchDelete = useCallback(async () => {
        const taskIds = [...selectedIdsArray];
        if (taskIds.length === 0) return;

        setIsBatchDeleting(true);
        try {
            await Promise.resolve(batchDeleteTasks(taskIds));
            exitSelectionMode();
            const undo = registerUndoableAction(() => {
                void restoreDeletedTasksWithFeedback(taskIds, restoreTask, showToast);
            });
            if (undoNotificationsEnabled) {
                const deletedMessage = taskIds.length === 1
                    ? (t('list.taskDeleted') || 'Task deleted')
                    : (t('list.tasksDeleted') || '{{count}} tasks deleted').replace('{{count}}', String(taskIds.length));
                showToast(
                    deletedMessage,
                    'info',
                    5000,
                    {
                        label: t('common.undo') || 'Undo',
                        onClick: undo,
                    },
                );
            }
        } catch (error) {
            reportError('Failed to batch delete tasks', error);
            showToast(translateWithFallback('bulk.deleteFailed', 'Failed to delete selected tasks'), 'error');
        } finally {
            setIsBatchDeleting(false);
        }
    }, [
        batchDeleteTasks,
        exitSelectionMode,
        restoreTask,
        selectedIdsArray,
        showToast,
        t,
        translateWithFallback,
        undoNotificationsEnabled,
    ]);

    const handleBatchAssignArea = useCallback(async (areaId: string | null) => {
        if (selectedIdsArray.length === 0) return;
        try {
            await Promise.resolve(batchUpdateTasks(selectedIdsArray.map((id) => ({
                id,
                updates: { areaId: areaId ?? undefined },
            }))));
            exitSelectionMode();
        } catch (error) {
            reportError('Failed to batch assign area', error);
            showToast(translateWithFallback('bulk.moveFailed', 'Failed to update selected tasks'), 'error');
        }
    }, [batchUpdateTasks, exitSelectionMode, selectedIdsArray, showToast, translateWithFallback]);

    const handleBatchAddTag = useCallback(() => {
        if (selectedIdsArray.length === 0) return;
        setTagPromptIds(selectedIdsArray);
        setTagPromptOpen(true);
    }, [selectedIdsArray]);

    const handleBatchAddContext = useCallback(() => {
        if (selectedIdsArray.length === 0) return;
        setContextPromptIds(selectedIdsArray);
        setContextPromptMode('add');
        setContextPromptOpen(true);
    }, [selectedIdsArray]);

    const handleBatchRemoveContext = useCallback(() => {
        if (selectedIdsArray.length === 0) return;
        setContextPromptIds(selectedIdsArray);
        setContextPromptMode('remove');
        setContextPromptOpen(true);
    }, [selectedIdsArray]);

    const handleConfirmTagPrompt = useCallback(async (value: string) => {
        const input = value.trim();
        if (!input) return;
        const tag = input.startsWith('#') ? input : `#${input}`;
        await Promise.resolve(batchUpdateTasks(tagPromptIds.map((id) => {
            const task = tasksById.get(id);
            const existingTags = task?.tags || [];
            const nextTags = Array.from(new Set([...existingTags, tag]));
            return { id, updates: { tags: nextTags } };
        })));
        setTagPromptOpen(false);
        setTagPromptIds([]);
        exitSelectionMode();
    }, [batchUpdateTasks, exitSelectionMode, tagPromptIds, tasksById]);

    const handleConfirmContextPrompt = useCallback(async (value: string) => {
        const input = value.trim();
        if (!input) return;
        const context = input.startsWith('@') ? input : `@${input}`;
        await Promise.resolve(batchUpdateTasks(contextPromptIds.map((id) => {
            const task = tasksById.get(id);
            const existing = task?.contexts || [];
            const nextContexts = contextPromptMode === 'add'
                ? Array.from(new Set([...existing, context]))
                : existing.filter((token) => token !== context);
            return { id, updates: { contexts: nextContexts } };
        })));
        setContextPromptOpen(false);
        setContextPromptIds([]);
        exitSelectionMode();
    }, [batchUpdateTasks, contextPromptIds, contextPromptMode, exitSelectionMode, tasksById]);

    const toggleSelectionMode = useCallback(() => {
        if (selectionMode) {
            exitSelectionMode();
            return;
        }
        setSelectionMode(true);
    }, [exitSelectionMode, selectionMode]);

    return {
        contextPromptMode,
        contextPromptOpen,
        exitSelectionMode,
        handleBatchAddContext,
        handleBatchAddTag,
        handleBatchAssignArea,
        handleBatchDelete,
        handleBatchMove,
        handleBatchRemoveContext,
        handleConfirmContextPrompt,
        handleConfirmTagPrompt,
        handleSelectIndex,
        isBatchDeleting,
        allVisibleTasksSelected,
        clearTaskSelection,
        multiSelectedIds,
        selectedIdsArray,
        selectedIndex,
        selectAllVisibleTasks,
        selectionMode,
        setContextPromptOpen,
        setTagPromptOpen,
        tagPromptOpen,
        toggleMultiSelect,
        toggleSelectionMode,
    };
}
