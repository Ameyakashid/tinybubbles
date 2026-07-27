import { describe, expect, it } from 'vitest';

import {
    countActiveRecords,
    createBackupFileName,
    prepareRestoredBackupDataForSync,
    serializeBackupData,
    validateBackupJson,
} from './backup-transfer';
import { mergeAppData } from './sync';
import { SYNC_BACKUP_RESTORE_REV_BY } from './sync-revision';
import { purgeExpiredTombstones } from './sync-tombstones';
import type { AppData } from './types';

const buildAppData = (): AppData => {
    const now = '2026-03-30T12:00:00.000Z';
    return {
        tasks: [
            {
                id: 'task-1',
                title: 'Task',
                status: 'inbox',
                tags: [],
                contexts: [],
                createdAt: now,
                updatedAt: now,
            },
        ],
        projects: [
            {
                id: 'project-1',
                title: 'Project',
                status: 'active',
                color: '#94a3b8',
                order: 0,
                tagIds: [],
                createdAt: now,
                updatedAt: now,
            },
        ],
        sections: [],
        areas: [],
        people: [],
        settings: {},
    };
};

describe('backup transfer', () => {
    it('validates a serialized backup and derives metadata from the file name', () => {
        const data = buildAppData();
        const fileName = createBackupFileName(new Date('2026-03-30T12:34:56.789Z'));
        const result = validateBackupJson(serializeBackupData(data), { fileName });

        expect(result.valid).toBe(true);
        expect(result.data).toEqual(data);
        expect(result.metadata?.taskCount).toBe(1);
        expect(result.metadata?.projectCount).toBe(1);
        expect(result.metadata?.backupAt).toBe('2026-03-30T12:34:56.789Z');
        expect(result.warnings).toEqual([]);
    });

    it('rejects non-Mindwtr JSON payloads', () => {
        const result = validateBackupJson(JSON.stringify({
            tasks: {},
            projects: [],
            sections: [],
            areas: [],
            settings: {},
        }), {
            fileName: 'package.json',
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('tasks');
    });

    it('marks restored live backup records as fresh local sync operations', () => {
        const data = buildAppData();
        const restoredAt = '2026-04-01T00:00:10.000Z';
        data.areas = [{
            id: 'area-1',
            name: 'Area',
            order: 0,
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        data.people = [{
            id: 'person-1',
            name: 'Alex',
            note: 'Design lead',
            referenceLink: 'https://example.com/alex',
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        data.projects[0] = {
            ...data.projects[0],
            areaId: 'area-1',
            rev: 4,
            revBy: 'old-device',
        };
        data.sections = [{
            id: 'section-1',
            projectId: 'project-1',
            title: 'Section',
            description: '',
            order: 0,
            isCollapsed: false,
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        data.tasks[0] = {
            ...data.tasks[0],
            areaId: 'area-1',
            projectId: 'project-1',
            sectionId: 'section-1',
            rev: 4,
            revBy: 'old-device',
        };
        data.tasks.push({
            ...data.tasks[0],
            id: 'deleted-task',
            title: 'Deleted task',
            deletedAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
            rev: 8,
            revBy: 'delete-device',
        });

        const restored = prepareRestoredBackupDataForSync(data, { restoredAt });

        expect(restored.tasks.find((task) => task.id === 'task-1')).toMatchObject({
            updatedAt: restoredAt,
            rev: 5,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        });
        expect(restored.projects[0]).toMatchObject({
            updatedAt: restoredAt,
            rev: 5,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        });
        expect(restored.sections[0]).toMatchObject({
            updatedAt: restoredAt,
            rev: 5,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        });
        expect(restored.areas[0]).toMatchObject({
            updatedAt: restoredAt,
            rev: 5,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        });
        expect(restored.people?.[0]).toMatchObject({
            updatedAt: restoredAt,
            rev: 5,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        });
        expect(restored.tasks.find((task) => task.id === 'deleted-task')).toMatchObject({
            updatedAt: restoredAt,
            rev: 9,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            deletedAt: restoredAt,
        });
        expect(restored.settings).toMatchObject({
            pendingRemoteWriteAt: restoredAt,
            pendingRemoteWriteRetryAt: undefined,
            pendingRemoteWriteAttempts: undefined,
        });
    });

    it('does not restore device-local mobile app lock state', () => {
        const data = buildAppData();
        const restoredAt = '2026-04-01T00:00:10.000Z';
        data.settings = {
            diagnostics: { loggingEnabled: true },
            security: { mobileAppLockEnabled: true },
        };

        const restored = prepareRestoredBackupDataForSync(data, { restoredAt });

        expect(restored.settings.security).toBeUndefined();
        expect(restored.settings.diagnostics).toEqual({ loggingEnabled: true });
        expect(restored.settings.pendingRemoteWriteAt).toBe(restoredAt);
    });

    it('stamps backup rows above current same-id revisions, including deletions', () => {
        const restoredAt = '2026-04-01T00:00:10.000Z';
        const backup = buildAppData();
        backup.tasks = [
            { ...backup.tasks[0], title: 'Backup wins', rev: 2, revBy: 'backup-device' },
            {
                ...backup.tasks[0],
                id: 'deleted-task',
                title: 'Deleted in backup',
                deletedAt: '2026-03-30T13:00:00.000Z',
                rev: 3,
                revBy: 'backup-device',
            },
        ];
        const previousData = buildAppData();
        previousData.tasks = [
            { ...previousData.tasks[0], title: 'Newer current row', rev: 10, revBy: 'current-device' },
            {
                ...previousData.tasks[0],
                id: 'deleted-task',
                title: 'Current live row',
                rev: 12,
                revBy: 'current-device',
            },
        ];

        const restored = prepareRestoredBackupDataForSync(backup, { previousData, restoredAt });

        expect(restored.tasks.find((task) => task.id === 'task-1')).toMatchObject({
            title: 'Backup wins',
            rev: 11,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });
        expect(restored.tasks.find((task) => task.id === 'deleted-task')).toMatchObject({
            title: 'Deleted in backup',
            deletedAt: restoredAt,
            rev: 13,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });

        const forward = mergeAppData(restored, previousData);
        const reverse = mergeAppData(previousData, restored);
        const forwardLive = forward.tasks.find((task) => task.id === 'task-1');
        const reverseLive = reverse.tasks.find((task) => task.id === 'task-1');
        const forwardDeleted = forward.tasks.find((task) => task.id === 'deleted-task');
        const reverseDeleted = reverse.tasks.find((task) => task.id === 'deleted-task');
        expect(forwardLive).toEqual(reverseLive);
        expect(forwardLive).toMatchObject({
            title: 'Backup wins',
            rev: 11,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });
        expect(forwardDeleted).toEqual(reverseDeleted);
        expect(forwardDeleted).toMatchObject({
            title: 'Deleted in backup',
            deletedAt: restoredAt,
            rev: 13,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });
    });

    it('refreshes expired backup and carried tombstones so restore cleanup retains them', () => {
        const restoredAt = '2026-04-01T00:00:10.000Z';
        const backup = buildAppData();
        backup.tasks.push({
            ...backup.tasks[0],
            id: 'backup-deleted-task',
            title: 'Deleted in old backup',
            deletedAt: '2025-01-01T00:00:00.000Z',
            rev: 3,
            revBy: 'backup-device',
        });
        const previousData = buildAppData();
        previousData.tasks.push({
            ...previousData.tasks[0],
            id: 'purged-task',
            title: 'Purged after backup',
            deletedAt: '2025-01-01T00:00:00.000Z',
            purgedAt: '2025-01-02T00:00:00.000Z',
            rev: 7,
            revBy: 'current-device',
        });

        const restored = prepareRestoredBackupDataForSync(backup, { previousData, restoredAt });
        const refreshed = purgeExpiredTombstones(restored, restoredAt, 90);

        expect(restored.tasks.find((task) => task.id === 'purged-task')).toMatchObject({
            deletedAt: '2025-01-01T00:00:00.000Z',
            purgedAt: restoredAt,
            rev: 8,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });
        expect(restored.tasks.find((task) => task.id === 'backup-deleted-task')).toMatchObject({
            deletedAt: restoredAt,
            rev: 4,
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
            updatedAt: restoredAt,
        });
        expect(refreshed.removedTaskTombstones).toBe(0);
        expect(refreshed.data.tasks.find((task) => task.id === 'purged-task')).toMatchObject({
            deletedAt: '2025-01-01T00:00:00.000Z',
            purgedAt: restoredAt,
        });
        expect(refreshed.data.tasks.find((task) => task.id === 'backup-deleted-task')).toMatchObject({
            deletedAt: restoredAt,
        });
    });

    it('keeps recovered backup data live when remote sync still has stale cascade tombstones', () => {
        const deletedAt = '2026-04-01T00:00:05.000Z';
        const restoredAt = '2026-04-01T00:00:10.000Z';
        const backup = buildAppData();
        backup.areas = [{
            id: 'area-1',
            name: 'Area',
            order: 0,
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        backup.people = [{
            id: 'person-1',
            name: 'Alex',
            note: 'Design lead',
            referenceLink: 'https://example.com/alex',
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        backup.projects[0] = {
            ...backup.projects[0],
            areaId: 'area-1',
            areaTitle: 'Area',
            rev: 4,
            revBy: 'old-device',
        };
        backup.sections = [{
            id: 'section-1',
            projectId: 'project-1',
            title: 'Section',
            description: '',
            order: 0,
            isCollapsed: false,
            createdAt: '2026-03-30T12:00:00.000Z',
            updatedAt: '2026-03-30T12:00:00.000Z',
            rev: 4,
            revBy: 'old-device',
        }];
        backup.tasks[0] = {
            ...backup.tasks[0],
            areaId: 'area-1',
            projectId: 'project-1',
            sectionId: 'section-1',
            rev: 4,
            revBy: 'old-device',
        };
        const restored = prepareRestoredBackupDataForSync(backup, { restoredAt });
        const remote: AppData = {
            tasks: [{
                ...backup.tasks[0],
                updatedAt: deletedAt,
                deletedAt,
                rev: 99,
                revBy: 'remote-delete',
            }],
            projects: [{
                ...backup.projects[0],
                updatedAt: deletedAt,
                deletedAt,
                rev: 99,
                revBy: 'remote-delete',
            }],
            sections: [{
                ...backup.sections[0],
                updatedAt: deletedAt,
                deletedAt,
                rev: 99,
                revBy: 'remote-delete',
            }],
            areas: [{
                ...backup.areas[0],
                updatedAt: deletedAt,
                deletedAt,
                rev: 99,
                revBy: 'remote-delete',
            }],
            people: [{
                ...backup.people![0],
                updatedAt: deletedAt,
                deletedAt,
                rev: 99,
                revBy: 'remote-delete',
            }],
            settings: {},
        };

        const forward = mergeAppData(restored, remote, { nowIso: restoredAt });
        const reverse = mergeAppData(remote, restored, { nowIso: restoredAt });

        for (const merged of [forward, reverse]) {
            expect(merged.tasks[0]).toMatchObject({
                updatedAt: restoredAt,
                revBy: SYNC_BACKUP_RESTORE_REV_BY,
            });
            expect(merged.tasks[0].deletedAt).toBeUndefined();
            expect(merged.projects[0]).toMatchObject({
                updatedAt: restoredAt,
                revBy: SYNC_BACKUP_RESTORE_REV_BY,
            });
            expect(merged.projects[0].deletedAt).toBeUndefined();
            expect(merged.sections[0]).toMatchObject({
                updatedAt: restoredAt,
                revBy: SYNC_BACKUP_RESTORE_REV_BY,
            });
            expect(merged.sections[0].deletedAt).toBeUndefined();
            expect(merged.areas[0]).toMatchObject({
                updatedAt: restoredAt,
                revBy: SYNC_BACKUP_RESTORE_REV_BY,
            });
            expect(merged.areas[0].deletedAt).toBeUndefined();
            expect(merged.people?.[0]).toMatchObject({
                updatedAt: restoredAt,
                revBy: SYNC_BACKUP_RESTORE_REV_BY,
            });
            expect(merged.people?.[0].deletedAt).toBeUndefined();
        }
    });

    it('does not let the remote hand back records the restored backup dropped (#939)', () => {
        // The reported flow: import a pile of tasks, delete them, then restore a
        // backup taken before the import. The backup has no trace of them, the
        // remote still does, and without carrying the deletion forward the next
        // merge reads that absence as "new over there" and restores them.
        const restoredAt = '2026-04-01T00:00:10.000Z';
        const backup = buildAppData();
        const previousData: AppData = {
            ...backup,
            tasks: [
                ...backup.tasks,
                {
                    ...backup.tasks[0],
                    id: 'imported-task',
                    title: 'Imported then deleted',
                    rev: 3,
                    revBy: 'other-device',
                },
            ],
        };
        const remote: AppData = {
            ...previousData,
            tasks: previousData.tasks.map((task) => ({ ...task, rev: 12, revBy: 'other-device' })),
            settings: {},
        };

        const restored = prepareRestoredBackupDataForSync(backup, { previousData, restoredAt });

        for (const merged of [
            mergeAppData(restored, remote, { nowIso: restoredAt }),
            mergeAppData(remote, restored, { nowIso: restoredAt }),
        ]) {
            const imported = merged.tasks.find((task) => task.id === 'imported-task');
            expect(imported?.deletedAt).toBe(restoredAt);
            expect(merged.tasks.filter((task) => !task.deletedAt).map((task) => task.id)).toEqual(['task-1']);
        }
    });

    it('leaves records the restoring device never saw alone (#939)', () => {
        // Absence from a backup only means "deleted" for ids this device knew
        // about. A task another device created while this one was offline is not
        // ours to tombstone.
        const restoredAt = '2026-04-01T00:00:10.000Z';
        const backup = buildAppData();
        const restored = prepareRestoredBackupDataForSync(backup, { previousData: backup, restoredAt });
        const remote: AppData = {
            ...backup,
            tasks: [
                ...backup.tasks,
                {
                    ...backup.tasks[0],
                    id: 'other-device-task',
                    title: 'Made elsewhere',
                    rev: 2,
                    revBy: 'other-device',
                },
            ],
            settings: {},
        };

        const merged = mergeAppData(restored, remote, { nowIso: restoredAt });

        expect(merged.tasks.find((task) => task.id === 'other-device-task')?.deletedAt).toBeUndefined();
    });

    describe('countActiveRecords', () => {
        // Pinned verbatim from desktop's and mobile's data-transfer.ts before this refactor —
        // both had this exact 4-field object and both silently omitted `people`. Per the "a test
        // that iterates the new thing can't catch it shrinking" gotcha, this compares against the
        // OLD predicate directly rather than re-deriving expectations from countActiveRecords
        // itself, so a regression that drops a field back out would fail this test.
        const oldFourFieldPredicate = (data: AppData) => ({
            tasks: data.tasks.filter((task) => !task.deletedAt).length,
            projects: data.projects.filter((project) => !project.deletedAt).length,
            sections: data.sections.filter((section) => !section.deletedAt).length,
            areas: data.areas.filter((area) => !area.deletedAt).length,
        });

        it('matches the old hand-written predicate on every field it had, plus counts people', () => {
            const now = '2026-03-30T12:00:00.000Z';
            const data: AppData = {
                ...buildAppData(),
                sections: [
                    { id: 'section-1', projectId: 'project-1', title: 'Live', order: 0, createdAt: now, updatedAt: now },
                    { id: 'section-2', projectId: 'project-1', title: 'Gone', order: 1, createdAt: now, updatedAt: now, deletedAt: now },
                ],
                areas: [
                    { id: 'area-1', name: 'Live area', color: '#000', order: 0, createdAt: now, updatedAt: now },
                    { id: 'area-2', name: 'Gone area', color: '#000', order: 1, createdAt: now, updatedAt: now, deletedAt: now },
                ],
                people: [
                    { id: 'person-1', name: 'Alex', createdAt: now, updatedAt: now },
                    { id: 'person-2', name: 'Departed', createdAt: now, updatedAt: now, deletedAt: now },
                ],
            };

            const result = countActiveRecords(data);

            expect(result).toMatchObject(oldFourFieldPredicate(data));
            expect(result.people).toBe(1);
        });

        it('treats a missing people array as zero, not a crash', () => {
            const data: AppData = { ...buildAppData(), people: undefined as unknown as AppData['people'] };
            expect(countActiveRecords(data).people).toBe(0);
        });
    });
});
