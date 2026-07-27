import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AppData, Attachment, Project, Task } from '@mindwtr/core';
import {
    appendPendingRemoteAttachmentDeletes,
    collectPendingRemoteDeletesForProjectPurge,
    collectReferencedAttachmentCloudKeys,
    collectRetainedAttachmentCloudKeysForProjectPurge,
    garbageCollectOrphanAttachments,
    getAttachmentCloudKey,
    stripProjectAttachmentRemoteMetadata,
} from './server-attachments';

const iso = '2026-01-01T00:00:00.000Z';

const makeTask = (overrides: Pick<Task, 'id' | 'title'> & Partial<Task>): Task => ({
    status: 'inbox',
    tags: [],
    contexts: [],
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
});

const makeProject = (overrides: Pick<Project, 'id' | 'title'> & Partial<Project>): Project => ({
    status: 'active',
    color: '#6B7280',
    order: 0,
    tagIds: [],
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
});

const makeFileAttachment = (overrides: Pick<Attachment, 'id'> & Partial<Attachment>): Attachment => ({
    kind: 'file',
    title: 'file',
    uri: '',
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
});

const emptyAppData = (): AppData => ({ tasks: [], projects: [], sections: [], areas: [], people: [], settings: {} });

// Ages a file past garbageCollectOrphanAttachments' 5-minute GC grace window.
const expireFile = (path: string): void => {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    utimesSync(path, staleTime, staleTime);
};

describe('getAttachmentCloudKey', () => {
    test('normalizes the cloud key for file attachments only', () => {
        expect(getAttachmentCloudKey(makeFileAttachment({ id: 'a1', cloudKey: 'folder/file.bin' }))).toBe('folder/file.bin');
        expect(getAttachmentCloudKey(makeFileAttachment({ id: 'a2', cloudKey: undefined }))).toBeNull();
        expect(getAttachmentCloudKey(makeFileAttachment({ id: 'a3', kind: 'link', uri: 'https://example.com', cloudKey: 'ignored' }))).toBeNull();
        expect(getAttachmentCloudKey(makeFileAttachment({ id: 'a4', cloudKey: '../escape' }))).toBeNull();
    });
});

describe('stripProjectAttachmentRemoteMetadata', () => {
    test('clears cloudKey/localStatus only on file attachments and leaves other kinds untouched', () => {
        const fileAttachment = makeFileAttachment({ id: 'f1', cloudKey: 'folder/file.bin', localStatus: 'available' });
        const linkAttachment: Attachment = { id: 'l1', kind: 'link', title: 'link', uri: 'https://example.com', createdAt: iso, updatedAt: iso };
        const stripped = stripProjectAttachmentRemoteMetadata([fileAttachment, linkAttachment]);

        expect(stripped?.[0]).toEqual({ ...fileAttachment, cloudKey: undefined, localStatus: undefined });
        expect(stripped?.[1]).toBe(linkAttachment);
    });

    test('passes through undefined unchanged', () => {
        expect(stripProjectAttachmentRemoteMetadata(undefined)).toBeUndefined();
    });
});

describe('collectReferencedAttachmentCloudKeys', () => {
    test('only counts non-deleted file attachments on non-deleted owners', () => {
        const data = emptyAppData();
        data.tasks = [
            makeTask({
                id: 'live-task',
                title: 'Live',
                attachments: [makeFileAttachment({ id: 'ta1', cloudKey: 'live-task/keep.bin' })],
            }),
            makeTask({
                id: 'deleted-task',
                title: 'Deleted',
                deletedAt: iso,
                attachments: [makeFileAttachment({ id: 'ta2', cloudKey: 'deleted-task/excluded.bin' })],
            }),
        ];
        data.projects = [
            makeProject({
                id: 'live-project',
                title: 'Live',
                attachments: [
                    makeFileAttachment({ id: 'pa1', cloudKey: 'live-project/keep.bin' }),
                    makeFileAttachment({ id: 'pa2', cloudKey: 'live-project/deleted-attachment.bin', deletedAt: iso }),
                    { id: 'pa3', kind: 'link', title: 'link', uri: 'https://example.com', createdAt: iso, updatedAt: iso },
                ],
            }),
        ];

        const referenced = collectReferencedAttachmentCloudKeys(data);
        expect(referenced).toEqual(new Set(['live-task/keep.bin', 'live-project/keep.bin']));
    });
});

describe('collectRetainedAttachmentCloudKeysForProjectPurge', () => {
    test('excludes the purging project and any already-purged project, keeps everything else', () => {
        const data = emptyAppData();
        data.projects = [
            makeProject({ id: 'purging', title: 'Purging', attachments: [makeFileAttachment({ id: 'a1', cloudKey: 'shared.bin' })] }),
            makeProject({ id: 'sibling', title: 'Sibling', attachments: [makeFileAttachment({ id: 'a2', cloudKey: 'shared.bin' })] }),
            makeProject({
                id: 'already-purged',
                title: 'Already purged',
                purgedAt: iso,
                attachments: [makeFileAttachment({ id: 'a3', cloudKey: 'already-purged-only.bin' })],
            }),
        ];
        data.tasks = [
            makeTask({ id: 'live-task', title: 'Live', attachments: [makeFileAttachment({ id: 'a4', cloudKey: 'from-task.bin' })] }),
            makeTask({
                id: 'purged-task',
                title: 'Purged',
                purgedAt: iso,
                attachments: [makeFileAttachment({ id: 'a5', cloudKey: 'purged-task-only.bin' })],
            }),
        ];

        const retained = collectRetainedAttachmentCloudKeysForProjectPurge(data, 'purging');
        // 'shared.bin' survives because the sibling project also references it; the
        // purging project's own reference to it does not count towards retention.
        expect(retained).toEqual(new Set(['shared.bin', 'from-task.bin']));
    });
});

describe('collectPendingRemoteDeletesForProjectPurge', () => {
    test('queues only cloud keys that become unreferenced once the project is purged, deduplicated', () => {
        const purgingProject = makeProject({
            id: 'purging',
            title: 'Purging',
            attachments: [
                makeFileAttachment({ id: 'a1', cloudKey: 'shared.bin', title: 'Shared' }),
                makeFileAttachment({ id: 'a2', cloudKey: 'orphan.bin', title: 'Orphan' }),
                makeFileAttachment({ id: 'a3', cloudKey: 'orphan.bin', title: 'Orphan duplicate' }),
                { id: 'a4', kind: 'link', title: 'Link', uri: 'https://example.com', createdAt: iso, updatedAt: iso },
            ],
        });
        const data = emptyAppData();
        data.projects = [
            purgingProject,
            makeProject({ id: 'sibling', title: 'Sibling', attachments: [makeFileAttachment({ id: 'b1', cloudKey: 'shared.bin' })] }),
        ];

        const pending = collectPendingRemoteDeletesForProjectPurge(purgingProject, data);
        expect(pending).toEqual([{ cloudKey: 'orphan.bin', title: 'Orphan' }]);
    });

    test('falls back to the cloud key as the title when the attachment has none', () => {
        const purgingProject = makeProject({
            id: 'purging',
            title: 'Purging',
            attachments: [{ ...makeFileAttachment({ id: 'a1', cloudKey: 'orphan.bin' }), title: '' }],
        });
        const pending = collectPendingRemoteDeletesForProjectPurge(purgingProject, emptyAppData());
        expect(pending).toEqual([{ cloudKey: 'orphan.bin', title: 'orphan.bin' }]);
    });
});

describe('appendPendingRemoteAttachmentDeletes', () => {
    test('keeps the existing entry on a cloud-key collision and appends genuinely new ones', () => {
        const settings: AppData['settings'] = {
            attachments: {
                pendingRemoteDeletes: [{ cloudKey: 'existing.bin', title: 'Existing', attempts: 2 }],
            },
        };
        const merged = appendPendingRemoteAttachmentDeletes(settings, [
            { cloudKey: 'existing.bin', title: 'Should not override' },
            { cloudKey: 'new.bin', title: 'New' },
        ]);
        expect(merged.attachments?.pendingRemoteDeletes).toEqual([
            { cloudKey: 'existing.bin', title: 'Existing', attempts: 2 },
            { cloudKey: 'new.bin', title: 'New' },
        ]);
    });

    test('returns the same settings reference when there is nothing to append', () => {
        const settings: AppData['settings'] = {};
        expect(appendPendingRemoteAttachmentDeletes(settings, [])).toBe(settings);
    });
});

describe('garbageCollectOrphanAttachments', () => {
    let sandbox = '';

    const withSandbox = (fn: (dataDir: string) => void) => {
        sandbox = mkdtempSync(join(tmpdir(), 'mindwtr-cloud-attachment-gc-'));
        try {
            fn(sandbox);
        } finally {
            rmSync(sandbox, { recursive: true, force: true });
            sandbox = '';
        }
    };

    test('is a no-op and creates nothing when the namespace has no attachments directory yet', () => {
        withSandbox((dataDir) => {
            const key = 'no-attachments-yet';
            const result = garbageCollectOrphanAttachments(dataDir, key, emptyAppData());
            expect(result).toEqual({ deleted: 0, errors: [], kept: 0, scanned: 0 });
            expect(existsSync(join(dataDir, key))).toBe(false);
        });
    });

    test('refuses to scan through a symlinked attachments root', () => {
        withSandbox((dataDir) => {
            const key = 'symlinked-root';
            const outside = join(dataDir, '..', 'outside-gc');
            mkdirSync(outside, { recursive: true });
            mkdirSync(join(dataDir, key), { recursive: true });
            symlinkSync(outside, join(dataDir, key, 'attachments'), 'dir');

            const result = garbageCollectOrphanAttachments(dataDir, key, emptyAppData());
            expect(result).toEqual({
                deleted: 0,
                errors: ['attachment root is not a normal directory'],
                kept: 0,
                scanned: 0,
            });

            rmSync(outside, { recursive: true, force: true });
        });
    });

    test('deletes only unreferenced files past the GC grace window, keeps referenced and fresh ones, and prunes directories emptied by the deletion', () => {
        withSandbox((dataDir) => {
            const key = 'gc-key';
            const attachmentsRoot = join(dataDir, key, 'attachments');
            mkdirSync(join(attachmentsRoot, 'mixed'), { recursive: true });
            mkdirSync(join(attachmentsRoot, 'stale-only'), { recursive: true });
            mkdirSync(join(attachmentsRoot, 'fresh-only'), { recursive: true });

            const referencedPath = join(attachmentsRoot, 'mixed', 'referenced.bin');
            const staleSiblingPath = join(attachmentsRoot, 'mixed', 'stale-sibling.bin');
            const staleOnlyPath = join(attachmentsRoot, 'stale-only', 'stale.bin');
            const freshOnlyPath = join(attachmentsRoot, 'fresh-only', 'fresh.bin');
            writeFileSync(referencedPath, 'referenced');
            writeFileSync(staleSiblingPath, 'stale-sibling');
            writeFileSync(staleOnlyPath, 'stale');
            writeFileSync(freshOnlyPath, 'fresh');
            expireFile(staleSiblingPath);
            expireFile(staleOnlyPath);
            // freshOnlyPath keeps its just-written mtime, inside the grace window.

            const data = emptyAppData();
            data.tasks = [makeTask({
                id: 't1',
                title: 'Task',
                attachments: [makeFileAttachment({ id: 'a1', cloudKey: 'mixed/referenced.bin' })],
            })];

            const result = garbageCollectOrphanAttachments(dataDir, key, data);
            expect(result.deleted).toBe(2);
            expect(result.kept).toBe(2);
            expect(result.scanned).toBe(4);
            expect(result.errors).toEqual([]);
            expect(existsSync(referencedPath)).toBe(true);
            expect(existsSync(staleSiblingPath)).toBe(false);
            expect(existsSync(staleOnlyPath)).toBe(false);
            expect(existsSync(freshOnlyPath)).toBe(true);
            // 'mixed' still has the referenced file, so it survives; 'stale-only' lost
            // its one (deleted) file and is pruned; 'fresh-only' keeps its one
            // (still-within-grace) file, so it survives too.
            expect(existsSync(join(attachmentsRoot, 'mixed'))).toBe(true);
            expect(existsSync(join(attachmentsRoot, 'stale-only'))).toBe(false);
            expect(existsSync(join(attachmentsRoot, 'fresh-only'))).toBe(true);
        });
    });
});
