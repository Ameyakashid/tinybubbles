import { expect } from 'vitest';
import { LIST_END_GAP } from '../components/views/list/list-toolbar';

const classList = (element: Element) => element.className.split(/\s+/).filter(Boolean);

/**
 * #977: the gap below a list's last row belongs to the scrolled content. Put it
 * on the scroll viewport (or on a wrapper that sizes it) and it turns into a
 * dead band the list can never reach — which is how half the desktop views
 * stopped short of the window edge while the other half ran straight into it.
 *
 * jsdom cannot measure layout, so this is a class tripwire: the shared end gap
 * has to be present as content, and the viewport around it has to stay free of
 * bottom padding.
 */
export const expectScrolledEndGap = (container: HTMLElement) => {
    const gaps = Array.from(container.querySelectorAll('[data-list-end]'));
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
        expect(classList(gap)).toContain(LIST_END_GAP);
    }

    for (const viewport of container.querySelectorAll('[class*="overflow-y-auto"]')) {
        if (!viewport.querySelector('[data-list-end]')) continue;
        expect(classList(viewport).filter((name) => name.startsWith('pb-'))).toEqual([]);
    }
};
