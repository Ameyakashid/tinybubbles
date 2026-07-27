// Shared "apply" step for third-party importers (OmniFocus, TickTick, DGT) that all parse into
// the same area/project/task + sourceKey shape. Each importer keeps its own parser and maps its
// Parsed*Data into ImportSource before calling applyImport; the only importer-specific behaviour
// left after mapping is id minting (idFor) and, for TickTick, an inbox->next status promotion.
//
// Todoist is intentionally NOT unified here: it has no areas, nests tasks/sections per project
// instead of cross-referencing via sourceKey, and allocates task order differently (index-based,
// not continuing after existing siblings). Forcing it through this seam would risk changing its
// behaviour, which the "pure refactor" requirement rules out.
import { DEFAULT_AREA_COLOR, DEFAULT_PROJECT_COLOR } from './color-constants';
import { safeParseDate } from './date';
import { ensureDeviceId } from './store-helpers';
import { nextRevision } from './sync-revision';
import type { AppData, Area, ChecklistItem, Project, Task, TaskPriority, TaskStatus } from './types';
import { generateUUID as uuidv4 } from './uuid';

export type ImportAreaSource = {
    color?: string;
    createdAt?: string;
    name: string;
    order: number;
    sourceKey: string;
    updatedAt?: string;
};

export type ImportProjectSource = {
    areaSourceKey?: string;
    color?: string;
    createdAt?: string;
    dueDate?: string;
    name: string;
    order: number;
    sourceKey: string;
    status?: Project['status'];
    supportNotes?: string;
    tagIds?: string[];
    updatedAt?: string;
};

export type ImportTaskSource = {
    areaSourceKey?: string;
    checklist?: ChecklistItem[];
    completedAt?: string;
    contexts?: string[];
    createdAt?: string;
    description?: string;
    dueDate?: string;
    order: number;
    priority?: TaskPriority;
    projectSourceKey?: string;
    recurrence?: Task['recurrence'];
    sourceKey?: string;
    startTime?: string;
    status: TaskStatus;
    tags?: string[];
    title: string;
    updatedAt?: string;
};

export type ImportSource = {
    areas: ImportAreaSource[];
    projects: ImportProjectSource[];
    tasks: ImportTaskSource[];
    warnings: string[];
};

export type ImportExecutionResult = {
    data: AppData;
    importedAreaCount: number;
    importedChecklistItemCount: number;
    importedProjectCount: number;
    importedStandaloneTaskCount: number;
    importedTaskCount: number;
    warnings: string[];
};

// OmniFocus/TickTick/DGT's *ImportParseResult types were structurally identical — only the
// parsed-data and preview shapes differed. Todoist keeps its own distinct type (its field is
// `parsedProjects`, not `parsedData`, and is never null) since that field name is read directly
// by desktop/mobile settings UI outside this refactor's scope.
export type ImportParseResult<TData, TPreview> = {
    errors: string[];
    parsedData: TData | null;
    preview: TPreview | null;
    valid: boolean;
    warnings: string[];
};

export type ImportApplyOptions = {
    fallbacks: {
        area: string;
        project: string;
    };
    idFor?: (kind: 'area' | 'project' | 'section' | 'task', sourceKey: string) => string;
    now?: Date | string;
    resolveTaskStatus?: (status: TaskStatus, projectId: string | undefined) => TaskStatus;
    suffix: string;
};

// The one shared implementation — every importer used to declare this verbatim.
export const resolveUniqueName = (
    title: string,
    usedTitles: Set<string>,
    fallback: string,
    suffix: string
): string => {
    const trimmed = title.trim() || fallback;
    if (!usedTitles.has(trimmed.toLowerCase())) {
        usedTitles.add(trimmed.toLowerCase());
        return trimmed;
    }

    const base = `${trimmed}${suffix}`;
    if (!usedTitles.has(base.toLowerCase())) {
        usedTitles.add(base.toLowerCase());
        return base;
    }

    let suffixIndex = 2;
    while (true) {
        const next = `${base} ${suffixIndex}`;
        const normalized = next.toLowerCase();
        if (!usedTitles.has(normalized)) {
            usedTitles.add(normalized);
            return next;
        }
        suffixIndex += 1;
    }
};

// DGT's parser already normalizes its own timestamp strings, so validating-and-passing-through
// reproduces DGT's exact prior behaviour. TickTick's raw CSV timestamps need `.toISOString()`
// normalization first — its thin wrapper does that before calling applyImport, so by the time a
// value reaches here it is either already-normalized or absent, and this still degrades safely.
const resolveTimestamp = (value: string | undefined, fallback: string): string => (
    safeParseDate(value) ? (value as string) : fallback
);

const getTaskBucketKey = (projectId?: string, areaId?: string): string => {
    if (projectId) return `project:${projectId}`;
    if (areaId) return `area:${areaId}`;
    return 'inbox';
};

export function applyImport(
    currentData: AppData,
    parsed: ImportSource,
    opts: ImportApplyOptions
): ImportExecutionResult {
    const resolvedNow = opts.now instanceof Date
        ? opts.now
        : typeof opts.now === 'string' && opts.now.trim()
            ? new Date(opts.now)
            : new Date();
    const nowIso = Number.isFinite(resolvedNow.getTime()) ? resolvedNow.toISOString() : new Date().toISOString();
    const deviceState = ensureDeviceId(currentData.settings ?? {});
    const settings = deviceState.settings;
    const nextData: AppData = {
        tasks: [...currentData.tasks],
        projects: [...currentData.projects],
        sections: [...currentData.sections],
        areas: [...currentData.areas],
        people: [...(currentData.people ?? [])],
        settings,
    };

    const idFor = opts.idFor ?? (() => uuidv4());
    const resolveTaskStatus = opts.resolveTaskStatus ?? ((status: TaskStatus) => status);

    const usedAreaNames = new Set(
        nextData.areas.filter((area) => !area.deletedAt).map((area) => area.name.trim().toLowerCase())
    );
    const usedProjectTitles = new Set(
        nextData.projects.filter((project) => !project.deletedAt).map((project) => project.title.trim().toLowerCase())
    );
    const warnings = [...parsed.warnings];

    // Includes tombstones deliberately: a deterministic idFor must see prior deletions so a
    // re-import can neither duplicate a live entity nor resurrect one the user removed.
    const existingAreaById = new Map(nextData.areas.map((area) => [area.id, area]));
    const existingProjectById = new Map(nextData.projects.map((project) => [project.id, project]));
    const existingTaskIds = new Set(nextData.tasks.map((task) => task.id));

    const areaIdBySourceKey = new Map<string, string>();
    const projectIdBySourceKey = new Map<string, string>();

    let importedAreaCount = 0;
    let importedProjectCount = 0;
    let importedTaskCount = 0;
    let importedChecklistItemCount = 0;
    let importedStandaloneTaskCount = 0;

    const nextAreaOrder = nextData.areas
        .filter((area) => !area.deletedAt)
        .reduce((max, area) => Math.max(max, Number.isFinite(area.order) ? area.order : -1), -1) + 1;

    parsed.areas.forEach((area, index) => {
        const areaId = idFor('area', area.sourceKey);
        const existingArea = existingAreaById.get(areaId);
        if (existingArea) {
            if (!existingArea.deletedAt) areaIdBySourceKey.set(area.sourceKey, existingArea.id);
            return;
        }
        const areaName = resolveUniqueName(area.name, usedAreaNames, opts.fallbacks.area, opts.suffix);
        if (areaName !== area.name) {
            warnings.push(`Imported area "${area.name}" was renamed to "${areaName}" to avoid a name conflict.`);
        }
        const createdAt = resolveTimestamp(area.createdAt, nowIso);
        const updatedAt = resolveTimestamp(area.updatedAt, createdAt);
        const nextArea: Area = {
            id: areaId,
            name: areaName,
            color: area.color ?? DEFAULT_AREA_COLOR,
            order: nextAreaOrder + index,
            createdAt,
            updatedAt,
            rev: nextRevision(),
            revBy: deviceState.deviceId,
        };
        nextData.areas.push(nextArea);
        areaIdBySourceKey.set(area.sourceKey, nextArea.id);
        importedAreaCount += 1;
    });

    parsed.projects.forEach((project) => {
        const projectId = idFor('project', project.sourceKey);
        const existingProject = existingProjectById.get(projectId);
        if (existingProject) {
            if (!existingProject.deletedAt) projectIdBySourceKey.set(project.sourceKey, existingProject.id);
            return;
        }
        const areaId = project.areaSourceKey ? areaIdBySourceKey.get(project.areaSourceKey) : undefined;
        const projectTitle = resolveUniqueName(project.name, usedProjectTitles, opts.fallbacks.project, opts.suffix);
        if (projectTitle !== project.name) {
            warnings.push(`Imported project "${project.name}" was renamed to "${projectTitle}" to avoid a title conflict.`);
        }
        const siblingMaxOrder = nextData.projects
            .filter((item) => !item.deletedAt && (item.areaId ?? undefined) === areaId)
            .reduce((max, item) => Math.max(max, Number.isFinite(item.order) ? item.order : -1), -1);
        const createdAt = resolveTimestamp(project.createdAt, nowIso);
        const updatedAt = resolveTimestamp(project.updatedAt, createdAt);
        const nextProject: Project = {
            id: projectId,
            title: projectTitle,
            status: project.status ?? 'active',
            color: project.color ?? DEFAULT_PROJECT_COLOR,
            order: siblingMaxOrder + 1,
            tagIds: project.tagIds ?? [],
            supportNotes: project.supportNotes,
            dueDate: project.dueDate,
            createdAt,
            updatedAt,
            rev: nextRevision(),
            revBy: deviceState.deviceId,
            ...(areaId ? { areaId } : {}),
        };
        nextData.projects.push(nextProject);
        projectIdBySourceKey.set(project.sourceKey, nextProject.id);
        importedProjectCount += 1;
    });

    const nextTaskOrderByBucket = new Map<string, number>();
    nextData.tasks.forEach((task) => {
        if (task.deletedAt) return;
        const bucket = getTaskBucketKey(task.projectId, task.areaId);
        const candidate = typeof task.order === 'number'
            ? task.order
            : typeof task.orderNum === 'number'
                ? task.orderNum
                : -1;
        nextTaskOrderByBucket.set(bucket, Math.max(nextTaskOrderByBucket.get(bucket) ?? -1, candidate));
    });
    nextTaskOrderByBucket.forEach((maxOrder, bucket) => {
        nextTaskOrderByBucket.set(bucket, maxOrder + 1);
    });
    const allocateTaskOrder = (projectId?: string, areaId?: string): number => {
        const bucket = getTaskBucketKey(projectId, areaId);
        const cached = nextTaskOrderByBucket.get(bucket);
        if (cached !== undefined) {
            nextTaskOrderByBucket.set(bucket, cached + 1);
            return cached;
        }
        nextTaskOrderByBucket.set(bucket, 1);
        return 0;
    };

    parsed.tasks.forEach((task) => {
        const taskId = idFor('task', task.sourceKey ?? '');
        if (existingTaskIds.has(taskId)) return;
        const projectId = task.projectSourceKey ? projectIdBySourceKey.get(task.projectSourceKey) : undefined;
        const areaId = !projectId && task.areaSourceKey ? areaIdBySourceKey.get(task.areaSourceKey) : undefined;
        const order = allocateTaskOrder(projectId, areaId);
        const checklist = task.checklist && task.checklist.length > 0
            ? task.checklist.map((item) => ({
                id: uuidv4(),
                title: item.title,
                isCompleted: item.isCompleted,
            }))
            : undefined;
        const createdAt = resolveTimestamp(task.createdAt, nowIso);
        const updatedAt = resolveTimestamp(task.updatedAt, createdAt);
        const status = resolveTaskStatus(task.status, projectId);
        const completedAt = status === 'done' || status === 'archived'
            ? task.completedAt ?? updatedAt
            : undefined;
        const nextTask: Task = {
            id: taskId,
            title: task.title,
            status,
            taskMode: checklist ? 'list' : 'task',
            priority: task.priority,
            contexts: task.contexts ?? [],
            tags: task.tags ?? [],
            checklist,
            description: task.description,
            startTime: task.startTime,
            dueDate: task.dueDate,
            recurrence: task.recurrence,
            completedAt,
            pushCount: 0,
            createdAt,
            updatedAt,
            rev: nextRevision(),
            revBy: deviceState.deviceId,
            order,
            orderNum: order,
            ...(projectId ? { projectId } : {}),
            ...(areaId ? { areaId } : {}),
        };
        nextData.tasks.push(nextTask);
        existingTaskIds.add(taskId);
        importedTaskCount += 1;
        importedChecklistItemCount += checklist?.length ?? 0;
        if (!projectId) importedStandaloneTaskCount += 1;
    });

    return {
        data: nextData,
        importedAreaCount,
        importedChecklistItemCount,
        importedProjectCount,
        importedStandaloneTaskCount,
        importedTaskCount,
        warnings,
    };
}
