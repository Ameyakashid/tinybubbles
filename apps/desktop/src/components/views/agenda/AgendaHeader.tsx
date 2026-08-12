import type { NextGroupBy } from '../list/next-grouping';
import { displayLabel } from '../../../lib/display-labels';
import type { Language } from '@tinybubbles/core';

type AgendaHeaderProps = {
    filterCount: number;
    filtersOpen: boolean;
    nextActionsCount: number;
    nextGroupBy: NextGroupBy;
    onChangeGroupBy: (value: NextGroupBy) => void;
    onToggleFilters: () => void;
    onToggleDetails: () => void;
    onToggleTop3: () => void;
    resolveText: (key: string, fallback: string) => string;
    showListDetails: boolean;
    t: (key: string) => string;
    language?: Language;
    top3Only: boolean;
};

export function AgendaHeader({
    nextActionsCount,
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
            {/* Toolbar controls (Top 3 / Filters / Details / Group) are hidden
             * in the simplified shell — capability intact, props still passed.
             * See DESIGN.md. */}
        </header>
    );
}
