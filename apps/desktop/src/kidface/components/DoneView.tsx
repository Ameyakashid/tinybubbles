import { useMemo } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { useTaskStore, type Task } from '@tinybubbles/core';
import { cn } from '@/lib/utils';

function isSameDay(a: string, b: Date): boolean {
    const date = new Date(a);
    return (
        date.getFullYear() === b.getFullYear()
        && date.getMonth() === b.getMonth()
        && date.getDate() === b.getDate()
    );
}

function isYesterday(a: string, now: Date): boolean {
    const date = new Date(a);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return (
        date.getFullYear() === yesterday.getFullYear()
        && date.getMonth() === yesterday.getMonth()
        && date.getDate() === yesterday.getDate()
    );
}

function completedAtTime(task: Task): number {
    return task.completedAt ? new Date(task.completedAt).getTime() : 0;
}

type DoneGroup = {
    key: 'today' | 'yesterday' | 'earlier';
    title: string;
    tasks: Task[];
};

function groupDoneTasks(tasks: Task[]): DoneGroup[] {
    const now = new Date();
    const done = tasks.filter(
        (task) => !task.deletedAt && (task.status === 'done' || task.status === 'archived') && task.completedAt,
    );
    done.sort((a, b) => completedAtTime(b) - completedAtTime(a));

    const today: Task[] = [];
    const yesterday: Task[] = [];
    const earlier: Task[] = [];

    for (const task of done) {
        if (isSameDay(task.completedAt!, now)) {
            today.push(task);
        } else if (isYesterday(task.completedAt!, now)) {
            yesterday.push(task);
        } else {
            earlier.push(task);
        }
    }

    const groups: DoneGroup[] = [
        { key: 'today', title: 'Today', tasks: today },
        { key: 'yesterday', title: 'Yesterday', tasks: yesterday },
        { key: 'earlier', title: 'Before that', tasks: earlier },
    ];
    return groups.filter((group) => group.tasks.length > 0);
}

interface DoneBubbleRowProps {
    task: Task;
    onUndo: (task: Task) => void | Promise<void>;
}

function DoneBubbleRow({ task, onUndo }: DoneBubbleRowProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-4 rounded-2xl bg-success/10 p-4 kidface-slide-up',
            )}
        >
            <div
                className="flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-success bg-success text-success-foreground"
                aria-hidden="true"
            >
                <Trophy className="size-7" strokeWidth={2.5} />
            </div>
            <span className="min-w-0 flex-1 text-lg font-semibold leading-snug text-foreground line-through">
                {task.title}
            </span>
            <button
                type="button"
                onClick={() => void onUndo(task)}
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-card text-success shadow-sm transition-transform active:scale-90"
                aria-label={`Put ${task.title} back on the list`}
            >
                <RotateCcw className="size-6" strokeWidth={2.5} />
            </button>
        </div>
    );
}

export function DoneView() {
    const tasks = useTaskStore((state) => state.tasks);
    const updateTask = useTaskStore((state) => state.updateTask);

    const groups = useMemo(() => groupDoneTasks(tasks), [tasks]);

    const handleUndo = async (task: Task) => {
        await updateTask(task.id, { status: 'next', completedAt: undefined });
    };

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Done
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Trophy case
                </h1>
                <p className="text-lg text-muted-foreground">
                    Things you finished
                </p>
            </header>

            {groups.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center kidface-slide-up">
                    <div className="flex size-28 items-center justify-center rounded-full bg-secondary">
                        <Trophy className="size-14 text-primary" />
                    </div>
                    <p className="max-w-[16rem] text-lg text-muted-foreground">
                        No trophies yet. Finish something and it will show up here.
                    </p>
                </div>
            ) : (
                <section className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
                    {groups.map((group) => (
                        <div key={group.key} className="flex flex-col gap-3">
                            <h2 className="text-xl font-bold text-foreground">{group.title}</h2>
                            <ul className="flex flex-col gap-3">
                                {group.tasks.map((task) => (
                                    <li key={task.id}>
                                        <DoneBubbleRow task={task} onUndo={handleUndo} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
