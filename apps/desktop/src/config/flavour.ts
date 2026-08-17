/**
 * Build flavour. One codebase ships two apps:
 *
 * - default        — Tiny Bubbles, the full app (and, on the kids/shell
 *                    branch, the simplified kid surface built on it)
 * - parent         — Tiny Bubbles Parent, the admin app a parent runs against
 *                    the same self-hosted sync namespace as their child's
 *                    device. Identical engine; adds the Family dashboard and
 *                    a "Parent" identity, changes nothing below the paint.
 *
 * Selected at build/dev time: VITE_TINYBUBBLES_FLAVOUR=parent.
 */

export const isParentFlavour: boolean = import.meta.env.VITE_TINYBUBBLES_FLAVOUR === 'parent';

/** App display name for the current flavour, from the translated base name. */
export const flavourAppName = (baseName: string): string => (
    isParentFlavour ? `${baseName} Parent` : baseName
);

/** A parent opens the app to see how their child is doing, not their own agenda. */
export const FLAVOUR_DEFAULT_VIEW: string = isParentFlavour ? 'familyDashboard' : 'agenda';
