import { tFallback, type Language } from '@tinybubbles/core';

type TranslateFn = (key: string) => string;

/**
 * Plain-language display overrides (see DESIGN.md — simplify pass).
 *
 * The translated strings live in packages/core (edit-forbidden) and speak GTD:
 * "Next Actions", "Someday/Maybe", "Waiting For". The shell shows plainer
 * words a child could hear read aloud. This map is the single place where
 * display text is overridden — core is untouched, and the override only
 * applies at call sites that opt in via displayLabel().
 *
 * Overrides are deliberately English-only. Every other locale keeps its
 * inherited translation untouched.
 */
const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
    'status.next': 'To do',
    'status.someday': 'Maybe later',
    'agenda.nextActions': 'to do',
    'list.someday': 'Maybe later',
    'list.waiting': 'Waiting',
    'nav.trash': 'Deleted',
};

/** The translated label for `key`, unless the shell overrides it with plainer words. */
export function displayLabel(t: TranslateFn, language: Language, key: string, fallback: string): string {
    return (language === 'en' ? DISPLAY_LABEL_OVERRIDES[key] : undefined) ?? tFallback(t, key, fallback);
}
