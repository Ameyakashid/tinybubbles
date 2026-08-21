import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { useTaskStore, type Task } from '@tinybubbles/core';
import { TaskBubbleRow } from './TaskBubbleRow';
import { OpenTaskView } from './OpenTaskView';
import { AmbientField } from './AmbientField';
import { Pebble } from './Pebble';
import { selectTodayTasks } from './today-task-filter';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';

const RECENT_DONE_LIMIT = 3;
const GENTLE_UNDO_MS = 5000;

function sortOpenTasks(a: Task, b: Task): number {
    const focusedA = a.isFocusedToday ? 1 : 0;
    const focusedB = b.isFocusedToday ? 1 : 0;
    if (focusedA !== focusedB) return focusedB - focusedA;
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function greetingKeyForHour(hour: number): string {
    if (hour < 12) return 'kidface.today.greeting.morning';
    if (hour < 17) return 'kidface.today.greeting.afternoon';
    return 'kidface.today.greeting.evening';
}

interface TodayViewProps {
    onSeeAllDone: () => void;
    onSeeCalendar: () => void;
}

export function TodayView({ onSeeAllDone, onSeeCalendar }: TodayViewProps) {
    const { t, language } = useLanguage();
    const tasks = useTaskStore((state) => state.tasks);
    const updateTask = useTaskStore((state) => state.updateTask);
    const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
    const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (!recentlyCompletedId) return undefined;
        const id = window.setTimeout(() => setRecentlyCompletedId(null), GENTLE_UNDO_MS);
        return () => window.clearTimeout(id);
    }, [recentlyCompletedId]);

    const { openTasks, doneToday, upcomingCount } = useMemo(() => {
        const selection = selectTodayTasks(tasks, new Date());
        selection.openTasks.sort(sortOpenTasks);
        selection.doneToday.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
        return selection;
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
            setRecentlyCompletedId((prev) => (prev === task.id ? null : prev));
        } else {
            await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
            setJustCompletedIds((prev) => new Set(prev).add(task.id));
            setRecentlyCompletedId(task.id);
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
    const doneTodayLabel = displayLabel(t, language, 'kidface.today.doneToday', 'Done today');
    const plainEmptyHint = displayLabel(t, language, 'kidface.today.plainEmpty.hint', 'Tap the big + below if something needs doing.');
    const undoToast = displayLabel(t, language, 'kidface.undo.toast', 'Done! Tap to undo.');
    const undoAction = displayLabel(t, language, 'kidface.undo.action', 'Undo');
    const allDoneTitle = displayLabel(t, language, 'kidface.today.allDone.title', 'All done!');
    const allDoneMessage = displayLabel(t, language, 'kidface.today.allDone.message', 'You finished everything for today.');
    const seeDoneLabel = displayLabel(t, language, 'kidface.today.allDone.seeDone', 'See your trophies');
    const headerCountOne = displayLabel(t, language, 'kidface.today.header.count.one', '1 thing to do today');
    const headerCountOther = displayLabel(t, language, 'kidface.today.header.count.other', '{count} things to do today');
    const headerEmpty = displayLabel(t, language, 'kidface.today.header.empty', 'Nothing left to do — nice work!');
    const headerScheduledOne = displayLabel(t, language, 'kidface.today.header.emptyScheduled.one', 'Nothing today — 1 thing coming up');
    const headerScheduledOther = displayLabel(t, language, 'kidface.today.header.emptyScheduled.other', 'Nothing today — {count} things coming up');
    const scheduledEmptyTitle = displayLabel(t, language, 'kidface.today.scheduledEmpty.title', 'Free today');
    const scheduledEmptyOne = displayLabel(t, language, 'kidface.today.scheduledEmpty.one', 'You have 1 thing coming up.');
    const scheduledEmptyOther = displayLabel(t, language, 'kidface.today.scheduledEmpty.other', 'You have {count} things coming up.');
    const scheduledEmptyAction = displayLabel(t, language, 'kidface.today.scheduledEmpty.seeCalendar', "See what's coming");
    const greeting = displayLabel(
        t,
        language,
        greetingKeyForHour(now.getHours()),
        'Good morning',
    );
    const seeAllDoneTemplate = displayLabel(t, language, 'kidface.today.seeAllDone', 'See all {count} done');
    const undoTaskLabelTemplate = displayLabel(t, language, 'kidface.today.undo.label', 'Undo {title}');

    const headerSubtitle = (() => {
        if (openTasks.length > 0) {
            return openTasks.length === 1
                ? headerCountOne
                : headerCountOther.replace('{count}', String(openTasks.length));
        }
        if (upcomingCount === 0) return headerEmpty;
        return upcomingCount === 1
            ? headerScheduledOne
            : headerScheduledOther.replace('{count}', String(upcomingCount));
    })();

    const scheduledEmptyMessage = upcomingCount === 1
        ? scheduledEmptyOne
        : scheduledEmptyOther.replace('{count}', String(upcomingCount));

    const recentlyCompletedTask = recentlyCompletedId
        ? doneToday.find((task) => task.id === recentlyCompletedId) ?? null
        : null;

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {toDoLabel}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    {greeting}
                </h1>
                <p className="text-lg text-muted-foreground">{headerSubtitle}</p>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-3">
                <h2 className="sr-only">{toDoLabel}</h2>
                {recentlyCompletedTask && (
                    <div
                        className="flex items-center justify-between gap-3 rounded-2xl bg-success/10 p-4 kidface-joy-bounce"
                        aria-live="polite"
                    >
                        <span className="text-lg font-semibold text-success">{undoToast}</span>
                        <button
                            type="button"
                            onClick={() => void handleToggle(recentlyCompletedTask)}
                            className="flex min-h-22 items-center rounded-full bg-card px-6 text-base font-bold text-success shadow-sm active:scale-90"
                        >
                            {undoAction}
                        </button>
                    </div>
                )}
                {openTasks.length === 0 ? (
                    doneToday.length > 0 ? (
                        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 text-center kidface-slide-up">
                            <AmbientField />
                            <Pebble state="celebrate" size={140} />
                            <div className="relative flex max-w-[18rem] flex-col gap-1">
                                <p className="text-2xl font-extrabold text-foreground">{allDoneTitle}</p>
                                <p className="text-lg text-muted-foreground">{allDoneMessage}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onSeeAllDone}
                                className="relative flex min-h-[88px] items-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground active:scale-[0.99]"
                            >
                                {seeDoneLabel}
                            </button>
                        </div>
                    ) : upcomingCount > 0 ? (
                        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 text-center kidface-slide-up">
                            <AmbientField />
                            <Pebble state="idle" size={140} />
                            <div className="relative flex max-w-[18rem] flex-col gap-1">
                                <p className="text-2xl font-extrabold text-foreground">{scheduledEmptyTitle}</p>
                                <p className="text-lg text-muted-foreground">{scheduledEmptyMessage}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onSeeCalendar}
                                className="relative flex min-h-[88px] items-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground active:scale-[0.99]"
                            >
                                {scheduledEmptyAction}
                            </button>
                        </div>
                    ) : (
                        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 text-center kidface-slide-up">
                            <AmbientField />
                            <Pebble state="think" size={140} />
                            <p className="relative max-w-[16rem] text-lg text-muted-foreground">{plainEmptyHint}</p>
                        </div>
                    )
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
                    <h2 className="text-xl font-bold text-foreground">{doneTodayLabel}</h2>
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
                                    className="flex size-[88px] shrink-0 items-center justify-center rounded-full bg-card text-success shadow-sm active:scale-90"
                                    aria-label={undoTaskLabelTemplate.replace('{title}', task.title)}
                                >
                                    <RotateCcw className="size-8" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    {doneToday.length > RECENT_DONE_LIMIT && (
                        <button
                            type="button"
                            onClick={onSeeAllDone}
                            className="flex min-h-[88px] w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left text-lg font-semibold text-foreground shadow-sm active:scale-[0.99]"
                        >
                            <span>{seeAllDoneTemplate.replace('{count}', String(doneToday.length))}</span>
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
