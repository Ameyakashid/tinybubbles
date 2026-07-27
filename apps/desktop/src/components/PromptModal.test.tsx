import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PromptModal } from './PromptModal';

vi.mock('../contexts/language-context', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

const baseProps = {
    isOpen: true,
    title: 'Add link',
    confirmLabel: 'Save',
    cancelLabel: 'Cancel',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

describe('PromptModal browse', () => {
    it('fills the input from onBrowse and confirms with the picked value', async () => {
        const onConfirm = vi.fn();
        const onBrowse = vi.fn(async () => 'C:\\docs\\report.pdf');
        render(
            <PromptModal
                {...baseProps}
                onConfirm={onConfirm}
                browseLabel="Link to file…"
                onBrowse={onBrowse}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Link to file…' }));
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toHaveValue('C:\\docs\\report.pdf');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith('C:\\docs\\report.pdf');
    });

    it('prevents the input blur on footer button mousedown so the first click is not swallowed', () => {
        render(
            <PromptModal
                {...baseProps}
                defaultValue="https://example.com"
                browseLabel="Link to file…"
                onBrowse={vi.fn(async () => null)}
            />
        );

        // fireEvent returns false when preventDefault was called; without it the
        // blur reveals the validation line mid-click and shifts the buttons away
        // from the pointer, eating the first click.
        expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Link to file…' }))).toBe(false);
        expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Cancel' }))).toBe(false);
        expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Save' }))).toBe(false);
        expect(screen.queryByText('common.validationRequired')).toBeNull();
    });
});

describe('PromptModal numericField', () => {
    it('does not render a numeric field or widen onConfirm when the prop is absent', () => {
        const onConfirm = vi.fn();
        render(<PromptModal {...baseProps} defaultValue="Task title" onConfirm={onConfirm} />);

        expect(screen.queryByLabelText('Time Spent')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith('Task title');
        expect(onConfirm.mock.calls[0]).toHaveLength(1);
    });

    it('renders the numeric field, seeds it from defaultValue, and normalizes on confirm', () => {
        const onConfirm = vi.fn();
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                onConfirm={onConfirm}
                numericField={{ label: 'Time Spent', placeholder: 'minutes', defaultValue: '30' }}
            />
        );

        const numericInput = screen.getByLabelText('Time Spent') as HTMLInputElement;
        expect(numericInput.value).toBe('30');

        fireEvent.change(numericInput, { target: { value: '45' } });
        expect(numericInput.value).toBe('45');

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith('Task title', 45);
    });

    // The number input refuses letters itself, so the draft is left alone and
    // confirm does the coercion — a digit-strip here would read "2.5" as 25.
    it('rounds a fractional entry on confirm instead of concatenating its digits', () => {
        const onConfirm = vi.fn();
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                onConfirm={onConfirm}
                numericField={{ label: 'Time Spent', defaultValue: '30' }}
            />
        );

        fireEvent.change(screen.getByLabelText('Time Spent'), { target: { value: '2.5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onConfirm).toHaveBeenCalledWith('Task title', 3);
    });

    // Enter used to be wired to the first input only, so confirming from the
    // Time Spent field did nothing and the dialog just sat there (#896).
    it('confirms on Enter from the numeric field, not just the main input', () => {
        const onConfirm = vi.fn();
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                onConfirm={onConfirm}
                numericField={{ label: 'Time Spent', defaultValue: '30' }}
            />
        );

        fireEvent.keyDown(screen.getByLabelText('Time Spent'), { key: 'Enter' });

        expect(onConfirm).toHaveBeenCalledWith('Task title', 30);
    });

    it('cancels on Escape from the numeric field', () => {
        const onCancel = vi.fn();
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                onCancel={onCancel}
                numericField={{ label: 'Time Spent', defaultValue: '30' }}
            />
        );

        fireEvent.keyDown(screen.getByLabelText('Time Spent'), { key: 'Escape' });

        expect(onCancel).toHaveBeenCalled();
    });

    // Matches the task editor's Time Spent control so arrow keys step it there too.
    it('renders the numeric field as a stepping number input', () => {
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                numericField={{ label: 'Time Spent', defaultValue: '30' }}
            />
        );

        const numericInput = screen.getByLabelText('Time Spent') as HTMLInputElement;
        expect(numericInput).toHaveAttribute('type', 'number');
        expect(numericInput).toHaveAttribute('step', '5');
        expect(numericInput).toHaveAttribute('min', '0');
    });

    it('normalizes a blank numeric field to undefined instead of 0', () => {
        const onConfirm = vi.fn();
        render(
            <PromptModal
                {...baseProps}
                defaultValue="Task title"
                onConfirm={onConfirm}
                numericField={{ label: 'Time Spent', defaultValue: '30' }}
            />
        );

        fireEvent.change(screen.getByLabelText('Time Spent'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onConfirm).toHaveBeenCalledWith('Task title', undefined);
    });
});
