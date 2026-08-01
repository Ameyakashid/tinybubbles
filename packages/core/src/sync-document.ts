import type { AppData } from './types';
import { normalizeAppData, validateSyncPayloadShape } from './sync-normalization';
import {
    areSyncPayloadsEqual,
    computeStableValueFingerprint,
    sanitizeAppDataForRemote,
} from './sync-helpers';

export type SyncDocumentSource = 'local' | 'remote';

export type SyncDocumentParseResult =
    | { ok: true; data: AppData }
    | { ok: false; errors: string[] };

export const parseSyncDocument = (
    input: unknown,
    source: SyncDocumentSource,
): SyncDocumentParseResult => {
    const errors = validateSyncPayloadShape(input, source);
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, data: normalizeAppData(input as AppData) };
};

declare const remoteSyncDocumentBrand: unique symbol;

/** An AppData snapshot after device-local fields have been removed for transport. */
export type RemoteSyncDocument = AppData & {
    readonly [remoteSyncDocumentBrand]: true;
};

export const toRemoteSyncDocument = (data: AppData): RemoteSyncDocument =>
    sanitizeAppDataForRemote(data) as RemoteSyncDocument;

export const areRemoteSyncDocumentsEqual = (
    left: RemoteSyncDocument,
    right: RemoteSyncDocument,
): boolean => areSyncPayloadsEqual(left, right);

export const computeRemoteSyncDocumentFingerprint = (data: RemoteSyncDocument): string =>
    computeStableValueFingerprint(data);
