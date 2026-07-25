// Shell-side seam: the desktop and mobile data-transfer modules each repeated the same
// addBreadcrumb -> logInfo(start) -> transaction -> logInfo(complete)/logError boilerplate once
// per import source. This module owns that boilerplate once; each shell keeps only its own
// boundaries object (storage/refresh/snapshot plumbing) and its own logInfo/logError module.
import { prepareRestoredBackupDataForSync } from './backup-transfer';
import {
    runDataTransferTransaction,
    type DataTransferStaleDetails,
} from './data-transfer-transaction';
import { applyDgtImport, type ParsedDgtImportData } from './dgt-import';
import { addBreadcrumb } from './log-breadcrumbs';
import { applyOmniFocusImport, type ParsedOmniFocusImportData } from './omnifocus-import';
import { applyTickTickImport, type ParsedTickTickImportData } from './ticktick-import';
import { applyTodoistImport, type ParsedTodoistProject } from './todoist-import';
import type { AppData } from './types';

export type ImportSourceId = 'backup' | 'dgt' | 'omnifocus' | 'ticktick' | 'todoist';

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

type ImportDescriptor = {
    apply: (data: AppData, parsed: unknown) => { data: AppData; result: unknown };
    completeLabel: string;
    countExtra: (result: unknown) => Record<string, string>;
    operation: string;
    source: ImportSourceId;
    startLabel: string;
};

const toBackupCountExtra = (data: AppData): Record<string, string> => ({
    tasks: String(data.tasks.filter((task) => !task.deletedAt).length),
    projects: String(data.projects.filter((project) => !project.deletedAt).length),
    sections: String(data.sections.filter((section) => !section.deletedAt).length),
    areas: String(data.areas.filter((area) => !area.deletedAt).length),
});

const IMPORT_DESCRIPTORS: Record<ImportSourceId, ImportDescriptor> = {
    backup: {
        operation: 'restoreBackup',
        source: 'backup',
        startLabel: 'Backup restore started',
        completeLabel: 'Backup restore complete',
        apply: (_currentData, parsed) => {
            const restored = prepareRestoredBackupDataForSync(parsed as AppData);
            return { data: restored, result: restored };
        },
        countExtra: (result) => toBackupCountExtra(result as AppData),
    },
    todoist: {
        operation: 'importTodoist',
        source: 'todoist',
        startLabel: 'Todoist import started',
        completeLabel: 'Todoist import complete',
        apply: (data, parsed) => {
            const result = applyTodoistImport(data, parsed as ParsedTodoistProject[]);
            return { data: result.data, result };
        },
        countExtra: (result) => {
            const typed = result as ReturnType<typeof applyTodoistImport>;
            return {
                tasks: String(typed.importedTaskCount),
                projects: String(typed.importedProjectCount),
                sections: String(typed.importedSectionCount),
                checklistItems: String(typed.importedChecklistItemCount),
            };
        },
    },
    ticktick: {
        operation: 'importTickTick',
        source: 'ticktick',
        startLabel: 'TickTick import started',
        completeLabel: 'TickTick import complete',
        apply: (data, parsed) => {
            const result = applyTickTickImport(data, parsed as ParsedTickTickImportData);
            return { data: result.data, result };
        },
        countExtra: (result) => {
            const typed = result as ReturnType<typeof applyTickTickImport>;
            return {
                tasks: String(typed.importedTaskCount),
                projects: String(typed.importedProjectCount),
                areas: String(typed.importedAreaCount),
                checklistItems: String(typed.importedChecklistItemCount),
            };
        },
    },
    dgt: {
        operation: 'importDgt',
        source: 'dgt',
        startLabel: 'DGT import started',
        completeLabel: 'DGT import complete',
        apply: (data, parsed) => {
            const result = applyDgtImport(data, parsed as ParsedDgtImportData);
            return { data: result.data, result };
        },
        countExtra: (result) => {
            const typed = result as ReturnType<typeof applyDgtImport>;
            return {
                tasks: String(typed.importedTaskCount),
                projects: String(typed.importedProjectCount),
                areas: String(typed.importedAreaCount),
                checklistItems: String(typed.importedChecklistItemCount),
            };
        },
    },
    omnifocus: {
        operation: 'importOmniFocus',
        source: 'omnifocus',
        startLabel: 'OmniFocus import started',
        completeLabel: 'OmniFocus import complete',
        apply: (data, parsed) => {
            const result = applyOmniFocusImport(data, parsed as ParsedOmniFocusImportData);
            return { data: result.data, result };
        },
        countExtra: (result) => {
            const typed = result as ReturnType<typeof applyOmniFocusImport>;
            return {
                areas: String(typed.importedAreaCount),
                checklistItems: String(typed.importedChecklistItemCount),
                tasks: String(typed.importedTaskCount),
                projects: String(typed.importedProjectCount),
                standaloneTasks: String(typed.importedStandaloneTaskCount),
            };
        },
    },
};

export async function runImport<TParsed, TResult>(
    source: ImportSourceId,
    parsed: TParsed,
    boundaries: DataTransferBoundaries,
    log: ImportRunnerLog
): Promise<{ result: TResult; snapshotName: string | null }> {
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
        const result = transaction.result as TResult;
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
