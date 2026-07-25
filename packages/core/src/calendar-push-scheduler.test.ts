import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCalendarPushScheduler } from './calendar-push-scheduler';

const flushPromises = () => vi.advanceTimersByTimeAsync(0);

describe('createCalendarPushScheduler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('coalesces rapid changes into one debounced partial run', async () => {
        const runPartial = vi.fn(async () => undefined);
        const scheduler = createCalendarPushScheduler({
            debounceMs: 2500,
            runFull: async () => undefined,
            runPartial,
        });

        scheduler.scheduleDebounced(['a', 'b']);
        vi.advanceTimersByTime(2000);
        scheduler.scheduleDebounced(['b', 'c']);
        expect(runPartial).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        expect(runPartial).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(runPartial).toHaveBeenCalledTimes(1);
        expect(runPartial.mock.calls[0]?.[0]).toEqual(['a', 'b', 'c']);
    });

    it('starts a fresh batch after the debounce fires', async () => {
        const runPartial = vi.fn(async () => undefined);
        const scheduler = createCalendarPushScheduler({ debounceMs: 10, runFull: async () => undefined, runPartial });

        scheduler.scheduleDebounced(['a']);
        await vi.runAllTimersAsync();
        scheduler.scheduleDebounced(['b']);
        await vi.runAllTimersAsync();

        expect(runPartial.mock.calls.map((call) => call[0])).toEqual([['a'], ['b']]);
    });

    it('drops the pending batch when cancelled', async () => {
        const runPartial = vi.fn(async () => undefined);
        const scheduler = createCalendarPushScheduler({ debounceMs: 10, runFull: async () => undefined, runPartial });

        scheduler.scheduleDebounced(['a']);
        scheduler.cancelPending();
        await vi.runAllTimersAsync();

        expect(runPartial).not.toHaveBeenCalled();

        scheduler.scheduleDebounced(['b']);
        await vi.runAllTimersAsync();
        expect(runPartial.mock.calls.map((call) => call[0])).toEqual([['b']]);
    });

    it('serializes a full sync against a debounced partial sync', async () => {
        const order: string[] = [];
        let releaseFull: (() => void) | null = null;
        const scheduler = createCalendarPushScheduler({
            debounceMs: 10,
            runFull: async () => {
                order.push('full:start');
                await new Promise<void>((resolve) => {
                    releaseFull = resolve;
                });
                order.push('full:end');
            },
            runPartial: async () => {
                order.push('partial');
            },
        });

        void scheduler.runFull();
        await flushPromises();
        scheduler.scheduleDebounced(['a']);
        await vi.advanceTimersByTimeAsync(10);

        expect(order).toEqual(['full:start']);

        releaseFull?.();
        await flushPromises();

        expect(order).toEqual(['full:start', 'full:end', 'partial']);
    });

    it('keeps running queued work after a failed run', async () => {
        const runPartial = vi.fn(async () => undefined);
        const scheduler = createCalendarPushScheduler({
            debounceMs: 10,
            runFull: async () => {
                throw new Error('calendar unavailable');
            },
            runPartial,
        });

        await expect(scheduler.runFull()).rejects.toThrow('calendar unavailable');
        scheduler.scheduleDebounced(['a']);
        await vi.runAllTimersAsync();

        expect(runPartial).toHaveBeenCalledTimes(1);
    });
});
