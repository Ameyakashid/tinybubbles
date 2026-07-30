import { hasTimeComponent, safeParseDate, type Task } from '@mindwtr/core';

export const calendarDateKey = (date: Date): string => (
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
);

// A localized "10:00 AM" wraps and clips in the 56px timeline gutter, so drop the :00 an hour
// line already implies. 24-hour locales ("13:00") fit as-is and would be left a bare "13".
export const compactHourLabel = (label: string): string => (
  /[^\d\s.:]/.test(label) ? label.replace(/[.:]00/, '') : label
);

export const addCalendarMapItem = <T,>(map: Map<string, T[]>, date: Date, item: T) => {
  const key = calendarDateKey(date);
  const items = map.get(key);
  if (items) {
    items.push(item);
    return;
  }
  map.set(key, [item]);
};

export const isTimedScheduledTask = (task: Pick<Task, 'startTime'>): boolean => (
  hasTimeComponent(task.startTime)
);

export const isAllDayScheduledTask = (task: Pick<Task, 'startTime'>): boolean => (
  Boolean(task.startTime) && !hasTimeComponent(task.startTime)
);

export const buildScheduledTasksByDate = (tasks: readonly Task[]): Map<string, Task[]> => {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.startTime) continue;
    const startTime = safeParseDate(task.startTime);
    if (startTime) addCalendarMapItem(map, startTime, task);
  }
  return map;
};
