import { useEffect, useState } from 'react';
import { getNextFutureStartRevealAt } from '@mindwtr/core';

export function getLocalDayKey(now: Date = new Date()): string {
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

export function useLocalDayKey(enabled = true): string {
    const [dayKey, setDayKey] = useState(getLocalDayKey);

    useEffect(() => {
        if (!enabled) return;
        let timer: number | undefined;
        const scheduleNextDay = () => {
            if (timer) window.clearTimeout(timer);
            const now = new Date();
            const nextDay = new Date(now);
            nextDay.setHours(24, 0, 0, 0);
            timer = window.setTimeout(refresh, Math.max(1, nextDay.getTime() - now.getTime() + 50));
        };
        const refresh = () => {
            setDayKey(getLocalDayKey());
            scheduleNextDay();
        };

        scheduleNextDay();
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            if (timer) window.clearTimeout(timer);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [enabled]);

    return dayKey;
}

/**
 * Re-renders the consumer when the earliest upcoming timed start among the
 * given tasks arrives, so a task hidden until its start time (#995) appears
 * without waiting for an unrelated store change.
 */
export function useFutureStartRevealTick(tasks: ReadonlyArray<{ startTime?: string }>): number {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const revealAt = getNextFutureStartRevealAt(tasks);
        if (revealAt === null) return;
        const timer = window.setTimeout(() => setTick((t) => t + 1), Math.max(1, revealAt - Date.now() + 50));
        return () => window.clearTimeout(timer);
    }, [tasks, tick]);
    return tick;
}
