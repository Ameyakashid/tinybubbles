import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
    applyMindwtrCsvImport,
    parseMindwtrCsvImportSource,
    type ParsedMindwtrCsvImportData,
} from './mindwtr-csv-import';
import { mockAppData } from './sync-test-utils';

const quoteCell = (cell: string): string => `"${cell.replace(/"/gu, '""')}"`;

const buildCsv = (headers: string[], rows: string[][], delimiter = ','): string => (
    [headers, ...rows].map((row) => row.map(quoteCell).join(delimiter)).join('\n')
);

const FULL_HEADERS = [
    'Title', 'Description', 'Status', 'Project', 'Section', 'Area', 'Contexts', 'Tags',
    'Assigned To', 'Priority', 'Energy', 'Start Date', 'Due Date', 'Review Date',
    'Completed At', 'Checklist', 'Location', 'Order', 'ID', 'Created At',
];

describe('mindwtr csv import', () => {
    it('parses a full-featured row into the right task, project, section, and area fields', () => {
        const csv = buildCsv(FULL_HEADERS, [
            [
                'Draft launch email', 'Multi-line\ndescription text', 'waiting', 'Marketing', 'Launch', 'Work',
                '@phone, home', '#urgent, review', 'Alex', 'high', 'low', '2026-09-01',
                '2026-09-05T14:30:00+02:00', '2026-09-10', '', '[x] Draft copy|[ ] Get approval|Send',
                'Office', '5', 'task-1', '2026-08-01T09:00:00Z',
            ],
        ]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.parsedData?.areas).toMatchObject([{ name: 'Work', sourceKey: 'work' }]);
        expect(result.parsedData?.projects).toMatchObject([
            { name: 'Marketing', sourceKey: 'marketing', areaSourceKey: 'work' },
        ]);
        expect(result.parsedData?.sections).toMatchObject([
            { name: 'Launch', projectSourceKey: 'marketing', sourceKey: 'marketing:launch' },
        ]);

        const [task] = result.parsedData?.tasks ?? [];
        expect(task).toMatchObject({
            title: 'Draft launch email',
            description: 'Multi-line\ndescription text',
            status: 'waiting',
            projectSourceKey: 'marketing',
            sectionSourceKey: 'marketing:launch',
            contexts: ['@phone', '@home'],
            tags: ['#urgent', '#review'],
            assignedTo: 'Alex',
            priority: 'high',
            energyLevel: 'low',
            startTime: '2026-09-01',
            dueDate: '2026-09-05T12:30:00.000Z',
            reviewAt: '2026-09-10',
            location: 'Office',
            sourceId: 'task-1',
            createdAt: '2026-08-01T09:00:00.000Z',
        });
        expect(task?.checklist).toEqual([
            { id: expect.any(String), title: 'Draft copy', isCompleted: true },
            { id: expect.any(String), title: 'Get approval', isCompleted: false },
            { id: expect.any(String), title: 'Send', isCompleted: false },
        ]);
    });

    it('parses a semicolon-delimited file', () => {
        const csv = buildCsv(['Title', 'Project'], [['Semicolon task', 'Ops']], ';');

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.valid).toBe(true);
        expect(result.parsedData?.tasks).toMatchObject([{ title: 'Semicolon task', projectSourceKey: 'ops' }]);
    });

    it('errors when the Title column is missing', () => {
        const csv = buildCsv(['Status', 'Project'], [['next', 'Ops']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.valid).toBe(false);
        expect(result.parsedData).toBeNull();
        expect(result.errors).toEqual(['Mindwtr CSV is missing the required column: Title']);
    });

    it('maps an unrecognized status to Inbox and warns', () => {
        const csv = buildCsv(['Title', 'Status'], [['Mystery task', 'urgent-ish']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.parsedData?.tasks).toMatchObject([{ status: 'inbox' }]);
        expect(result.warnings).toContain('1 task status could not be mapped and was imported to Inbox.');
    });

    it('ignores a Section without a Project and warns', () => {
        const csv = buildCsv(['Title', 'Section'], [['Orphan section task', 'Some Section']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.parsedData?.sections).toEqual([]);
        expect(result.parsedData?.tasks).toMatchObject([{ sectionSourceKey: undefined }]);
        expect(result.warnings).toContain('1 Section was ignored because its row had no Project.');
    });

    it('keeps a date-only value date-only while a datetime keeps its time', () => {
        const csv = buildCsv(
            ['Title', 'Start Date', 'Due Date'],
            [['Mixed dates', '2026-10-01', '2026-10-02T09:15:00']]
        );

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.parsedData?.tasks).toMatchObject([
            { startTime: '2026-10-01', dueDate: '2026-10-02T09:15:00' },
        ]);
    });

    it('defaults empty Status to next with a Project and to inbox without one', () => {
        const csv = buildCsv(
            ['Title', 'Project', 'Status'],
            [
                ['Has a project', 'Ops', ''],
                ['No project', '', ''],
            ]
        );

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        const tasks = result.parsedData?.tasks ?? [];
        expect(tasks.find((task) => task.title === 'Has a project')).toMatchObject({ status: 'next', projectSourceKey: 'ops' });
        expect(tasks.find((task) => task.title === 'No project')).toMatchObject({ status: 'inbox', projectSourceKey: undefined });
    });

    it('defaults empty Status to done when Completed At is set', () => {
        const csv = buildCsv(
            ['Title', 'Status', 'Completed At'],
            [['Finished already', '', '2026-08-05T10:00:00Z']]
        );

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.parsedData?.tasks).toMatchObject([{ status: 'done' }]);
    });

    it('warns once about unknown columns without repeating per row', () => {
        const csv = buildCsv(
            ['Title', 'Notes'],
            [['Row one', 'ignored'], ['Row two', 'ignored too']]
        );

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.warnings).toContain('1 unknown column was ignored.');
    });

    it('parses a zipped export and skips unsupported archive entries', () => {
        const csv = buildCsv(['Title', 'Project'], [['Zipped task', 'Ops']]);
        const archive = zipSync({
            'backup.csv': strToU8(csv),
            'notes.txt': strToU8('skip me'),
            'nested.zip': new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        });

        const result = parseMindwtrCsvImportSource({ fileName: 'export.zip', bytes: archive });

        expect(result.valid).toBe(true);
        expect(result.preview).toMatchObject({ taskCount: 1, projectCount: 1 });
        expect(result.warnings).toContain('1 non-CSV file inside the ZIP was skipped.');
        expect(result.warnings).toContain('1 nested ZIP file inside the archive was skipped.');
    });

    it('imports parsed data into areas, projects, sections, and tasks with fresh revisions', () => {
        const csv = buildCsv(FULL_HEADERS, [
            [
                'Draft launch email', 'Notes', 'waiting', 'Marketing', 'Launch', 'Work',
                '@phone', '#urgent', 'Alex', 'high', 'low', '2026-09-01', '2026-09-05', '2026-09-10',
                '', '[x] Draft copy', 'Office', '1', 'task-1', '2026-08-01T09:00:00Z',
            ],
        ]);
        const parsedData = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv }).parsedData as ParsedMindwtrCsvImportData;

        const result = applyMindwtrCsvImport(mockAppData([], [], []), parsedData, { now: '2026-08-08T12:00:00.000Z' });

        expect(result.importedAreaCount).toBe(1);
        expect(result.importedProjectCount).toBe(1);
        expect(result.importedSectionCount).toBe(1);
        expect(result.importedTaskCount).toBe(1);
        expect(result.importedChecklistItemCount).toBe(1);
        expect(result.importedStandaloneTaskCount).toBe(0);
        expect(result.data.settings.deviceId).toBeTruthy();

        const area = result.data.areas[0];
        expect(area).toMatchObject({ name: 'Work', rev: 1, revBy: result.data.settings.deviceId });

        const project = result.data.projects[0];
        expect(project).toMatchObject({ title: 'Marketing', areaId: area.id, rev: 1, revBy: result.data.settings.deviceId });

        const section = result.data.sections[0];
        expect(section).toMatchObject({ title: 'Launch', projectId: project.id, rev: 1, revBy: result.data.settings.deviceId });

        const task = result.data.tasks[0];
        expect(task).toMatchObject({
            title: 'Draft launch email',
            status: 'waiting',
            projectId: project.id,
            sectionId: section.id,
            assignedTo: 'Alex',
            priority: 'high',
            energyLevel: 'low',
            location: 'Office',
            rev: 1,
            revBy: result.data.settings.deviceId,
        });
        expect(task.areaId).toBeUndefined();
        expect(task.checklist).toEqual([{ id: expect.any(String), title: 'Draft copy', isCompleted: true }]);
    });

    it('does not collapse rows at the same position across two CSVs in one ZIP (C1)', () => {
        const csvA = buildCsv(['Title', 'Project'], [['Task from A', 'Ops']]);
        const csvB = buildCsv(['Title', 'Project'], [['Task from B', 'Ops']]);
        const archive = zipSync({
            'a.csv': strToU8(csvA),
            'b.csv': strToU8(csvB),
        });

        const result = parseMindwtrCsvImportSource({ fileName: 'export.zip', bytes: archive });

        expect(result.valid).toBe(true);
        const titles = (result.parsedData?.tasks ?? []).map((task) => task.title).sort();
        expect(titles).toEqual(['Task from A', 'Task from B']);

        const applied = applyMindwtrCsvImport(mockAppData([], [], []), result.parsedData as ParsedMindwtrCsvImportData, { now: '2026-08-08T12:00:00.000Z' });
        expect(applied.importedTaskCount).toBe(2);
    });

    it('normalizes a date-only Created At to a full UTC instant (C2)', () => {
        const csv = buildCsv(['Title', 'Created At'], [['Old task', '2026-08-01']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        const [task] = result.parsedData?.tasks ?? [];
        expect(task?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('does not duplicate a Section when the same import is applied again (T1)', () => {
        const csv = buildCsv(['Title', 'Project', 'Section'], [['Task one', 'Ops', 'Backlog']]);
        const parsedData = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv }).parsedData as ParsedMindwtrCsvImportData;

        const first = applyMindwtrCsvImport(mockAppData([], [], []), parsedData, { now: '2026-08-08T12:00:00.000Z' });
        const second = applyMindwtrCsvImport(first.data, parsedData, { now: '2026-08-09T12:00:00.000Z' });

        expect(first.importedSectionCount).toBe(1);
        expect(second.importedSectionCount).toBe(0);
        expect(second.data.sections).toHaveLength(1);
    });

    it('parses a tab-delimited file (T2)', () => {
        const csv = buildCsv(['Title', 'Project'], [['Tab task', 'Ops']], '\t');

        const result = parseMindwtrCsvImportSource({ fileName: 'export.tsv', text: csv });

        expect(result.valid).toBe(true);
        expect(result.parsedData?.tasks).toMatchObject([{ title: 'Tab task', projectSourceKey: 'ops' }]);
    });

    it('reorders tasks within a project by the Order column, falling back to row order on ties (T3)', () => {
        const csv = buildCsv(
            ['Title', 'Project', 'Order'],
            [
                ['Third', 'Ops', '3'],
                ['First', 'Ops', '1'],
                ['Second-a', 'Ops', '2'],
                ['Second-b', 'Ops', '2'],
            ]
        );
        const parsedData = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv }).parsedData as ParsedMindwtrCsvImportData;

        const result = applyMindwtrCsvImport(mockAppData([], [], []), parsedData, { now: '2026-08-08T12:00:00.000Z' });

        const byOrder = [...result.data.tasks].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
        expect(byOrder.map((task) => task.title)).toEqual(['First', 'Second-a', 'Second-b', 'Third']);
    });

    it('warns when a Recurrence value is present (T4)', () => {
        const csv = buildCsv(['Title', 'Recurrence'], [['Repeats weekly', 'FREQ=WEEKLY']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.warnings).toContain('1 Recurrence value was ignored; this importer does not create recurring tasks.');
    });

    it('warns when a date cell cannot be parsed', () => {
        const csv = buildCsv(['Title', 'Due Date'], [['Bad date', '09/05/2026']]);

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.parsedData?.tasks).toMatchObject([{ dueDate: undefined }]);
        expect(result.warnings).toContain('1 date value could not be parsed and was skipped.');
    });

    it('warns when an ID value is duplicated within one import', () => {
        const csv = buildCsv(
            ['Title', 'Project', 'ID'],
            [
                ['First', 'Ops', 'dup-1'],
                ['Second', 'Ops', 'dup-1'],
            ]
        );

        const result = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv });

        expect(result.warnings).toContain('1 row had an ID that duplicated an earlier row in this import and was dropped.');
    });

    it('does not duplicate records when a file with an ID column is imported again', () => {
        const csv = buildCsv(FULL_HEADERS, [
            [
                'Repeatable task', '', 'next', 'Ops', '', '', '', '', '', '', '', '', '', '',
                '', '', '', '', 'stable-id', '',
            ],
        ]);
        const parsedData = parseMindwtrCsvImportSource({ fileName: 'export.csv', text: csv }).parsedData as ParsedMindwtrCsvImportData;

        const first = applyMindwtrCsvImport(mockAppData([], [], []), parsedData, { now: '2026-08-08T12:00:00.000Z' });
        const second = applyMindwtrCsvImport(first.data, parsedData, { now: '2026-08-09T12:00:00.000Z' });

        expect(first.importedTaskCount).toBe(1);
        expect(second.importedTaskCount).toBe(0);
        expect(second.importedProjectCount).toBe(0);
        expect(second.data.tasks).toHaveLength(first.data.tasks.length);
        expect(second.data.projects).toHaveLength(first.data.projects.length);
    });
});
