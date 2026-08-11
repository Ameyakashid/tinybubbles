export type AppAnnouncementAction =
    | {
        type: 'url';
        label: string;
        url: string;
    }
    | {
        type: 'feedback';
        label: string;
    };

export type AppAnnouncement = {
    id: string;
    title: string;
    body: string;
    dismissLabel?: string;
    action?: AppAnnouncementAction;
};

export const APP_ANNOUNCEMENT_DISMISSED_VALUE = 'dismissed';

// Tiny Bubbles does not solicit donations and runs no funding accounts. This announcement
// is kept because the announcement plumbing is generic and other messages may reuse it, but
// it points at the project itself rather than asking anyone for money. It is inactive
// unless ACTIVE_APP_ANNOUNCEMENT below is set.
export const DONATION_PROMPT_ANNOUNCEMENT: AppAnnouncement = {
    id: 'support-tinybubbles-one-time-v1',
    title: 'Tiny Bubbles is free and open source',
    body: 'Tiny Bubbles has no ads, no tracking, and no paywalls, and it never asks you for money. If it helps you, the most useful thing you can do is report a bug, improve a translation, or contribute a fix.',
    dismissLabel: 'Maybe later',
    action: {
        type: 'url',
        label: 'Visit the project',
        url: 'https://github.com/tinybubbles-app/tinybubbles',
    },
};

// Maintainers can replace null with one active announcement for a specific release.
export const ACTIVE_APP_ANNOUNCEMENT: AppAnnouncement | null = null;

export function getAnnouncementDismissalStorageKey(id: string): string {
    return `tinybubbles:announcement-dismissed:${id.trim()}`;
}

export function shouldShowAppAnnouncement(
    announcement: AppAnnouncement | null | undefined,
    dismissedValue: string | null | undefined,
): announcement is AppAnnouncement {
    if (!announcement) return false;
    if (!announcement.id.trim() || !announcement.title.trim() || !announcement.body.trim()) return false;
    return dismissedValue !== APP_ANNOUNCEMENT_DISMISSED_VALUE;
}
