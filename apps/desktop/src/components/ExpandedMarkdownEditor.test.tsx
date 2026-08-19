import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { ExpandedMarkdownEditor } from './ExpandedMarkdownEditor';

const baseProps = {
    isOpen: true as const,
    onClose: vi.fn(),
    value: '',
    onChange: vi.fn(),
    title: 'Description',
    placeholder: 'Description',
    t: (key: string) => key,
    initialMode: 'edit' as const,
    selection: { start: 0, end: 0 } as const,
    canUndo: false,
    onUndo: () => undefined as const,
    onApplyAction: () => undefined as const,
    onSelectionChange: vi.fn(),
};

describe('ExpandedMarkdownEditor', () => {
    it('enables native spell checking in edit mode', () => {
        const { getByRole } = render(
            <ExpandedMarkdownEditor {...baseProps} value="Fix teh typo" />,
        );

        expect(getByRole('textbox')).toHaveAttribute('spellcheck', 'true');
    });

    it('renders GFM tables in preview mode', () => {
        const { container, getByRole, getByText } = render(
            <div style={{ transform: 'translateY(50px)' }}>
                <ExpandedMarkdownEditor
                    {...baseProps}
                    initialMode="preview"
                    value={[
                        '## Browsers to test',
                        '',
                        '| Browser | Version |',
                        '| ------- | ------- |',
                        '| Chrome | 124+ |',
                        '| Safari | 17+ |',
                    ].join('\n')}
                />
            </div>,
        );

        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(getByRole('dialog')).toBeInTheDocument();
        expect(getByRole('table')).toBeInTheDocument();
        expect(getByText('Chrome')).toBeInTheDocument();
        expect(getByText('124+')).toBeInTheDocument();
    });

    it('shows the markdown toolbar by default', () => {
        const { getByRole } = render(<ExpandedMarkdownEditor {...baseProps} />);

        expect(getByRole('button', { name: 'Bold' })).toBeInTheDocument();
        expect(getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('hides the markdown toolbar when showToolbar is false', () => {
        const { queryByRole } = render(
            <ExpandedMarkdownEditor {...baseProps} showToolbar={false} />,
        );

        expect(queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    });
});
