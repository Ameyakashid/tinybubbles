import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { useTaskSelection } from './useTaskSelection';

describe('useTaskSelection', () => {
    it('owns range selection, visibility pruning, and mode reset', () => {
        let selection!: ReturnType<typeof useTaskSelection>;

        function Probe({ visibleIds }: { visibleIds: string[] }) {
            selection = useTaskSelection(visibleIds);
            return null;
        }

        let root!: renderer.ReactTestRenderer;
        act(() => {
            root = renderer.create(<Probe visibleIds={['a', 'b', 'c', 'd']} />);
        });
        act(() => {
            selection.toggleMultiSelect('b');
            selection.toggleMultiSelect('d', { range: true });
        });

        expect(selection.selectionMode).toBe(true);
        expect(selection.selectedIdsArray).toEqual(['b', 'c', 'd']);

        act(() => {
            root.update(<Probe visibleIds={['b', 'd']} />);
        });
        expect(selection.selectedIdsArray).toEqual(['b', 'd']);

        act(() => {
            selection.exitSelectionMode();
        });
        expect(selection.selectionMode).toBe(false);
        expect(selection.selectedIdsArray).toEqual([]);
    });

    it('exits selection mode when the last selected task is toggled off', () => {
        let selection!: ReturnType<typeof useTaskSelection>;

        function Probe() {
            selection = useTaskSelection(['a']);
            return null;
        }

        act(() => {
            renderer.create(<Probe />);
        });
        act(() => {
            selection.toggleMultiSelect('a');
            selection.toggleMultiSelect('a');
        });

        expect(selection.selectionMode).toBe(false);
        expect(selection.selectedIdsArray).toEqual([]);
    });

    it('owns write outcomes and only clears selection after success', async () => {
        let selection!: ReturnType<typeof useTaskSelection>;
        const onActionError = vi.fn();
        const showToast = vi.fn();
        const batchMoveTasks = vi
            .fn()
            .mockResolvedValueOnce({ success: false, error: 'nope' })
            .mockResolvedValueOnce({ success: true });

        function Probe() {
            selection = useTaskSelection(['a'], {
                batchMoveTasks,
                onActionError,
                showToast,
            });
            return null;
        }

        act(() => {
            renderer.create(<Probe />);
        });
        act(() => {
            selection.toggleMultiSelect('a');
        });
        await act(async () => {
            await selection.moveSelectedTasks('next');
        });
        expect(selection.selectedIdsArray).toEqual(['a']);
        expect(onActionError).toHaveBeenCalledWith('move', expect.any(Error));
        expect(showToast).toHaveBeenCalledWith('Failed to move selected tasks', 'error');

        await act(async () => {
            await selection.moveSelectedTasks('done');
        });
        expect(batchMoveTasks).toHaveBeenLastCalledWith(['a'], 'done');
        expect(selection.selectionMode).toBe(false);
        expect(selection.selectedIdsArray).toEqual([]);
    });

    it('owns delete undo registration and feedback', async () => {
        let selection!: ReturnType<typeof useTaskSelection>;
        const restoreTask = vi.fn().mockResolvedValue({ success: true });
        const showToast = vi.fn();

        function Probe() {
            selection = useTaskSelection(['a'], {
                batchDeleteTasks: vi.fn().mockResolvedValue({ success: true }),
                restoreTask,
                showToast,
            });
            return null;
        }

        act(() => {
            renderer.create(<Probe />);
        });
        act(() => {
            selection.toggleMultiSelect('a');
        });
        await act(async () => {
            await selection.deleteSelectedTasks();
        });

        const undoAction = showToast.mock.calls[showToast.mock.calls.length - 1]?.[3];
        expect(showToast).toHaveBeenCalledWith(
            'Task deleted',
            'info',
            5000,
            expect.objectContaining({ label: 'Undo' }),
        );
        await act(async () => {
            undoAction?.onClick();
            await Promise.resolve();
        });
        expect(restoreTask).toHaveBeenCalledWith('a');
    });
});
