import type { RecurrenceWeekday } from '@mindwtr/core';
import { TaskItemRecurrenceModal } from './TaskItemRecurrenceModal';
import { WEEKDAY_ORDER } from './recurrence-constants';
import type { useTaskItemRecurrence } from './useTaskItemRecurrence';

type TaskRecurrenceOverlayProps = {
    recurrence: ReturnType<typeof useTaskItemRecurrence>;
    weekdayLabels: Record<RecurrenceWeekday, string>;
    t: (key: string) => string;
};

export function TaskRecurrenceOverlay({ recurrence, weekdayLabels, t }: TaskRecurrenceOverlayProps) {
    const {
        showCustomRecurrence,
        setShowCustomRecurrence,
        customInterval,
        setCustomInterval,
        customMode,
        setCustomMode,
        customOrdinal,
        setCustomOrdinal,
        customWeekday,
        setCustomWeekday,
        setCustomMonthDay,
        customMonthDay,
        applyCustomRecurrence,
    } = recurrence;
    if (!showCustomRecurrence) return null;

    return (
        <TaskItemRecurrenceModal
            t={t}
            weekdayOrder={WEEKDAY_ORDER}
            weekdayLabels={weekdayLabels}
            customInterval={customInterval}
            customMode={customMode}
            customOrdinal={customOrdinal}
            customWeekday={customWeekday}
            customMonthDay={customMonthDay}
            onIntervalChange={setCustomInterval}
            onModeChange={setCustomMode}
            onOrdinalChange={setCustomOrdinal}
            onWeekdayChange={setCustomWeekday}
            onMonthDayChange={(value) => {
                const safe = Number.isFinite(value) ? Math.min(Math.max(value, 1), 31) : 1;
                setCustomMonthDay(safe);
            }}
            onClose={() => setShowCustomRecurrence(false)}
            onApply={applyCustomRecurrence}
        />
    );
}
