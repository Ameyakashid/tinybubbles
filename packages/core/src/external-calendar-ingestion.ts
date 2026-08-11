import type {
    ExternalCalendarEvent,
    ExternalCalendarSubscription,
} from './ics';

const TINYBUBBLES_PUSHED_EVENT_PREFIX = 'tinybubbles: ';
const TINYBUBBLES_MIRROR_CALENDAR_NAMES = new Set([
    'tinybubbles',
    'tinybubbles calendar',
    'tinybubblescal',
]);

export type ExternalCalendarSourceResult = {
    calendars: ExternalCalendarSubscription[];
    events: ExternalCalendarEvent[];
};

export function isTinyBubblesMirrorCalendar(
    calendar: Pick<ExternalCalendarSubscription, 'name'>,
): boolean {
    return TINYBUBBLES_MIRROR_CALENDAR_NAMES.has(
        calendar.name.trim().toLowerCase().replace(/\s+/g, ' '),
    );
}

export function isTinyBubblesMirrorEvent(
    event: Pick<ExternalCalendarEvent, 'sourceId' | 'title'>,
    calendarById: ReadonlyMap<string, ExternalCalendarSubscription>,
): boolean {
    const calendar = calendarById.get(event.sourceId);
    if (calendar && isTinyBubblesMirrorCalendar(calendar)) return true;
    return event.title.trim().toLowerCase().startsWith(
        TINYBUBBLES_PUSHED_EVENT_PREFIX,
    );
}

export function mergeExternalCalendarSources(
    sources: readonly ExternalCalendarSourceResult[],
): ExternalCalendarSourceResult {
    const calendarById = new Map<string, ExternalCalendarSubscription>();
    for (const source of sources) {
        for (const calendar of source.calendars) {
            calendarById.set(calendar.id, calendar);
        }
    }

    const eventByKey = new Map<string, ExternalCalendarEvent>();
    for (const source of sources) {
        for (const event of source.events) {
            if (isTinyBubblesMirrorEvent(event, calendarById)) continue;
            eventByKey.set(
                `${event.sourceId}:${event.id}:${event.start}:${event.end}`,
                event,
            );
        }
    }

    const events = Array.from(eventByKey.values());
    events.sort((left, right) => {
        if (left.start === right.start) {
            return left.title.localeCompare(right.title);
        }
        return left.start.localeCompare(right.start);
    });

    return {
        calendars: Array.from(calendarById.values()).filter(
            (calendar) => !isTinyBubblesMirrorCalendar(calendar),
        ),
        events,
    };
}
