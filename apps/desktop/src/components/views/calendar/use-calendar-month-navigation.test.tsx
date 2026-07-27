import { act, renderHook } from '@testing-library/react';
import { addDays, addWeeks, subDays, subWeeks } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dayKey } from './calendar-primitives';
import { useCalendarMonthNavigation, type CalendarMonthNavigationOptions } from './use-calendar-month-navigation';

const renderNavigation = (overrides: Partial<CalendarMonthNavigationOptions> = {}) => {
    const onNavigate = overrides.onNavigate ?? vi.fn();
    const view = renderHook(() => useCalendarMonthNavigation({
        calendarLocale: 'en-US',
        calendarSystem: 'gregorian',
        onNavigate,
        weekStartsOn: 0,
        ...overrides,
    }));
    return { ...view, onNavigate };
};

describe('useCalendarMonthNavigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 3, 3, 14, 48));
        window.history.replaceState(null, '', '/');
    });

    afterEach(() => {
        vi.useRealTimers();
        window.history.replaceState(null, '', '/');
    });

    it('restores the view mode and dates from the URL, defaulting a schedule view to today', () => {
        window.history.replaceState(null, '', '/?calendarView=schedule&calendarMonth=2026-04');

        const { result } = renderNavigation();

        expect(result.current.viewMode).toBe('schedule');
        expect(dayKey(result.current.selectedDate as Date)).toBe('2026-04-03');
        expect(dayKey(result.current.currentMonth)).toBe('2026-04-03');
    });

    it('leaves the month view unselected and writes the resolved view back to the URL', () => {
        const { result } = renderNavigation();

        expect(result.current.viewMode).toBe('month');
        expect(result.current.selectedDate).toBeNull();
        expect(window.location.search).toContain('calendarView=month');
        expect(window.location.search).toContain('calendarMonth=2026-04');
        expect(window.location.search).not.toContain('calendarDate=');
    });

    it('rejects a rolled-over date in the URL instead of silently landing on another day', () => {
        window.history.replaceState(null, '', '/?calendarView=day&calendarDate=2026-02-30');

        const { result } = renderNavigation();

        // Falls back to today, not to 2026-03-02.
        expect(dayKey(result.current.selectedDate as Date)).toBe('2026-04-03');
    });

    // Pinned against the pre-split arithmetic: each view mode steps by its own
    // unit, and only the modes that need a selected day keep one.
    const stepCases = [
        { mode: 'day', prev: subDays(new Date(2026, 3, 3), 1), next: addDays(new Date(2026, 3, 3), 1), keepsSelection: true },
        { mode: 'week', prev: subWeeks(new Date(2026, 3, 3), 1), next: addWeeks(new Date(2026, 3, 3), 1), keepsSelection: true },
        { mode: 'schedule', prev: subWeeks(new Date(2026, 3, 3), 2), next: addWeeks(new Date(2026, 3, 3), 2), keepsSelection: true },
        { mode: 'month', prev: new Date(2026, 2, 3), next: new Date(2026, 4, 3), keepsSelection: false },
    ] as const;

    for (const { mode, prev, next, keepsSelection } of stepCases) {
        it(`steps ${mode} view by its own unit and ${keepsSelection ? 'keeps' : 'drops'} the selected day`, () => {
            const { result, onNavigate } = renderNavigation();

            act(() => result.current.handleViewModeChange(mode));
            act(() => result.current.handlePrevMonth());

            expect(dayKey(result.current.currentMonth)).toBe(dayKey(prev));
            expect(result.current.selectedDate && dayKey(result.current.selectedDate)).toBe(
                keepsSelection ? dayKey(prev) : null
            );

            act(() => result.current.handleNextMonth());
            act(() => result.current.handleNextMonth());

            expect(dayKey(result.current.currentMonth)).toBe(dayKey(next));
            expect(onNavigate).toHaveBeenCalled();
        });
    }

    it('opens the day view for a date and reports the navigation', () => {
        const { result, onNavigate } = renderNavigation();

        act(() => result.current.openDayViewForDate(new Date(2026, 3, 9)));

        expect(result.current.viewMode).toBe('day');
        expect(dayKey(result.current.selectedDate as Date)).toBe('2026-04-09');
        expect(result.current.isMonthPickerOpen).toBe(false);
        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(window.location.search).toContain('calendarDate=2026-04-09');
    });

    it('selects a date without navigating away from the current month', () => {
        const { result, onNavigate } = renderNavigation();

        act(() => result.current.selectCalendarDate(new Date(2026, 3, 20)));

        expect(dayKey(result.current.selectedDate as Date)).toBe('2026-04-20');
        expect(dayKey(result.current.currentMonth)).toBe('2026-04-03');
        // Picking a day inside the visible month is not a navigation: it must
        // not wipe the selected-day panel's search or in-progress time edit.
        expect(onNavigate).not.toHaveBeenCalled();

        act(() => result.current.selectCalendarDate(new Date(2026, 4, 20)));
        expect(dayKey(result.current.currentMonth)).toBe('2026-05-20');
    });

    it('reveals a date the user just acted on, and closing the day resets the panel', () => {
        const { result, onNavigate } = renderNavigation();

        act(() => result.current.revealDate(new Date(2026, 3, 11)));
        expect(dayKey(result.current.selectedDate as Date)).toBe('2026-04-11');
        expect(dayKey(result.current.currentMonth)).toBe('2026-04-11');
        expect(onNavigate).not.toHaveBeenCalled();

        act(() => result.current.closeSelectedDay());
        expect(result.current.selectedDate).toBeNull();
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('builds a month grid padded to whole weeks and a seven-day timeline', () => {
        const { result } = renderNavigation();

        expect(result.current.days.length % 7).toBe(0);
        expect(dayKey(result.current.days[0])).toBe('2026-03-29');
        expect(result.current.weekdayHeaders).toHaveLength(7);
        expect(result.current.monthNames).toHaveLength(12);
        expect(result.current.yearOptions).toEqual([
            2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031,
        ]);

        act(() => result.current.handleViewModeChange('week'));
        expect(result.current.timelineDays).toHaveLength(7);
        expect(dayKey(result.current.timelineDays[0])).toBe('2026-03-29');

        act(() => result.current.handleViewModeChange('day'));
        expect(result.current.timelineDays).toHaveLength(1);
    });

    it('keeps the schedule view range at 61 days', () => {
        const { result } = renderNavigation();

        act(() => result.current.handleViewModeChange('schedule'));

        expect(result.current.scheduleDays).toHaveLength(61);
        expect(dayKey(result.current.scheduleDays[0])).toBe('2026-04-03');
    });

    it('changes month and year from the picker without keeping the old selection', () => {
        const { result, onNavigate } = renderNavigation();

        act(() => result.current.selectCalendarDate(new Date(2026, 3, 20)));
        act(() => result.current.handleMonthChange(6));

        expect(dayKey(result.current.currentMonth)).toBe('2026-07-03');
        expect(result.current.selectedDate).toBeNull();

        act(() => result.current.handleYearChange(2030));
        expect(dayKey(result.current.currentMonth)).toBe('2030-07-03');
        expect(onNavigate).toHaveBeenCalledTimes(2);
    });

    it('toggles the month picker and closes it on every navigation', () => {
        const { result } = renderNavigation();

        act(() => result.current.toggleMonthPicker());
        expect(result.current.isMonthPickerOpen).toBe(true);

        act(() => result.current.handleToday());
        expect(result.current.isMonthPickerOpen).toBe(false);
    });
});
