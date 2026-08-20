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

    it('updates the language when a language button is pressed', () => {
        const updateSettings = vi.fn().mockResolvedValue(undefined);
        useTaskStore.setState({ updateSettings });

        renderView();

        fireEvent.click(screen.getByRole('button', { name: 'Español' }));

        expect(updateSettings).toHaveBeenCalledWith({ language: 'es' });
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
});
