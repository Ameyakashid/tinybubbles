import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/language-context';
import { KidLayout } from '../KidLayout';

function renderLayout(props: { lastSyncError?: string | null; onRequestSync?: () => void }) {
    return render(
        <LanguageProvider>
            <KidLayout
                lastSyncError={props.lastSyncError ?? null}
                onRequestSync={props.onRequestSync ?? vi.fn()}
            >
                <div data-testid="kid-content">Today</div>
            </KidLayout>
        </LanguageProvider>,
    );
}

describe('KidLayout', () => {
    it('renders children without a banner when there is no sync error', () => {
        renderLayout({ lastSyncError: null });

        expect(screen.getByTestId('kid-content')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Offline/ })).not.toBeInTheDocument();
    });

    it('shows the offline banner when the runtime reports a sync failure', () => {
        renderLayout({ lastSyncError: 'offline' });

        const banner = screen.getByRole('button', { name: /Offline — your changes are saved/ });
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveTextContent('Try syncing');
    });

    it('requests a sync and enters a busy state when the banner is pressed', () => {
        const onRequestSync = vi.fn();
        renderLayout({ lastSyncError: 'offline', onRequestSync });

        fireEvent.click(screen.getByRole('button', { name: /Offline — your changes are saved/ }));

        expect(onRequestSync).toHaveBeenCalled();
        const busyBanner = screen.getByRole('button', { name: 'Trying to sync…' });
        expect(busyBanner).toBeDisabled();
        expect(busyBanner).toHaveAttribute('aria-busy', 'true');
    });

    it('shows a synced flash when the error clears after a retry, then dismisses', async () => {
        const onRequestSync = vi.fn();
        const { rerender } = renderLayout({ lastSyncError: 'offline', onRequestSync });

        fireEvent.click(screen.getByRole('button', { name: /Offline — your changes are saved/ }));
        expect(screen.getByRole('button', { name: 'Trying to sync…' })).toBeInTheDocument();

        rerender(
            <LanguageProvider>
                <KidLayout lastSyncError={null} onRequestSync={onRequestSync}>
                    <div data-testid="kid-content">Today</div>
                </KidLayout>
            </LanguageProvider>,
        );

        expect(screen.getByRole('button', { name: 'Synced!' })).toBeInTheDocument();

        await waitFor(
            () => {
                expect(screen.queryByRole('button')).not.toBeInTheDocument();
            },
            { timeout: 2000 },
        );
    });

    it('returns to normal error copy when a retry fails again', () => {
        const onRequestSync = vi.fn();
        const { rerender } = renderLayout({ lastSyncError: 'offline', onRequestSync });

        fireEvent.click(screen.getByRole('button', { name: /Offline — your changes are saved/ }));
        expect(screen.getByRole('button', { name: 'Trying to sync…' })).toBeDisabled();

        rerender(
            <LanguageProvider>
                <KidLayout lastSyncError={null} onRequestSync={onRequestSync}>
                    <div data-testid="kid-content">Today</div>
                </KidLayout>
            </LanguageProvider>,
        );

        rerender(
            <LanguageProvider>
                <KidLayout lastSyncError="offline" onRequestSync={onRequestSync}>
                    <div data-testid="kid-content">Today</div>
                </KidLayout>
            </LanguageProvider>,
        );

        const banner = screen.getByRole('button', { name: /Offline — your changes are saved/ });
        expect(banner).toBeEnabled();
        expect(banner).toHaveAttribute('aria-busy', 'false');
    });

    it('keeps the offline banner on the 88px floor', () => {
        renderLayout({ lastSyncError: 'offline' });

        const banner = screen.getByRole('button', { name: /Offline — your changes are saved/ });
        expect(banner).toHaveClass('min-h-22');
    });
});
