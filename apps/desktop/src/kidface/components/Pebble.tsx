/**
 * Pebble — the kid-face bubble buddy.
 *
 * A friendly mascot for empty states and quiet moments. Rendered as an inline
 * SVG so it inherits the app's theme tokens and respects prefers-reduced-motion
 * via the existing kid-face media query.
 *
 * The visual vocabulary mirrors the design-kit mascot ("Bubbo") but uses the
 * Sunlit Rockpool token set so it stays a sibling to the rest of the face.
 */

export type PebbleState = 'idle' | 'happy' | 'celebrate' | 'wave' | 'sleep' | 'think';

interface PebbleProps {
    state?: PebbleState;
    size?: number;
    className?: string;
}

export function Pebble({ state = 'idle', size = 200, className }: PebbleProps) {
    const label = `Pebble the bubble buddy, ${state}`;

    return (
        <div
            className={`pebble pebble--${state} ${className ?? ''}`.trim()}
            style={{ '--pebble-size': `${size}px` } as React.CSSProperties}
            role="img"
            aria-label={label}
        >
            <svg viewBox="0 0 200 200" className="pebble__svg">
                <defs>
                    <radialGradient id="pebble-body-gradient" cx="35%" cy="30%" r="85%">
                        <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.98)" />
                        <stop offset="55%" stopColor="hsl(var(--primary) / 0.75)" />
                        <stop offset="100%" stopColor="hsl(var(--primary) / 0.55)" />
                    </radialGradient>
                </defs>

                <g className="pebble__body">
                    <ellipse className="pebble__arm pebble__arm--left" cx="28" cy="118" rx="17" ry="11" />
                    <ellipse className="pebble__arm pebble__arm--right" cx="172" cy="118" rx="17" ry="11" />
                    <circle cx="100" cy="100" r="78" fill="url(#pebble-body-gradient)" stroke="hsl(var(--primary))" strokeWidth="3" />
                    <ellipse cx="70" cy="56" rx="22" ry="11" fill="hsl(var(--primary-foreground) / 0.8)" transform="rotate(-24 70 56)" />
                    <circle cx="140" cy="148" r="6" fill="hsl(var(--primary-foreground) / 0.55)" />
                </g>

                <g className="pebble__face pebble__face--idle">
                    <g className="pebble__eyes-open">
                        <circle cx="76" cy="92" r="9.5" fill="hsl(var(--foreground))" />
                        <circle cx="124" cy="92" r="9.5" fill="hsl(var(--foreground))" />
                        <circle cx="79.5" cy="88.5" r="3.2" fill="hsl(var(--background))" />
                        <circle cx="127.5" cy="88.5" r="3.2" fill="hsl(var(--background))" />
                    </g>
                    <path d="M82 122 Q100 137 118 122" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                </g>

                <g className="pebble__face pebble__face--happy">
                    <path d="M65 92 Q76 80 87 92" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <path d="M113 92 Q124 80 135 92" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <path d="M78 116 Q100 146 122 116 Q100 128 78 116" fill="hsl(var(--foreground))" />
                    <ellipse cx="58" cy="110" rx="9" ry="6" fill="hsl(var(--primary) / 0.35)" opacity="0.75" />
                    <ellipse cx="142" cy="110" rx="9" ry="6" fill="hsl(var(--primary) / 0.35)" opacity="0.75" />
                </g>

                <g className="pebble__face pebble__face--sleep">
                    <path d="M66 92 Q76 99 86 92" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <path d="M114 92 Q124 99 134 92" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="100" cy="124" r="6.5" fill="none" stroke="hsl(var(--foreground))" strokeWidth="4.5" />
                </g>

                <g className="pebble__face pebble__face--think">
                    <g className="pebble__eyes-open">
                        <circle cx="76" cy="88" r="9.5" fill="hsl(var(--foreground))" />
                        <circle cx="124" cy="88" r="9.5" fill="hsl(var(--foreground))" />
                        <circle cx="79.5" cy="84.5" r="3.2" fill="hsl(var(--background))" />
                        <circle cx="127.5" cy="84.5" r="3.2" fill="hsl(var(--background))" />
                    </g>
                    <path d="M90 126 Q100 121 110 126" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                </g>

                <g className="pebble__zzz">
                    <text x="150" y="56" fontSize="26">Z</text>
                    <text x="164" y="44">Z</text>
                    <text x="176" y="32">z</text>
                </g>

                <g className="pebble__thought">
                    <circle cx="160" cy="64" r="6" />
                    <circle cx="173" cy="46" r="8" />
                    <circle cx="186" cy="26" r="10" />
                </g>
            </svg>
        </div>
    );
}
