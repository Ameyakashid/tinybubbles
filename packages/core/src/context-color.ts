const CONTEXT_COLOR_PALETTE = [
    '#2563eb',
    '#0f766e',
    '#15803d',
    // Fuchsia, not indigo: indigo sat 17° from the violet below and the two
    // were indistinguishable as chip tints (#974). Replaced in place — the
    // palette length feeds the hash modulo, so shrinking it would recolor
    // every context instead of only the ones on this slot.
    '#a21caf',
    '#c2410c',
    '#be185d',
    '#0e7490',
    '#7c3aed',
    '#166534',
    '#b45309',
];

function hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index);
        hash |= 0;
    }
    return hash;
}

export function getContextColor(context: string): string {
    const normalized = context.trim().toLowerCase();
    if (!normalized) return CONTEXT_COLOR_PALETTE[0];
    const hash = hashText(normalized);
    const index = Math.abs(hash) % CONTEXT_COLOR_PALETTE.length;
    return CONTEXT_COLOR_PALETTE[index];
}
