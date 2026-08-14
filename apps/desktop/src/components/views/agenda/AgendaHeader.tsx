import { displayLabel } from '../../../lib/display-labels';
import type { Language } from '@tinybubbles/core';

type AgendaHeaderProps = {
    filtersOpen: boolean;
    nextActionsCount: number;
    onToggleFilters: () => void;
    t: (key: string) => string;
    language?: Language;
};

export function AgendaHeader({
    filtersOpen,
    nextActionsCount,
    onToggleFilters,
    t,
    language = 'en',
}: AgendaHeaderProps) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">
                    {t('agenda.title')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {nextActionsCount} {displayLabel(t, language, 'agenda.nextActions', 'to do')}
                </p>
            </div>
            <button
                type="button"
                onClick={onToggleFilters}
                aria-expanded={filtersOpen}
                aria-controls="agenda-filters-panel"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
                {t('filters.label')}
            </button>
        </header>
    );
}
