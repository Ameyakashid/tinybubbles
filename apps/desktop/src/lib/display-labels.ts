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
    'agenda.nextActions': 'To do',
    'list.someday': 'Maybe later',
    'list.waiting': 'Waiting',
    'nav.trash': 'Deleted',
    'calendar.openDayView': 'Show this day',
    'calendar.items': 'to do',
    'calendar.deadline': 'Due',
    'calendar.unschedule': 'Take off this day',
    'calendar.existingTask': 'Pick a task',
    'calendar.schedulePlaceholder': 'Find a task...',
    'quickAdd.example': 'e.g. Feed the cat',
    'quickAdd.invalidDateCommand': "I couldn't understand this date",
    'projects.activeSection': 'My lists',
    'projects.deferredSection': 'Later',
    'projects.selectProject': 'Pick a list to see its tasks',
    'process.btn': 'Tidy up',
    'mindSweep.launchButton': 'Get it all out',
    'mindSweep.title': 'Get it all out',
    'calendar.tasksAndEvents': 'See what is coming up',
    'search.scopeHint': 'Find anything',
    'inbox.projectHint': 'If something needs lots of steps, you can turn it into a list while you tidy up.',
};

/** The translated label for `key`, unless the shell overrides it with plainer words. */
export function displayLabel(t: TranslateFn, language: Language, key: string, fallback: string): string {
    return (language === 'en' ? DISPLAY_LABEL_OVERRIDES[key] : undefined) ?? tFallback(t, key, fallback);
}
