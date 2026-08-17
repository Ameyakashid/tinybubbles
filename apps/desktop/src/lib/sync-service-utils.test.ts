import { afterEach, describe, expect, it, vi } from 'vitest';
import { yieldToRenderer } from './sync-service-utils';

describe('yieldToRenderer', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('settles when a hidden webview suppresses animation frames', async () => {
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

        let settled = false;
        const pending = yieldToRenderer().then(() => { settled = true; });
        await vi.advanceTimersByTimeAsync(49);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await pending;

        expect(settled).toBe(true);
    });

    it('settles on the animation frame when the renderer is active', async () => {
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback(0);
            return 1;
        });

        await expect(yieldToRenderer()).resolves.toBeUndefined();
    });
});
