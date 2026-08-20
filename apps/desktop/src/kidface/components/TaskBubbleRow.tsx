import { Star, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Task } from '@tinybubbles/core';
import { BubbleCheckbox } from './BubbleCheckbox';
import { cn } from '@/lib/utils';

interface TaskBubbleRowProps {
    task: Task;
    onToggle: (task: Task) => void | Promise<void>;
    onOpen: (task: Task) => void;
}

export function TaskBubbleRow({ task, onToggle, onOpen }: TaskBubbleRowProps) {
    const [isPopping, setIsPopping] = useState(false);
    const popTimeoutRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (popTimeoutRef.current !== null) {
            window.clearTimeout(popTimeoutRef.current);
        }
    }, []);

    const handleToggle = () => {
        setIsPopping(true);
        void onToggle(task);
        popTimeoutRef.current = window.setTimeout(() => setIsPopping(false), 250);
    };

    return (
        <div
            className={cn(
                'group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md',
                isPopping && 'kidface-pop',
            )}
        >
            <BubbleCheckbox
                checked={false}
                onChange={handleToggle}
                label={`Mark ${task.title} as done`}
                celebrating={isPopping}
            />
            <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left"
                aria-label={`Open ${task.title}`}
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
                    <Star
                        className="size-6 shrink-0 fill-focus-star text-focus-star"
                        aria-label="Focused today"
                    />
                )}
                <ChevronRight
                    className="size-6 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
