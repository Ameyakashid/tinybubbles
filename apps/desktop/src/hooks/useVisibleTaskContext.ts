import { useMemo } from 'react';
import {
    isTaskVisibleInArea,
    resolveAreaFilterSelection,
    useTaskStore,
    type Area,
    type AreaVisibilityContext,
    type Project,
    type Task,
} from '@mindwtr/core';

/** Desktop always has the area lookup, so it is not optional here. */
export type DesktopAreaVisibility = AreaVisibilityContext & {
    areaById: Map<string, Area>;
    projectById: Map<string, Project>;
};

export type VisibleTaskContext = DesktopAreaVisibility & {
    /** The same bundle, stable, to hand to core's `isTaskVisibleInArea`. */
    visibility: DesktopAreaVisibility;
    /** Store tasks minus deleted, parked-project and out-of-area ones. */
    visibleTasks: Task[];
};

/**
 * "What can this screen show right now", answered once — the desktop twin of
 * mobile's `useVisibleTaskContext`. Every list needs the same three lookups
 * (projects, areas, the resolved area filter) and each view used to rebuild
 * all three itself, so a dropped clause read as an invisible divergence
 * between views rather than a change to one core predicate.
 *
 * Archive and Trash read `_allTasks` and deliberately show tasks in parked and
 * archived projects, so they take the lookups and apply their own predicate
 * rather than `isTaskVisibleInArea`.
 */
export function useAreaVisibility(): DesktopAreaVisibility {
    const projects = useTaskStore((state) => state.projects);
    const areas = useTaskStore((state) => state.areas);
    const filters = useTaskStore((state) => state.settings?.filters);

    const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
    const projectById = useMemo(
        () => new Map(projects.map((project) => [project.id, project])),
        [projects],
    );
    const resolvedAreaFilter = useMemo(
        () => resolveAreaFilterSelection(filters, areas),
        [filters, areas],
    );

    return useMemo(
        () => ({ areaById, projectById, resolvedAreaFilter }),
        [areaById, projectById, resolvedAreaFilter],
    );
}

/** `useAreaVisibility` plus the store's task list already narrowed to it. */
export function useVisibleTaskContext(): VisibleTaskContext {
    const visibility = useAreaVisibility();
    const tasks = useTaskStore((state) => state.tasks);
    const visibleTasks = useMemo(
        () => tasks.filter((task) => isTaskVisibleInArea(task, visibility)),
        [tasks, visibility],
    );
    return { ...visibility, visibility, visibleTasks };
}
