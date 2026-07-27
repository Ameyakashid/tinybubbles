import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@mindwtr/core';

import { useTaskEditState } from './use-task-edit-state';

const task: Task = {
    id: 'task-1',
    title: 'Original',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
};

describe('useTaskEditState', () => {
    it('can synchronize a persisted field without marking the draft dirty', () => {
        let state!: ReturnType<typeof useTaskEditState>;
        const resetCopilotStateRef = { current: vi.fn() };

        function Probe() {
            state = useTaskEditState({
                onClose: vi.fn(),
                onSave: vi.fn(),
                onSaveError: vi.fn(),
                resetCopilotStateRef,
                sections: [],
                task,
                tasks: [task],
                visible: true,
            });
            return null;
        }

        renderer.act(() => {
            renderer.create(React.createElement(Probe));
        });

        renderer.act(() => {
            state.setDraftField('title', 'Transcribed', false);
        });

        expect(state.taskEditDraft?.draft.title).toBe('Transcribed');
        expect(state.isDirtyRef.current).toBe(false);

        renderer.act(() => {
            state.setDraftField('title', 'Edited');
        });

        expect(state.isDirtyRef.current).toBe(true);
    });

    it('keeps the editor open until the draft write succeeds', async () => {
        let state!: ReturnType<typeof useTaskEditState>;
        const onClose = vi.fn();
        const onSaveError = vi.fn();
        const onSave = vi.fn()
            .mockResolvedValueOnce({ success: false, error: 'disk full' })
            .mockResolvedValueOnce({ success: true });
        const resetCopilotStateRef = { current: vi.fn() };

        function Probe() {
            state = useTaskEditState({
                onClose,
                onSave,
                onSaveError,
                resetCopilotStateRef,
                sections: [],
                task,
                tasks: [task],
                visible: true,
            });
            return null;
        }

        renderer.act(() => {
            renderer.create(React.createElement(Probe));
        });
        renderer.act(() => {
            state.titleDraftRef.current = 'Edited';
            state.setTitleDraft('Edited');
            state.setDraftField('title', 'Edited');
        });

        await renderer.act(async () => {
            expect(await state.draftLifecycle.save()).toBe(false);
        });
        expect(onSave).toHaveBeenLastCalledWith('task-1', { title: 'Edited' });
        expect(onSaveError).toHaveBeenCalledWith('disk full');
        expect(onClose).not.toHaveBeenCalled();

        await renderer.act(async () => {
            expect(await state.draftLifecycle.save()).toBe(true);
        });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
