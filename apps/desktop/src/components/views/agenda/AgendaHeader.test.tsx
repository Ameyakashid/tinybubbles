import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AgendaHeader } from './AgendaHeader';

const resolveText = (key: string, fallback: string) => {
    if (key === 'tags.title') return 'Tags';
    return fallback;
};

const t = (key: string) => resolveText(key, key);

const renderHeader = (overrides: Partial<Parameters<typeof AgendaHeader>[0]> = {}) => render(
    <AgendaHeader
        filtersOpen={false}
        nextActionsCount={3}
        onToggleFilters={vi.fn()}
        t={t}
        {...overrides}
    />
);

describe('AgendaHeader', () => {
    // The Focus toolbar (Top 3 / Filters / Show details / Group) is hidden in
    // the simplified shell — capability intact (props still accepted/wired),
    // but AgendaHeader itself renders no controls. See DESIGN.md.
    it('does not render a Group selector', () => {
        const { queryByRole } = renderHeader();

        expect(queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument();
    });

    it('does not render a details toggle button, in either details state', () => {
        const { queryByRole, rerender } = renderHeader();
        expect(queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: 'Hide details' })).not.toBeInTheDocument();

        rerender(
            <AgendaHeader
                filtersOpen
                nextActionsCount={3}
                onToggleFilters={vi.fn()}
                t={t}
            />
        );
        expect(queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: 'Hide details' })).not.toBeInTheDocument();
    });

    // Focus used to draw its own pill buttons and a bare select for Top 3 /
    // Filters / Show details / Group; the whole row is hidden now, so the
    // header renders only the title and the plain-language count line.
    it('renders only the filter entry point and exposes its panel state', () => {
        const onToggleFilters = vi.fn();
        const { getByRole, queryByText } = renderHeader({ onToggleFilters });
        const button = getByRole('button', { name: 'filters.label' });

        expect(button).toHaveAttribute('aria-expanded', 'false');
        button.click();
        expect(onToggleFilters).toHaveBeenCalledOnce();
        expect(queryByText('Group')).not.toBeInTheDocument();
        expect(queryByText('3 to do')).toBeInTheDocument();
    });
});
