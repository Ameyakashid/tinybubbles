import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTaskStore } from '@tinybubbles/core';
import { LanguageProvider } from '@/contexts/language-context';
import { useKidFaceRuntime, type KidFaceRuntimeStatus } from './runtime';
import { KidFaceApp } from './KidFaceApp';

vi.mock('./runtime', () => ({
    useKidFaceRuntime: vi.fn(),
}));

const mockedUseKidFaceRuntime = vi.mocked(useKidFaceRuntime);

const runtimeStatus = (
    overrides: Partial<KidFaceRuntimeStatus> = {},
): KidFaceRuntimeStatus => ({
    hydrated: true,
    loadError: null,
    lastSyncError: null,
    syncPending: false,
    persistError: null,
    persistRetrying: false,
    requestSync: vi.fn(async () => undefined),
    retryPersistence: vi.fn(async () => undefined),
    retryLoad: vi.fn(),
    ...overrides,
});

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
        mockedUseKidFaceRuntime.mockReturnValue(runtimeStatus({
            hydrated: false,
        }));

        renderApp();

        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('renders a calm error screen when stored data fails to load', () => {
        mockedUseKidFaceRuntime.mockReturnValue(runtimeStatus({
            loadError: 'disk unreadable',
        }));

        renderApp();

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Could not load your morning')).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong while waking up/)).toBeInTheDocument();
        expect(screen.queryByText('Nothing left to do')).not.toBeInTheDocument();
    });

    it('recovers when loading stored data succeeds on retry', async () => {
        const actualRuntime = await vi.importActual<typeof import('./runtime')>('./runtime');
        const originalFetchData = useTaskStore.getState().fetchData;
        const fetchData = vi.fn()
            .mockRejectedValueOnce(new Error('disk unreadable'))
            .mockResolvedValueOnce(undefined);
        useTaskStore.setState({ fetchData });
        mockedUseKidFaceRuntime.mockImplementation(actualRuntime.useKidFaceRuntime);

        const view = renderApp();

        expect(await screen.findByText('Could not load your morning')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() => {
            expect(screen.queryByText('Could not load your morning')).not.toBeInTheDocument();
            expect(screen.getByRole('main', { name: 'Today' })).toBeInTheDocument();
        });
        expect(fetchData).toHaveBeenCalledTimes(2);

        view.unmount();
        useTaskStore.setState({ fetchData: originalFetchData });
    });

    it('moves focus to the main content when the room changes', () => {
        mockedUseKidFaceRuntime.mockReturnValue(runtimeStatus());

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(screen.getByRole('main', { name: 'Add' })).toHaveFocus();
    });

    it('shows a sync-error banner when the runtime reports a sync failure', () => {
        const requestSync = vi.fn(async () => undefined);
        mockedUseKidFaceRuntime.mockReturnValue(runtimeStatus({
            lastSyncError: 'offline',
            requestSync,
        }));

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: /Offline — your changes are saved/ }));

        expect(requestSync).toHaveBeenCalled();
        const busyBanner = screen.getByRole('button', { name: 'Trying to sync…' });
        expect(busyBanner).toBeDisabled();
        expect(busyBanner).toHaveAttribute('aria-busy', 'true');
    });

    it('navigates to the settings room and moves focus to it', () => {
        mockedUseKidFaceRuntime.mockReturnValue(runtimeStatus());

        renderApp();

        fireEvent.click(screen.getByRole('button', { name: 'Me' }));

        expect(screen.getByRole('main', { name: 'Me' })).toBeInTheDocument();
        expect(screen.getByRole('main', { name: 'Me' })).toHaveFocus();
        expect(screen.getByRole('heading', { name: 'Your settings' })).toBeInTheDocument();
    });
});
