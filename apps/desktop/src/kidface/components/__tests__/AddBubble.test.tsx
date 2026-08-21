import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AddBubble } from '../AddBubble';

const renderBubble = (props: Partial<Parameters<typeof AddBubble>[0]> = {}) =>
    render(<AddBubble onAdd={vi.fn()} {...props} />);

describe('AddBubble', () => {
    it('renders the input and add button', () => {
        renderBubble();

        expect(screen.getByLabelText('Add something to do')).toBeInTheDocument();
        expect(screen.getByLabelText('Add')).toBeInTheDocument();
    });

    it('calls onAdd with the trimmed title when submitted', () => {
        const onAdd = vi.fn();
        renderBubble({ onAdd });

        const input = screen.getByLabelText('Add something to do');
        fireEvent.change(input, { target: { value: '  Feed the cat  ' } });
        fireEvent.click(screen.getByLabelText('Add'));

        expect(onAdd).toHaveBeenCalledWith('Feed the cat');
    });

    it('clears the input after adding', () => {
        renderBubble();

        const input = screen.getByLabelText('Add something to do') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        expect(input.value).toBe('');
    });

    it('applies the pop animation to the add button on submit', () => {
        renderBubble();

        const input = screen.getByLabelText('Add something to do');
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        expect(screen.getByLabelText('Add')).toHaveClass('kidface-pop');
    });

    it('does not call onAdd and shakes the input when the form is submitted empty', () => {
        const onAdd = vi.fn();
        const { container } = renderBubble({ onAdd });

        const input = screen.getByLabelText('Add something to do');
        fireEvent.submit(container.querySelector('form')!);

        expect(onAdd).not.toHaveBeenCalled();
        expect(input).toHaveClass('kidface-shake');
    });

    it('removes the shake animation after it finishes', () => {
        const { container } = renderBubble();

        const input = screen.getByLabelText('Add something to do');
        fireEvent.submit(container.querySelector('form')!);
        expect(input).toHaveClass('kidface-shake');

        fireEvent.animationEnd(input);

        expect(input).not.toHaveClass('kidface-shake');
    });

    it('keeps the input and add button on the 88px floor', () => {
        renderBubble();

        expect(screen.getByLabelText('Add something to do')).toHaveClass('min-h-22');
        expect(screen.getByLabelText('Add')).toHaveClass('size-[88px]');
    });
});
