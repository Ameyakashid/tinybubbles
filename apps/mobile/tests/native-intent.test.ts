import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from '@/app/+native-intent';

describe('redirectSystemPath', () => {
    it('rewrites host-form open-feature links to the destination route', () => {
        expect(redirectSystemPath({ path: 'tinybubbles://open-feature?feature=inbox', initial: true })).toBe('/inbox');
        expect(redirectSystemPath({ path: 'tinybubbles://open-feature?feature=projects', initial: false })).toBe('/projects');
        expect(redirectSystemPath({ path: 'tinybubbles://open-feature?feature=review', initial: false })).toBe('/review-tab');
    });

    it('rewrites path-form open-feature links to the destination route', () => {
        expect(redirectSystemPath({ path: 'tinybubbles:///open-feature?feature=focus', initial: true })).toBe('/focus');
        expect(redirectSystemPath({ path: 'tinybubbles:///open-feature?feature=calendar', initial: false })).toBe('/calendar');
    });

    it('falls back to inbox for unknown or missing features', () => {
        expect(redirectSystemPath({ path: 'tinybubbles://open-feature?feature=nonsense', initial: false })).toBe('/inbox');
        expect(redirectSystemPath({ path: 'tinybubbles://open-feature', initial: false })).toBe('/inbox');
    });

    it('rewrites entity-open links to inbox so there is no Unmatched Route flash (#1017)', () => {
        expect(redirectSystemPath({ path: 'tinybubbles://open?task=abc-123', initial: true })).toBe('/inbox');
        expect(redirectSystemPath({ path: 'tinybubbles:///open?project=proj-1', initial: false })).toBe('/inbox');
        expect(redirectSystemPath({ path: 'tinybubbles://open?area=area-1', initial: false })).toBe('/inbox');
    });

    it('leaves capture and unrelated links untouched', () => {
        expect(redirectSystemPath({ path: 'tinybubbles://capture?title=Buy%20milk', initial: false }))
            .toBe('tinybubbles://capture?title=Buy%20milk');
        expect(redirectSystemPath({ path: '/inbox', initial: true })).toBe('/inbox');
        expect(redirectSystemPath({ path: 'not a url', initial: false })).toBe('not a url');
    });
});
