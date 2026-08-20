import { Star, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '@tinybubbles/core';
import { BubbleCheckbox } from './BubbleCheckbox';
import { useCelebration } from './CelebrationContext';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';

interface TaskBubbleRowProps {
    task: Task;
    onToggle: (task: Task) => void | Promise<void>;
    onOpen: (task: Task) => void;
}

export function TaskBubbleRow({ task, onToggle, onOpen }: TaskBubbleRowProps) {
    const { t, language } = useLanguage();
    const celebrate = useCelebration();
    const checkboxRef = useRef<HTMLButtonElement>(null);
    const [isPopping, setIsPopping] = useState(false);
    const popTimeoutRef = useRef<number | null>(null);
    const isAnimatingRef = useRef(false);
    const taskRef = useRef(task);
    const onToggleRef = useRef(onToggle);

    // Keep refs current so the unmount cleanup can commit the latest task/onToggle
    // if a completion burst is still pending.
    useEffect(() => {
        taskRef.current = task;
        onToggleRef.current = onToggle;
    });

    const isDone = task.status === 'done' || task.status === 'archived';

    const doneLabel = useMemo(
        () => displayLabel(t, language, 'kidface.task.markDone', 'Mark {title} as done').replace('{title}', task.title),
        [t, language, task.title],
    );
    const openLabel = useMemo(
        () => displayLabel(t, language, 'kidface.task.openLabel', 'Open {title}').replace('{title}', task.title),
        [t, language, task.title],
    );

    useEffect(() => () => {
        if (popTimeoutRef.current !== null) {
            window.clearTimeout(popTimeoutRef.current);
            popTimeoutRef.current = null;
            // If the row is unmounted during the completion burst, commit the
            // toggle so the child's tap is not silently dropped.
            isAnimatingRef.current = false;
            void onToggleRef.current(taskRef.current);
        }
    }, []);

    const handleToggle = () => {
        if (isAnimatingRef.current) return;

        if (!isDone) {
            // Queue the status change so the completion burst has time to play
            // before the Today filter unmounts the row. If unmount happens first,
            // the cleanup above commits the toggle.
            isAnimatingRef.current = true;
            setIsPopping(true);

            const rect = checkboxRef.current?.getBoundingClientRect();
            const origin = rect
                ? {
                    x: (rect.left + rect.width / 2) / window.innerWidth,
                    y: (rect.top + rect.height / 2) / window.innerHeight,
                }
                : undefined;
            celebrate(origin);

            popTimeoutRef.current = window.setTimeout(() => {
                popTimeoutRef.current = null;
                isAnimatingRef.current = false;
                setIsPopping(false);
                void onToggle(task);
            }, 500);
        } else {
            void onToggle(task);
        }
    };

    return (
        <div
            className={cn(
                'group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md',
                isPopping && 'kidface-pop',
            )}
        >
            <BubbleCheckbox
                ref={checkboxRef}
                checked={isDone || isPopping}
                onChange={handleToggle}
                label={isDone ? openLabel : doneLabel}
                celebrating={isPopping}
            />
            <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex min-h-[88px] min-w-0 flex-1 flex-col justify-center text-left"
                aria-label={openLabel}
            >
                <span className="truncate text-lg font-semibold leading-snug text-foreground">
                    {task.title}
                </span>
                {task.checklist && task.checklist.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                        {task.checklist.filter((item) => item.isCompleted).length}
                        {' / '}
                        {task.checklist.length}
                    </span>
                )}
            </button>
            <div className="flex shrink-0 items-center gap-2">
                {task.isFocusedToday && (
                    <span className="relative flex size-7 items-center justify-center">
                        <span
                            data-testid="focus-pulse-ring"
                            className="absolute left-1/2 top-1/2 size-7 rounded-full bg-focus-star/30 kidface-pulse-ring-slow"
                            aria-hidden="true"
                        />
                        <Star
                            className="relative z-10 size-7 shrink-0 fill-focus-star text-focus-star"
                            aria-label="Focused today"
                        />
                    </span>
                )}
                <ChevronRight
                    className="size-7 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
