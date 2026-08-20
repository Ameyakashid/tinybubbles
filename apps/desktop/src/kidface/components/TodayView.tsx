import { useMemo, useState } from 'react';
import { Sparkles, RotateCcw, ChevronRight } from 'lucide-react';
import { useTaskStore, type Task } from '@tinybubbles/core';
import { TaskBubbleRow } from './TaskBubbleRow';
import { OpenTaskView } from './OpenTaskView';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';

const RECENT_DONE_LIMIT = 3;

function isSameDay(a: string, b: Date): boolean {
    const date = new Date(a);
    return (
        date.getFullYear() === b.getFullYear()
        && date.getMonth() === b.getMonth()
        && date.getDate() === b.getDate()
    );
}

function sortOpenTasks(a: Task, b: Task): number {
    const focusedA = a.isFocusedToday ? 1 : 0;
    const focusedB = b.isFocusedToday ? 1 : 0;
    if (focusedA !== focusedB) return focusedB - focusedA;
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function greetingForHour(hour: number): string {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

interface TodayViewProps {
    onSeeAllDone: () => void;
}

export function TodayView({ onSeeAllDone }: TodayViewProps) {
    const { t, language } = useLanguage();
    const tasks = useTaskStore((state) => state.tasks);
    const updateTask = useTaskStore((state) => state.updateTask);
    const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);

    const { openTasks, doneToday } = useMemo(() => {
        const now = new Date();
        const open: Task[] = [];
        const done: Task[] = [];
        for (const task of tasks) {
            if (task.deletedAt) continue;
            if (task.status === 'done' || task.status === 'archived') {
                if (task.completedAt && isSameDay(task.completedAt, now)) {
                    done.push(task);
                }
                continue;
            }
            if (task.status === 'next' || task.status === 'inbox' || task.status === 'waiting') {
                open.push(task);
            }
        }
        open.sort(sortOpenTasks);
        done.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
        return { openTasks: open, doneToday: done };
    }, [tasks]);

    const selectedTask = useMemo(
        () => tasks.find((task) => task.id === openTaskId) ?? null,
        [tasks, openTaskId],
    );

    const handleToggle = async (task: Task) => {
        if (task.status === 'done' || task.status === 'archived') {
            await updateTask(task.id, { status: 'next', completedAt: undefined });
            setJustCompletedIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        } else {
            await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
            setJustCompletedIds((prev) => new Set(prev).add(task.id));
            window.setTimeout(() => {
                setJustCompletedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(task.id);
                    return next;
                });
            }, 1500);
        }
    };

    const handleToggleChecklistItem = async (taskId: string, itemId: string) => {
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (!task?.checklist) return;
        const nextChecklist = task.checklist.map((item) =>
            item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
        );
        await updateTask(taskId, { checklist: nextChecklist });
    };

    const now = new Date();
    const toDoLabel = displayLabel(t, language, 'agenda.nextActions', 'To do');

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    {greetingForHour(now.getHours())}
                </h1>
                <p className="text-lg text-muted-foreground">
                    {openTasks.length === 0
                        ? 'Nothing left to do — nice work!'
                        : `${openTasks.length} thing${openTasks.length === 1 ? '' : 's'} to do today`}
                </p>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-3">
                <h2 className="text-xl font-bold text-foreground">{toDoLabel}</h2>
                {openTasks.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                        <div className="flex size-28 items-center justify-center rounded-full bg-secondary">
                            <Sparkles className="size-14 text-primary" />
                        </div>
                        <p className="max-w-[16rem] text-lg text-muted-foreground">
                            Tap the big + above if something needs doing.
                        </p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3 overflow-y-auto pb-2">
                        {openTasks.map((task, index) => (
                            <li
                                key={task.id}
                                className={cn('kidface-slide-up', justCompletedIds.has(task.id) && 'opacity-60')}
                                style={{ animationDelay: `${index * 40}ms` }}
                            >
                                <TaskBubbleRow
                                    task={task}
                                    onToggle={handleToggle}
                                    onOpen={(openedTask) => setOpenTaskId(openedTask.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {doneToday.length > 0 && (
                <section className="flex shrink-0 flex-col gap-3">
                    <h2 className="text-xl font-bold text-foreground">Done today</h2>
                    <ul className="flex flex-col gap-2">
                        {doneToday.slice(0, RECENT_DONE_LIMIT).map((task) => (
                            <li
                                key={task.id}
                                className="flex items-center justify-between rounded-xl bg-success/10 px-4 py-3"
                            >
                                <span className="truncate text-base font-semibold text-success">
                                    {task.title}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void handleToggle(task)}
                                    className="flex size-14 shrink-0 items-center justify-center rounded-full bg-card text-success shadow-sm active:scale-90"
                                    aria-label={`Undo ${task.title}`}
                                >
                                    <RotateCcw className="size-6" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    {doneToday.length > RECENT_DONE_LIMIT && (
                        <button
                            type="button"
                            onClick={onSeeAllDone}
                            className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left text-lg font-semibold text-foreground shadow-sm active:scale-[0.99]"
                        >
                            <span>See all {doneToday.length} done</span>
                            <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                    )}
                </section>
            )}

            {selectedTask && (
                <OpenTaskView
                    task={selectedTask}
                    onClose={() => setOpenTaskId(null)}
                    onToggleTask={handleToggle}
                    onToggleChecklistItem={handleToggleChecklistItem}
                />
            )}
        </div>
    );
}
