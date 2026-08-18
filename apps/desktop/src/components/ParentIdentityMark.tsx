import { cn } from '../lib/utils';

/**
 * Tiny Bubbles Parent — the identity mark.
 *
 * The kid app's mark is three hand-drawn bubbles drifting free (Sunlit
 * Rockpool). The parent mark holds the same three bubbles inside one calm
 * ring: the same water, watched over from the shore. The wordmark keeps
 * "Tiny Bubbles" as the product name and demotes "Parent" to a quiet
 * small-caps tag — it is a role, not part of the name.
 *
 * Inline SVG, no asset file, drawn entirely from the active theme's tokens so
 * it follows light, dark and every custom theme.
 */
export function ParentIdentityMark({ collapsed = false }: { collapsed?: boolean }) {
    const label = 'Tiny Bubbles Parent';
    return (
        <span
            className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'justify-center')}
            role="img"
            aria-label={label}
            title={label}
        >
            <svg
                viewBox="0 0 36 36"
                className={cn('shrink-0', collapsed ? 'h-8 w-8' : 'h-9 w-9')}
                aria-hidden="true"
            >
                {/* the watchful ring */}
                <circle
                    cx="18" cy="18" r="16"
                    fill="hsl(var(--primary) / 0.05)"
                    stroke="hsl(var(--primary) / 0.55)"
                    strokeWidth="1.4"
                />
                {/* the kid's three bubbles, settled inside */}
                <circle
                    cx="14.5" cy="20" r="6"
                    fill="hsl(var(--primary) / 0.16)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                />
                <circle
                    cx="23.5" cy="13.5" r="3.6"
                    fill="hsl(var(--focus-star) / 0.28)"
                    stroke="hsl(var(--focus-star-outline))"
                    strokeWidth="1.3"
                />
                <circle
                    cx="24.5" cy="23.5" r="2.5"
                    fill="hsl(var(--info) / 0.2)"
                    stroke="hsl(var(--info))"
                    strokeWidth="1.2"
                />
                {/* light catching the water */}
                <circle cx="12.4" cy="17.8" r="1.5" fill="hsl(0 0% 100% / 0.8)" />
                <circle cx="22.6" cy="12.4" r="0.9" fill="hsl(0 0% 100% / 0.8)" />
            </svg>
            {!collapsed && (
                <span className="flex min-w-0 flex-col leading-none">
                    <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                        Tiny Bubbles
                    </span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-primary">
                        Parent
                    </span>
                </span>
            )}
        </span>
    );
}
