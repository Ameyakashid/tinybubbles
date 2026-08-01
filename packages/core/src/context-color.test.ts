import { describe, expect, it } from 'vitest';
import { getContextColor, NORD_CONTEXT_COLOR_PALETTE } from './context-color';

// One token per slot, so this table pins the canonical palette's values AND
// its order — the hash modulo is the palette length, so a reorder or a resize
// recolors contexts that have already been on screen for months (#974).
const SLOT_TOKENS: Array<[token: string, canonical: string, nord: string]> = [
    ['@office', '#2563eb', '#5e81ac'],
    ['@calls', '#0f766e', '#8fbcbb'],
    ['@phone', '#15803d', '#a3be8c'],
    ['@anywhere', '#a21caf', '#b48ead'],
    ['@email', '#c2410c', '#d08770'],
    ['@work', '#be185d', '#bf616a'],
    ['@shop', '#0e7490', '#88c0d0'],
    ['@errands', '#7c3aed', '#81a1c1'],
    ['@focus', '#166534', '#7a9161'],
    ['@home', '#b45309', '#ebcb8b'],
];

describe('getContextColor', () => {
    it('returns a deterministic color for the same context', () => {
        expect(getContextColor('@work')).toBe(getContextColor('@work'));
    });

    it('treats context values case-insensitively', () => {
        expect(getContextColor('@Home')).toBe(getContextColor('  @home  '));
    });

    it('returns a hex color string', () => {
        expect(getContextColor('@errands')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('keeps the canonical palette on every slot', () => {
        expect(SLOT_TOKENS.map(([token]) => getContextColor(token)))
            .toEqual(SLOT_TOKENS.map(([, canonical]) => canonical));
    });

    it('swaps in the Nord palette slot-for-slot under the nord theme', () => {
        expect(SLOT_TOKENS.map(([token]) => getContextColor(token, 'nord')))
            .toEqual(SLOT_TOKENS.map(([, , nord]) => nord));
    });

    it('leaves every other theme on the canonical palette', () => {
        for (const [token, canonical] of SLOT_TOKENS) {
            expect(getContextColor(token, 'sepia')).toBe(canonical);
            expect(getContextColor(token, 'eink')).toBe(canonical);
            expect(getContextColor(token, 'dark')).toBe(canonical);
            expect(getContextColor(token, undefined)).toBe(canonical);
        }
    });

    it('themes the empty-context fallback too', () => {
        expect(getContextColor('   ')).toBe('#2563eb');
        expect(getContextColor('   ', 'nord')).toBe('#5e81ac');
    });
});

describe('NORD_CONTEXT_COLOR_PALETTE', () => {
    it('is the same length as the canonical palette so the hash modulo is unchanged', () => {
        expect(NORD_CONTEXT_COLOR_PALETTE).toHaveLength(10);
    });

    it('has no repeated color, so two contexts never merge visually', () => {
        expect(new Set(NORD_CONTEXT_COLOR_PALETTE).size).toBe(NORD_CONTEXT_COLOR_PALETTE.length);
    });
});
