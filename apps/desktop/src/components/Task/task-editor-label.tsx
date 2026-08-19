import { formatI18nTemplate, tFallback } from '@tinybubbles/core';

export const taskEditorLabelClassName = 'text-xs text-muted-foreground font-semibold';

// Quick-add tokens each editor field maps to, verified against parseQuickAdd
// (packages/core/src/quick-add.ts). Fields whose token the parser does not
// accept get no hint. Tokens are language-neutral and never translated.
export const QUICK_ADD_FIELD_TOKENS = {
    energyLevel: '/energy:',
    assignedTo: '%Name',
    contexts: '@context',
    tags: '#tag',
    startTime: '/start:',
    dueDate: '/due:',
    reviewAt: '/review:',
    note: '/note:',
    link: '/link:',
    area: '!Area',
    project: '+Project',
} as const;

// Localized "Quick add: <token>" hint for a token badge's `title` tooltip (#918).
export function quickAddTokenHint(t: (key: string) => string, token: string): string {
    return formatI18nTemplate(
        tFallback(t, 'taskEdit.quickAddTokenHint', 'Quick add: {{token}}'),
        { token },
    );
}

export function QuickAddTokenBadge(_props: {
    t: (key: string) => string;
    token: string;
}) {
    // Simplified shell (see DESIGN.md): the token-syntax badges taught the
    // adult quick-add grammar (+Project, @context, /due:) beside every field
    // label. A child should not be handed a syntax lesson; the parser still
    // accepts every token in typed input, the token roster and tooltip
    // machinery above stay for the call sites, and the parent flavour keeps
    // the badges. Rendering nothing here hides all of them at once.
    return null;
}
