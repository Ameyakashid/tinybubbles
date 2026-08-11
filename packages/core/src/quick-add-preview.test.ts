import { describe, expect, it } from 'vitest';
import { buildQuickAddPreviewEntries } from './quick-add-preview';
import { parseQuickAdd } from './quick-add';
import type { Project } from './types';

const t = (key: string) => key;

const project = (overrides: Partial<Project> = {}): Project => ({
    id: 'p1',
    title: 'Home Reno',
    color: '#000000',
    status: 'active',
    order: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
} as Project);

const now = new Date(2026, 7, 11, 9, 0, 0);

describe('buildQuickAddPreviewEntries', () => {
    it('shows nothing for a plain title', () => {
        const parsed = parseQuickAdd('call mom', [], now);
        expect(buildQuickAddPreviewEntries(parsed, { t, rawInput: 'call mom' })).toEqual([]);
    });

    it('renders the values the parse resolved, never the matched text', () => {
        const input = 'call mom @errands #family +"Home Reno" /due:tomorrow 5pm';
        const parsed = parseQuickAdd(input, [project()], now);
        const entries = buildQuickAddPreviewEntries(parsed, {
            t,
            projects: [project()],
            rawInput: input,
        });
        const byKind = Object.fromEntries(entries.map((entry) => [entry.kind, entry.value]));

        // The resolved date, formatted — not the words the user typed.
        expect(byKind.due).not.toContain('tomorrow');
        expect(byKind.due).toContain('2026');
        expect(byKind.context).toBe('@errands');
        expect(byKind.tag).toBe('#family');
        expect(byKind.project).toBe('Home Reno');
        expect(byKind.title).toBe('call mom');
    });

    it('flags every invalid date command as a warning chip', () => {
        const input = 'call mom /due:notaday';
        const parsed = parseQuickAdd(input, [], now);
        const entries = buildQuickAddPreviewEntries(parsed, { t, rawInput: input });
        expect(entries.filter((entry) => entry.tone === 'warning').map((entry) => entry.value))
            .toEqual(['/due:notaday']);
    });

    it('shows a trailing natural date as the due date it becomes', () => {
        const input = 'call mom tomorrow';
        const parsed = parseQuickAdd(input, [], now);
        expect(parsed.detectedDate?.date).toBeTruthy();
        const entries = buildQuickAddPreviewEntries(parsed, { t, rawInput: input });
        expect(entries.some((entry) => entry.kind === 'due')).toBe(true);
    });

    it('hides a detected date the surface will suppress', () => {
        const input = 'call mom tomorrow';
        const parsed = parseQuickAdd(input, [], now);
        const entries = buildQuickAddPreviewEntries(parsed, { t, rawInput: input, suppressDetectedDate: true });
        expect(entries.some((entry) => entry.kind === 'due')).toBe(false);
    });

    it('keeps chip ids stable while the draft grows', () => {
        const first = parseQuickAdd('call mom @errands', [], now);
        const second = parseQuickAdd('call mom @errands #family', [], now);
        const idsOf = (parsed: typeof first) => buildQuickAddPreviewEntries(parsed, { t }).map((entry) => entry.id);
        expect(idsOf(first)).toEqual(['context:@errands']);
        expect(idsOf(second)).toEqual(['context:@errands', 'tag:#family']);
    });

    it('names a project the capture would create', () => {
        const input = 'call mom +Brand New';
        const parsed = parseQuickAdd(input, [], now);
        const entries = buildQuickAddPreviewEntries(parsed, { t, rawInput: input });
        expect(entries.find((entry) => entry.kind === 'project')?.value).toBe('Brand New');
    });
});
