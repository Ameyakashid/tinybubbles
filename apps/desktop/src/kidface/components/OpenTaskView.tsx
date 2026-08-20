import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Star, Check } from 'lucide-react';
import { useTaskStore, type Task, generateUUID } from '@tinybubbles/core';
import { BubbleCheckbox } from './BubbleCheckbox';
import { Dialog, DialogBody, DialogHeader } from '@/components/ui/Dialog';
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
    const editTitlePlaceholder = displayLabel(t, language, 'kidface.task.editTitlePlaceholder', 'What is this called?');
    const addStepPlaceholder = displayLabel(t, language, 'kidface.task.addStepPlaceholder', 'Add a step');
    const addStepAction = displayLabel(t, language, 'kidface.task.addStepAction', 'Add step');
    const titleLabel = displayLabel(t, language, 'kidface.task.titleLabel', 'Task title');
    const checklistEmpty = displayLabel(t, language, 'kidface.task.checklistEmpty', 'Nothing to check off — just do it.');
    const markDoneLabel = displayLabel(t, language, 'kidface.task.markDone', 'Mark {title} as done').replace('{title}', task.title);
    const markNotDoneLabel = displayLabel(t, language, 'kidface.task.markNotDone', 'Mark {title} as not done').replace('{title}', task.title);

    const updateTask = useTaskStore((state) => state.updateTask);
    const [titleDraft, setTitleDraft] = useState(task.title);
    const [stepDraft, setStepDraft] = useState('');

    useEffect(() => {
        setTitleDraft(task.title);
    }, [task.title]);

    const commitTitle = () => {
        const trimmed = titleDraft.trim();
        if (trimmed && trimmed !== task.title) {
            void updateTask(task.id, { title: trimmed });
        }
        if (!trimmed) {
            setTitleDraft(task.title);
        }
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            setTitleDraft(task.title);
            event.currentTarget.blur();
        }
    };

    const handleAddStep = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = stepDraft.trim();
        if (!trimmed) return;
        const nextChecklist = [...checklist, { id: generateUUID(), title: trimmed, isCompleted: false }];
        void updateTask(task.id, { checklist: nextChecklist });
        setStepDraft('');
    };

    return (
        <Dialog
            onClose={onClose}
            label={task.title}
            closeOnBackdrop={false}
            overlayClassName="bg-background"
            panelClassName="fixed inset-0 max-h-none max-w-none rounded-none border-none shadow-none"
        >
            <DialogHeader className="flex h-16 shrink-0 items-center px-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex size-14 items-center justify-center rounded-full text-foreground active:scale-90"
                    aria-label={t('common.back')}
                >
                    <ArrowLeft className="size-7" strokeWidth={2.5} />
                </button>
            </DialogHeader>

            <DialogBody className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-8 pt-2">
                <div className="flex items-center gap-5 rounded-2xl bg-card p-5 shadow-sm">
                    <BubbleCheckbox
                        checked={finished}
                        onChange={() => void onToggleTask(task)}
                        label={finished ? markNotDoneLabel : markDoneLabel}
                        className={finished ? 'border-success bg-success text-success-foreground' : undefined}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <input
                            type="text"
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={handleTitleKeyDown}
                            placeholder={editTitlePlaceholder}
                            aria-label={titleLabel}
                            className={cn(
                                'w-full bg-transparent text-2xl font-bold leading-tight placeholder:text-muted-foreground focus-visible:outline-none',
                                finished && 'text-muted-foreground line-through',
                            )}
                        />
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
                    {checklist.length === 0 && (
                        <p className="rounded-2xl bg-card p-5 text-center text-lg text-muted-foreground shadow-sm">
                            {checklistEmpty}
                        </p>
                    )}
                    {checklist.length > 0 && (
                        <ul className="flex flex-col gap-2">
                            {checklist.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={item.isCompleted}
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
                    <form onSubmit={handleAddStep} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
                        <input
                            value={stepDraft}
                            onChange={(event) => setStepDraft(event.target.value)}
                            placeholder={addStepPlaceholder}
                            aria-label={addStepPlaceholder}
                            className={cn(
                                'h-12 flex-1 rounded-xl border border-input bg-background px-4 text-lg text-foreground placeholder:text-muted-foreground',
                                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50',
                            )}
                        />
                        <button
                            type="submit"
                            disabled={!stepDraft.trim()}
                            className={cn(
                                'flex min-h-12 items-center rounded-full bg-primary px-5 text-base font-bold text-primary-foreground shadow-sm transition-transform active:scale-90',
                                'disabled:opacity-50 disabled:active:scale-100',
                            )}
                        >
                            {addStepAction}
                        </button>
                    </form>
                </div>
            </DialogBody>
        </Dialog>
    );
}
