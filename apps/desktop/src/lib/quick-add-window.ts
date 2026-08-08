import { invokeNative } from './tauri-invoke';

export const QUICK_ADD_WINDOW_PARAM = 'quickAddWindow';

export function isQuickAddWindowLocation(location: Pick<Location, 'search'> = window.location): boolean {
    const params = new URLSearchParams(location.search);
    const value = params.get(QUICK_ADD_WINDOW_PARAM);
    return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * Claims a pending native quick-add request for `target`, if there is one.
 * Consuming is one-shot: the shell drops the request once it is read.
 */
export const consumeQuickAddPending = (target: string): Promise<boolean> => (
    invokeNative<boolean>('consume_quick_add_pending', { target })
);

/** Hides the standalone quick-add window without closing it. */
export const hideQuickAddWindow = (): Promise<void> => invokeNative<void>('hide_quick_add_window');
