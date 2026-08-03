import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getNextFutureStartRevealAt } from '@mindwtr/core';

export function getLocalDayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

export function useLocalDayKey(enabled = true): string {
  const [dayKey, setDayKey] = useState(getLocalDayKey);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextDay = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, Math.max(1, nextDay.getTime() - now.getTime() + 50));
    };
    const refresh = () => {
      setDayKey(getLocalDayKey());
      scheduleNextDay();
    };

    scheduleNextDay();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
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
    const timer = setTimeout(() => setTick((t) => t + 1), Math.max(1, revealAt - Date.now() + 50));
    return () => clearTimeout(timer);
  }, [tasks, tick]);
  return tick;
}
