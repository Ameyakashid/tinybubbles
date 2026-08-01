import { describe, expect, it } from 'vitest';
import {
    areRemoteSyncDocumentsEqual,
    computeRemoteSyncDocumentFingerprint,
    computeSyncPayloadFingerprint,
    parseSyncDocument,
    toRemoteSyncDocument,
} from './index';
import type { AppData } from './types';

const NOW = '2026-08-01T12:00:00.000Z';

const createData = (title = 'Task'): AppData => ({
    tasks: [{
        id: 'task-1',
        title,
        status: 'inbox',
        tags: [],
        contexts: [],
        createdAt: NOW,
        updatedAt: NOW,
    }],
    projects: [],
    sections: [],
    areas: [],
    people: [],
    settings: {},
});

describe('Sync document lifecycle', () => {
    it('accepts old partial documents and normalizes them idempotently', () => {
        const first = parseSyncDocument({
            tasks: [],
            projects: [],
            areas: [],
            settings: {},
        }, 'remote');

        expect(first).toEqual({
            ok: true,
            data: {
                tasks: [],
                projects: [],
                sections: [],
                areas: [],
                people: [],
                settings: {},
            },
        });
        if (!first.ok) throw new Error('Expected the partial document to be accepted');

        expect(parseSyncDocument(first.data, 'remote')).toEqual(first);
    });

    it('reports malformed raw fields before normalization can replace them', () => {
        const result = parseSyncDocument({ tasks: 'not-an-array' }, 'remote');

        expect(result).toEqual({
            ok: false,
            errors: ['remote payload field "tasks" must be an array when present'],
        });
    });

    it('uses the same remote shape for equality and fingerprints', () => {
        const left = createData();
        left.settings.lastSyncAt = NOW;
        left.settings.lastSyncStatus = 'success';
        const right = createData();
        right.settings.lastSyncAt = '2026-08-02T12:00:00.000Z';
        right.settings.lastSyncStatus = 'error';

        const leftRemote = toRemoteSyncDocument(left);
        const rightRemote = toRemoteSyncDocument(right);

        expect(areRemoteSyncDocumentsEqual(leftRemote, rightRemote)).toBe(true);
        expect(computeRemoteSyncDocumentFingerprint(leftRemote)).toBe(
            computeRemoteSyncDocumentFingerprint(rightRemote),
        );
        expect(computeRemoteSyncDocumentFingerprint(leftRemote)).toBe(
            computeSyncPayloadFingerprint(left),
        );

        const changedRemote = toRemoteSyncDocument(createData('Changed'));
        expect(areRemoteSyncDocumentsEqual(leftRemote, changedRemote)).toBe(false);
        expect(computeRemoteSyncDocumentFingerprint(leftRemote)).not.toBe(
            computeRemoteSyncDocumentFingerprint(changedRemote),
        );
    });
});
