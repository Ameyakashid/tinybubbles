// Shared file-reading frontend for the third-party importers (OmniFocus, Todoist, TickTick,
// DGT). Every importer used to hand-write its own copy of "sniff bytes -> unzip or decode ->
// sanitize -> split CSV into rows/header index" — this module owns that once. Per-format parse
// logic (what a row/record MEANS) stays in each importer; only the byte/CSV mechanics move here.
import { strFromU8, unzipSync } from 'fflate';

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

export const basename = (value: string): string => {
    const parts = String(value || '').split(/[\\/]/u);
    return parts[parts.length - 1] || value;
};

export const toImportBytes = (value?: ArrayBuffer | Uint8Array | null): Uint8Array | null => {
    if (!value) return null;
    return value instanceof Uint8Array ? value : new Uint8Array(value);
};

export const isZipBytes = (bytes: Uint8Array): boolean =>
    bytes.length >= ZIP_SIGNATURE.length && ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte);

// Every importer's non-UTF-8 fallback is identical; OmniFocus additionally sniffs a UTF-16 BOM
// before falling back to this for the rest, so it keeps its own richer decoder that calls this
// one for the shared tail.
export const decodeTextBytes = (bytes: Uint8Array): string => {
    try {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return strFromU8(bytes, true);
    }
};

export const sanitizeCsvText = (raw: string): string => String(raw || '').replace(/^\uFEFF/u, '');

export const sanitizeJsonText = (raw: string): string => String(raw || '').replace(/^\uFEFF/u, '').trim();

export const detectDelimiter = (text: string, fallback = ','): string => {
    const firstLine = sanitizeCsvText(text)
        .split(/\r?\n/u)
        .find((line) => line.trim().length > 0);
    if (!firstLine) return fallback;
    const commaCount = (firstLine.match(/,/gu) || []).length;
    const semicolonCount = (firstLine.match(/;/gu) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
};

export const parseCsvRows = (text: string, delimiter: string): { hasUnclosedQuote: boolean; rows: string[][] } => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (inQuotes) {
            if (char === '"') {
                if (next === '"') {
                    currentCell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }
        if (char === delimiter) {
            currentRow.push(currentCell);
            currentCell = '';
            continue;
        }
        if (char === '\r' || char === '\n') {
            if (char === '\r' && next === '\n') {
                index += 1;
            }
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
            continue;
        }
        currentCell += char;
    }

    currentRow.push(currentCell);
    if (currentRow.length > 1 || currentRow[0] !== '' || rows.length === 0) {
        rows.push(currentRow);
    }

    return {
        rows: rows.filter((row) => row.some((cell) => cell.length > 0)),
        hasUnclosedQuote: inQuotes,
    };
};

export const normalizeHeaderCell = (value: string): string => value.trim().toUpperCase();

export const buildHeaderIndex = (headerRow: string[]): Map<string, number> => {
    const index = new Map<string, number>();
    headerRow.forEach((cell, cellIndex) => {
        const normalized = normalizeHeaderCell(cell);
        if (normalized && !index.has(normalized)) {
            index.set(normalized, cellIndex);
        }
    });
    return index;
};

export const getCell = (row: string[], headerIndex: Map<string, number>, key: string): string => {
    const index = headerIndex.get(key);
    if (index === undefined) return '';
    return String(row[index] ?? '').trim();
};

// Same concept in OmniFocus and DGT: normalize a free-text context name to Mindwtr's `@name`
// convention. (Not the same as OmniFocus's/DGT's *own* `normalizeContexts`/`normalizeTags`
// functions, which parse an entire CSV token list or a whole JSON array respectively — those
// happen to share a name across formats but do genuinely different things, so they stay local.)
export const normalizeContextName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

// Trim + dedupe case-insensitively, keeping the first-seen casing. Every importer had its own
// copy of this (some under a different local name, e.g. OmniFocus's `dedupeCaseInsensitive`).
export const dedupeStrings = (values: Array<string | undefined>): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        result.push(trimmed);
    });
    return result;
};

export const joinDescription = (parts: Array<string | undefined>): string | undefined => {
    const normalized = parts.map((part) => String(part || '').trim()).filter(Boolean);
    return normalized.length > 0 ? normalized.join('\n\n') : undefined;
};

// Every importer's warning list is built from its own counters and its own message strings —
// only this "if count > 0, push singular/plural" shape was byte-identical across all four.
export const appendWarning = (warnings: string[], count: number, singular: string, plural = singular): void => {
    if (count <= 0) return;
    warnings.push(count === 1 ? singular : plural.replace('{count}', String(count)));
};

export type ImportSourceInput = {
    bytes?: ArrayBuffer | Uint8Array | null;
    fileName: string;
    text?: string | null;
};

export type ImportArchiveEntry = { entryBytes: Uint8Array; entryName: string };

export type ReadImportSourceResult =
    | { entries: ImportArchiveEntry[]; fileName: string; kind: 'archive' }
    | { fileName: string; kind: 'text'; text: string };

// Bytes -> either a decoded single-file text blob or the raw entries of a ZIP archive. Each
// importer still walks `entries` itself and owns its own per-entry extension/counter logic
// (nested zip, wrong extension, invalid parse) since the exact warning message and which
// extension is expected (.csv vs .json) differs per format; this only removes the byte-sniffing
// and generic UTF-8 decode that were duplicated verbatim in all four parsers.
export const readImportSource = (
    input: ImportSourceInput,
    decodeText: (bytes: Uint8Array) => string = decodeTextBytes
): ReadImportSourceResult => {
    const fileName = basename(input.fileName);
    const bytes = toImportBytes(input.bytes);
    if (bytes && isZipBytes(bytes)) {
        const entries = Object.entries(unzipSync(bytes)).map(([entryName, entryBytes]) => ({ entryName, entryBytes }));
        return { kind: 'archive', fileName, entries };
    }
    const text = input.text ?? (bytes ? decodeText(bytes) : '');
    return { kind: 'text', fileName, text };
};
