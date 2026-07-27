import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

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
