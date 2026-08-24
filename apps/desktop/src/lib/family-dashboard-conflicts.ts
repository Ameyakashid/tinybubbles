import { listMergeConflictSamples } from '@tinybubbles/core';
import type {
    AppSettings,
    ConflictSampleEntity,
    EntityConflictSample,
    Task,
} from '@tinybubbles/core';

export type FamilyConflictNotice = {
    key: string;
    entity: ConflictSampleEntity | 'item';
    id: string;
    title: string;
    at: string;
    detail: string;
};

export type FamilyConflictSummary = {
    notices: FamilyConflictNotice[];
    undisclosedCount: number;
};

const entityName = (entity: FamilyConflictNotice['entity']): string => {
    if (entity === 'task') return 'Task';
    if (entity === 'person') return 'Person';
    return entity === 'item' ? 'Synced item' : `${entity[0]?.toUpperCase()}${entity.slice(1)}`;
};

const losingSide = (sample: EntityConflictSample): string =>
    sample.winner === 'incoming' ? 'this app' : 'the other device';

const describeSample = (sample: EntityConflictSample, currentTask?: Task): string => {
    const discardedFrom = losingSide(sample);
    if (sample.reasons.includes('deleteState')) {
        const discardedDeletion = sample.winner === 'incoming'
            ? Boolean(sample.localDeletedAt)
            : Boolean(sample.incomingDeletedAt);
        return discardedDeletion
            ? `A deletion from ${discardedFrom} was discarded. The task was kept.`
            : `The live version from ${discardedFrom} was discarded. The record does not retain its contents.`;
    }

    const completionChanged = sample.diffKeys.includes('completedAt') || sample.diffKeys.includes('status');
    if (completionChanged) {
        const currentIsComplete = currentTask?.status === 'done' || Boolean(currentTask?.completedAt);
        return currentIsComplete
            ? `Completion information from ${discardedFrom} was discarded. The record does not retain its exact value.`
            : `A possible completion from ${discardedFrom} was discarded. The record retained that completion fields differed, but not their values.`;
    }

    if (sample.diffKeys.length > 0) {
        return `An edit from ${discardedFrom} was discarded. It changed ${sample.diffKeys.join(', ')}, but the record does not retain the discarded values.`;
    }

    return `The version from ${discardedFrom} was discarded. The record retains timestamps and revision evidence, but not the discarded contents.`;
};

export function buildFamilyConflictSummary(
    settings: Pick<AppSettings, 'lastSyncAt' | 'lastSyncStatus' | 'lastSyncStats' | 'lastSyncHistory'>,
    tasks: Task[],
): FamilyConflictSummary {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const samples = listMergeConflictSamples(settings.lastSyncStats);
    const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
    const conflictHistory = (settings.lastSyncHistory ?? []).filter((entry) => entry.status === 'conflict');
    const cycles = conflictHistory.length > 0
        ? conflictHistory
        : settings.lastSyncStatus === 'conflict'
            ? [{
                at: settings.lastSyncAt ?? '',
                status: 'conflict' as const,
                conflicts: samples.length,
                conflictIds: samples.map(({ id }) => id),
                maxClockSkewMs: 0,
                timestampAdjustments: 0,
            }]
            : [];

    const notices: FamilyConflictNotice[] = [];
    let undisclosedCount = 0;
    cycles.forEach((cycle, cycleIndex) => {
        const ids = [...new Set(cycle.conflictIds)];
        undisclosedCount += Math.max(0, cycle.conflicts - ids.length);
        ids.forEach((id) => {
            // Detailed samples only describe the latest merge. Do not attach
            // them to an older occurrence of an ID that later conflicted again.
            const sample = settings.lastSyncStatus === 'conflict' && cycleIndex === 0
                ? sampleById.get(id)
                : undefined;
            const task = taskById.get(id);
            const entity = sample?.entity ?? (task ? 'task' : 'item');
            const title = task?.title ?? `${entityName(entity)} ${id}`;
            const at = sample
                ? sample.winner === 'incoming' ? sample.localUpdatedAt : sample.incomingUpdatedAt
                : cycle.at;
            notices.push({
                key: `${cycle.at}:${entity}:${id}`,
                entity,
                id,
                title,
                at,
                detail: sample
                    ? describeSample(sample, task)
                    : 'A conflict was resolved automatically. The history retained its ID and time, but not the discarded changes.',
            });
        });
    });

    return { notices, undisclosedCount };
}
