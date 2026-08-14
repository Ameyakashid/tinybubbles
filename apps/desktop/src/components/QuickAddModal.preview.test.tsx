import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTaskStore } from '@tinybubbles/core';

import { LanguageProvider } from '../contexts/language-context';
import { QuickAddModal } from './QuickAddModal';

const coreSpies = vi.hoisted(() => ({
    parseQuickAdd: vi.fn(),
}));

// The preview and the submit path have to run ONE parse configuration. Spying
// on the shared entry point is the only way to prove they do: a preview built
// from a second, hand-rolled options bag would still render plausible chips.
vi.mock('@tinybubbles/core', async () => {
    const actual = await vi.importActual<typeof import('@tinybubbles/core')>('@tinybubbles/core');
    coreSpies.parseQuickAdd.mockImplementation(actual.parseQuickAdd);
    return { ...actual, parseQuickAdd: coreSpies.parseQuickAdd };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => false) }));
vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn(async () => undefined), listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ hide: vi.fn(async () => undefined) }) }));
vi.mock('@tauri-apps/plugin-fs', () => ({
    BaseDirectory: { Data: 'Data' },
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async () => new Uint8Array()),
    remove: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/api/path', () => ({
    dataDir: vi.fn(async () => '/data'),
    join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

const DRAFT = 'call mom @errands #family /due:tomorrow';

const initialTaskState = useTaskStore.getState();
const addTask = vi.fn(async () => ({ success: true, id: 'task-id' }));

const openModalWithDraft = async () => {
    render(
        <LanguageProvider>
            <QuickAddModal />
        </LanguageProvider>
    );
    await act(async () => {
        window.dispatchEvent(new CustomEvent('tinybubbles:quick-add', { detail: {} }));
        await Promise.resolve();
    });
    const input = screen.getByPlaceholderText('Add Task');
    await act(async () => {
        fireEvent.change(input, { target: { value: DRAFT } });
        await Promise.resolve();
    });
};

beforeEach(() => {
    coreSpies.parseQuickAdd.mockClear();
    addTask.mockClear();
    act(() => {
        useTaskStore.setState(initialTaskState, true);
        useTaskStore.setState((state) => ({
            ...state,
            _allProjects: [],
            _allAreas: [],
            addTask,
            tasks: [
                { id: 'seed', title: 'seed', status: 'inbox', contexts: ['@errands'], tags: ['#family'] },
            ] as never,
        }));
    });
});

describe('QuickAddModal live preview', () => {
    // The live preview strip is hidden in the simplified shell (see DESIGN.md
    // — "the live parse preview... hidden"). Parsing itself is not touched:
    // the same parseQuickAdd call that used to feed the strip still runs and
    // still drives what gets saved, so these tests now prove the capability
    // through the one path left to observe it — the saved task — instead of
    // through a preview node that no longer renders.
    it('renders no live preview strip, but still resolves tokens into the saved task', async () => {
        await openModalWithDraft();

        expect(screen.queryByTestId('quick-add-preview')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(addTask).toHaveBeenCalled());
        // The resolved due date, not the phrase that produced it.
        expect(addTask).toHaveBeenCalledWith('call mom', expect.objectContaining({
            contexts: ['@errands'],
            tags: ['#family'],
            dueDate: expect.any(String),
        }));
        const [, props] = addTask.mock.calls[0] as unknown as [string, Record<string, unknown>];
        expect(props.dueDate).not.toContain('/due:tomorrow');
    });

    it('parses the (unrendered) preview with the same input and options the save uses', async () => {
        await openModalWithDraft();

        const previewCalls = coreSpies.parseQuickAdd.mock.calls.length;
        expect(previewCalls).toBeGreaterThan(0);
        const previewCall = coreSpies.parseQuickAdd.mock.calls[previewCalls - 1];

        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(addTask).toHaveBeenCalled());

        const submitCall = coreSpies.parseQuickAdd.mock.calls[previewCalls];
        expect(submitCall).toBeDefined();
        // input, projects, areas and the options bag: same values, and the bag
        // is literally the same object the preview memo read. The memo still
        // runs even though nothing renders it — it also drives whether the
        // area selector shows (hasProjectOverride) — so this identity still
        // guards a real invariant, not a cosmetic one.
        expect(submitCall[0]).toBe(previewCall[0]);
        expect(submitCall[1]).toBe(previewCall[1]);
        expect(submitCall[3]).toBe(previewCall[3]);
        expect(submitCall[4]).toBe(previewCall[4]);
    });

    it('shows a clear warning when an invalid date command blocks the save', async () => {
        render(
            <LanguageProvider>
                <QuickAddModal />
            </LanguageProvider>
        );
        await act(async () => {
            window.dispatchEvent(new CustomEvent('tinybubbles:quick-add', { detail: {} }));
            await Promise.resolve();
        });
        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText('Add Task'), { target: { value: 'call mom /due:notaday' } });
            await Promise.resolve();
        });

        expect(screen.queryByTestId('quick-add-preview')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await act(async () => {
            await Promise.resolve();
        });

        expect(addTask).not.toHaveBeenCalled();
        expect(screen.getByText("I couldn't understand this date: /due:notaday")).toBeInTheDocument();
    });
});
