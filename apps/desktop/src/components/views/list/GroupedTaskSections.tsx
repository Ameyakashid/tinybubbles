import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Task } from '@mindwtr/core';
import { cn } from '../../../lib/utils';
import type { TaskGroup } from './next-grouping';

type GroupedTaskSectionsProps = {
    groups: TaskGroup[];
    renderTask: (task: Task, group: TaskGroup) => ReactNode;
    /** When provided, group headers become collapse toggles. */
    onToggleGroup?: (groupId: string) => void;
    collapsedGroupIds?: Set<string>;
    getSectionDomId?: (group: TaskGroup, index: number) => string | undefined;
};

export type GroupedVirtualRow =
    | {
        kind: 'header';
        group: TaskGroup;
        collapsed: boolean;
        controlsId?: string;
    }
    | {
        kind: 'task';
        group: TaskGroup;
        task: Task;
        isFirst: boolean;
        isLast: boolean;
        controlsId?: string;
    };

export function buildGroupedVirtualRows(
    groups: TaskGroup[],
    collapsedGroupIds: ReadonlySet<string>,
    getSectionDomId?: (group: TaskGroup, index: number) => string | undefined,
): GroupedVirtualRow[] {
    return groups.flatMap((group, groupIndex) => {
        const collapsed = collapsedGroupIds.has(group.id);
        const controlsId = getSectionDomId?.(group, groupIndex);
        const header: GroupedVirtualRow = {
            kind: 'header',
            group,
            collapsed,
            controlsId,
        };
        if (collapsed) return [header];
        return [
            header,
            ...group.tasks.map((task, index): GroupedVirtualRow => ({
                kind: 'task',
                group,
                task,
                isFirst: index === 0,
                isLast: index === group.tasks.length - 1,
                controlsId,
            })),
        ];
    });
}

/**
 * The tasks a grouped list is showing, once per task. Tag and context grouping
 * put a task in every group it belongs to, but the keyboard walk and "Select
 * all" step by task rather than by row, so a repeat would leave the cursor on
 * an index no row claims (#970).
 */
export function flattenVisibleGroupTasks(
    groups: TaskGroup[],
    collapsedGroupIds: ReadonlySet<string>,
): Task[] {
    const seen = new Set<string>();
    const tasks: Task[] = [];
    groups.forEach((group) => {
        if (collapsedGroupIds.has(group.id)) return;
        group.tasks.forEach((task) => {
            if (seen.has(task.id)) return;
            seen.add(task.id);
            tasks.push(task);
        });
    });
    return tasks;
}

type GroupedTaskSectionHeaderProps = {
    group: TaskGroup;
    collapsed: boolean;
    controlsId?: string;
    onToggleGroup?: (groupId: string) => void;
    className?: string;
};

export function GroupedTaskSectionHeader({
    group,
    collapsed,
    controlsId,
    onToggleGroup,
    className,
}: GroupedTaskSectionHeaderProps) {
    const collapsible = Boolean(onToggleGroup);
    const title = (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            {collapsible && (
                collapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )
            )}
            {group.dotColor && (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.dotColor }} aria-hidden="true" />
            )}
            <span className="truncate">{group.title}</span>
        </span>
    );

    return collapsible ? (
        <button
            type="button"
            onClick={() => onToggleGroup?.(group.id)}
            aria-expanded={!collapsed}
            aria-controls={controlsId}
            className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-muted/30',
                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                !collapsed && 'border-b border-border/30',
                group.muted ? 'text-muted-foreground' : 'text-foreground/90',
                className,
            )}
        >
            {title}
            <span className="shrink-0 text-muted-foreground">{group.tasks.length}</span>
        </button>
    ) : (
        <div className={cn(
            'flex items-center justify-between gap-3 border-b border-border/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide',
            group.muted ? 'text-muted-foreground' : 'text-foreground/90',
            className,
        )}>
            {title}
            <span className="shrink-0 text-muted-foreground">{group.tasks.length}</span>
        </div>
    );
}

/**
 * The one grouped-list section renderer: header card with dot, title, and
 * count, then the group's tasks. The virtual row builder above preserves the
 * same section order and collapse semantics for large grouped lists.
 */
export function GroupedTaskSections({
    groups,
    renderTask,
    onToggleGroup,
    collapsedGroupIds,
    getSectionDomId,
}: GroupedTaskSectionsProps) {
    const collapsible = Boolean(onToggleGroup);
    return (
        <div className="space-y-2">
            {groups.map((group, groupIndex) => {
                const collapsed = collapsible && (collapsedGroupIds?.has(group.id) ?? false);
                const controlsId = collapsible ? getSectionDomId?.(group, groupIndex) : undefined;
                return (
                    <div key={group.id} className="rounded-md border border-border/40 bg-card/30">
                        <GroupedTaskSectionHeader
                            group={group}
                            collapsed={collapsed}
                            controlsId={controlsId}
                            onToggleGroup={onToggleGroup}
                        />
                        {!collapsed && (
                            <div id={controlsId} className="divide-y divide-border/30">
                                {group.tasks.map((task) => renderTask(task, group))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
