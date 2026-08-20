import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import {
    getShortWeekdayLabels,
    getTaskCalendarOccurrenceDate,
    safeFormatDate,
    safeParseDate,
    useTaskStore,
    type Task,
    type Language,
} from '@tinybubbles/core';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { CalendarDaySheet } from './CalendarDaySheet';

const WEEK_START_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};

function getTaskDate(task: Task): Date | null {
    const value = getTaskCalendarOccurrenceDate(task);
    if (!value) return null;
    return safeParseDate(value);
}

function isOpenTask(task: Task): boolean {
    return !task.deletedAt && task.status !== 'done' && task.status !== 'archived';
}

function taskCountLabel(t: (key: string) => string, language: Language, count: number): string {
    let category: Intl.LDMLPluralRule;
    try {
        category = count === 0 ? 'zero' : new Intl.PluralRules(language).select(count);
    } catch {
        category = count === 0 ? 'zero' : new Intl.PluralRules('en').select(count);
    }
    const template = displayLabel(
        t,
        language,
        `kidface.calendar.dayTaskCount.${category}`,
        count === 0 ? 'nothing to do' : count === 1 ? 'one thing' : '{count} things',
    );
    return template.replace('{count}', String(count));
}

export function CalendarView() {
    const { t, language } = useLanguage();
    const tasks = useTaskStore((state) => state.tasks);
    const weekStartSetting = useTaskStore((state) => state.settings.weekStart);
    const weekStart = WEEK_START_MAP[typeof weekStartSetting === 'string' ? weekStartSetting : 'sunday'] ?? 0;
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    const today = new Date();

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: weekStart });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: weekStart });
        return eachDayOfInterval({ start, end });
    }, [currentMonth, weekStart]);

    const tasksByDay = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const task of tasks) {
            if (!isOpenTask(task)) continue;
            const date = getTaskDate(task);
            if (!date) continue;
            const key = safeFormatDate(date, 'yyyy-MM-dd');
            if (!key) continue;
            const list = map.get(key) ?? [];
            list.push(task);
            map.set(key, list);
        }
        return map;
    }, [tasks]);

    const weekdayLabels = useMemo(() => {
        const labels = getShortWeekdayLabels(language);
        return [...labels.slice(weekStart), ...labels.slice(0, weekStart)];
    }, [language, weekStart]);

    const title = displayLabel(t, language, 'kidface.calendar.title', 'Calendar');
    const monthLabel = safeFormatDate(currentMonth, 'MMMM yyyy');
    const emptyLabel = displayLabel(t, language, 'kidface.calendar.empty', 'No big plans this month.');
    const emptyHintLabel = displayLabel(t, language, 'kidface.calendar.emptyHint', 'Tap a day to make a plan.');
    const prevMonthLabel = displayLabel(t, language, 'kidface.calendar.prevMonth', 'Previous month');
    const nextMonthLabel = displayLabel(t, language, 'kidface.calendar.nextMonth', 'Next month');

    const hasPlansThisMonth = useMemo(
        () => days.some((day) => tasksByDay.has(safeFormatDate(day, 'yyyy-MM-dd') ?? '')),
        [days, tasksByDay],
    );

    const handlePrev = () => setCurrentMonth((prev) => subMonths(prev, 1));
    const handleNext = () => setCurrentMonth((prev) => addMonths(prev, 1));

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{monthLabel}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label={prevMonthLabel}
                        className="flex size-12 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-transform hover:bg-muted active:scale-90"
                    >
                        <ChevronLeft className="size-6" strokeWidth={2.5} />
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label={nextMonthLabel}
                        className="flex size-12 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-transform hover:bg-muted active:scale-90"
                    >
                        <ChevronRight className="size-6" strokeWidth={2.5} />
                    </button>
                </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="grid grid-cols-7 gap-1">
                    {weekdayLabels.map((label) => (
                        <div key={label} className="py-2 text-center text-sm font-bold text-muted-foreground">
                            {label}
                        </div>
                    ))}
                </div>

                <div className="grid flex-1 grid-cols-7 gap-1">
                    {days.map((day) => {
                        const dayKey = safeFormatDate(day, 'yyyy-MM-dd') ?? '';
                        const dayTasks = tasksByDay.get(dayKey) ?? [];
                        const inCurrentMonth = isSameMonth(day, currentMonth);
                        const isToday = isSameDay(day, today);
                        const dateLabel = safeFormatDate(day, 'MMMM d, yyyy') ?? dayKey;
                        const countLabel = taskCountLabel(t, language, dayTasks.length);
                        const hasTasks = dayTasks.length > 0;
                        return (
                            <button
                                key={dayKey}
                                type="button"
                                data-calendar-day={dayKey}
                                onClick={() => setSelectedDay(day)}
                                aria-label={`${dateLabel}, ${countLabel}`}
                                aria-current={isToday ? 'date' : undefined}
                                aria-haspopup="dialog"
                                className={cn(
                                    'group flex min-h-20 flex-col items-center justify-start gap-1.5 rounded-2xl p-2 transition-all',
                                    inCurrentMonth
                                        ? 'bg-card text-foreground shadow-sm hover:shadow-md active:scale-[0.99]'
                                        : 'bg-transparent text-muted-foreground/50',
                                    isToday && 'ring-4 ring-primary/30',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-9 items-center justify-center rounded-full text-base font-bold transition-colors',
                                        isToday && 'bg-primary text-primary-foreground',
                                        hasTasks && !isToday && 'group-hover:bg-primary/10',
                                    )}
                                >
                                    {day.getDate()}
                                </span>
                                {hasTasks && (
                                    <span
                                        data-task-count
                                        className="flex min-h-5 items-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary"
                                        aria-hidden="true"
                                    >
                                        {dayTasks.length > 9 ? '9+' : dayTasks.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {!hasPlansThisMonth && (
                    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                        <div className="flex size-24 items-center justify-center rounded-full bg-secondary">
                            <CalendarDays className="size-12 text-primary" aria-hidden="true" />
                        </div>
                        <div className="flex max-w-[18rem] flex-col gap-1">
                            <p className="text-2xl font-extrabold text-foreground">{emptyLabel}</p>
                            <p className="text-base text-muted-foreground">{emptyHintLabel}</p>
                        </div>
                    </div>
                )}
            </section>

            {selectedDay && (
                <CalendarDaySheet
                    date={selectedDay}
                    tasks={tasksByDay.get(safeFormatDate(selectedDay, 'yyyy-MM-dd') ?? '') ?? []}
                    onClose={() => setSelectedDay(null)}
                />
            )}
        </div>
    );
}
