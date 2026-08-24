import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageProvider } from '@/contexts/language-context';
import { CalmCornerView } from '../CalmCornerView';

function renderView(props: { onClose?: () => void } = {}) {
    return render(
        <LanguageProvider>
            <CalmCornerView onClose={props.onClose ?? vi.fn()} />
        </LanguageProvider>,
    );
}

describe('CalmCornerView', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('renders the title and feeling hint', () => {
        renderView();

        expect(screen.getByRole('heading', { name: 'Calm Corner' })).toBeInTheDocument();
        expect(screen.getByText('Pick the one that feels closest.')).toBeInTheDocument();
    });

    it('shows five large picture-first feeling chips', () => {
        renderView();

        expect(screen.getByRole('radio', { name: 'Overwhelmed' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Frustrated' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Worried' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Tired' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: "I don't know" })).toBeInTheDocument();
    });

    it('shows the breathing buddy after a feeling is selected', () => {
        renderView();

        fireEvent.click(screen.getByRole('radio', { name: 'Worried' }));

        expect(screen.getByRole('img', { name: 'Breathing buddy — calm bubble' })).toBeInTheDocument();
    });

    it('calls onClose when the ready button is pressed', () => {
        const onClose = vi.fn();
        renderView({ onClose });

        fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));

        expect(onClose).toHaveBeenCalled();
    });

    it('has no help button in slice 1', () => {
        renderView();

        expect(screen.queryByRole('button', { name: /help/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/help/i)).not.toBeInTheDocument();
    });

    it('respects reduced motion with tap-to-advance breathing cues', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query === '(prefers-reduced-motion: reduce)',
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        renderView();

        fireEvent.click(screen.getByRole('radio', { name: 'Overwhelmed' }));

        const buddy = screen.getByRole('img', { name: 'Breathing buddy — calm bubble' });
        expect(buddy).toBeInTheDocument();

        expect(screen.getByText('Breathe in')).toBeInTheDocument();

        fireEvent.click(buddy.closest('button')!);

        expect(screen.getByText('Breathe out')).toBeInTheDocument();
    });

    it('keeps feeling chip touch targets above the 88px floor', () => {
        renderView();

        const chip = screen.getByRole('radio', { name: 'Tired' });
        expect(chip).toHaveClass('min-h-[140px]');
    });
});
