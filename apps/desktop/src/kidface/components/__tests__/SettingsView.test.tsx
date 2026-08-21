import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useTaskStore, type AppTheme } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { SettingsView } from '../SettingsView';

const initialState = useTaskStore.getState();

const renderView = () => render(
    <LanguageProvider>
        <SettingsView />
    </LanguageProvider>,
);

describe('SettingsView', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState(initialState, true);
        });
    });

    it('renders the settings heading and sections', () => {
        renderView();

        expect(screen.getByRole('heading', { name: 'Your settings' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Look and feel' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    });

    it('marks the current theme as selected', () => {
        act(() => {
            useTaskStore.setState({ settings: { ...initialState.settings, theme: 'dark' as AppTheme } });
        });

        renderView();

        expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates the theme when a theme button is pressed', () => {
        const updateSettings = vi.fn().mockResolvedValue(undefined);
        useTaskStore.setState({ updateSettings });

        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Sepia' }));

        expect(updateSettings).toHaveBeenCalledWith({ theme: 'sepia' });
    });

    it('asks for confirmation before changing language', () => {
        const updateSettings = vi.fn().mockResolvedValue(undefined);
        useTaskStore.setState({ updateSettings });

        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Español' }));

        expect(screen.getByRole('dialog', { name: 'Switch language?' })).toBeInTheDocument();
        expect(screen.getByText('This will change the words in the app to Español.')).toBeInTheDocument();
        expect(updateSettings).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Switch to Español' }));

        expect(updateSettings).toHaveBeenCalledWith({ language: 'es' });
    });

    it('keeps the current language when confirmation is cancelled', () => {
        const updateSettings = vi.fn().mockResolvedValue(undefined);
        useTaskStore.setState({ updateSettings });

        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Español' }));
        fireEvent.click(screen.getByRole('button', { name: 'Keep English' }));

        expect(updateSettings).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'Switch language?' })).not.toBeInTheDocument();
    });

    it('shows the current language as selected', () => {
        renderView();

        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('offers every supported language', () => {
        renderView();

        expect(screen.getByRole('button', { name: 'Deutsch' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Français' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '日本語' })).toBeInTheDocument();
    });

    it('keeps theme buttons on the 88px floor', () => {
        renderView();

        const darkButton = screen.getByRole('button', { name: 'Dark' });
        expect(darkButton).toHaveClass('min-h-22');
    });
});
