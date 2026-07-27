import renderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

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
});
