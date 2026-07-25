import { describe, expect, it } from 'vitest';

import { buildCalendarDayItems, buildTimedCalendarLayouts } from './calendar-day-items';
import type { ExternalCalendarEvent, Task } from './index';

const task = (overrides: Partial<Task>): Task => ({
    id: 'task-1',
    title: 'Task',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-05-04T00:00:00.000Z',
    updatedAt: '2026-05-04T00:00:00.000Z',
    ...overrides,
});

const event = (overrides: Partial<ExternalCalendarEvent>): ExternalCalendarEvent => ({
    id: 'event-1',
    sourceId: 'work',
    title: 'Event',
    start: '2026-05-04T09:30:00',
    end: '2026-05-04T10:00:00',
    allDay: false,
    ...overrides,
});

describe('buildCalendarDayItems', () => {
    it('orders scheduled tasks, deadlines and events by start time', () => {
        const items = buildCalendarDayItems({
            deadlines: [task({ id: 'due', title: 'Due today', dueDate: '2026-05-04' })],
            events: [event({ id: 'standup', title: 'Standup', start: '2026-05-04T09:30:00' })],
            scheduled: [task({ id: 'timed', title: 'Timed', startTime: '2026-05-04T08:00:00' })],
        });

        // A date-only deadline lands at the end of its day, after the timed items.
        expect(items.map((item) => item.id)).toEqual([
            'scheduled-timed',
            'event-standup',
            'deadline-due',
        ]);
    });

    it('shows a task that is both scheduled and due only as its scheduled block', () => {
        const both = task({ id: 'both', title: 'Both', dueDate: '2026-05-04', startTime: '2026-05-04T08:00:00' });

        const items = buildCalendarDayItems({ deadlines: [both], events: [], scheduled: [both] });

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ id: 'scheduled-both', kind: 'scheduled' });
    });

    it('sorts undated items last and breaks ties by title', () => {
        const items = buildCalendarDayItems({
            deadlines: [],
            events: [],
            scheduled: [
                task({ id: 'zulu', title: 'Zulu', startTime: '2026-05-04T08:00:00' }),
                task({ id: 'alpha', title: 'Alpha', startTime: '2026-05-04T08:00:00' }),
                task({ id: 'undated', title: 'Undated' }),
            ],
        });

        expect(items.map((item) => item.id)).toEqual(['scheduled-alpha', 'scheduled-zulu', 'scheduled-undated']);
    });
});

describe('buildTimedCalendarLayouts', () => {
    it('gives each overlap cluster its own column count', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'morning', startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { id: 'afternoon', startMinutes: 14 * 60, endMinutes: 15 * 60 },
        ]);

        // A day-wide column count would squeeze both of these to 50%.
        expect(layouts.get('morning')).toMatchObject({ columnCount: 1, leftPercent: 0, widthPercent: 100 });
        expect(layouts.get('afternoon')).toMatchObject({ columnCount: 1, leftPercent: 0, widthPercent: 100 });
    });

    it('splits only the cluster that actually overlaps', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'solo', startMinutes: 8 * 60, endMinutes: 9 * 60 },
            { id: 'pair-a', startMinutes: 13 * 60, endMinutes: 14 * 60 },
            { id: 'pair-b', startMinutes: 13 * 60 + 30, endMinutes: 14 * 60 + 30 },
        ]);

        expect(layouts.get('solo')).toMatchObject({ columnCount: 1, widthPercent: 100 });
        expect(layouts.get('pair-a')).toMatchObject({ columnCount: 2, columnIndex: 0, leftPercent: 0 });
        expect(layouts.get('pair-b')).toMatchObject({ columnCount: 2, columnIndex: 1, leftPercent: 50 });
    });

    it('places same-slot timed items in separate columns', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'long-event', startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { id: 'short-event', startMinutes: 9 * 60, endMinutes: 9 * 60 + 15 },
        ]);

        const longEvent = layouts.get('long-event');
        const shortEvent = layouts.get('short-event');

        expect(longEvent?.columnCount).toBe(2);
        expect(shortEvent?.columnCount).toBe(2);
        expect(longEvent?.widthPercent).toBeCloseTo(50);
        expect(longEvent?.columnIndex).not.toBe(shortEvent?.columnIndex);
        expect(new Set([longEvent?.leftPercent, shortEvent?.leftPercent])).toEqual(new Set([0, 50]));
    });

    it('keeps back-to-back timed items full width', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'morning', startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { id: 'next', startMinutes: 10 * 60, endMinutes: 11 * 60 },
        ]);

        expect(layouts.get('morning')).toMatchObject({ columnCount: 1, columnIndex: 0, leftPercent: 0, widthPercent: 100 });
        expect(layouts.get('next')).toMatchObject({ columnCount: 1, columnIndex: 0, leftPercent: 0, widthPercent: 100 });
    });

    it('reuses a column inside a chained overlap group', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'a', startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { id: 'b', startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 30 },
            { id: 'c', startMinutes: 10 * 60, endMinutes: 11 * 60 },
        ]);

        expect(layouts.get('a')).toMatchObject({ columnCount: 2, columnIndex: 0 });
        expect(layouts.get('b')).toMatchObject({ columnCount: 2, columnIndex: 1 });
        expect(layouts.get('c')).toMatchObject({ columnCount: 2, columnIndex: 0 });
    });

    it('drops items without a usable range', () => {
        const layouts = buildTimedCalendarLayouts([
            { id: 'empty', startMinutes: 60, endMinutes: 60 },
            { id: 'nan', startMinutes: Number.NaN, endMinutes: 120 },
        ]);

        expect(layouts.size).toBe(0);
    });
});
