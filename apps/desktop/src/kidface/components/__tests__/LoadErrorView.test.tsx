import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/language-context';
import { LoadErrorView } from '../LoadErrorView';

const renderView = (props: { onRetry?: () => void } = {}) =>
    render(
        <LanguageProvider>
            <LoadErrorView onRetry={props.onRetry ?? vi.fn()} />
        </LanguageProvider>,
    );

describe('LoadErrorView', () => {
    it('announces itself as an alert and shows comforting copy', () => {
        renderView();

        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
        expect(alert).toHaveTextContent('Could not load your morning');
        expect(alert).toHaveTextContent('Something went wrong while waking up');
    });

    it('does not expose raw diagnostics to the child', () => {
        renderView();

        expect(screen.queryByText('disk unreadable')).not.toBeInTheDocument();
        expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });

    it('calls onRetry when the try-again button is pressed', () => {
        const onRetry = vi.fn();
        renderView({ onRetry });

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(onRetry).toHaveBeenCalled();
    });

    it('shows a busy state while retrying and returns to the action afterwards', async () => {
        const onRetry = vi.fn();
        renderView({ onRetry });

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        const busyButton = screen.getByRole('button', { name: 'Waking up…' });
        expect(busyButton).toBeDisabled();
        expect(busyButton).toHaveAttribute('aria-busy', 'true');

        await waitFor(
            () => {
                const retryButton = screen.getByRole('button', { name: 'Try again' });
                expect(retryButton).toBeEnabled();
                expect(retryButton).toHaveAttribute('aria-busy', 'false');
            },
            { timeout: 1500 },
        );
    });

    it('does not allow a second retry while one is already in progress', () => {
        const onRetry = vi.fn();
        renderView({ onRetry });

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        fireEvent.click(screen.getByRole('button', { name: 'Waking up…' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
