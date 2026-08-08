import { useMemo } from 'react';
import {
  isTaskVisibleInArea,
  useTaskStore,
  type Area,
  type AreaFilterSelection,
  type AreaVisibilityContext,
  type Project,
  type Task,
} from '@mindwtr/core';

import { useMobileAreaFilter } from '@/hooks/use-mobile-area-filter';

export type VisibleTaskContext = {
  areaById: Map<string, Area>;
  projectById: Map<string, Project>;
  resolvedAreaFilter: AreaFilterSelection;
  /** The lookup bundle to hand to core's `isTaskVisibleInArea` for other lists. */
  visibility: AreaVisibilityContext;
  /** Store tasks minus deleted, parked-project and out-of-area ones. */
  visibleTasks: Task[];
};

/**
 * "What can this screen show right now". Every task list on mobile needs the
 * same three things — the project lookup, the area lookup and the resolved area
 * filter — and used to spell all three out itself. Screens now take
 * `visibleTasks` and narrow it by status, so a dropped clause is a change to one
 * core predicate rather than an invisible divergence between screens.
 *
 * One predicate, not one computation: this is a plain hook, so each screen that
 * calls it builds its own `projectById` and runs its own filter. That is cheap
 * enough while screens mount one at a time; sharing the result would mean a
 * context provider.
 */
export function useVisibleTaskContext(): VisibleTaskContext {
  const tasks = useTaskStore((state) => state.tasks);
  const projects = useTaskStore((state) => state.projects);
  const { areaById, resolvedAreaFilter } = useMobileAreaFilter();

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const visibility = useMemo<AreaVisibilityContext>(
    () => ({ areaById, projectById, resolvedAreaFilter }),
    [areaById, projectById, resolvedAreaFilter],
  );
  const visibleTasks = useMemo(
    () => tasks.filter((task) => isTaskVisibleInArea(task, visibility)),
    [tasks, visibility],
  );

  return { areaById, projectById, resolvedAreaFilter, visibility, visibleTasks };
}
