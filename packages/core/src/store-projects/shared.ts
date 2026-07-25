import type { AppData, Area, Person, Project, Section, Task, TaskStatus } from '../types';
import type { StoreActionResult, TaskStore } from '../store-types';
import {
    buildSaveSnapshot,
    ensureDeviceId,
    getNextDataChangeAt,
    nextRevision,
    normalizeTagId,
    replaceEntitiesInArray,
    replaceEntitiesInMap,
    selectVisibleAreas,
    selectVisiblePeople,
    selectVisibleProjects,
    selectVisibleSections,
} from '../store-helpers';

export type ProjectActions = Pick<
    TaskStore,
    | 'addProject'
    | 'updateProject'
    | 'deleteProject'
    | 'restoreProject'
    | 'purgeProject'
    | 'purgeDeletedProjects'
    | 'duplicateProject'
    | 'toggleProjectFocus'
    | 'addSection'
    | 'updateSection'
    | 'deleteSection'
    | 'reorderSections'
    | 'addArea'
    | 'updateArea'
    | 'deleteArea'
    | 'restoreArea'
    | 'reorderAreas'
    | 'reorderProjects'
    | 'reorderProjectTasks'
    | 'reorderBoardTasks'
    | 'addPerson'
    | 'updatePerson'
    | 'renamePerson'
    | 'deletePerson'
    | 'restorePerson'
    | 'deleteTag'
    | 'renameTag'
    | 'deleteContext'
    | 'renameContext'
>;

export type ProjectActionContext = {
    set: (partial: Partial<TaskStore> | ((state: TaskStore) => Partial<TaskStore> | TaskStore)) => void;
    get: () => TaskStore;
    debouncedSave: (data: AppData, onError?: (msg: string) => void) => void;
};

export type ProjectCoreActions = Pick<
    ProjectActions,
    | 'addProject'
    | 'updateProject'
    | 'deleteProject'
    | 'restoreProject'
    | 'purgeProject'
    | 'purgeDeletedProjects'
    | 'duplicateProject'
    | 'toggleProjectFocus'
>;

export type SectionActions = Pick<ProjectActions, 'addSection' | 'updateSection' | 'deleteSection'>;

export type AreaActions = Pick<ProjectActions, 'addArea' | 'updateArea' | 'deleteArea' | 'restoreArea' | 'reorderAreas'>;

export type OrderingActions = Pick<ProjectActions, 'reorderProjects' | 'reorderProjectTasks' | 'reorderBoardTasks' | 'reorderSections'>;

export type PeopleActions = Pick<ProjectActions, 'addPerson' | 'updatePerson' | 'renamePerson' | 'deletePerson' | 'restorePerson'>;

export type TaxonomyActions = Pick<ProjectActions, 'deleteTag' | 'renameTag' | 'deleteContext' | 'renameContext'>;

export type { AppData, Area, Person, Project, Section, Task, TaskStatus };

export const actionOk = (extra?: Omit<StoreActionResult, 'success'>): StoreActionResult => ({ success: true, ...extra });
export const actionFail = (error: string): StoreActionResult => ({ success: false, error });

type EntityCollection = 'projects' | 'sections' | 'areas' | 'people';

type EntityByCollection = {
    projects: Project;
    sections: Section;
    areas: Area;
    people: Person;
};

type MutateEntitiesOptions<K extends EntityCollection> = {
    collection: K;
    select: (state: TaskStore) => EntityByCollection[K][];
    buildUpdates: (
        entity: EntityByCollection[K],
        context: { now: string; state: TaskStore },
    ) => Partial<EntityByCollection[K]> | null;
    buildSettings?: (
        state: TaskStore,
        context: { now: string },
    ) => Partial<TaskStore['settings']> | undefined;
    missingMessage?: string;
};

const collectionStateKeys = {
    projects: { all: '_allProjects', map: '_projectsById' },
    sections: { all: '_allSections', map: '_sectionsById' },
    areas: { all: '_allAreas', map: '_areasById' },
    people: { all: '_allPeople', map: '_peopleById' },
} as const;

const selectVisibleEntities = <K extends EntityCollection>(
    collection: K,
    entities: EntityByCollection[K][],
): EntityByCollection[K][] => {
    switch (collection) {
        case 'projects':
            return selectVisibleProjects(entities as Project[]) as EntityByCollection[K][];
        case 'sections':
            return selectVisibleSections(entities as Section[]) as EntityByCollection[K][];
        case 'areas':
            return selectVisibleAreas(entities as Area[]) as EntityByCollection[K][];
        case 'people':
            return selectVisiblePeople(entities as Person[]) as EntityByCollection[K][];
    }
};

export const mutateEntities = async <K extends EntityCollection>(
    { set, debouncedSave }: Pick<ProjectActionContext, 'set' | 'debouncedSave'>,
    options: MutateEntitiesOptions<K>,
): Promise<StoreActionResult> => {
    const changeAt = Date.now();
    const now = new Date().toISOString();
    let snapshot: AppData | null = null;
    let missing = false;
    set((state) => {
        const selectedEntities = options.select(state);
        if (selectedEntities.length === 0) {
            missing = Boolean(options.missingMessage);
            return state;
        }
        const pendingUpdates = selectedEntities
            .map((entity) => ({
                entity,
                updates: options.buildUpdates(entity, { now, state }),
            }))
            .filter((entry) => entry.updates !== null);
        const settingsUpdates = options.buildSettings?.(state, { now });
        if (pendingUpdates.length === 0 && settingsUpdates === undefined) return state;

        const deviceState = ensureDeviceId(state.settings);
        const changedEntities = pendingUpdates.map(({ entity, updates }) => ({
            ...entity,
            ...updates,
            updatedAt: now,
            rev: nextRevision(entity.rev),
            revBy: deviceState.deviceId,
        })) as EntityByCollection[K][];
        const { all: allKey, map: mapKey } = collectionStateKeys[options.collection];
        const allEntities = state[allKey] as EntityByCollection[K][];
        const nextAllEntities = replaceEntitiesInArray(allEntities, changedEntities);
        const nextVisibleEntities = selectVisibleEntities(options.collection, nextAllEntities);
        const nextSettings = settingsUpdates === undefined
            ? deviceState.settings
            : { ...deviceState.settings, ...settingsUpdates };
        const settingsChanged = settingsUpdates !== undefined || deviceState.updated;

        snapshot = buildSaveSnapshot(state, {
            [options.collection]: nextAllEntities,
            ...(settingsChanged ? { settings: nextSettings } : {}),
        });
        return {
            [options.collection]: nextVisibleEntities,
            [allKey]: nextAllEntities,
            [mapKey]: replaceEntitiesInMap(
                state[mapKey] as Map<string, EntityByCollection[K]>,
                changedEntities,
            ),
            lastDataChangeAt: getNextDataChangeAt(state.lastDataChangeAt, changeAt),
            ...(settingsChanged ? { settings: nextSettings } : {}),
        } as Partial<TaskStore>;
    });
    if (snapshot) {
        debouncedSave(snapshot, (msg) => set({ error: msg }));
    }
    return missing ? actionFail(options.missingMessage ?? 'Entity not found') : actionOk();
};

export const formatTagIdPreservingCase = (value: string): string => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

export const dedupeTagValuesLastWins = (values: string[], preferredValue?: string): string[] => {
    const preferredNormalized = preferredValue ? normalizeTagId(preferredValue) : '';
    const seen = new Set<string>();
    const dedupedReversed: string[] = [];
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const value = values[index];
        const normalized = normalizeTagId(value);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        dedupedReversed.push(normalized === preferredNormalized ? preferredValue! : value);
    }
    return dedupedReversed.reverse();
};
