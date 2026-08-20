import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/language-context';
import { useKidFaceRuntime } from './runtime';
import { KidFaceApp } from './KidFaceApp';

vi.mock('./runtime', () => ({
    useKidFaceRuntime: vi.fn(),
}));

const mockedUseKidFaceRuntime = vi.mocked(useKidFaceRuntime);

const renderApp = () => render(
    <LanguageProvider>
        <KidFaceApp />
    </LanguageProvider>,
);

describe('KidFaceApp', () => {
    beforeEach(() => {
        mockedUseKidFaceRuntime.mockReset();
    });

    it('shows a loading spinner while the runtime hydrates', () => {
        mockedUseKidFaceRuntime.mockReturnValue({
            hydrated: false,
            loadError: null,
            lastSyncError: null,
            requestSync: vi.fn(),
        });

        renderApp();

        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('renders a calm error screen when stored data fails to load', () => {
        mockedUseKidFaceRuntime.mockReturnValue({
            hydrated: true,
            loadError: 'disk unreadable',
            lastSyncError: null,
            requestSync: vi.fn(),
        });

        renderApp();

        expect(screen.getByText('Could not load your morning')).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong while waking up/)).toBeInTheDocument();
        expect(screen.queryByText('Nothing left to do')).not.toBeInTheDocument();
    });

    it('calls requestSync when the load-error retry button is pressed', () => {
        const requestSync = vi.fn();
        mockedUseKidFaceRuntime.mockReturnValue({
            hydrated: true,
            loadError: 'disk unreadable',
            lastSyncError: null,
            requestSync,
        });

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(requestSync).toHaveBeenCalled();
    });

    it('moves focus to the main content when the room changes', () => {
        mockedUseKidFaceRuntime.mockReturnValue({
            hydrated: true,
            loadError: null,
            lastSyncError: null,
            requestSync: vi.fn(),
        });

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(screen.getByRole('main', { name: 'Add' })).toHaveFocus();
    });

    it('shows a sync-error banner when the runtime reports a sync failure', () => {
        const requestSync = vi.fn();
        mockedUseKidFaceRuntime.mockReturnValue({
            hydrated: true,
            loadError: null,
            lastSyncError: 'offline',
            requestSync,
        });

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: /Offline — your changes are saved/ }));

        expect(requestSync).toHaveBeenCalled();
    });
});
