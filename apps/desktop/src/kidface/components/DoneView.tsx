import { useMemo } from 'react';
import { Trophy, RotateCcw, Sparkles } from 'lucide-react';
import { useTaskStore, type Task, type Language } from '@tinybubbles/core';
import { AmbientField } from './AmbientField';
import { Pebble } from './Pebble';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

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

type DoneGroupKey = 'today' | 'yesterday' | 'earlier';

type DoneGroup = {
    key: DoneGroupKey;
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
        { key: 'today', tasks: today },
        { key: 'yesterday', tasks: yesterday },
        { key: 'earlier', tasks: earlier },
    ];
    return groups.filter((group) => group.tasks.length > 0);
}

function countLabel(t: (key: string) => string, language: Language, keyOne: string, keyOther: string, count: number): string {
    const template = displayLabel(t, language, count === 1 ? keyOne : keyOther, count === 1 ? '1' : '{count}');
    return template.replace('{count}', String(count));
}

interface DoneBubbleRowProps {
    task: Task;
    onUndo: (task: Task) => void | Promise<void>;
    undoLabel: string;
}

function DoneBubbleRow({ task, onUndo, undoLabel }: DoneBubbleRowProps) {
    return (
        <div
            className={cn(
                'group flex items-center gap-4 rounded-2xl bg-success/10 p-4 kidface-slide-up',
            )}
        >
            <div
                className="relative flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-success bg-success text-success-foreground"
                aria-hidden="true"
            >
                <Trophy className="relative z-10 size-9" strokeWidth={2.5} />
                <Sparkles
                    className="absolute -right-1 -top-1 z-30 size-5 text-focus-star opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    aria-hidden="true"
                />
            </div>
            <span className="min-w-0 flex-1 text-lg font-semibold leading-snug text-foreground line-through">
                {task.title}
            </span>
            <button
                type="button"
                onClick={() => void onUndo(task)}
                className="flex size-[88px] shrink-0 items-center justify-center rounded-full bg-card text-success shadow-sm transition-transform active:scale-90"
                aria-label={undoLabel.replace('{title}', task.title)}
            >
                <RotateCcw className="size-8" strokeWidth={2.5} />
            </button>
        </div>
    );
}

export function DoneView() {
    const { t, language } = useLanguage();
    const tasks = useTaskStore((state) => state.tasks);
    const updateTask = useTaskStore((state) => state.updateTask);

    const groups = useMemo(() => groupDoneTasks(tasks), [tasks]);

    const handleUndo = async (task: Task) => {
        await updateTask(task.id, { status: 'next', completedAt: undefined });
    };

    const todayCount = groups.find((group) => group.key === 'today')?.tasks.length ?? 0;
    const totalCount = groups.reduce((sum, group) => sum + group.tasks.length, 0);

    const title = displayLabel(t, language, 'kidface.done.title', 'Done');
    const heading = displayLabel(t, language, 'kidface.done.heading', 'Trophy case');
    const subtitle = displayLabel(t, language, 'kidface.done.subtitle', 'Things you finished');
    const emptyTitle = displayLabel(t, language, 'kidface.done.empty.title', 'No trophies yet');
    const emptyHint = displayLabel(t, language, 'kidface.done.empty.hint', 'Finish something and it will show up here.');
    const todaySummary = countLabel(
        t,
        language,
        'kidface.done.summary.today.one',
        'kidface.done.summary.today.other',
        todayCount,
    );
    const totalSummary = countLabel(
        t,
        language,
        'kidface.done.summary.total.one',
        'kidface.done.summary.total.other',
        totalCount,
    );
    const undoLabelTemplate = displayLabel(t, language, 'kidface.done.undo.label', 'Put {title} back on the list');

    const groupTitle = (key: DoneGroupKey) => {
        const map: Record<DoneGroupKey, string> = {
            today: displayLabel(t, language, 'kidface.done.group.today', 'Today'),
            yesterday: displayLabel(t, language, 'kidface.done.group.yesterday', 'Yesterday'),
            earlier: displayLabel(t, language, 'kidface.done.group.earlier', 'Before that'),
        };
        return map[key];
    };

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    {heading}
                </h1>
                <p className="text-lg text-muted-foreground">{subtitle}</p>
            </header>

            {groups.length > 0 && (
                <div data-testid="trophy-summary" className="flex min-h-22 items-center gap-3 rounded-2xl bg-card p-4 shadow-sm kidface-slide-up">
                    <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-full bg-success/10">
                        <Trophy className="relative z-10 size-7 text-success" strokeWidth={2.5} />
                        <span
                            className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-transparent via-success-foreground/30 to-transparent kidface-trophy-shine"
                            aria-hidden="true"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold text-foreground">{todaySummary}</span>
                        <span className="text-sm text-muted-foreground">{totalSummary}</span>
                    </div>
                </div>
            )}

            {groups.length === 0 ? (
                <div className="relative flex flex-1 flex-col items-center justify-center gap-4 text-center kidface-slide-up">
                    <AmbientField />
                    <Pebble state="sleep" size={160} />
                    <div className="relative flex max-w-[18rem] flex-col gap-1">
                        <p className="text-2xl font-extrabold text-foreground">{emptyTitle}</p>
                        <p className="text-lg text-muted-foreground">{emptyHint}</p>
                    </div>
                </div>
            ) : (
                <section className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
                    {groups.map((group, groupIndex) => (
                        <div key={group.key} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-foreground">{groupTitle(group.key)}</h2>
                                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-muted-foreground">
                                    {group.tasks.length}
                                </span>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {group.tasks.map((task, taskIndex) => (
                                    <li
                                        key={task.id}
                                        style={{ animationDelay: `${(groupIndex * 3 + taskIndex) * 40}ms` }}
                                    >
                                        <DoneBubbleRow
                                            task={task}
                                            onUndo={handleUndo}
                                            undoLabel={undoLabelTemplate}
                                        />
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
