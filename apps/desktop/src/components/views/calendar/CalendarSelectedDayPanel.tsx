import { format } from 'date-fns';
import type { DragEvent } from 'react';
import { Check, Clock, MoreHorizontal, Plus, X } from 'lucide-react';
import { getTaskCalendarOccurrenceDate, hasTimeComponent, isProjectedRecurringTask, safeFormatDate, safeParseDate, type Task } from '@tinybubbles/core';

import { cn } from '../../../lib/utils';
import { displayLabel } from '../../../lib/display-labels';
import { useLanguage } from '../../../contexts/language-context';
import { reportError } from '../../../lib/report-error';
import { setCalendarTaskDragData } from '../../../lib/calendar-task-drag';
import type { DesktopCalendarController } from './useDesktopCalendarController';

type CalendarSelectedDayPanelController = Pick<
    DesktopCalendarController,
    | 'beginEditScheduledTime'
    | 'calendarNameById'
    | 'cancelEditScheduledTime'
    | 'closeSelectedDay'
    | 'commitEditScheduledTime'
    | 'createTaskFromExternalEvent'
    | 'editingTimeTaskId'
    | 'editingTimeValue'
    | 'getExternalCalendarColor'
    | 'isExternalLoading'
    | 'markTaskDone'
    | 'openQuickAddForDate'
    | 'openTaskFromCalendar'
    | 'resolveText'
    | 'scheduleCandidates'
    | 'scheduleError'
    | 'scheduleQuery'
    | 'scheduleTaskOnSelectedDate'
    | 'selectedAllDayEvents'
    | 'selectedDate'
    | 'selectedExternalEvents'
    | 'selectedTaskRows'
    | 'selectedTimedEvents'
    | 't'
    | 'timeEstimateToMinutes'
    | 'updateEditingTimeValue'
    | 'updateScheduleQuery'
    | 'updateTask'
>;

type CalendarSelectedDayPanelProps = {
    controller: CalendarSelectedDayPanelController;
};

const PROJECTED_RECURRENCE_LABEL_DATE_FORMAT = 'MMM d';

function getProjectedRecurrenceDisplayLabel(task: Task, projectedLabel: string): string {
    const occurrenceDateLabel = safeFormatDate(
        getTaskCalendarOccurrenceDate(task),
        PROJECTED_RECURRENCE_LABEL_DATE_FORMAT
    );
    return occurrenceDateLabel ? `${projectedLabel} · ${occurrenceDateLabel}` : projectedLabel;
}

export function CalendarSelectedDayPanel({ controller }: CalendarSelectedDayPanelProps) {
    const { language } = useLanguage();
    const {
        beginEditScheduledTime,
        calendarNameById,
        cancelEditScheduledTime,
        closeSelectedDay,
        commitEditScheduledTime,
        createTaskFromExternalEvent,
        editingTimeTaskId,
        editingTimeValue,
        getExternalCalendarColor,
        isExternalLoading,
        markTaskDone,
        openQuickAddForDate,
        openTaskFromCalendar,
        resolveText,
        selectedAllDayEvents,
        selectedDate,
        selectedExternalEvents,
        selectedTaskRows,
        selectedTimedEvents,
        t,
        timeEstimateToMinutes,
        updateEditingTimeValue,
        updateTask,
    } = controller;
    const handleTaskDragStart = (event: DragEvent<HTMLElement>, taskId: string, kind: 'scheduled' | 'deadline') => {
        event.stopPropagation();
        setCalendarTaskDragData(event.dataTransfer, taskId, { itemKind: kind });
    };

    if (!selectedDate) return null;

    return (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/20 px-4 py-3">
                <div>
                    <div className="text-lg font-bold">{format(selectedDate, 'PPPP')}</div>
                    <div className="text-sm text-muted-foreground">
                        {selectedTaskRows.length + selectedExternalEvents.length} {displayLabel(t, language, 'calendar.items', 'items')}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95"
                        onClick={() => openQuickAddForDate(selectedDate)}
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('calendar.addTask')}
                    </button>
                    <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        onClick={closeSelectedDay}
                        aria-label={t('common.close')}
                        title={t('common.close')}
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="grid gap-4 p-4">
                <div className="space-y-5">
                    {selectedAllDayEvents.length > 0 && (
                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">{t('calendar.allDay')}</h3>
                            <div className="space-y-1.5">
                                {selectedAllDayEvents.map((event) => {
                                    const sourceLabel = calendarNameById.get(event.sourceId);
                                    return (
                                        <div
                                            key={event.id}
                                            className="flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] bg-muted/50 px-3 py-2 text-base shadow-sm"
                                            style={{ borderLeftColor: getExternalCalendarColor(event.sourceId) }}
                                        >
                                            <span className="min-w-0 flex-1 truncate">{event.title}</span>
                                            {sourceLabel && <span className="truncate text-sm text-muted-foreground">{sourceLabel}</span>}
                                            <button
                                                type="button"
                                                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                onClick={() => void createTaskFromExternalEvent(event)}
                                                aria-label={`${resolveText('calendar.createTaskFromEvent', 'Create task')}: ${event.title}`}
                                                title={resolveText('calendar.createTaskFromEvent', 'Create task')}
                                            >
                                                <Plus className="h-4 w-4" aria-hidden="true" />
                                                {resolveText('calendar.createTaskFromEvent', 'Create task')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {(isExternalLoading || selectedTimedEvents.length > 0) && (
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">{t('calendar.events')}</h3>
                        <div className="space-y-1.5">
                            {isExternalLoading && (
                                <div className="rounded-xl bg-muted/40 px-3 py-2 text-base text-muted-foreground">
                                    {resolveText('common.loading', 'Loading...')}
                                </div>
                            )}
                            {selectedTimedEvents.map((event) => {
                                const start = safeParseDate(event.start);
                                const end = safeParseDate(event.end);
                                const timeLabel = start && end
                                    ? `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`
                                    : '';
                                const sourceLabel = calendarNameById.get(event.sourceId);
                                return (
                                    <div
                                        key={event.id}
                                        className="flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] bg-muted/50 px-3 py-2 text-base shadow-sm"
                                        style={{ borderLeftColor: getExternalCalendarColor(event.sourceId) }}
                                    >
                                        <span className="w-28 shrink-0 text-sm font-medium text-muted-foreground">{timeLabel}</span>
                                        <span className="min-w-0 flex-1 truncate">{event.title}</span>
                                        {sourceLabel && <span className="truncate text-sm text-muted-foreground">{sourceLabel}</span>}
                                        <button
                                            type="button"
                                            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                            onClick={() => void createTaskFromExternalEvent(event)}
                                            aria-label={`${resolveText('calendar.createTaskFromEvent', 'Create task')}: ${event.title}`}
                                            title={resolveText('calendar.createTaskFromEvent', 'Create task')}
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            {resolveText('calendar.createTaskFromEvent', 'Create task')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                    )}

                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">{resolveText('calendar.tasks', 'Tasks')}</h3>
                        <div className="space-y-1.5">
                            {selectedTaskRows.map(({ id, kind, task, start }) => {
                                const projected = isProjectedRecurringTask(task);
                                const projectedLabel = projected
                                    ? getProjectedRecurrenceDisplayLabel(task, resolveText('calendar.projectedRecurrence', 'Projected'))
                                    : '';
                                const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
                                const isAllDayScheduled = kind === 'scheduled' && !hasTimeComponent(task.startTime);
                                const end = start && kind === 'scheduled' && !isAllDayScheduled
                                    ? new Date(start.getTime() + durationMinutes * 60 * 1000)
                                    : null;
                                const timeLabel = isAllDayScheduled
                                    ? t('calendar.allDay')
                                    : start && end
                                    ? `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`
                                    : kind === 'deadline'
                                        ? displayLabel(t, language, 'calendar.deadline', 'Deadline')
                                        : '';
                                const isEditing = editingTimeTaskId === task.id;

                                return (
                                    <div
                                        key={id}
                                        data-task-id={task.id}
                                        draggable={!projected}
                                        onDragStart={(event) => {
                                            if (!projected) handleTaskDragStart(event, task.id, kind);
                                        }}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-xl px-4 py-2 text-base shadow-sm transition-colors hover:bg-muted/50",
                                            projected
                                                ? "border border-dashed border-primary/50 bg-primary/5"
                                                : kind === 'scheduled' ? "bg-primary/5" : "bg-background/60 ring-1 ring-border"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            {...(!projected ? { 'data-task-edit-trigger': true } : {})}
                                            disabled={projected}
                                            onClick={() => {
                                                if (!projected) openTaskFromCalendar(task);
                                            }}
                                            className="flex min-h-11 min-w-0 flex-1 items-center truncate text-left text-foreground focus:outline-none focus:underline"
                                        >
                                            <span className="mr-2 inline-flex w-28 shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
                                                {kind === 'scheduled' && <Clock className="h-4 w-4" aria-hidden="true" />}
                                                {timeLabel}
                                            </span>
                                            <span className="min-w-0 truncate">{task.title}</span>
                                        </button>
                                        {projected && (
                                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                {projectedLabel}
                                            </span>
                                        )}
                                        {!projected && isEditing ? (
                                            <div className="flex shrink-0 items-center gap-1">
                                                <input
                                                    type="time"
                                                    value={editingTimeValue}
                                                    onChange={(e) => updateEditingTimeValue(e.target.value)}
                                                    className="h-11 rounded border border-border bg-background px-2 text-sm"
                                                />
                                                <button
                                                    type="button"
                                                    className="h-11 rounded bg-primary px-3 text-sm text-primary-foreground"
                                                    onClick={commitEditScheduledTime}
                                                >
                                                    {t('common.save')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-11 rounded bg-muted px-3 text-sm hover:bg-muted/80"
                                                    onClick={cancelEditScheduledTime}
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </div>
                                        ) : !projected ? (
                                            // Always visible — never hover-revealed: controls must not
                                            // appear, disappear or move between states (see DESIGN.md).
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success hover:bg-success/25 active:scale-95"
                                                    onClick={() => markTaskDone(task.id)}
                                                    aria-label={displayLabel(t, language, 'status.done', 'Done')}
                                                    title={displayLabel(t, language, 'status.done', 'Done')}
                                                >
                                                    <Check className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                                {kind === 'scheduled' && (
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                                                        onClick={() => beginEditScheduledTime(task.id)}
                                                        aria-label={t('common.edit')}
                                                        title={t('common.edit')}
                                                    >
                                                        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                                                    </button>
                                                )}
                                                {kind === 'scheduled' && (
                                                    <button
                                                        type="button"
                                                        className="h-11 rounded-full bg-muted px-3 text-sm text-muted-foreground hover:text-foreground"
                                                        onClick={() => updateTask(task.id, { startTime: undefined, relativeStartOffset: undefined })
                                                            .catch((error) => reportError('Failed to clear scheduled time', error))}
                                                        title={displayLabel(t, language, 'calendar.unschedule', 'Remove from calendar')}
                                                    >
                                                        {displayLabel(t, language, 'calendar.unschedule', 'Remove from calendar')}
                                                    </button>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                            {selectedTaskRows.length === 0 && (
                                <div className="rounded-xl bg-muted/30 px-3 py-3 text-base text-muted-foreground">
                                    {t('calendar.noTasks')}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* The schedule-search aside is hidden in the simplified shell —
                    presentation only; the controller state is intact. See DESIGN.md. */}
            </div>
        </div>
    );
}
