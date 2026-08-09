// Generic "Mindwtr CSV" importer for users migrating from apps with no dedicated importer.
// Structural template: ticktick-import.ts (parse -> {parsedData, preview, errors, warnings}).
// Apply delegates to the shared import-apply.ts seam, which also creates this importer's
// Sections (the only ImportSource caller that supplies any).
import { safeParseDate } from './date';
import { applyImport, type ImportExecutionResult, type ImportParseResult } from './import-apply';
import {
    appendWarning,
    basename,
    buildHeaderIndex,
    dedupeStrings,
    decodeTextBytes,
    detectDelimiter,
    formatLocalDate,
    formatLocalDateTime,
    getCell,
    normalizeContextName,
    normalizeHeaderCell,
    parseCsvRows,
    readImportSource,
    sanitizeCsvText,
} from './import-source-reader';
import { normalizeTagId } from './store-helpers';
import type { AppData, ChecklistItem, TaskEnergyLevel, TaskPriority, TaskStatus } from './types';
import { generateDeterministicUUID, generateUUID as uuidv4 } from './uuid';

const MINDWTR_CSV_IMPORT_ID_NAMESPACE = 'mindwtr:csv-import:v1';
const MINDWTR_CSV_AREA_FALLBACK = 'Mindwtr CSV Area';
const MINDWTR_CSV_PROJECT_FALLBACK = 'Mindwtr CSV Import';
const MINDWTR_CSV_IMPORT_SUFFIX = ' (Mindwtr CSV)';

const createMindwtrCsvImportId = (kind: 'area' | 'project' | 'section' | 'task', sourceKey: string): string => (
    generateDeterministicUUID(`${MINDWTR_CSV_IMPORT_ID_NAMESPACE}:${kind}:${sourceKey}`)
);

type MindwtrCsvFileInput = {
    bytes?: ArrayBuffer | Uint8Array | null;
    fileName: string;
    text?: string | null;
};

type MindwtrCsvWarningCounters = {
    duplicateIds: number;
    emptyTitleRows: number;
    invalidCsvFiles: number;
    nestedZipFiles: number;
    nonCsvEntries: number;
    recurrenceColumnsIgnored: number;
    sectionWithoutProject: number;
    unclosedQuotedFiles: number;
    unknownColumns: number;
    unknownStatuses: number;
    unparsedDates: number;
};

export type ParsedMindwtrCsvArea = {
    name: string;
    order: number;
    sourceKey: string;
};

export type ParsedMindwtrCsvProject = {
    areaSourceKey?: string;
    name: string;
    order: number;
    sourceKey: string;
};

export type ParsedMindwtrCsvSection = {
    name: string;
    order: number;
    projectSourceKey: string;
    sourceKey: string;
};

export type ParsedMindwtrCsvTask = {
    areaSourceKey?: string;
    assignedTo?: string;
    checklist: ChecklistItem[];
    completedAt?: string;
    contexts: string[];
    createdAt?: string;
    description?: string;
    dueDate?: string;
    energyLevel?: TaskEnergyLevel;
    location?: string;
    order: number;
    priority?: TaskPriority;
    projectSourceKey?: string;
    reviewAt?: string;
    sectionSourceKey?: string;
    sourceId: string;
    startTime?: string;
    status: TaskStatus;
    tags: string[];
    title: string;
};

export type ParsedMindwtrCsvImportData = {
    areas: ParsedMindwtrCsvArea[];
    projects: ParsedMindwtrCsvProject[];
    sections: ParsedMindwtrCsvSection[];
    tasks: ParsedMindwtrCsvTask[];
    warnings: string[];
};

export type MindwtrCsvImportProjectPreview = {
    areaName?: string;
    name: string;
    taskCount: number;
};

export type MindwtrCsvImportPreview = {
    areaCount: number;
    checklistItemCount: number;
    fileName: string;
    projectCount: number;
    projects: MindwtrCsvImportProjectPreview[];
    sectionCount: number;
    standaloneTaskCount: number;
    taskCount: number;
    warnings: string[];
};

export type MindwtrCsvImportParseResult = ImportParseResult<ParsedMindwtrCsvImportData, MindwtrCsvImportPreview>;

export type MindwtrCsvImportExecutionResult = ImportExecutionResult & { importedSectionCount: number };

const KNOWN_COLUMNS = new Set([
    'TITLE', 'DESCRIPTION', 'STATUS', 'PROJECT', 'SECTION', 'AREA', 'CONTEXTS', 'TAGS',
    'ASSIGNED TO', 'PRIORITY', 'ENERGY', 'START DATE', 'DUE DATE', 'REVIEW DATE',
    'COMPLETED AT', 'CHECKLIST', 'LOCATION', 'ORDER', 'ID', 'CREATED AT', 'RECURRENCE',
]);

const VALID_STATUSES = new Set<TaskStatus>(['inbox', 'next', 'waiting', 'someday', 'reference', 'done', 'archived']);

const createWarningCounters = (): MindwtrCsvWarningCounters => ({
    duplicateIds: 0,
    emptyTitleRows: 0,
    invalidCsvFiles: 0,
    nestedZipFiles: 0,
    nonCsvEntries: 0,
    recurrenceColumnsIgnored: 0,
    sectionWithoutProject: 0,
    unclosedQuotedFiles: 0,
    unknownColumns: 0,
    unknownStatuses: 0,
    unparsedDates: 0,
});

const buildWarnings = (counters: MindwtrCsvWarningCounters): string[] => {
    const warnings: string[] = [];
    appendWarning(warnings, counters.unknownColumns, '1 unknown column was ignored.', '{count} unknown columns were ignored.');
    appendWarning(warnings, counters.unknownStatuses, '1 task status could not be mapped and was imported to Inbox.', '{count} task statuses could not be mapped and were imported to Inbox.');
    appendWarning(warnings, counters.sectionWithoutProject, '1 Section was ignored because its row had no Project.', '{count} Sections were ignored because their rows had no Project.');
    appendWarning(warnings, counters.recurrenceColumnsIgnored, '1 Recurrence value was ignored; this importer does not create recurring tasks.', '{count} Recurrence values were ignored; this importer does not create recurring tasks.');
    appendWarning(warnings, counters.unparsedDates, '1 date value could not be parsed and was skipped.', '{count} date values could not be parsed and were skipped.');
    appendWarning(warnings, counters.duplicateIds, '1 row had an ID that duplicated an earlier row in this import and was dropped.', '{count} rows had an ID that duplicated an earlier row in this import and were dropped.');
    appendWarning(warnings, counters.emptyTitleRows, '1 row with an empty title was skipped.', '{count} rows with empty titles were skipped.');
    appendWarning(warnings, counters.nonCsvEntries, '1 non-CSV file inside the ZIP was skipped.', '{count} non-CSV files inside the ZIP were skipped.');
    appendWarning(warnings, counters.nestedZipFiles, '1 nested ZIP file inside the archive was skipped.', '{count} nested ZIP files inside the archive were skipped.');
    appendWarning(warnings, counters.unclosedQuotedFiles, '1 CSV file ended with an unclosed quoted field and was imported best-effort.', '{count} CSV files ended with unclosed quoted fields and were imported best-effort.');
    appendWarning(warnings, counters.invalidCsvFiles, '1 CSV file could not be parsed and was skipped.', '{count} CSV files could not be parsed and were skipped.');
    return warnings;
};

// Tab is checked locally (the shared detectDelimiter never needs it); comma vs semicolon
// delegates to that shared heuristic instead of duplicating it.
const detectMindwtrCsvDelimiter = (text: string): string => {
    const firstLine = sanitizeCsvText(text).split(/\r?\n/u).find((line) => line.trim().length > 0);
    if (firstLine) {
        const tabCount = (firstLine.match(/\t/gu) || []).length;
        const commaCount = (firstLine.match(/,/gu) || []).length;
        const semicolonCount = (firstLine.match(/;/gu) || []).length;
        if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
    }
    return detectDelimiter(text);
};

const countUnknownColumns = (headerRow: string[], counters: MindwtrCsvWarningCounters): void => {
    headerRow.forEach((cell) => {
        const normalized = normalizeHeaderCell(cell);
        if (normalized && !KNOWN_COLUMNS.has(normalized)) counters.unknownColumns += 1;
    });
};

const normalizeSourceKey = (value: string): string => value.trim().toLowerCase();

const toNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const splitTokens = (value: string): string[] => value.split(/[,;]+/u).map((token) => token.trim()).filter(Boolean);

const parseContexts = (value: string): string[] => dedupeStrings(
    splitTokens(value).map((context) => normalizeContextName(context)).filter(Boolean) as string[]
);

const parseTags = (value: string): string[] => dedupeStrings(
    splitTokens(value).map((tag) => normalizeTagId(tag.replace(/^#+/u, '')))
);

const parsePriority = (value: string): TaskPriority | undefined => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'high' || trimmed === '1') return 'high';
    if (trimmed === 'medium' || trimmed === '2') return 'medium';
    if (trimmed === 'low' || trimmed === '3') return 'low';
    return undefined;
};

const parseEnergy = (value: string): TaskEnergyLevel | undefined => {
    const trimmed = value.trim().toLowerCase();
    return trimmed === 'high' || trimmed === 'medium' || trimmed === 'low' ? trimmed : undefined;
};

const CHECKLIST_ITEM_PATTERN = /^\[([ xX])\]\s*(.*)$/u;

const parseChecklist = (value: string): ChecklistItem[] => {
    if (!value.trim()) return [];
    return value.replace(/\r/gu, '\n').split(/\n|\|/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const match = CHECKLIST_ITEM_PATTERN.exec(line);
            if (!match) return { id: uuidv4(), title: line, isCompleted: false };
            return { id: uuidv4(), title: match[2].trim() || line, isCompleted: match[1].toLowerCase() === 'x' };
        })
        .filter((item) => item.title);
};

const resolveStatus = (
    raw: string,
    hasProject: boolean,
    hasCompletedAt: boolean,
    counters: MindwtrCsvWarningCounters
): TaskStatus => {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return hasCompletedAt ? 'done' : hasProject ? 'next' : 'inbox';
    if (VALID_STATUSES.has(trimmed as TaskStatus)) return trimmed as TaskStatus;
    counters.unknownStatuses += 1;
    return 'inbox';
};

// Mirrors the date-only/datetime split omnifocus-import.ts's normalizeMappedDate already
// established: a date-only value never gains an implicit midnight/time component, and a
// datetime with no explicit offset keeps its literal wall-clock digits instead of shifting
// through UTC. Used for startTime/dueDate/reviewAt only — NOT for entity timestamps, which
// must be a real instant (see normalizeEntityTimestamp below).
const parseCsvDateValue = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})$/u.exec(trimmed);
    if (dateOnlyMatch) return dateOnlyMatch[1];
    const dateTimeMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/u.exec(trimmed);
    if (dateTimeMatch) return `${dateTimeMatch[1]}T${dateTimeMatch[2]}`;
    const parsed = safeParseDate(trimmed);
    if (!parsed) return undefined;
    if (/Z$|[+-]\d{2}:?\d{2}$/iu.test(trimmed)) return parsed.toISOString();
    return /\d{1,2}:\d{2}/u.test(trimmed) ? formatLocalDateTime(parsed) : formatLocalDate(parsed);
};

// Entity timestamps (createdAt, and completedAt which feeds updatedAt via applyImport's
// fallback) must be a real, unambiguous instant. A bare "2026-08-01" written verbatim into
// storage reads back as UTC midnight in some readers (sync.ts's `new Date(...)`) and local
// midnight in others (safeParseDate) — one string, two different instants. Normalizing through
// safeParseDate + toISOString here, once, means every reader agrees forever after.
const normalizeEntityTimestamp = (value: string): string | undefined => safeParseDate(value)?.toISOString();

const parseDateCell = (raw: string, counters: MindwtrCsvWarningCounters): string | undefined => {
    const value = parseCsvDateValue(raw);
    if (!value && raw.trim()) counters.unparsedDates += 1;
    return value;
};

const parseTimestampCell = (raw: string, counters: MindwtrCsvWarningCounters): string | undefined => {
    const value = normalizeEntityTimestamp(raw);
    if (!value && raw.trim()) counters.unparsedDates += 1;
    return value;
};

// `sourcePrefix` is the ZIP entry name (empty for a lone CSV file). Without it, row 2 of a.csv
// and row 2 of b.csv in one ZIP would both fall back to the same "row-2" id and collapse into
// one task — see C1 in the review.
const parseMindwtrCsvRows = (
    csvText: string,
    counters: MindwtrCsvWarningCounters,
    sourcePrefix: string
): ParsedMindwtrCsvImportData => {
    const delimiter = detectMindwtrCsvDelimiter(csvText);
    const { rows, hasUnclosedQuote } = parseCsvRows(sanitizeCsvText(csvText), delimiter);
    if (hasUnclosedQuote) counters.unclosedQuotedFiles += 1;
    if (rows.length === 0) {
        return { areas: [], projects: [], sections: [], tasks: [], warnings: [] };
    }

    const headerIndex = buildHeaderIndex(rows[0] || []);
    if (!headerIndex.has('TITLE')) {
        throw new Error('Mindwtr CSV is missing the required column: Title');
    }
    countUnknownColumns(rows[0] || [], counters);

    const areasByKey = new Map<string, ParsedMindwtrCsvArea>();
    const projectsByKey = new Map<string, ParsedMindwtrCsvProject>();
    const sectionsByKey = new Map<string, ParsedMindwtrCsvSection>();
    const sectionCountByProject = new Map<string, number>();
    const tasks: ParsedMindwtrCsvTask[] = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        const title = getCell(row, headerIndex, 'TITLE').trim();
        if (!title) {
            if (row.some((cell) => String(cell || '').trim().length > 0)) counters.emptyTitleRows += 1;
            continue;
        }

        const projectName = getCell(row, headerIndex, 'PROJECT').trim();
        const sectionName = getCell(row, headerIndex, 'SECTION').trim();
        const areaName = getCell(row, headerIndex, 'AREA').trim();
        if (getCell(row, headerIndex, 'RECURRENCE')) counters.recurrenceColumnsIgnored += 1;

        const projectSourceKey = projectName ? normalizeSourceKey(projectName) : undefined;
        const areaSourceKey = areaName ? normalizeSourceKey(areaName) : undefined;
        let sectionSourceKey: string | undefined;
        if (sectionName) {
            if (projectSourceKey) {
                sectionSourceKey = `${projectSourceKey}:${normalizeSourceKey(sectionName)}`;
            } else {
                counters.sectionWithoutProject += 1;
            }
        }

        if (areaSourceKey && !areasByKey.has(areaSourceKey)) {
            areasByKey.set(areaSourceKey, { sourceKey: areaSourceKey, name: areaName, order: areasByKey.size });
        }
        if (projectSourceKey && !projectsByKey.has(projectSourceKey)) {
            projectsByKey.set(projectSourceKey, {
                sourceKey: projectSourceKey,
                name: projectName,
                order: projectsByKey.size,
                ...(areaSourceKey ? { areaSourceKey } : {}),
            });
        }
        if (sectionSourceKey && !sectionsByKey.has(sectionSourceKey)) {
            const order = sectionCountByProject.get(projectSourceKey as string) ?? 0;
            sectionCountByProject.set(projectSourceKey as string, order + 1);
            sectionsByKey.set(sectionSourceKey, {
                sourceKey: sectionSourceKey,
                projectSourceKey: projectSourceKey as string,
                name: sectionName,
                order,
            });
        }

        const completedAt = parseTimestampCell(getCell(row, headerIndex, 'COMPLETED AT'), counters);
        const status = resolveStatus(getCell(row, headerIndex, 'STATUS'), Boolean(projectSourceKey), Boolean(completedAt), counters);
        const idColumn = getCell(row, headerIndex, 'ID').trim();

        tasks.push({
            areaSourceKey,
            assignedTo: getCell(row, headerIndex, 'ASSIGNED TO').trim() || undefined,
            checklist: parseChecklist(getCell(row, headerIndex, 'CHECKLIST')),
            completedAt,
            contexts: parseContexts(getCell(row, headerIndex, 'CONTEXTS')),
            createdAt: parseTimestampCell(getCell(row, headerIndex, 'CREATED AT'), counters),
            description: getCell(row, headerIndex, 'DESCRIPTION').trim() || undefined,
            dueDate: parseDateCell(getCell(row, headerIndex, 'DUE DATE'), counters),
            energyLevel: parseEnergy(getCell(row, headerIndex, 'ENERGY')),
            location: getCell(row, headerIndex, 'LOCATION').trim() || undefined,
            // Falls back to row index like TickTick's own ORDER column handling; ties after
            // sorting keep CSV row order because Array#sort is a stable sort.
            order: toNumber(getCell(row, headerIndex, 'ORDER'), rowIndex),
            priority: parsePriority(getCell(row, headerIndex, 'PRIORITY')),
            projectSourceKey,
            reviewAt: parseDateCell(getCell(row, headerIndex, 'REVIEW DATE'), counters),
            sectionSourceKey,
            sourceId: idColumn || `${sourcePrefix}row-${rowIndex + 1}`,
            startTime: parseDateCell(getCell(row, headerIndex, 'START DATE'), counters),
            status,
            tags: parseTags(getCell(row, headerIndex, 'TAGS')),
            title,
        });
    }

    return {
        areas: Array.from(areasByKey.values()),
        projects: Array.from(projectsByKey.values()),
        sections: Array.from(sectionsByKey.values()),
        tasks,
        warnings: [],
    };
};

const mergeParsedData = (target: ParsedMindwtrCsvImportData, source: ParsedMindwtrCsvImportData): void => {
    const areaKeys = new Set(target.areas.map((area) => area.sourceKey));
    const projectKeys = new Set(target.projects.map((project) => project.sourceKey));
    const sectionKeys = new Set(target.sections.map((section) => section.sourceKey));
    source.areas.forEach((area) => {
        if (areaKeys.has(area.sourceKey)) return;
        areaKeys.add(area.sourceKey);
        target.areas.push(area);
    });
    source.projects.forEach((project) => {
        if (projectKeys.has(project.sourceKey)) return;
        projectKeys.add(project.sourceKey);
        target.projects.push(project);
    });
    source.sections.forEach((section) => {
        if (sectionKeys.has(section.sourceKey)) return;
        sectionKeys.add(section.sourceKey);
        target.sections.push(section);
    });
    target.tasks.push(...source.tasks);
};

const bucketKeyForTask = (task: ParsedMindwtrCsvTask): string => (
    task.projectSourceKey ? `project:${task.projectSourceKey}`
        : task.areaSourceKey ? `area:${task.areaSourceKey}`
            : 'inbox'
);

const buildPreview = (fileName: string, parsedData: ParsedMindwtrCsvImportData): MindwtrCsvImportPreview => {
    const taskCountByProject = new Map<string, number>();
    parsedData.tasks.forEach((task) => {
        if (!task.projectSourceKey) return;
        taskCountByProject.set(task.projectSourceKey, (taskCountByProject.get(task.projectSourceKey) ?? 0) + 1);
    });
    const areaNameByKey = new Map(parsedData.areas.map((area) => [area.sourceKey, area.name]));
    const projects = parsedData.projects.map((project) => ({
        name: project.name,
        areaName: project.areaSourceKey ? areaNameByKey.get(project.areaSourceKey) : undefined,
        taskCount: taskCountByProject.get(project.sourceKey) ?? 0,
    }));
    const checklistItemCount = parsedData.tasks.reduce((sum, task) => sum + task.checklist.length, 0);
    const standaloneTaskCount = parsedData.tasks.filter((task) => !task.projectSourceKey).length;
    return {
        fileName,
        areaCount: parsedData.areas.length,
        projectCount: parsedData.projects.length,
        sectionCount: parsedData.sections.length,
        taskCount: parsedData.tasks.length,
        standaloneTaskCount,
        checklistItemCount,
        projects,
        warnings: parsedData.warnings,
    };
};

export const parseMindwtrCsvImportSource = (input: MindwtrCsvFileInput): MindwtrCsvImportParseResult => {
    const fileName = basename(input.fileName);
    const counters = createWarningCounters();
    const parsedData: ParsedMindwtrCsvImportData = { areas: [], projects: [], sections: [], tasks: [], warnings: [] };

    const parseOneCsv = (csvText: string, sourcePrefix = ''): void => {
        mergeParsedData(parsedData, parseMindwtrCsvRows(csvText, counters, sourcePrefix));
    };

    try {
        const source = readImportSource(input);
        if (source.kind === 'archive') {
            source.entries.forEach(({ entryName, entryBytes }) => {
                const lowerName = entryName.toLowerCase();
                if (!entryName || entryName.endsWith('/')) return;
                if (lowerName.endsWith('.zip')) {
                    counters.nestedZipFiles += 1;
                    return;
                }
                if (!lowerName.endsWith('.csv')) {
                    counters.nonCsvEntries += 1;
                    return;
                }
                try {
                    parseOneCsv(decodeTextBytes(entryBytes), `${entryName}:`);
                } catch {
                    counters.invalidCsvFiles += 1;
                }
            });
        } else {
            parseOneCsv(source.text);
        }
    } catch (error) {
        return {
            valid: false,
            parsedData: null,
            preview: null,
            warnings: buildWarnings(counters),
            errors: [error instanceof Error && error.message ? error.message : 'Failed to parse the Mindwtr CSV file.'],
        };
    }

    // A duplicated user-supplied ID (within one file, or across CSVs in one ZIP that share a
    // project) collapses to one task at apply time via the same `${projectSourceKey}:${sourceId}`
    // key — warn about it here so the drop isn't silent.
    const seenTaskKeys = new Set<string>();
    parsedData.tasks.forEach((task) => {
        const key = `${task.projectSourceKey ?? 'none'}:${task.sourceId}`;
        if (seenTaskKeys.has(key)) counters.duplicateIds += 1;
        else seenTaskKeys.add(key);
    });

    // Stable sort: groups each task's manual Order within its own project/area bucket while
    // preserving original row order as the tiebreak (Array#sort is required to be stable).
    parsedData.tasks.sort((left, right) => {
        const bucketCompare = bucketKeyForTask(left).localeCompare(bucketKeyForTask(right));
        return bucketCompare !== 0 ? bucketCompare : left.order - right.order;
    });

    const warnings = buildWarnings(counters);
    parsedData.warnings = warnings;
    const errors = parsedData.tasks.length === 0 ? ['No importable tasks were found in the selected file.'] : [];
    return {
        valid: errors.length === 0,
        parsedData: errors.length === 0 ? parsedData : null,
        preview: errors.length === 0 ? buildPreview(fileName, parsedData) : null,
        warnings,
        errors,
    };
};

// Delegates entity creation (rev/revBy stamping, tombstone-aware deterministic id dedupe,
// per-bucket order allocation, and now Section creation) entirely to the shared seam.
export const applyMindwtrCsvImport = (
    currentData: AppData,
    parsedData: ParsedMindwtrCsvImportData,
    options: { now?: Date | string } = {}
): MindwtrCsvImportExecutionResult => (
    applyImport(
        currentData,
        {
            areas: parsedData.areas,
            projects: parsedData.projects,
            sections: parsedData.sections,
            tasks: parsedData.tasks.map((task) => ({
                ...task,
                sourceKey: `${task.projectSourceKey ?? 'none'}:${task.sourceId}`,
            })),
            warnings: parsedData.warnings,
        },
        {
            fallbacks: { area: MINDWTR_CSV_AREA_FALLBACK, project: MINDWTR_CSV_PROJECT_FALLBACK },
            idFor: createMindwtrCsvImportId,
            now: options.now,
            suffix: MINDWTR_CSV_IMPORT_SUFFIX,
        }
    )
);
