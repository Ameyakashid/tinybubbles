import type { AppData } from './types';
import { nextRevision, SYNC_BACKUP_RESTORE_REV_BY } from './sync-revision';
import {
    isObjectRecord,
    normalizeAppData,
    validateMergedSyncData,
    validateSyncPayloadShape,
} from './sync-normalization';

export const BACKUP_FILE_PREFIX = 'mindwtr-backup-';

export type ActiveRecordCounts = {
    areas: number;
    people: number;
    projects: number;
    sections: number;
    tasks: number;
};

// Both desktop's and mobile's data-transfer.ts carried byte-identical copies of this for their
// own export/restore/snapshot logging — and both omitted `people`, a first-class synced entity,
// undercounting it in every backup/restore log line on both platforms.
export const countActiveRecords = (data: AppData): ActiveRecordCounts => ({
    tasks: data.tasks.filter((task) => !task.deletedAt).length,
    projects: data.projects.filter((project) => !project.deletedAt).length,
    sections: data.sections.filter((section) => !section.deletedAt).length,
    areas: data.areas.filter((area) => !area.deletedAt).length,
    people: (data.people ?? []).filter((person) => !person.deletedAt).length,
});

export type BackupMetadata = {
    fileName?: string;
    backupAt?: string;
    version?: string;
    taskCount: number;
    projectCount: number;
    sectionCount: number;
    areaCount: number;
};

export type BackupValidation = {
    valid: boolean;
    data: AppData | null;
    metadata: BackupMetadata | null;
    errors: string[];
    warnings: string[];
};

type BackupValidationOptions = {
    appVersion?: string | null;
    fileModifiedAt?: string | number | Date | null;
    fileName?: string | null;
};

type BackupEnvelope = {
    backupMetadata?: {
        version?: unknown;
        createdAt?: unknown;
    };
    data?: unknown;
};

type BackupRestoreSyncPreparationOptions = {
    restoredAt?: string | number | Date | null;
    // The data being replaced. Anything it holds that the backup does not is
    // carried over as a tombstone so the restore survives the next merge — see
    // carryForwardEntitiesMissingFromBackup.
    previousData?: AppData | null;
};

type RestorableEntity = {
    id: string;
    deletedAt?: string;
    purgedAt?: string;
    rev?: number;
    revBy?: string;
    updatedAt: string;
};

const BACKUP_TIMESTAMP_PATTERN = new RegExp(
    `^${BACKUP_FILE_PREFIX}(\\d{4}-\\d{2}-\\d{2})T(\\d{2})-(\\d{2})-(\\d{2})(?:-(\\d{3}))?Z?\\.json$`,
    'i'
);

const normalizeVersion = (value?: string | null): string => String(value || '').trim().replace(/^v/i, '');

const compareVersions = (left?: string | null, right?: string | null): number => {
    const leftParts = normalizeVersion(left).split('.').map((part) => Number(part));
    const rightParts = normalizeVersion(right).split('.').map((part) => Number(part));
    const length = Math.max(leftParts.length, rightParts.length, 0);
    for (let index = 0; index < length; index += 1) {
        const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] as number : 0;
        const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] as number : 0;
        if (leftValue > rightValue) return 1;
        if (leftValue < rightValue) return -1;
    }
    return 0;
};

const toIsoString = (value?: string | number | Date | null): string | undefined => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

const deriveBackupAtFromFileName = (fileName?: string | null): string | undefined => {
    const trimmed = String(fileName || '').trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(BACKUP_TIMESTAMP_PATTERN);
    if (!match) return undefined;
    const [, date, hour, minute, second, millisecond] = match;
    const iso = `${date}T${hour}:${minute}:${second}.${millisecond ?? '000'}Z`;
    const parsed = new Date(iso);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const extractBackupEnvelope = (value: unknown): { data: unknown; metadata: BackupEnvelope['backupMetadata'] | null } => {
    if (!isObjectRecord(value)) return { data: value, metadata: null };
    const record = value as BackupEnvelope;
    if (isObjectRecord(record.data)) {
        return {
            data: record.data,
            metadata: isObjectRecord(record.backupMetadata) ? record.backupMetadata : null,
        };
    }
    return {
        data: value,
        metadata: isObjectRecord(record.backupMetadata) ? record.backupMetadata : null,
    };
};

export function sanitizeSerializedJsonText(raw: string): string {
    let text = String(raw || '').replace(/^\uFEFF/, '').trim();
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\u0000+$/g, '').trim();
    return text;
}

export const createBackupFileName = (date: Date = new Date()): string => {
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `${BACKUP_FILE_PREFIX}${timestamp}.json`;
};

export const serializeBackupData = (data: AppData): string => JSON.stringify(data, null, 2);

const prepareRestoredEntityForSync = <T extends RestorableEntity>(
    item: T,
    restoredAt: string
): T => {
    if (item.deletedAt) return item;
    return {
        ...item,
        updatedAt: restoredAt,
        rev: nextRevision(item.rev),
        revBy: SYNC_BACKUP_RESTORE_REV_BY,
    };
};

/**
 * Restoring replaces local data wholesale, which silently drops the tombstones
 * this device was holding for anything deleted since the backup was taken. The
 * remote still has those records, so the next merge reads their absence as
 * "new over there" and hands them all back — the restore appears to work and
 * then undoes itself (#939).
 *
 * So every id the replaced data knows about but the backup does not is carried
 * over as a tombstone, at a revision above the one it was last seen at, making
 * the restored snapshot authoritative rather than merely newer in places.
 * Records this device never saw are untouched: absence here is ignorance, not a
 * deletion, and another device's work is not ours to erase.
 */
const carryForwardEntitiesMissingFromBackup = <T extends RestorableEntity>(
    restored: T[],
    previous: T[] | undefined,
    restoredAt: string
): T[] => {
    if (!previous?.length) return restored;
    const restoredIds = new Set(restored.map((item) => item.id));
    const carried = previous
        // An already-purged tombstone is gone everywhere; reviving it into the
        // payload would only re-broadcast a delete that has already landed.
        .filter((item) => !item.purgedAt && !restoredIds.has(item.id))
        .map((item) => ({
            ...item,
            deletedAt: item.deletedAt ?? restoredAt,
            updatedAt: restoredAt,
            rev: nextRevision(item.rev),
            revBy: SYNC_BACKUP_RESTORE_REV_BY,
        }));
    return carried.length > 0 ? [...restored, ...carried] : restored;
};

const stripDeviceLocalRestoreSettings = (settings: AppData['settings']): AppData['settings'] => {
    if (settings.security?.mobileAppLockEnabled === undefined) return settings;
    const nextSettings: AppData['settings'] = {
        ...settings,
        security: { ...settings.security },
    };
    delete nextSettings.security?.mobileAppLockEnabled;
    if (nextSettings.security && Object.keys(nextSettings.security).length === 0) {
        delete nextSettings.security;
    }
    return nextSettings;
};

export const prepareRestoredBackupDataForSync = (
    data: AppData,
    options: BackupRestoreSyncPreparationOptions = {}
): AppData => {
    const restoredAt = toIsoString(options.restoredAt) ?? new Date().toISOString();
    const restoredSettings = stripDeviceLocalRestoreSettings(data.settings);
    const previous = options.previousData ?? null;
    const prepare = <T extends RestorableEntity>(restored: T[], before: T[] | undefined): T[] => (
        carryForwardEntitiesMissingFromBackup(restored, before, restoredAt)
            .map((item) => prepareRestoredEntityForSync(item, restoredAt))
    );
    return {
        ...data,
        tasks: prepare(data.tasks, previous?.tasks),
        projects: prepare(data.projects, previous?.projects),
        sections: prepare(data.sections, previous?.sections),
        areas: prepare(data.areas, previous?.areas),
        people: prepare(data.people ?? [], previous?.people),
        settings: {
            ...restoredSettings,
            pendingRemoteWriteAt: restoredAt,
            pendingRemoteWriteRetryAt: undefined,
            pendingRemoteWriteAttempts: undefined,
        },
    };
};

export const validateBackupJson = (
    rawJson: string,
    options: BackupValidationOptions = {}
): BackupValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized = sanitizeSerializedJsonText(rawJson);
    if (!sanitized) {
        return {
            valid: false,
            data: null,
            metadata: null,
            errors: ['Backup file is empty.'],
            warnings,
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(sanitized);
    } catch (error) {
        return {
            valid: false,
            data: null,
            metadata: null,
            errors: [
                error instanceof Error && error.message
                    ? `Backup file is not valid JSON: ${error.message}`
                    : 'Backup file is not valid JSON.',
            ],
            warnings,
        };
    }

    const envelope = extractBackupEnvelope(parsed);
    const shapeErrors = validateSyncPayloadShape(envelope.data, 'local');
    if (shapeErrors.length > 0) {
        return {
            valid: false,
            data: null,
            metadata: null,
            errors: shapeErrors,
            warnings,
        };
    }

    const normalized = normalizeAppData(envelope.data as AppData);
    const dataErrors = validateMergedSyncData(normalized);
    if (dataErrors.length > 0) {
        return {
            valid: false,
            data: null,
            metadata: null,
            errors: dataErrors,
            warnings,
        };
    }

    const taskCount = normalized.tasks.filter((task) => !task.deletedAt).length;
    const projectCount = normalized.projects.filter((project) => !project.deletedAt).length;
    const sectionCount = normalized.sections.filter((section) => !section.deletedAt).length;
    const areaCount = normalized.areas.filter((area) => !area.deletedAt).length;
    if (taskCount === 0 && projectCount === 0) {
        warnings.push('This backup does not contain any active tasks or projects.');
    }

    const metadataVersion = typeof envelope.metadata?.version === 'string'
        ? normalizeVersion(envelope.metadata.version)
        : undefined;
    const appVersion = normalizeVersion(options.appVersion);
    if (metadataVersion && appVersion) {
        const comparison = compareVersions(metadataVersion, appVersion);
        if (comparison > 0) {
            warnings.push(`This backup was created by a newer Mindwtr version (${metadataVersion}).`);
        } else if (comparison < 0) {
            warnings.push(`This backup was created by an older Mindwtr version (${metadataVersion}).`);
        }
    }

    const metadata: BackupMetadata = {
        fileName: String(options.fileName || '').trim() || undefined,
        backupAt:
            toIsoString(envelope.metadata?.createdAt as string | number | Date | null)
            ?? toIsoString(options.fileModifiedAt)
            ?? deriveBackupAtFromFileName(options.fileName),
        version: metadataVersion,
        taskCount,
        projectCount,
        sectionCount,
        areaCount,
    };

    return {
        valid: true,
        data: normalized,
        metadata,
        errors,
        warnings,
    };
};
