import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from './file-system';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
    addBreadcrumb,
    countActiveRecords,
    createBackupFileName,
    flushPendingSave,
    runDataTransferTransactionWithoutSnapshot,
    serializeBackupData,
    type AppData,
    useTaskStore,
    validateBackupJson,
} from '@mindwtr/core';
import {
    parseImportSource,
    runImport,
    type DataTransferBoundaries,
    type ImportPickerSourceId,
    type ImportSourceParseResultMap,
} from '@mindwtr/core/import-runner';
import {
    type DgtImportExecutionResult,
    type ParsedDgtImportData,
} from '@mindwtr/core/dgt-import';
import {
    type OmniFocusImportExecutionResult,
    type ParsedOmniFocusImportData,
} from '@mindwtr/core/omnifocus-import';
import {
    type ParsedTodoistProject,
    type TodoistImportExecutionResult,
} from '@mindwtr/core/todoist-import';
import {
    type ParsedTickTickImportData,
    type TickTickImportExecutionResult,
} from '@mindwtr/core/ticktick-import';

import { logError, logInfo } from './app-log';
import { mobileStorage } from './storage-adapter';

const StorageAccessFramework = FileSystem.StorageAccessFramework;
const SNAPSHOT_DIR_NAME = 'snapshots';
const SNAPSHOT_FILE_PATTERN = /^data\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.snapshot\.json$/u;
const MAX_LOCAL_SNAPSHOTS = 5;

export type TransferDocument = {
    fileName: string;
    lastModified?: number | null;
    uri: string;
};

type SnapshotApplyResult = {
    snapshotName: string;
};

const toCountExtra = (data: AppData): Record<string, string> => {
    const counts = countActiveRecords(data);
    return {
        tasks: String(counts.tasks),
        projects: String(counts.projects),
        sections: String(counts.sections),
        areas: String(counts.areas),
        people: String(counts.people),
    };
};

const getLocalChangeAt = (): number => useTaskStore.getState().lastDataChangeAt;

const normalizeBaseUri = (value?: string | null): string | null => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const getSnapshotDirectory = (): Directory | null => {
    const baseUri = normalizeBaseUri(Paths.document?.uri ?? FileSystem.documentDirectory);
    if (!baseUri) return null;
    return new Directory(`${baseUri}/${SNAPSHOT_DIR_NAME}`);
};

const buildSnapshotFileName = (date: Date = new Date()): string => {
    const iso = date.toISOString();
    const [datePart, timePartWithMs] = iso.split('T');
    const [timePart] = (timePartWithMs || '').split('.');
    const safeTime = String(timePart || '00:00:00').replace(/:/gu, '-');
    return `data.${datePart}T${safeTime}.snapshot.json`;
};

const listSnapshotEntries = (directory: Directory): Array<{ name: string; uri: string }> => {
    if (!directory.exists) return [];
    return directory
        .list()
        .map((entry) => {
            const uri = String(entry.uri || '');
            const name = uri.split('/').pop() || '';
            return { name, uri };
        })
        .filter((entry) => SNAPSHOT_FILE_PATTERN.test(entry.name))
        .sort((left, right) => right.name.localeCompare(left.name));
};

const pruneSnapshots = (directory: Directory): void => {
    const entries = listSnapshotEntries(directory);
    entries.slice(MAX_LOCAL_SNAPSHOTS).forEach((entry) => {
        try {
            const file = new File(entry.uri);
            if (file.exists) {
                file.delete();
            }
        } catch {
            // Ignore best-effort cleanup failures.
        }
    });
};

const readTextFile = async (fileUri: string): Promise<string> => {
    if (fileUri.startsWith('content://')) {
        if (!StorageAccessFramework?.readAsStringAsync) {
            throw new Error('This device cannot read the selected document.');
        }
        return await StorageAccessFramework.readAsStringAsync(fileUri);
    }

    if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
        try {
            const file = new File(fileUri);
            if (file.exists) {
                return await file.text();
            }
        } catch {
            // Fall back to legacy API below.
        }
    }

    return await FileSystem.readAsStringAsync(fileUri);
};

const readBinaryFile = async (fileUri: string): Promise<Uint8Array> => {
    if (fileUri.startsWith('content://')) {
        if (!StorageAccessFramework?.readAsStringAsync) {
            throw new Error('This device cannot read the selected document.');
        }
        const base64 = await StorageAccessFramework.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        return Uint8Array.from(Buffer.from(base64, 'base64'));
    }

    if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
        try {
            const file = new File(fileUri);
            if (file.exists) {
                return new Uint8Array(await file.bytes());
            }
        } catch {
            // Fall back to legacy API below.
        }
    }

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return Uint8Array.from(Buffer.from(base64, 'base64'));
};

const pickDocument = async (type: string | string[]): Promise<TransferDocument | null> => {
    const result = await DocumentPicker.getDocumentAsync({
        type,
        copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    return {
        uri: asset.uri,
        fileName: asset.name || asset.uri.split('/').pop() || 'import',
        lastModified: asset.lastModified ?? null,
    };
};

const saveCurrentDataSnapshot = async (data: AppData): Promise<string> => {
    void logInfo('Recovery snapshot started', {
        scope: 'transfer',
        extra: {
            operation: 'snapshot',
            source: 'local',
        },
    });
    const directory = getSnapshotDirectory();
    if (!directory) {
        throw new Error('Snapshot storage is unavailable on this device.');
    }
    directory.create({ intermediates: true, idempotent: true });
    const fileName = buildSnapshotFileName();
    const file = new File(`${directory.uri}/${fileName}`);
    if (file.exists) {
        file.delete();
    }
    file.create({ intermediates: true, overwrite: true });
    file.write(serializeBackupData(data));
    pruneSnapshots(directory);
    void logInfo('Recovery snapshot complete', {
        scope: 'transfer',
        extra: {
            operation: 'snapshot',
            source: 'local',
            ...toCountExtra(data),
        },
    });
    return fileName;
};

const logStaleDataTransfer = ({
    operation,
    localSnapshotChangeAt,
    currentChangeAt,
}: {
    operation: string;
    localSnapshotChangeAt: number;
    currentChangeAt: number;
}): void => {
    void logInfo('Data transfer aborted after local data changed', {
        scope: 'transfer',
        extra: {
            operation,
            snapshotChangeAt: String(localSnapshotChangeAt),
            currentChangeAt: String(currentChangeAt),
        },
    });
};

const mobileDataTransferBoundaries = () => ({
    flushPendingSave,
    getCurrentChangeAt: getLocalChangeAt,
    readCurrentData: () => mobileStorage.getData(),
    persistData: (data: AppData) => mobileStorage.saveData(data),
    refreshData: () => useTaskStore.getState().fetchData({ silent: true }),
    onStale: logStaleDataTransfer,
});

const mobileBoundaries: DataTransferBoundaries = {
    ...mobileDataTransferBoundaries(),
    createRecoverySnapshot: saveCurrentDataSnapshot,
};

const mobileLog = { logInfo, logError };

export const createMobileRecoverySnapshot = async (): Promise<string> => {
    await flushPendingSave();
    const localSnapshotChangeAt = getLocalChangeAt();
    const currentData = await mobileStorage.getData();
    if (getLocalChangeAt() !== localSnapshotChangeAt) {
        throw new Error('Local data changed while creating the recovery snapshot. Try again.');
    }
    const snapshotName = await saveCurrentDataSnapshot(currentData);
    if (getLocalChangeAt() !== localSnapshotChangeAt) {
        throw new Error('Local data changed while creating the recovery snapshot. Try again.');
    }
    return snapshotName;
};

const runMobileDataTransferWithoutSnapshot = async (
    operation: string,
    data: AppData
): Promise<void> => {
    await runDataTransferTransactionWithoutSnapshot({
        ...mobileDataTransferBoundaries(),
        operation,
        apply: () => ({ data, result: undefined }),
    });
};

export const pickBackupDocument = async (): Promise<TransferDocument | null> =>
    pickDocument('application/json');

export const inspectBackupDocument = async (
    document: TransferDocument,
    options?: { appVersion?: string | null }
): Promise<ImportSourceParseResultMap['backup']> => {
    const rawJson = await readTextFile(document.uri);
    return parseImportSource('backup', {
        appVersion: options?.appVersion,
        fileName: document.fileName,
        lastModified: document.lastModified,
        text: rawJson,
    });
};

// Core owns parser dispatch; only mobile document-picker metadata stays here.
type ImportPickerDescriptor = {
    mimeTypes: string[];
};

const IMPORT_PICKER_DESCRIPTORS: Record<ImportPickerSourceId, ImportPickerDescriptor> = {
    todoist: {
        mimeTypes: [
            'text/csv',
            'text/comma-separated-values',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream',
        ],
    },
    ticktick: {
        mimeTypes: [
            'text/csv',
            'text/comma-separated-values',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream',
        ],
    },
    dgt: {
        mimeTypes: [
            'application/json',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream',
        ],
    },
    omnifocus: {
        mimeTypes: [
            'text/csv',
            'text/comma-separated-values',
            'application/json',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream',
        ],
    },
};

const pickImportDocument = (source: ImportPickerSourceId): Promise<TransferDocument | null> =>
    pickDocument(IMPORT_PICKER_DESCRIPTORS[source].mimeTypes);

const inspectImportDocument = async <S extends ImportPickerSourceId>(
    source: S,
    document: TransferDocument
): Promise<ImportSourceParseResultMap[S]> => {
    const bytes = await readBinaryFile(document.uri);
    return parseImportSource(source, { bytes, fileName: document.fileName });
};

export const pickTodoistDocument = (): Promise<TransferDocument | null> => pickImportDocument('todoist');

export const pickTickTickDocument = (): Promise<TransferDocument | null> => pickImportDocument('ticktick');

export const pickDgtDocument = (): Promise<TransferDocument | null> => pickImportDocument('dgt');

export const pickOmniFocusDocument = (): Promise<TransferDocument | null> => pickImportDocument('omnifocus');

export const inspectTodoistDocument = (document: TransferDocument): Promise<ImportSourceParseResultMap['todoist']> =>
    inspectImportDocument('todoist', document);

export const inspectTickTickDocument = (document: TransferDocument): Promise<ImportSourceParseResultMap['ticktick']> =>
    inspectImportDocument('ticktick', document);

export const inspectDgtDocument = (document: TransferDocument): Promise<ImportSourceParseResultMap['dgt']> =>
    inspectImportDocument('dgt', document);

export const inspectOmniFocusDocument = (document: TransferDocument): Promise<ImportSourceParseResultMap['omnifocus']> =>
    inspectImportDocument('omnifocus', document);

// Mobile's snapshot writer never returns null (unlike desktop's Tauri-only snapshot), so the
// shared `string | null` contract can be narrowed back for mobile's public result type.
export const restoreDataFromBackup = async (backupData: AppData): Promise<SnapshotApplyResult> => {
    const { snapshotName } = await runImport('backup', backupData, mobileBoundaries, mobileLog);
    return { snapshotName: snapshotName as string };
};

export const importTodoistData = async (
    parsedProjects: ParsedTodoistProject[]
): Promise<SnapshotApplyResult & { result: TodoistImportExecutionResult }> => {
    const { result, snapshotName } = await runImport('todoist', parsedProjects, mobileBoundaries, mobileLog);
    return { snapshotName: snapshotName as string, result };
};

export const importTickTickData = async (
    parsedData: ParsedTickTickImportData
): Promise<SnapshotApplyResult & { result: TickTickImportExecutionResult }> => {
    const { result, snapshotName } = await runImport('ticktick', parsedData, mobileBoundaries, mobileLog);
    return { snapshotName: snapshotName as string, result };
};

export const importDgtData = async (
    parsedData: ParsedDgtImportData
): Promise<SnapshotApplyResult & { result: DgtImportExecutionResult }> => {
    const { result, snapshotName } = await runImport('dgt', parsedData, mobileBoundaries, mobileLog);
    return { snapshotName: snapshotName as string, result };
};

export const importOmniFocusData = async (
    parsedData: ParsedOmniFocusImportData
): Promise<SnapshotApplyResult & { result: OmniFocusImportExecutionResult }> => {
    const { result, snapshotName } = await runImport('omnifocus', parsedData, mobileBoundaries, mobileLog);
    return { snapshotName: snapshotName as string, result };
};

export const listLocalDataSnapshots = async (): Promise<string[]> => {
    const directory = getSnapshotDirectory();
    if (!directory?.exists) return [];
    pruneSnapshots(directory);
    return listSnapshotEntries(directory).map((entry) => entry.name);
};

export const restoreLocalDataSnapshot = async (snapshotName: string): Promise<void> => {
    addBreadcrumb('transfer:restore');
    void logInfo('Recovery snapshot restore started', {
        scope: 'transfer',
        extra: {
            operation: 'restoreSnapshot',
            source: 'snapshot',
        },
    });
    const directory = getSnapshotDirectory();
    if (!directory || !SNAPSHOT_FILE_PATTERN.test(snapshotName)) {
      throw new Error('Invalid snapshot file name.');
    }
    const file = new File(`${directory.uri}/${snapshotName}`);
    if (!file.exists) {
        throw new Error('Snapshot file not found.');
    }
    const validation = validateBackupJson(await file.text(), { fileName: snapshotName });
    if (!validation.valid || !validation.data) {
        throw new Error(validation.errors[0] || 'Snapshot is not a valid backup.');
    }

    try {
        await runMobileDataTransferWithoutSnapshot('restoreSnapshot', validation.data);
        void logInfo('Recovery snapshot restore complete', {
            scope: 'transfer',
            extra: {
                operation: 'restoreSnapshot',
                source: 'snapshot',
                ...toCountExtra(validation.data),
            },
        });
    } catch (error) {
        void logError(error, { scope: 'transfer', extra: { operation: 'restoreSnapshot' } });
        throw error;
    }
};

export const exportCurrentDataBackup = async (data: AppData): Promise<void> => {
    addBreadcrumb('transfer:export');
    const snapshotName = createBackupFileName();
    const jsonContent = serializeBackupData(data);
    void logInfo('Backup export started', {
        scope: 'transfer',
        extra: {
            operation: 'exportBackup',
            source: 'local',
        },
    });

    try {
        if (Platform.OS === 'android' && StorageAccessFramework) {
            try {
                const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
                const directoryUri = permissions.directoryUri;
                if (permissions.granted && directoryUri) {
                    const fileUri = await StorageAccessFramework.createFileAsync(
                        directoryUri,
                        snapshotName,
                        'application/json'
                    );
                    await StorageAccessFramework.writeAsStringAsync(fileUri, jsonContent);
                    void logInfo('Backup export complete', {
                        scope: 'transfer',
                        extra: {
                            operation: 'exportBackup',
                            source: 'local',
                            ...toCountExtra(data),
                        },
                    });
                    return;
                }
            } catch (error) {
                void logError(error, { scope: 'transfer', extra: { operation: 'exportBackup' } });
            }
        }

        const fileUri = `${FileSystem.cacheDirectory}${snapshotName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonContent);
        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) {
            throw new Error('Sharing is not available on this device.');
        }
        await Sharing.shareAsync(fileUri, {
            UTI: 'public.json',
            mimeType: 'application/json',
            dialogTitle: 'Export Mindwtr Backup',
        });
        void logInfo('Backup export complete', {
            scope: 'transfer',
            extra: {
                operation: 'exportBackup',
                source: 'local',
                ...toCountExtra(data),
            },
        });
    } catch (error) {
        void logError(error, { scope: 'transfer', extra: { operation: 'exportBackup' } });
        throw error;
    }
};
