import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import type { Task } from '@tinybubbles/core';
import { safeFormatDate, useTaskStore } from '@tinybubbles/core';
import { Dialog, DialogBody, DialogHeader } from '@/components/ui/Dialog';
import { TaskBubbleRow } from './TaskBubbleRow';
import { OpenTaskView } from './OpenTaskView';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

interface CalendarDaySheetProps {
    date: Date;
    tasks: Task[];
    onClose: () => void;
}

export function CalendarDaySheet({ date, tasks, onClose }: CalendarDaySheetProps) {
    const { t, language } = useLanguage();
    const updateTask = useTaskStore((state) => state.updateTask);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);

    const sortedTasks = useMemo(
        () => [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [tasks],
    );

    const selectedTask = useMemo(
        () => sortedTasks.find((task) => task.id === openTaskId) ?? null,
        [sortedTasks, openTaskId],
    );

    const handleToggle = async (task: Task) => {
        if (task.status === 'done' || task.status === 'archived') {
            await updateTask(task.id, { status: 'next', completedAt: undefined });
        } else {
            await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
        }
    };

    const handleToggleChecklistItem = async (taskId: string, itemId: string) => {
        const task = sortedTasks.find((candidate) => candidate.id === taskId);
        if (!task?.checklist) return;
        const nextChecklist = task.checklist.map((item) =>
            item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
        );
        await updateTask(taskId, { checklist: nextChecklist });
    };

    const dateLabel = safeFormatDate(date, 'EEEE, MMMM d') ?? String(date);
    const emptyLabel = displayLabel(t, language, 'kidface.calendar.daySheet.empty', 'No plans for this day.');
    const closeLabel = displayLabel(t, language, 'kidface.calendar.daySheet.close', 'Back to calendar');

    return (
        <Dialog
            onClose={onClose}
            label={dateLabel}
            closeOnBackdrop={false}
            overlayClassName="bg-background"
            panelClassName="fixed inset-0 max-h-none max-w-none rounded-none border-none shadow-none kidface-sheet-enter"
        >
            <DialogHeader className="flex h-16 shrink-0 items-center px-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex size-14 items-center justify-center rounded-full bg-card text-foreground shadow-sm active:scale-90"
                    aria-label={closeLabel}
                >
                    <ArrowLeft className="size-7" strokeWidth={2.5} />
                </button>
                <h2 className="ml-2 text-2xl font-extrabold text-foreground">{dateLabel}</h2>
            </DialogHeader>

            <DialogBody className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8 pt-2">
                {sortedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-card p-8 text-center shadow-sm">
                        <div className="flex size-16 items-center justify-center rounded-full bg-secondary">
                            <CalendarDays className="size-8 text-primary" aria-hidden="true" />
                        </div>
                        <p className="text-lg text-muted-foreground">{emptyLabel}</p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {sortedTasks.map((task, index) => (
                            <li
                                key={task.id}
                                className="kidface-slide-up"
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
            </DialogBody>

            {selectedTask && (
                <OpenTaskView
                    task={selectedTask}
                    onClose={() => setOpenTaskId(null)}
                    onToggleTask={handleToggle}
                    onToggleChecklistItem={handleToggleChecklistItem}
                />
            )}
        </Dialog>
    );
}
