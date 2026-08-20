import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '@/contexts/language-context';
import { AddView } from '../AddView';

const initialState = useTaskStore.getState();

const renderView = () => render(
    <LanguageProvider>
        <AddView />
    </LanguageProvider>,
);

describe('AddView', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState(initialState, true);
        });
    });

    it('renders the Add header and input', () => {
        renderView();

        expect(screen.getByText('Add something')).toBeInTheDocument();
        expect(screen.getByText('What do you need to do?')).toBeInTheDocument();
        expect(screen.getByLabelText('Add something to do')).toBeInTheDocument();
    });

    it('creates a next task when the form is submitted', async () => {
        const addTask = vi.spyOn(useTaskStore.getState(), 'addTask').mockResolvedValue({ success: true });
        renderView();

        const input = screen.getByLabelText('Add something to do');
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        await waitFor(() => {
            expect(addTask).toHaveBeenCalledWith('Feed the cat', { status: 'next' });
        });
    });

    it('clears the input after adding', async () => {
        vi.spyOn(useTaskStore.getState(), 'addTask').mockResolvedValue({ success: true });
        renderView();

        const input = screen.getByLabelText('Add something to do') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        await waitFor(() => {
            expect(input.value).toBe('');
        });
    });

    it('shows a celebratory confirmation after adding', async () => {
        vi.spyOn(useTaskStore.getState(), 'addTask').mockResolvedValue({ success: true });
        renderView();

        const input = screen.getByLabelText('Add something to do');
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        await waitFor(() => {
            expect(screen.getByText('Added! It is on your Today list.')).toBeInTheDocument();
        });
    });

    it('announces the celebratory confirmation to screen readers', async () => {
        vi.spyOn(useTaskStore.getState(), 'addTask').mockResolvedValue({ success: true });
        renderView();

        const input = screen.getByLabelText('Add something to do');
        fireEvent.change(input, { target: { value: 'Feed the cat' } });
        fireEvent.click(screen.getByLabelText('Add'));

        await waitFor(() => {
            expect(screen.getByText('Added! It is on your Today list.').parentElement).toHaveAttribute('aria-live', 'polite');
        });
    });
});
