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
        filterCount={0}
        filtersOpen={false}
        nextActionsCount={3}
        nextGroupBy="none"
        onChangeGroupBy={vi.fn()}
        onToggleDetails={vi.fn()}
        onToggleFilters={vi.fn()}
        onToggleTop3={vi.fn()}
        resolveText={resolveText}
        showListDetails={false}
        t={t}
        top3Only={false}
        {...overrides}
    />
);

describe('AgendaHeader', () => {
    // The Focus toolbar (Top 3 / Filters / Show details / Group) is hidden in
    // the simplified shell — capability intact (props still accepted/wired),
    // but AgendaHeader itself renders no controls. See DESIGN.md.
    it('does not render a Group selector', () => {
        const onChangeGroupBy = vi.fn();
        const { queryByRole } = renderHeader({ onChangeGroupBy });

        expect(queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument();
        expect(onChangeGroupBy).not.toHaveBeenCalled();
    });

    it('does not render a details toggle button, in either details state', () => {
        const { queryByRole, rerender } = renderHeader();
        expect(queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: 'Hide details' })).not.toBeInTheDocument();

        rerender(
            <AgendaHeader
                filterCount={0}
                filtersOpen={false}
                nextActionsCount={3}
                nextGroupBy="none"
                onChangeGroupBy={vi.fn()}
                onToggleDetails={vi.fn()}
                onToggleFilters={vi.fn()}
                onToggleTop3={vi.fn()}
                resolveText={resolveText}
                showListDetails
                t={t}
                top3Only={false}
            />
        );
        expect(queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: 'Hide details' })).not.toBeInTheDocument();
    });

    // Focus used to draw its own pill buttons and a bare select for Top 3 /
    // Filters / Show details / Group; the whole row is hidden now, so the
    // header renders only the title and the plain-language count line.
    it('renders no toolbar buttons or Group control at all', () => {
        const { container, queryByText } = renderHeader();

        expect(container.querySelectorAll('button')).toHaveLength(0);
        expect(queryByText('Group')).not.toBeInTheDocument();
        expect(queryByText('3 to do')).toBeInTheDocument();
    });
});
