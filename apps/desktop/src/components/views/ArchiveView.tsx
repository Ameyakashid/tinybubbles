import { memo, useMemo, useState, useEffect, useCallback, useLayoutEffect, useRef, type UIEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from '../ErrorBoundary';
import {
    createTaskFilterPredicate,
    formatTimeEstimateLabel,
    getTaskMetadataFilterVisibility,
    hasActiveFilterCriteria,
    safeFormatDate,
    shallow,
    sortDoneTasksForListView,
    sortTasksBy,
    tFallback,
    useTaskStore,
} from '@mindwtr/core';
import type { FilterCriteria, Task, Project, TimeEstimate } from '@mindwtr/core';

import { CheckCircle2, CheckSquare, Filter, SlidersHorizontal, Undo2, Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/language-context';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { checkBudget } from '../../config/performanceBudgets';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { PromptModal } from '../PromptModal';
import { cn } from '../../lib/utils';
import { toDateTimeLocalValue } from '../Task/task-item-helpers';
import {
    LIST_VIRTUALIZATION_THRESHOLD,
    LIST_VIRTUAL_ROW_ESTIMATE,
    LIST_VIRTUAL_OVERSCAN,
    useVirtualList,
} from './list/useVirtualList';
import { BulkSelectionToolbar } from './list/BulkSelectionToolbar';
import { GroupBySelect } from './list/GroupBySelect';
import {
    buildGroupedVirtualRows,
    GroupedTaskSectionHeader,
    GroupedTaskSections,
} from './list/GroupedTaskSections';
import { ListFiltersPanel } from './list/ListFiltersPanel';
import { DONE_SORT_OPTIONS, SortBySelect, ToolbarButton, VIEW_FILTER_INPUT } from './list/list-toolbar';
import {
    PRIORITY_FILTER_OPTIONS,
    TIME_ESTIMATE_FILTER_OPTIONS,
    useListFilterControls,
} from './list/list-filter-controls';
import {
    DONE_AXES,
    emptyCollapsedGroups,
    groupTasks,
    sanitizeCollapsedGroups,
    type CollapsedGroups,
    type DoneGroupBy,
    type TaskGroup,
} from './list/next-grouping';
import { usePersistedViewState } from '../../hooks/usePersistedViewState';
import { useTaskListScope } from './list/task-list-scope';
import { useTaskSelection } from './list/useTaskSelection';
import { useUiStore } from '../../store/ui-store';
import { useLocalDayKey } from '../../hooks/useLocalDayKey';
import { resolveDoneTaskSortBy } from '../../lib/task-list-sort';

type ArchiveTaskRowInnerProps = {
    task: Task;
    onRestore: (taskId: string) => void;
    onDelete: (taskId: string) => void;
    onEditCompletedAt: (taskId: string) => void;
    onToggleSelect: (taskId: string) => void;
    selectionMode: boolean;
    isSelected: boolean;
    t: (key: string) => string;
};

const ArchiveTaskRowInner = memo(function ArchiveTaskRowInner({
    task,
    onRestore,
    onDelete,
    onEditCompletedAt,
    onToggleSelect,
    selectionMode,
    isSelected,
    t,
}: ArchiveTaskRowInnerProps) {
    const handleRestore = useCallback(() => onRestore(task.id), [onRestore, task.id]);
    const handleDelete = useCallback(() => onDelete(task.id), [onDelete, task.id]);
    const handleEditCompletedAt = useCallback(() => onEditCompletedAt(task.id), [onEditCompletedAt, task.id]);
    const handleToggleSelect = useCallback(() => onToggleSelect(task.id), [onToggleSelect, task.id]);
    const completionTimestamp = task.completedAt || task.updatedAt;
    const completedLabel = t('list.done') || 'Completed';
    const editCompletedAtLabel = tFallback(t, 'task.editCompletedAt', 'Edit completion time');
    const completedText = `${completedLabel}: ${completionTimestamp ? safeFormatDate(completionTimestamp, 'Pp', completionTimestamp) : 'Unknown'}`;
    const otherMetadataParts = [
        task.dueDate ? `${t('taskEdit.dueDateLabel')}: ${safeFormatDate(task.dueDate, 'P')}` : '',
        ...(task.contexts ?? []),
    ].filter(Boolean);

    return (
        // data-task-id is what the shared task-list scope resolves keyboard
        // actions against; without it j/k/e/x/s silently do nothing here.
        <div
            data-task-id={task.id}
            className="rounded-lg px-3 py-3 flex items-center justify-between group hover:bg-muted/50 transition-colors"
        >
            <div className="flex min-w-0 items-center gap-3">
                {selectionMode && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={handleToggleSelect}
                        aria-label={`${tFallback(t, 'bulk.select', 'Select')} ${task.title}`}
                        className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
                    />
                )}
                <div>
                    <h3 className="font-medium text-foreground line-through opacity-70">{task.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        <button
                            type="button"
                            onClick={handleEditCompletedAt}
                            // Completion time is the only editable field on an
                            // archived task, so it is what `e` opens.
                            data-task-edit-trigger
                            title={editCompletedAtLabel}
                            aria-label={editCompletedAtLabel}
                            className="hover:text-foreground hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                        >
                            {completedText}
                        </button>
                        {otherMetadataParts.length > 0 ? ` • ${otherMetadataParts.join(' • ')}` : ''}
                    </p>
                </div>
            </div>
            {!selectionMode && <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                    onClick={handleRestore}
                    className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                    title={t('archived.restoreToInbox')}
                >
                    <Undo2 className="w-4 h-4" />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                    title={t('common.delete')}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>}
        </div>
    );
});

type VirtualArchiveTaskRowProps = ArchiveTaskRowInnerProps & {
    top: number;
    onMeasure: (id: string, height: number) => void;
};

const VirtualArchiveTaskRow = memo(function VirtualArchiveTaskRow({
    task,
    top,
    onRestore,
    onDelete,
    onEditCompletedAt,
    onToggleSelect,
    selectionMode,
    isSelected,
    onMeasure,
    t,
}: VirtualArchiveTaskRowProps) {
    const rowRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        const node = rowRef.current;
        if (!node) return;
        const nextHeight = Math.ceil(node.getBoundingClientRect().height);
        onMeasure(task.id, nextHeight);
    }, [task.id, task.updatedAt, onMeasure]);

    return (
        <div ref={rowRef} style={{ position: 'absolute', top, left: 0, right: 0 }}>
            <div className="border-b border-border/30">
                <ArchiveTaskRowInner
                    task={task}
                    onRestore={onRestore}
                    onDelete={onDelete}
                    onEditCompletedAt={onEditCompletedAt}
                    onToggleSelect={onToggleSelect}
                    selectionMode={selectionMode}
                    isSelected={isSelected}
                    t={t}
                />
            </div>
        </div>
    );
});

type ArchiveProjectRowProps = {
    project: Project;
    areaName?: string;
    onRestore: (projectId: string) => void;
    onDelete: (project: Project) => void;
    t: (key: string) => string;
};

const ArchiveProjectRow = memo(function ArchiveProjectRow({
    project,
    areaName,
    onRestore,
    onDelete,
    t,
}: ArchiveProjectRowProps) {
    const handleRestore = useCallback(() => onRestore(project.id), [onRestore, project.id]);
    const handleDelete = useCallback(() => onDelete(project), [onDelete, project]);
    const archivedText = `${t('list.done') || 'Completed'}: ${project.updatedAt ? safeFormatDate(project.updatedAt, 'Pp', project.updatedAt) : 'Unknown'}`;

    return (
        <div className="rounded-lg px-3 py-3 flex items-center justify-between group hover:bg-muted/50 transition-colors">
            <div className="flex min-w-0 items-center gap-3">
                <div>
                    <h3 className="font-medium text-foreground line-through opacity-70">{project.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {archivedText}
                        {areaName ? ` • ${areaName}` : ''}
                    </p>
                </div>
            </div>
            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                    onClick={handleRestore}
                    className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                    title={tFallback(t, 'archived.restoreProject', 'Restore project')}
                >
                    <Undo2 className="w-4 h-4" />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                    title={t('common.delete')}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

type ArchiveSegment = 'tasks' | 'projects';

// Same shape ListView uses, device-local: the collapsed set per axis (#963).
const ARCHIVE_VIEW_STATE_STORAGE_KEY = 'mindwtr:view:archive:v1';
type ArchiveGroupCollapseKey = Exclude<DoneGroupBy, 'none'>;
type ArchivePersistedViewState = {
    collapsedGroups: CollapsedGroups<DoneGroupBy>;
};
const DEFAULT_ARCHIVE_VIEW_STATE: ArchivePersistedViewState = {
    collapsedGroups: emptyCollapsedGroups(DONE_AXES),
};

function sanitizeArchiveViewState(value: unknown, fallback: ArchivePersistedViewState): ArchivePersistedViewState {
    const parsed = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<ArchivePersistedViewState>
        : {};
    return {
        collapsedGroups: sanitizeCollapsedGroups(DONE_AXES, parsed.collapsedGroups, fallback.collapsedGroups),
    };
}

function getArchiveDomIdSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
}

export function ArchiveView() {
    const perf = usePerformanceMonitor('ArchiveView');
    const {
        _allTasks,
        projects,
        areas,
        updateTask,
        deleteTask,
        updateProject,
        deleteProject,
        batchMoveTasks,
        batchDeleteTasks,
        restoreTask,
        settings,
    } = useTaskStore(
        (state) => ({
            _allTasks: state._allTasks,
            projects: state.projects,
            areas: state.areas,
            updateTask: state.updateTask,
            deleteTask: state.deleteTask,
            updateProject: state.updateProject,
            deleteProject: state.deleteProject,
            batchMoveTasks: state.batchMoveTasks,
            batchDeleteTasks: state.batchDeleteTasks,
            restoreTask: state.restoreTask,
            settings: state.settings,
        }),
        shallow
    );
    const { t } = useLanguage();
    const showToast = useUiStore((state) => state.showToast);
    const { requestConfirmation, confirmModal } = useConfirmDialog();
    const [segment, setSegment] = useState<ArchiveSegment>('tasks');
    const [searchQuery, setSearchQuery] = useState('');
    const [archiveViewState, setArchiveViewState] = usePersistedViewState(
        ARCHIVE_VIEW_STATE_STORAGE_KEY,
        DEFAULT_ARCHIVE_VIEW_STATE,
        sanitizeArchiveViewState,
    );
    const [completedAtTaskId, setCompletedAtTaskId] = useState<string | null>(null);
    const listScrollRef = useRef<HTMLDivElement>(null);
    const rowHeightsRef = useRef<Map<string, number>>(new Map());
    const [measureVersion, setMeasureVersion] = useState(0);
    const [listScrollTop, setListScrollTop] = useState(0);
    const [listHeight, setListHeight] = useState(0);
    const {
        criteria: listFilterCriteria,
        filtersOpen,
        selectedTokens,
        selectedPriorities,
        selectedTimeEstimates,
        toggleToken,
        togglePriority,
        toggleEstimate,
        clearFilters,
        setFiltersOpen,
    } = useListFilterControls();
    const archivedGroupBy = useUiStore((state) => state.listOptions.archivedGroupBy);
    const archivedSortBy = useUiStore((state) => state.listOptions.archivedSortBy);
    const setListOptions = useUiStore((state) => state.setListOptions);
    // Archive is completed work, so it reads Done's sort roster (which is the
    // only one carrying 'completed') and lands on Done's completion-recency
    // default rather than the global task sort, which orders by due date and
    // priority — neither of which means anything once a task is finished.
    const sortBy = resolveDoneTaskSortBy(settings?.taskSortBy, archivedSortBy);

    useEffect(() => {
        if (!perf.enabled) return;
        const timer = window.setTimeout(() => {
            checkBudget('ArchiveView', perf.metrics, 'simple');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [perf.enabled]);

    useEffect(() => {
        const element = listScrollRef.current;
        if (!element) return;
        const updateHeight = () => {
            const nextHeight = element.clientHeight;
            setListHeight((current) => (current === nextHeight ? current : nextHeight));
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        const resizeObserver = typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => updateHeight())
            : null;
        resizeObserver?.observe(element);
        return () => {
            window.removeEventListener('resize', updateHeight);
            resizeObserver?.disconnect();
        };
    }, []);

    // Everything in the archive, before the toolbar narrows it. The filter
    // chips, their counts and the priority/estimate section visibility all read
    // this, so a selection never hides the control that would undo it.
    const archivedBaseTasks = useMemo(
        () => _allTasks.filter((task) => task.status === 'archived' && !task.deletedAt),
        [_allTasks]
    );

    const prioritiesEnabled = settings?.features?.priorities !== false;
    const timeEstimatesEnabled = settings?.features?.timeEstimates !== false;
    const metadataFilterVisibility = useMemo(
        () => getTaskMetadataFilterVisibility(archivedBaseTasks, { prioritiesEnabled, timeEstimatesEnabled }),
        [archivedBaseTasks, prioritiesEnabled, timeEstimatesEnabled]
    );
    const showPriorityFilters = metadataFilterVisibility.priority;
    const showTimeEstimateFilters = metadataFilterVisibility.timeEstimate;
    const activeFilterCriteria = useMemo<FilterCriteria>(() => ({
        ...listFilterCriteria,
        priority: showPriorityFilters ? selectedPriorities : undefined,
        timeEstimates: showTimeEstimateFilters ? selectedTimeEstimates : undefined,
        timeEstimateRange: showTimeEstimateFilters ? listFilterCriteria.timeEstimateRange : undefined,
    }), [listFilterCriteria, selectedPriorities, selectedTimeEstimates, showPriorityFilters, showTimeEstimateFilters]);

    const { allTokens, tokenCounts } = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const task of archivedBaseTasks) {
            for (const token of new Set([...(task.contexts ?? []), ...(task.tags ?? [])])) {
                counts[token] = (counts[token] ?? 0) + 1;
            }
        }
        // Criteria are shared across every desktop list (#956), so a token
        // picked in Next can be active here while matching nothing archived.
        // Union it in or the panel would offer no way to switch it back off.
        return {
            allTokens: [...new Set([...Object.keys(counts), ...selectedTokens])].sort(),
            tokenCounts: counts,
        };
    }, [archivedBaseTasks, selectedTokens]);

    const archivedTasks = useMemo(() => {
        const criteriaPredicate = hasActiveFilterCriteria(activeFilterCriteria)
            ? createTaskFilterPredicate(activeFilterCriteria, { projects, tokenMatchMode: 'all' })
            : null;
        const query = searchQuery.trim().toLowerCase();
        const filtered = archivedBaseTasks.filter((task) => {
            if (criteriaPredicate && !criteriaPredicate(task)) return false;
            if (query && !task.title.toLowerCase().includes(query)) return false;
            return true;
        });
        return sortBy === 'default' ? sortDoneTasksForListView(filtered) : sortTasksBy(filtered, sortBy);
    }, [activeFilterCriteria, archivedBaseTasks, projects, searchQuery, sortBy]);

    const areaNameById = useMemo(
        () => new Map(areas.filter((area) => !area.deletedAt).map((area) => [area.id, area.name])),
        [areas]
    );

    const archivedProjects = useMemo(() => {
        const filtered = projects
            .filter((project) => project.status === 'archived')
            .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        if (!searchQuery) return filtered;
        const query = searchQuery.toLowerCase();
        return filtered.filter((project) => project.title.toLowerCase().includes(query));
    }, [projects, searchQuery]);
    const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
    const isGrouping = archivedGroupBy !== 'none';
    const localDayKey = useLocalDayKey(archivedGroupBy === 'completedDate');
    const groupedTasks = useMemo<TaskGroup[]>(
        () => (isGrouping ? groupTasks(archivedGroupBy, { tasks: archivedTasks, areas, projectMap, t }) : []),
        [archivedGroupBy, archivedTasks, areas, isGrouping, localDayKey, projectMap, t]
    );
    const activeCollapseKey: ArchiveGroupCollapseKey | null = isGrouping
        ? archivedGroupBy as ArchiveGroupCollapseKey
        : null;
    const collapsedGroupIds = useMemo(() => {
        if (!activeCollapseKey) return new Set<string>();
        return new Set(archiveViewState.collapsedGroups[activeCollapseKey] ?? []);
    }, [activeCollapseKey, archiveViewState.collapsedGroups]);
    const getSectionDomId = useCallback((group: TaskGroup, groupIndex: number) => (
        `archived-group-${getArchiveDomIdSegment(archivedGroupBy)}-${groupIndex}-${getArchiveDomIdSegment(group.id)}`
    ), [archivedGroupBy]);
    const toggleGroup = useCallback((groupId: string) => {
        if (!activeCollapseKey) return;
        setArchiveViewState((current) => {
            const nextIds = new Set(current.collapsedGroups[activeCollapseKey] ?? []);
            if (nextIds.has(groupId)) {
                nextIds.delete(groupId);
            } else {
                nextIds.add(groupId);
            }
            return {
                collapsedGroups: {
                    ...current.collapsedGroups,
                    [activeCollapseKey]: Array.from(nextIds),
                },
            };
        });
    }, [activeCollapseKey, setArchiveViewState]);
    const groupedVirtualRows = useMemo(
        () => buildGroupedVirtualRows(groupedTasks, collapsedGroupIds, isGrouping ? getSectionDomId : undefined),
        [collapsedGroupIds, getSectionDomId, groupedTasks, isGrouping]
    );
    // Grouped rows render in section order, so keyboard navigation and
    // "select all" have to walk that order rather than the flat sorted one.
    // A collapsed group contributes no rows, so it must not contribute
    // selectable tasks either.
    const orderedTasks = useMemo(
        () => (isGrouping
            ? groupedTasks.flatMap((group) => (collapsedGroupIds.has(group.id) ? [] : group.tasks))
            : archivedTasks),
        [archivedTasks, collapsedGroupIds, groupedTasks, isGrouping]
    );
    const archivedTaskIds = useMemo(() => orderedTasks.map((task) => task.id), [orderedTasks]);
    const {
        allVisibleTasksSelected: allVisibleSelected,
        clearTaskSelection: clearSelection,
        deleteSelectedTasks,
        exitSelectionMode,
        multiSelectedIds: selectedIds,
        moveSelectedTasks,
        selectionMode,
        selectAllVisibleTasks: selectAllVisible,
        toggleMultiSelect: toggleTaskSelection,
        toggleSelectionMode,
    } = useTaskSelection(archivedTaskIds, {
        batchDeleteTasks,
        batchMoveTasks,
        restoreTask,
        showToast,
        t,
        undoNotificationsEnabled: settings?.undoNotificationsEnabled !== false,
    });
    const virtualRowCount = isGrouping ? groupedVirtualRows.length : archivedTasks.length;
    const shouldVirtualize = virtualRowCount > LIST_VIRTUALIZATION_THRESHOLD;
    // Keep the Projects segment's layout behavior tied to the old flat-task
    // condition. Grouping only changes how the task segment renders.
    const shouldVirtualizeFlatTasks = !isGrouping && archivedTasks.length > LIST_VIRTUALIZATION_THRESHOLD;
    const shouldFillAvailableHeight = segment === 'tasks' ? shouldVirtualize : shouldVirtualizeFlatTasks;
    const handleVirtualRowMeasure = useCallback((id: string, height: number) => {
        if (rowHeightsRef.current.get(id) === height) return;
        rowHeightsRef.current.set(id, height);
        setMeasureVersion((current) => current + 1);
    }, []);
    const handleVirtualScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        setListScrollTop(event.currentTarget.scrollTop);
    }, []);
    const { rowOffsets, totalHeight, startIndex, visibleTasks } = useVirtualList({
        tasks: archivedTasks,
        shouldVirtualize: shouldVirtualizeFlatTasks,
        rowHeightsRef,
        measureVersion,
        listScrollTop,
        listHeight,
        rowEstimate: LIST_VIRTUAL_ROW_ESTIMATE,
        overscan: LIST_VIRTUAL_OVERSCAN,
    });
    const groupedRowVirtualizer = useVirtualizer({
        count: isGrouping && shouldVirtualize ? groupedVirtualRows.length : 0,
        getScrollElement: () => listScrollRef.current,
        estimateSize: (index) => groupedVirtualRows[index]?.kind === 'header'
            ? 42
            : LIST_VIRTUAL_ROW_ESTIMATE,
        overscan: Math.max(2, Math.ceil(LIST_VIRTUAL_OVERSCAN / LIST_VIRTUAL_ROW_ESTIMATE)),
        getItemKey: (index) => {
            const row = groupedVirtualRows[index];
            if (!row) return index;
            return row.kind === 'header'
                ? `group:${row.group.id}`
                : `task:${row.group.id}:${row.task.id}`;
        },
    });
    const groupedVirtualItems = isGrouping && shouldVirtualize
        ? groupedRowVirtualizer.getVirtualItems()
        : [];
    const groupedTotalHeight = isGrouping && shouldVirtualize
        ? groupedRowVirtualizer.getTotalSize()
        : 0;

    const handleRestore = useCallback((taskId: string) => {
        updateTask(taskId, { status: 'inbox' }); // Restore to inbox? Or previous status? Inbox is safest.
    }, [updateTask]);

    const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
    useTaskListScope({
        // The projects segment renders no task rows, so the keyboard must not
        // act on archived tasks the user cannot see.
        getTasks: () => (segment === 'tasks' ? orderedTasks : []),
        getSelectedIndex: () => selectedTaskIndex,
        setSelectedIndex: setSelectedTaskIndex,
        t,
        toggleSelect: (task) => toggleTaskSelection(task.id),
    });

    const handleBulkRestore = useCallback(async () => {
        await moveSelectedTasks('inbox');
    }, [moveSelectedTasks]);

    const handleBulkMoveToDone = useCallback(async () => {
        await moveSelectedTasks('done');
    }, [moveSelectedTasks]);

    const handleBulkDelete = useCallback(async () => {
        await deleteSelectedTasks({
            confirm: () => requestConfirmation({
                title: t('bulk.confirmDeleteTitle'),
                description: t('bulk.confirmDeleteBody'),
                confirmLabel: t('common.delete'),
                cancelLabel: t('common.cancel') || 'Cancel',
            }),
        });
    }, [deleteSelectedTasks, requestConfirmation, t]);

    const handleEditCompletedAt = useCallback((taskId: string) => {
        setCompletedAtTaskId(taskId);
    }, []);

    const applyCompletedAt = useCallback((value: string) => {
        const taskId = completedAtTaskId;
        setCompletedAtTaskId(null);
        if (!taskId) return;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return;
        updateTask(taskId, { completedAt: parsed.toISOString() });
    }, [completedAtTaskId, updateTask]);

    const handleDelete = useCallback(async (taskId: string) => {
        const task = _allTasks.find((item) => item.id === taskId);
        if (!task) return;
        const confirmed = await requestConfirmation({
            title: task.title,
            description: t('task.deleteConfirmBody'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel') || 'Cancel',
        });
        if (!confirmed) return;
        await deleteTask(taskId);
    }, [_allTasks, deleteTask, requestConfirmation, t]);

    const handleRestoreProject = useCallback((projectId: string) => {
        void updateProject(projectId, { status: 'active' });
    }, [updateProject]);

    const handleDeleteProject = useCallback(async (project: Project) => {
        const confirmed = await requestConfirmation({
            title: project.title,
            description: t('projects.deleteConfirm'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel') || 'Cancel',
        });
        if (!confirmed) return;
        await deleteProject(project.id);
    }, [deleteProject, requestConfirmation, t]);

    const renderArchiveRow = useCallback((task: Task) => (
        <ArchiveTaskRowInner
            key={task.id}
            task={task}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onEditCompletedAt={handleEditCompletedAt}
            onToggleSelect={toggleTaskSelection}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(task.id)}
            t={t}
        />
    ), [handleDelete, handleEditCompletedAt, handleRestore, selectedIds, selectionMode, t, toggleTaskSelection]);

    const formatEstimate = useCallback(
        (value: TimeEstimate) => formatTimeEstimateLabel(value, { t }),
        [t]
    );
    const filterSummary = [
        ...(searchQuery.trim() ? [`${t('common.search')}: ${searchQuery.trim()}`] : []),
        ...selectedTokens,
        ...(showPriorityFilters ? selectedPriorities.map((priority) => t(`priority.${priority}`)) : []),
        ...(showTimeEstimateFilters ? selectedTimeEstimates.map(formatEstimate) : []),
    ];
    const hasFilters = filterSummary.length > 0;
    const filterSummaryLabel = filterSummary.slice(0, 3).join(', ');
    const filterSummarySuffix = filterSummary.length > 3 ? ` +${filterSummary.length - 3}` : '';

    const handleSegmentChange = useCallback((next: ArchiveSegment) => {
        setSegment((current) => {
            if (current === next) return current;
            exitSelectionMode();
            return next;
        });
    }, [exitSelectionMode]);

    return (
        <ErrorBoundary>
            <div className={shouldFillAvailableHeight ? "flex h-full min-h-0 flex-col gap-6" : "flex flex-col gap-6"}>
            <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold tracking-tight">{t('archived.title')}</h2>
                    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                        <button
                            type="button"
                            onClick={() => handleSegmentChange('tasks')}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                segment === 'tasks'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t('common.tasks')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSegmentChange('projects')}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                segment === 'projects'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t('projects.title')}
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                    <span>
                        {segment === 'tasks'
                            ? `${archivedTasks.length} ${t('common.tasks')}`
                            : `${archivedProjects.length} ${t('projects.title')}`}
                    </span>
                    {segment === 'tasks' && hasFilters && (
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:max-w-[420px]">
                            <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{filterSummaryLabel}{filterSummarySuffix}</span>
                        </span>
                    )}
                </div>
                </div>

                {segment === 'tasks' && (
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <ToolbarButton
                            active={filtersOpen}
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            aria-expanded={filtersOpen}
                            aria-controls="list-filters-panel"
                            icon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                            {t('filters.label')}
                        </ToolbarButton>
                        {archivedTasks.length > 0 && (
                            <ToolbarButton
                                active={selectionMode}
                                onClick={toggleSelectionMode}
                                aria-pressed={selectionMode}
                                icon={<CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                                {selectionMode ? t('common.done') : t('bulk.select')}
                            </ToolbarButton>
                        )}
                        <SortBySelect
                            options={DONE_SORT_OPTIONS}
                            value={sortBy}
                            onChange={(value) => setListOptions({ archivedSortBy: value })}
                            t={t}
                            iconTestId="archive-sort-icon"
                        />
                        <GroupBySelect
                            value={archivedGroupBy}
                            axes={DONE_AXES}
                            onChange={(value) => setListOptions({ archivedGroupBy: value as DoneGroupBy })}
                            t={t}
                        />
                    </div>
                )}
            </header>

            {segment === 'tasks' && filtersOpen && (
                <ListFiltersPanel
                    t={t}
                    hasFilters={hasFilters}
                    onClearFilters={clearFilters}
                    allTokens={allTokens}
                    selectedTokens={selectedTokens}
                    tokenCounts={tokenCounts}
                    onToggleToken={toggleToken}
                    showPriorityFilters={showPriorityFilters}
                    priorityOptions={PRIORITY_FILTER_OPTIONS}
                    selectedPriorities={selectedPriorities}
                    onTogglePriority={togglePriority}
                    showTimeEstimateFilters={showTimeEstimateFilters}
                    timeEstimateOptions={TIME_ESTIMATE_FILTER_OPTIONS}
                    selectedTimeEstimates={selectedTimeEstimates}
                    onToggleEstimate={toggleEstimate}
                    formatEstimate={formatEstimate}
                />
            )}

            {segment === 'tasks' && selectionMode && (
                <div className="space-y-2">
                    <BulkSelectionToolbar
                        selectionCount={selectedIds.size}
                        totalCount={archivedTasks.length}
                        allSelected={allVisibleSelected}
                        onSelectAll={selectAllVisible}
                        onClearSelection={clearSelection}
                        t={t}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => { void handleBulkMoveToDone(); }}
                            disabled={selectedIds.size === 0}
                            aria-label={`${t('bulk.moveTo')} ${t('status.done')}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('bulk.moveTo')} {t('status.done')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { void handleBulkRestore(); }}
                            disabled={selectedIds.size === 0}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            {t('trash.restoreToInbox')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { void handleBulkDelete(); }}
                            disabled={selectedIds.size === 0}
                            className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('common.delete')}
                        </button>
                    </div>
                </div>
            )}

            <div className="relative">
                <input
                    type="text"
                    // Same shape and Escape-back-to-the-list behaviour as every
                    // other view's filter input (#959).
                    data-view-filter-input
                    placeholder={segment === 'projects'
                        ? tFallback(t, 'archived.searchProjectsPlaceholder', 'Search archived projects...')
                        : t('archived.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={VIEW_FILTER_INPUT}
                />
            </div>

            {segment === 'projects' ? (
                <div className={shouldVirtualizeFlatTasks ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
                    {archivedProjects.length === 0 ? (
                        <div className="px-1 py-8 text-left text-sm text-muted-foreground">
                            <p>{tFallback(t, 'archived.emptyProjects', 'No archived projects')}</p>
                            <p className="text-xs mt-2">{tFallback(t, 'archived.emptyProjectsHint', 'Projects you archive will appear here')}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {archivedProjects.map((project) => (
                                <ArchiveProjectRow
                                    key={project.id}
                                    project={project}
                                    areaName={project.areaId ? areaNameById.get(project.areaId) : undefined}
                                    onRestore={handleRestoreProject}
                                    onDelete={handleDeleteProject}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
            <div
                ref={listScrollRef}
                onScroll={isGrouping ? undefined : handleVirtualScroll}
                className={shouldVirtualize ? "flex-1 min-h-0 overflow-y-auto" : undefined}
            >
                {archivedTasks.length === 0 ? (
                    <div className="px-1 py-8 text-left text-sm text-muted-foreground">
                        <p>{t('archived.noTasksFound')}</p>
                        <p className="text-xs mt-2">{t('archived.emptyHint')}</p>
                    </div>
                ) : shouldVirtualize ? (
                    <div
                        data-testid="virtualized-task-list"
                        data-grouped={isGrouping ? 'true' : 'false'}
                        style={{ height: isGrouping ? groupedTotalHeight : totalHeight, position: 'relative' }}
                    >
                        {isGrouping ? groupedVirtualItems.map((virtualRow) => {
                            const groupedRow = groupedVirtualRows[virtualRow.index];
                            if (!groupedRow) return null;
                            if (groupedRow.kind === 'header') {
                                return (
                                    <div
                                        key={virtualRow.key}
                                        ref={groupedRowVirtualizer.measureElement}
                                        data-index={virtualRow.index}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            paddingTop: virtualRow.index > 0 ? 8 : 0,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <GroupedTaskSectionHeader
                                            group={groupedRow.group}
                                            collapsed={groupedRow.collapsed}
                                            controlsId={groupedRow.controlsId}
                                            onToggleGroup={toggleGroup}
                                            className={cn(
                                                'border border-border/40 bg-card/30',
                                                groupedRow.collapsed ? 'rounded-md' : 'rounded-t-md',
                                            )}
                                        />
                                    </div>
                                );
                            }
                            return (
                                <div
                                    key={virtualRow.key}
                                    ref={groupedRowVirtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div
                                        id={groupedRow.isFirst ? groupedRow.controlsId : undefined}
                                        className={cn(
                                            'border-x border-border/40 bg-card/30',
                                            !groupedRow.isLast && 'border-b border-border/30',
                                            groupedRow.isLast && 'rounded-b-md border-b border-border/40',
                                        )}
                                    >
                                        {renderArchiveRow(groupedRow.task)}
                                    </div>
                                </div>
                            );
                        }) : visibleTasks.map((task, visibleIndex) => {
                            const taskIndex = startIndex + visibleIndex;
                            return (
                                <VirtualArchiveTaskRow
                                    key={task.id}
                                    task={task}
                                    top={rowOffsets[taskIndex] ?? 0}
                                    onMeasure={handleVirtualRowMeasure}
                                    onRestore={handleRestore}
                                    onDelete={handleDelete}
                                    onEditCompletedAt={handleEditCompletedAt}
                                    onToggleSelect={toggleTaskSelection}
                                    selectionMode={selectionMode}
                                    isSelected={selectedIds.has(task.id)}
                                    t={t}
                                />
                            );
                        })}
                    </div>
                ) : isGrouping ? (
                    <GroupedTaskSections
                        groups={groupedTasks}
                        renderTask={renderArchiveRow}
                        onToggleGroup={toggleGroup}
                        collapsedGroupIds={collapsedGroupIds}
                        getSectionDomId={getSectionDomId}
                    />
                ) : (
                    <div className="divide-y divide-border/30">
                        {archivedTasks.map(renderArchiveRow)}
                    </div>
                )}
            </div>
            )}
            </div>
            {confirmModal}
            {completedAtTaskId && (
                <PromptModal
                    isOpen
                    title={tFallback(t, 'task.completedAtPromptTitle', 'Completion time')}
                    defaultValue={toDateTimeLocalValue(
                        (() => {
                            const task = _allTasks.find((item) => item.id === completedAtTaskId);
                            return task ? (task.completedAt || task.updatedAt) : undefined;
                        })()
                    )}
                    inputType="datetime-local"
                    confirmLabel={t('common.save')}
                    cancelLabel={t('common.cancel')}
                    onCancel={() => setCompletedAtTaskId(null)}
                    onConfirm={applyCompletedAt}
                />
            )}
        </ErrorBoundary>
    );
}
