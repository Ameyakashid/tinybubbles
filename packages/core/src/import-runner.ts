// Shell-side seam: the desktop and mobile data-transfer modules each repeated the same
// addBreadcrumb -> logInfo(start) -> transaction -> logInfo(complete)/logError boilerplate once
// per import source. This module owns that boilerplate once; each shell keeps only its own
// boundaries object (storage/refresh/snapshot plumbing) and its own logInfo/logError module.
import { prepareRestoredBackupDataForSync, validateBackupJson, type BackupValidation } from './backup-transfer';
import {
    runDataTransferTransaction,
    type DataTransferStaleDetails,
} from './data-transfer-transaction';
import {
    applyDgtImport,
    parseDgtImportSource,
    type DgtImportParseResult,
    type ParsedDgtImportData,
} from './dgt-import';
import { addBreadcrumb } from './log-breadcrumbs';
import type { ImportSourceInput } from './import-source-reader';
import {
    applyOmniFocusImport,
    parseOmniFocusImportSource,
    type OmniFocusImportParseResult,
    type ParsedOmniFocusImportData,
} from './omnifocus-import';
import {
    applyTickTickImport,
    parseTickTickImportSource,
    type ParsedTickTickImportData,
    type TickTickImportParseResult,
} from './ticktick-import';
import {
    applyTodoistImport,
    parseTodoistImportSource,
    type ParsedTodoistProject,
    type TodoistImportParseResult,
} from './todoist-import';
import type { AppData } from './types';

export type ImportSourceId = 'backup' | 'dgt' | 'omnifocus' | 'ticktick' | 'todoist';
export type ImportPickerSourceId = Exclude<ImportSourceId, 'backup'>;

export type ImportDescriptorInput = ImportSourceInput & {
    appVersion?: string | null;
    lastModified?: number | null;
};

export type ImportSourceParseResultMap = {
    backup: BackupValidation;
    dgt: DgtImportParseResult;
    omnifocus: OmniFocusImportParseResult;
    ticktick: TickTickImportParseResult;
    todoist: TodoistImportParseResult;
};

export type DataTransferBoundaries = {
    createRecoverySnapshot: (currentData: AppData) => Promise<string | null>;
    flushPendingSave: () => Promise<void>;
    getCurrentChangeAt: () => number;
    onStale?: (details: DataTransferStaleDetails) => void;
    persistData: (data: AppData) => Promise<void>;
    readCurrentData: () => Promise<AppData>;
    refreshData: () => Promise<void>;
};

export type TransferLogInfo = (
    message: string,
    context?: { extra?: Record<string, unknown>; scope?: string }
) => unknown;
export type TransferLogError = (
    error: unknown,
    context: { extra?: Record<string, unknown>; scope: string }
) => unknown;

export type ImportRunnerLog = {
    logError: TransferLogError;
    logInfo: TransferLogInfo;
};

// Maps each import source to its real parsed-input and applied-result types. The descriptor
// table below is keyed off this so each entry's `apply`/`countExtra` is checked against the
// actual importer signature instead of erasing to `unknown` and casting back per source.
type ImportTypeMap = {
    backup: { parsed: AppData; result: AppData };
    todoist: { parsed: ParsedTodoistProject[]; result: ReturnType<typeof applyTodoistImport> };
    ticktick: { parsed: ParsedTickTickImportData; result: ReturnType<typeof applyTickTickImport> };
    dgt: { parsed: ParsedDgtImportData; result: ReturnType<typeof applyDgtImport> };
    omnifocus: { parsed: ParsedOmniFocusImportData; result: ReturnType<typeof applyOmniFocusImport> };
};

type ImportDescriptor<S extends ImportSourceId> = {
    apply: (data: AppData, parsed: ImportTypeMap[S]['parsed']) => { data: AppData; result: ImportTypeMap[S]['result'] };
    completeLabel: string;
    countExtra: (result: ImportTypeMap[S]['result']) => Record<string, string>;
    operation: string;
    parse: (input: ImportDescriptorInput) => ImportSourceParseResultMap[S];
    source: S;
    startLabel: string;
};

const toBackupCountExtra = (data: AppData): Record<string, string> => ({
    tasks: String(data.tasks.filter((task) => !task.deletedAt).length),
    projects: String(data.projects.filter((project) => !project.deletedAt).length),
    sections: String(data.sections.filter((section) => !section.deletedAt).length),
    areas: String(data.areas.filter((area) => !area.deletedAt).length),
});

const IMPORT_DESCRIPTORS: { [S in ImportSourceId]: ImportDescriptor<S> } = {
    backup: {
        operation: 'restoreBackup',
        source: 'backup',
        startLabel: 'Backup restore started',
        completeLabel: 'Backup restore complete',
        parse: (input) => validateBackupJson(
            input.text ?? new TextDecoder().decode(input.bytes ?? undefined),
            {
                appVersion: input.appVersion,
                fileModifiedAt: input.lastModified,
                fileName: input.fileName,
            },
        ),
        apply: (_currentData, parsed) => {
            const restored = prepareRestoredBackupDataForSync(parsed);
            return { data: restored, result: restored };
        },
        countExtra: toBackupCountExtra,
    },
    todoist: {
        operation: 'importTodoist',
        source: 'todoist',
        startLabel: 'Todoist import started',
        completeLabel: 'Todoist import complete',
        parse: parseTodoistImportSource,
        apply: (data, parsed) => {
            const result = applyTodoistImport(data, parsed);
            return { data: result.data, result };
        },
        countExtra: (result) => ({
            tasks: String(result.importedTaskCount),
            projects: String(result.importedProjectCount),
            sections: String(result.importedSectionCount),
            checklistItems: String(result.importedChecklistItemCount),
        }),
    },
    ticktick: {
        operation: 'importTickTick',
        source: 'ticktick',
        startLabel: 'TickTick import started',
        completeLabel: 'TickTick import complete',
        parse: parseTickTickImportSource,
        apply: (data, parsed) => {
            const result = applyTickTickImport(data, parsed);
            return { data: result.data, result };
        },
        countExtra: (result) => ({
            tasks: String(result.importedTaskCount),
            projects: String(result.importedProjectCount),
            areas: String(result.importedAreaCount),
            checklistItems: String(result.importedChecklistItemCount),
        }),
    },
    dgt: {
        operation: 'importDgt',
        source: 'dgt',
        startLabel: 'DGT import started',
        completeLabel: 'DGT import complete',
        parse: parseDgtImportSource,
        apply: (data, parsed) => {
            const result = applyDgtImport(data, parsed);
            return { data: result.data, result };
        },
        countExtra: (result) => ({
            tasks: String(result.importedTaskCount),
            projects: String(result.importedProjectCount),
            areas: String(result.importedAreaCount),
            checklistItems: String(result.importedChecklistItemCount),
        }),
    },
    omnifocus: {
        operation: 'importOmniFocus',
        source: 'omnifocus',
        startLabel: 'OmniFocus import started',
        completeLabel: 'OmniFocus import complete',
        parse: parseOmniFocusImportSource,
        apply: (data, parsed) => {
            const result = applyOmniFocusImport(data, parsed);
            return { data: result.data, result };
        },
        countExtra: (result) => ({
            areas: String(result.importedAreaCount),
            checklistItems: String(result.importedChecklistItemCount),
            tasks: String(result.importedTaskCount),
            projects: String(result.importedProjectCount),
            standaloneTasks: String(result.importedStandaloneTaskCount),
        }),
    },
};

export function parseImportSource<S extends ImportSourceId>(
    source: S,
    input: ImportDescriptorInput,
): ImportSourceParseResultMap[S] {
    return IMPORT_DESCRIPTORS[source].parse(input);
}

// Closing this on `source` (rather than two free type parameters the caller had to spell out)
// lets `parsed`'s and the return value's types be inferred from the source id literal itself —
// `ImportTypeMap[S]` is exact per source, so every cast this function used to need to bridge
// "the caller's declared TParsed/TResult" against "whatever IMPORT_DESCRIPTORS[source] resolves
// to at runtime" is now just a correct, unconditional type instead of an erasure.
export async function runImport<S extends ImportSourceId>(
    source: S,
    parsed: ImportTypeMap[S]['parsed'],
    boundaries: DataTransferBoundaries,
    log: ImportRunnerLog
): Promise<{ result: ImportTypeMap[S]['result']; snapshotName: string | null }> {
    const descriptor = IMPORT_DESCRIPTORS[source];
    addBreadcrumb('transfer:restore');
    void log.logInfo(descriptor.startLabel, {
        scope: 'transfer',
        extra: { operation: descriptor.operation, source: descriptor.source },
    });
    try {
        const transaction = await runDataTransferTransaction({
            ...boundaries,
            operation: descriptor.operation,
            apply: (currentData: AppData) => descriptor.apply(currentData, parsed),
        });
        const result = transaction.result;
        void log.logInfo(descriptor.completeLabel, {
            scope: 'transfer',
            extra: {
                operation: descriptor.operation,
                source: descriptor.source,
                ...descriptor.countExtra(result),
            },
        });
        return { snapshotName: transaction.snapshot, result };
    } catch (error) {
        void log.logError(error, { scope: 'transfer', extra: { operation: descriptor.operation } });
        throw error;
    }
}
