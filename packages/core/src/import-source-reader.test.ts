import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
    appendWarning,
    basename,
    buildHeaderIndex,
    dedupeStrings,
    detectDelimiter,
    getCell,
    isZipBytes,
    joinDescription,
    normalizeHeaderCell,
    parseCsvRows,
    readImportSource,
    sanitizeCsvText,
    sanitizeJsonText,
    toImportBytes,
} from './import-source-reader';

describe('import-source-reader', () => {
    it('basename strips both slash styles and falls back to the whole value', () => {
        expect(basename('C:\\exports\\file.csv')).toBe('file.csv');
        expect(basename('/tmp/exports/file.csv')).toBe('file.csv');
        expect(basename('file.csv')).toBe('file.csv');
        expect(basename('')).toBe('');
    });

    it('toImportBytes normalizes ArrayBuffer/Uint8Array/null uniformly', () => {
        expect(toImportBytes(null)).toBeNull();
        expect(toImportBytes(undefined)).toBeNull();
        const bytes = new Uint8Array([1, 2, 3]);
        expect(toImportBytes(bytes)).toBe(bytes);
        expect(Array.from(toImportBytes(bytes.buffer) as Uint8Array)).toEqual([1, 2, 3]);
    });

    it('isZipBytes checks the local-file-header signature', () => {
        expect(isZipBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
        expect(isZipBytes(new Uint8Array([0x50, 0x4b, 0x03]))).toBe(false);
        expect(isZipBytes(new Uint8Array([0, 0, 0, 0]))).toBe(false);
    });

    it('sanitizeCsvText/sanitizeJsonText strip a leading BOM, json also trims', () => {
        expect(sanitizeCsvText('\uFEFFa,b')).toBe('a,b');
        expect(sanitizeJsonText('\uFEFF  {"a":1}  ')).toBe('{"a":1}');
    });

    it('detectDelimiter prefers semicolon only when it strictly outnumbers commas', () => {
        expect(detectDelimiter('a,b,c')).toBe(',');
        expect(detectDelimiter('a;b;c')).toBe(';');
        expect(detectDelimiter('a,b;c')).toBe(','); // tie goes to comma
        expect(detectDelimiter('')).toBe(','); // default fallback
        expect(detectDelimiter('', ';')).toBe(';'); // custom fallback
    });

    it('parseCsvRows handles quoted fields, escaped quotes, and reports an unclosed quote', () => {
        const { rows, hasUnclosedQuote } = parseCsvRows('a,"b,c","d""e"\nf,g,h', ',');
        expect(rows).toEqual([
            ['a', 'b,c', 'd"e'],
            ['f', 'g', 'h'],
        ]);
        expect(hasUnclosedQuote).toBe(false);

        const unclosed = parseCsvRows('a,"b', ',');
        expect(unclosed.hasUnclosedQuote).toBe(true);
        expect(unclosed.rows).toEqual([['a', 'b']]);
    });

    // No test — old or new — pinned CRLF handling before this refactor, even though the code has
    // an explicit `\r\n` branch. Cheap to close: same fixture, `\r\n` line endings instead of `\n`.
    it('parseCsvRows treats CRLF as a single row terminator, not an extra blank row', () => {
        const { rows } = parseCsvRows('a,"b,c","d""e"\r\nf,g,h\r\n', ',');
        expect(rows).toEqual([
            ['a', 'b,c', 'd"e'],
            ['f', 'g', 'h'],
        ]);
    });

    it('buildHeaderIndex/getCell resolve columns case-insensitively', () => {
        const index = buildHeaderIndex([' Title ', 'Due Date']);
        expect(normalizeHeaderCell(' Title ')).toBe('TITLE');
        expect(getCell(['Task 1', '2026-01-01'], index, 'TITLE')).toBe('Task 1');
        expect(getCell(['Task 1', '2026-01-01'], index, 'DUE DATE')).toBe('2026-01-01');
        expect(getCell(['Task 1'], index, 'MISSING')).toBe('');
    });

    it('dedupeStrings dedupes case-insensitively, keeping first-seen casing', () => {
        expect(dedupeStrings(['Work', 'work', ' WORK ', undefined, '', 'Home'])).toEqual(['Work', 'Home']);
    });

    it('joinDescription joins defined non-empty parts with a blank line', () => {
        expect(joinDescription(['first', undefined, '  ', 'second'])).toBe('first\n\nsecond');
        expect(joinDescription([undefined, '  '])).toBeUndefined();
    });

    it('appendWarning pushes nothing for zero, singular for one, formatted plural otherwise', () => {
        const warnings: string[] = [];
        appendWarning(warnings, 0, '1 thing', '{count} things');
        appendWarning(warnings, 1, '1 thing', '{count} things');
        appendWarning(warnings, 3, '1 thing', '{count} things');
        expect(warnings).toEqual(['1 thing', '3 things']);
    });

    it('readImportSource returns decoded text for a plain (non-ZIP) file', () => {
        const result = readImportSource({ fileName: 'export.csv', text: 'a,b\n1,2' });
        expect(result).toEqual({ kind: 'text', fileName: 'export.csv', text: 'a,b\n1,2' });
    });

    it('readImportSource decodes bytes with the provided decoder for a non-ZIP file', () => {
        const bytes = strToU8('hello');
        const result = readImportSource({ fileName: 'export.csv', bytes }, () => 'DECODED');
        expect(result).toEqual({ kind: 'text', fileName: 'export.csv', text: 'DECODED' });
    });

    it('readImportSource returns raw archive entries (including directories) for a ZIP file', () => {
        const archive = zipSync({
            'a.csv': strToU8('1,2'),
            'nested/': new Uint8Array(0),
            'notes.txt': strToU8('skip me'),
        });
        const result = readImportSource({ fileName: 'export.zip', bytes: archive });
        expect(result.kind).toBe('archive');
        if (result.kind !== 'archive') throw new Error('expected archive');
        expect(result.fileName).toBe('export.zip');
        const names = result.entries.map((entry) => entry.entryName).sort();
        expect(names).toEqual(['a.csv', 'nested/', 'notes.txt']);
        const csvEntry = result.entries.find((entry) => entry.entryName === 'a.csv');
        expect(new TextDecoder().decode(csvEntry?.entryBytes)).toBe('1,2');
    });
});
