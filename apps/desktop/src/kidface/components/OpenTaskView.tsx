import { useEffect, useMemo } from 'react';
import { ArrowLeft, Star, Check } from 'lucide-react';
import type { Task } from '@tinybubbles/core';
import { BubbleCheckbox } from './BubbleCheckbox';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

interface OpenTaskViewProps {
    task: Task;
    onClose: () => void;
    onToggleTask: (task: Task) => void | Promise<void>;
    onToggleChecklistItem: (taskId: string, itemId: string) => void | Promise<void>;
}

function isTaskFinished(task: Task): boolean {
    return task.status === 'done' || task.status === 'archived';
}

export function OpenTaskView({ task, onClose, onToggleTask, onToggleChecklistItem }: OpenTaskViewProps) {
    const { t, language } = useLanguage();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const finished = isTaskFinished(task);
    const checklist = task.checklist ?? [];
    const completedCount = useMemo(
        () => checklist.filter((item) => item.isCompleted).length,
        [checklist],
    );
    const progressLabel = checklist.length > 0
        ? `${completedCount} / ${checklist.length}`
        : undefined;
    const checklistLabel = displayLabel(t, language, 'taskEdit.checklist', 'Steps');

    return (
        <div
            className="kidface-slide-up fixed inset-0 z-50 flex flex-col bg-background text-foreground"
            role="dialog"
            aria-modal="true"
            aria-label={task.title}
        >
            <header className="flex h-16 shrink-0 items-center px-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex size-12 items-center justify-center rounded-full text-foreground active:scale-90"
                    aria-label={t('common.back')}
                >
                    <ArrowLeft className="size-7" strokeWidth={2.5} />
                </button>
            </header>

            <section className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-8 pt-2">
                <div className="flex items-center gap-5 rounded-2xl bg-card p-5 shadow-sm">
                    <BubbleCheckbox
                        checked={finished}
                        onChange={() => void onToggleTask(task)}
                        label={finished
                            ? `Mark ${task.title} as not done`
                            : `Mark ${task.title} as done`}
                        className={finished ? 'border-success bg-success text-success-foreground' : undefined}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                            className={cn(
                                'text-2xl font-bold leading-tight',
                                finished && 'text-muted-foreground line-through',
                            )}
                        >
                            {task.title}
                        </span>
                        {progressLabel && (
                            <span className="text-base text-muted-foreground">
                                {progressLabel}
                            </span>
                        )}
                    </div>
                    {task.isFocusedToday && (
                        <Star
                            className="size-7 shrink-0 fill-focus-star text-focus-star"
                            aria-label="Focused today"
                        />
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <h3 className="text-lg font-bold text-foreground">{checklistLabel}</h3>
                    {checklist.length === 0 ? (
                        <p className="rounded-2xl bg-card p-5 text-center text-lg text-muted-foreground shadow-sm">
                            Nothing to check off — just do it.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {checklist.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => void onToggleChecklistItem(task.id, item.id)}
                                        className={cn(
                                            'flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-sm transition-colors active:scale-[0.99]',
                                            item.isCompleted && 'bg-success/10',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] transition-colors',
                                                item.isCompleted
                                                    ? 'border-success bg-success text-success-foreground'
                                                    : 'border-border bg-card text-muted-foreground',
                                            )}
                                            aria-hidden="true"
                                        >
                                            <Check
                                                className={cn(
                                                    'size-6 transition-transform duration-150',
                                                    item.isCompleted ? 'scale-100' : 'scale-0',
                                                )}
                                                strokeWidth={3}
                                            />
                                        </span>
                                        <span
                                            className={cn(
                                                'min-w-0 flex-1 text-lg font-medium leading-snug',
                                                item.isCompleted && 'text-muted-foreground line-through',
                                            )}
                                        >
                                            {item.title}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
}
