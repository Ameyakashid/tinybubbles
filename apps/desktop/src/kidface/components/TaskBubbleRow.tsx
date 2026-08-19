import { Star } from 'lucide-react';
import { useState } from 'react';
import type { Task } from '@tinybubbles/core';
import { BubbleCheckbox } from './BubbleCheckbox';
import { cn } from '@/lib/utils';

interface TaskBubbleRowProps {
    task: Task;
    onToggle: (task: Task) => void | Promise<void>;
}

export function TaskBubbleRow({ task, onToggle }: TaskBubbleRowProps) {
    const [isPopping, setIsPopping] = useState(false);

    const handleToggle = () => {
        setIsPopping(true);
        void onToggle(task);
        window.setTimeout(() => setIsPopping(false), 250);
    };

    return (
        <div
            className={cn(
                'flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-transform duration-150',
                isPopping && 'kidface-pop',
            )}
        >
            <BubbleCheckbox
                checked={false}
                onChange={handleToggle}
                label={`Mark ${task.title} as done`}
            />
            <div className="flex min-w-0 flex-1 flex-col">
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
            </div>
            {task.isFocusedToday && (
                <Star
                    className="size-6 shrink-0 fill-focus-star text-focus-star"
                    aria-label="Focused today"
                />
            )}
        </div>
    );
}
