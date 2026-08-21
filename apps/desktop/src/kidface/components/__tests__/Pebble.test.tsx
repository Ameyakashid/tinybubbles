import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Pebble } from '../Pebble';

describe('Pebble', () => {
    it('renders with an accessible label', () => {
        render(<Pebble state="idle" />);

        expect(screen.getByRole('img', { name: 'Pebble the bubble buddy, idle' })).toBeInTheDocument();
    });

    it.each([
        ['idle', 'Pebble the bubble buddy, idle'],
        ['happy', 'Pebble the bubble buddy, happy'],
        ['celebrate', 'Pebble the bubble buddy, celebrate'],
        ['wave', 'Pebble the bubble buddy, wave'],
        ['sleep', 'Pebble the bubble buddy, sleep'],
        ['think', 'Pebble the bubble buddy, think'],
    ] as const)('announces the %s state', (state, expectedLabel) => {
        render(<Pebble state={state} />);

        expect(screen.getByRole('img', { name: expectedLabel })).toBeInTheDocument();
    });

    it('applies the requested size as a CSS custom property', () => {
        const { container } = render(<Pebble state="idle" size={120} />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.getPropertyValue('--pebble-size')).toBe('120px');
    });

    it('defaults to 200px when no size is provided', () => {
        const { container } = render(<Pebble state="idle" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.getPropertyValue('--pebble-size')).toBe('200px');
    });
});
