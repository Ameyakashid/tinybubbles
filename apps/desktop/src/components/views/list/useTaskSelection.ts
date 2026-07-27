import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateRangeSelection, type RangeSelectionOptions } from '@mindwtr/core';

export function useTaskSelection(visibleIds: string[]) {
    const [selectionMode, setSelectionMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const anchorIdRef = useRef<string | null>(null);

    const selectedIdsArray = useMemo(() => Array.from(multiSelectedIds), [multiSelectedIds]);
    const selectedVisibleCount = useMemo(
        () => visibleIds.filter((id) => multiSelectedIds.has(id)).length,
        [multiSelectedIds, visibleIds],
    );
    const allVisibleTasksSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

    useEffect(() => {
        const visible = new Set(visibleIds);
        setMultiSelectedIds((previous) => {
            const next = new Set(Array.from(previous).filter((id) => visible.has(id)));
            return next.size === previous.size ? previous : next;
        });
        if (anchorIdRef.current && !visible.has(anchorIdRef.current)) {
            anchorIdRef.current = null;
        }
    }, [visibleIds]);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setMultiSelectedIds(new Set());
        anchorIdRef.current = null;
    }, []);

    const toggleSelectionMode = useCallback(() => {
        if (selectionMode) {
            exitSelectionMode();
            return;
        }
        setSelectionMode(true);
    }, [exitSelectionMode, selectionMode]);

    const toggleMultiSelect = useCallback((taskId: string, options: RangeSelectionOptions = {}) => {
        setSelectionMode(true);
        setMultiSelectedIds((previous) => {
            const result = updateRangeSelection({
                anchorId: anchorIdRef.current,
                range: options.range,
                selectedIds: previous,
                targetId: taskId,
                visibleIds,
            });
            anchorIdRef.current = result.anchorId;
            return result.selectedIds;
        });
    }, [visibleIds]);

    const selectAllVisibleTasks = useCallback(() => {
        setSelectionMode(true);
        anchorIdRef.current = visibleIds[0] ?? null;
        setMultiSelectedIds(new Set(visibleIds));
    }, [visibleIds]);

    const clearTaskSelection = useCallback(() => {
        anchorIdRef.current = null;
        setMultiSelectedIds(new Set());
    }, []);

    return {
        allVisibleTasksSelected,
        clearTaskSelection,
        exitSelectionMode,
        multiSelectedIds,
        selectedIdsArray,
        selectionMode,
        selectAllVisibleTasks,
        setSelectionMode,
        toggleMultiSelect,
        toggleSelectionMode,
    };
}
