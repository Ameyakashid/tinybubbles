import {
    getUsedTaskTokens,
    SAVED_FILTER_NO_PROJECT_ID,
    type Task,
} from '@mindwtr/core';

export function splitFocusedTasks<T extends Pick<Task, 'isFocusedToday'>>(tasks: T[]): {
    focusedTasks: T[];
    otherTasks: T[];
} {
    const focusedTasks: T[] = [];
    const otherTasks: T[] = [];

    tasks.forEach((task) => {
        if (task.isFocusedToday) {
            focusedTasks.push(task);
            return;
        }

        otherTasks.push(task);
    });

    return { focusedTasks, otherTasks };
}

export const NO_PROJECT_FILTER_ID = SAVED_FILTER_NO_PROJECT_ID;

export function getFocusTokenOptions(tasks: Task[]): string[] {
    return getUsedTaskTokens(tasks, (task) => [...(task.contexts ?? []), ...(task.tags ?? [])]);
}
