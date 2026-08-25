import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BubbleCheckbox } from '../BubbleCheckbox';

const renderCheckbox = (props: Partial<Parameters<typeof BubbleCheckbox>[0]> = {}) =>
    render(
        <BubbleCheckbox
            checked={false}
            onChange={vi.fn()}
            label="Mark task as done"
            {...props}
        />,
    );

describe('BubbleCheckbox', () => {
    it('renders as an unchecked checkbox', () => {
        renderCheckbox();

        const checkbox = screen.getByRole('checkbox', { name: 'Mark task as done' });
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('renders as a checked checkbox', () => {
        renderCheckbox({ checked: true });

        const checkbox = screen.getByRole('checkbox', { name: 'Mark task as done' });
        expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('calls onChange when clicked', () => {
        const onChange = vi.fn();
        renderCheckbox({ onChange });

        fireEvent.click(screen.getByRole('checkbox'));

        expect(onChange).toHaveBeenCalled();
    });

    it('uses an 88px touch target', () => {
        renderCheckbox();

        expect(screen.getByRole('checkbox')).toHaveClass('size-[88px]');
    });

    it('shows the celebratory animation class when celebrating', () => {
        renderCheckbox({ celebrating: true });

        expect(screen.getByRole('checkbox')).toHaveClass('kidface-celebrate');
    });

    it('does not show the celebratory animation class by default', () => {
        renderCheckbox();

        expect(screen.getByRole('checkbox')).not.toHaveClass('kidface-celebrate');
    });

    it('shows a soft bubble hint when unchecked', () => {
        renderCheckbox();

        expect(screen.getByTestId('bubble-hint')).toBeInTheDocument();
    });

    it('hides the bubble hint when checked', () => {
        renderCheckbox({ checked: true });

        expect(screen.queryByTestId('bubble-hint')).not.toBeInTheDocument();
    });
});
