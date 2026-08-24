/**
 * Calm Corner inline SVG assets.
 *
 * The original assets were prepared in the kimi-workspace and are brought into
 * the app as inline SVGs so they inherit the app's CSS custom properties and
 * respect prefers-reduced-motion. Each icon uses its own gradient IDs so they
 * can render side by side without ID collisions.
 */

interface SvgProps {
    className?: string;
}

export function FeelingOverwhelmedIcon({ className }: SvgProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" className={className}>
            <defs>
                <radialGradient id="calm-storm-body" cx="40%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.95)" />
                    <stop offset="55%" stopColor="hsl(var(--primary) / 0.65)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.45)" />
                </radialGradient>
            </defs>
            <g fill="url(#calm-storm-body)" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinejoin="round">
                <circle cx="42" cy="56" r="20" />
                <circle cx="62" cy="44" r="24" />
                <circle cx="86" cy="56" r="20" />
                <rect x="42" y="56" width="44" height="22" rx="11" />
            </g>
            <path d="M58 82 L52 100 L64 96 L58 112 L72 90 L60 94 Z" fill="hsl(var(--foreground))" stroke="none" />
            <path d="M38 92 Q38 98 34 98 Q30 98 30 92 Q30 86 34 80 Q38 86 38 92 Z" fill="hsl(var(--primary) / 0.8)" />
            <path d="M92 90 Q92 96 88 96 Q84 96 84 90 Q84 84 88 78 Q92 84 92 90 Z" fill="hsl(var(--primary) / 0.8)" />
        </svg>
    );
}

export function FeelingFrustratedIcon({ className }: SvgProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" className={className}>
            <defs>
                <radialGradient id="calm-fist-body" cx="35%" cy="30%" r="85%">
                    <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.95)" />
                    <stop offset="60%" stopColor="hsl(var(--primary) / 0.7)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.5)" />
                </radialGradient>
            </defs>
            <g fill="url(#calm-fist-body)" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinejoin="round">
                <circle cx="44" cy="54" r="16" />
                <circle cx="64" cy="46" r="17" />
                <circle cx="84" cy="54" r="16" />
                <ellipse cx="54" cy="78" rx="22" ry="16" transform="rotate(-18 54 78)" />
                <path d="M40 64 Q60 58 88 64 L86 86 Q60 92 42 86 Z" />
            </g>
            <path d="M32 36 L44 42" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
            <path d="M88 42 L100 36" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export function FeelingWorriedIcon({ className }: SvgProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" className={className}>
            <defs>
                <radialGradient id="calm-rain-body" cx="40%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.95)" />
                    <stop offset="55%" stopColor="hsl(var(--primary) / 0.6)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.4)" />
                </radialGradient>
            </defs>
            <g fill="url(#calm-rain-body)" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinejoin="round">
                <circle cx="44" cy="58" r="20" />
                <circle cx="64" cy="46" r="24" />
                <circle cx="88" cy="58" r="20" />
                <rect x="44" y="58" width="44" height="22" rx="11" />
            </g>
            <path d="M38 92 Q38 100 34 100 Q30 100 30 92 Q30 84 34 76 Q38 84 38 92 Z" fill="hsl(var(--primary) / 0.85)" />
            <path d="M58 96 Q58 104 54 104 Q50 104 50 96 Q50 88 54 80 Q58 88 58 96 Z" fill="hsl(var(--primary) / 0.85)" />
            <path d="M78 92 Q78 100 74 100 Q70 100 70 92 Q70 84 74 76 Q78 84 78 92 Z" fill="hsl(var(--primary) / 0.85)" />
        </svg>
    );
}

export function FeelingTiredIcon({ className }: SvgProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" className={className}>
            <defs>
                <linearGradient id="calm-bed-frame" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.55)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.75)" />
                </linearGradient>
            </defs>
            <rect x="18" y="54" width="84" height="38" rx="14" fill="url(#calm-bed-frame)" stroke="hsl(var(--foreground))" strokeWidth="3" />
            <path
                d="M26 54 L26 34 Q26 26 34 26 L40 26 Q48 26 48 34 L48 54"
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <ellipse cx="72" cy="52" rx="22" ry="12" fill="hsl(var(--primary-foreground) / 0.9)" stroke="hsl(var(--foreground))" strokeWidth="3" />
            <path d="M42 72 Q60 66 90 72" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            <text x="90" y="38" fontSize="20" fontWeight="700" fill="hsl(var(--foreground))">z</text>
            <text x="100" y="28" fontSize="16" fontWeight="700" fill="hsl(var(--foreground))">z</text>
        </svg>
    );
}

export function FeelingUnknownIcon({ className }: SvgProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" className={className}>
            <defs>
                <radialGradient id="calm-question-body" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.95)" />
                    <stop offset="70%" stopColor="hsl(var(--primary) / 0.6)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.4)" />
                </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="48" fill="url(#calm-question-body)" stroke="hsl(var(--foreground))" strokeWidth="3" />
            <path
                d="M54 50 Q54 38 66 38 Q78 38 78 50 Q78 58 68 64 L68 76"
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="68" cy="88" r="5" fill="hsl(var(--foreground))" />
        </svg>
    );
}

interface BreathingBuddyProps {
    className?: string;
    reducedMotion?: boolean;
}

export function BreathingBuddy({ className, reducedMotion }: BreathingBuddyProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 200"
            role="img"
            aria-label="Breathing buddy — calm bubble"
            className={className}
        >
            <defs>
                <radialGradient id="calm-buddy-gradient" cx="40%" cy="30%" r="85%">
                    <stop offset="0%" stopColor="hsl(var(--primary-foreground) / 0.98)" />
                    <stop offset="55%" stopColor="hsl(var(--primary) / 0.65)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.45)" />
                </radialGradient>
            </defs>
            <g className={reducedMotion ? undefined : 'breathing-buddy__body'}>
                <ellipse className="breathing-buddy__arm breathing-buddy__arm--left" cx="34" cy="112" rx="16" ry="10" fill="hsl(var(--primary) / 0.55)" />
                <ellipse className="breathing-buddy__arm breathing-buddy__arm--right" cx="166" cy="112" rx="16" ry="10" fill="hsl(var(--primary) / 0.55)" />
                <circle cx="100" cy="100" r="76" fill="url(#calm-buddy-gradient)" stroke="hsl(var(--primary))" strokeWidth="3" />
                <ellipse cx="72" cy="60" rx="22" ry="12" fill="hsl(var(--primary-foreground) / 0.75)" transform="rotate(-22 72 60)" />
                <circle cx="144" cy="146" r="5.5" fill="hsl(var(--primary-foreground) / 0.5)" />
                <g className="breathing-buddy__face">
                    <path d="M68 94 Q78 102 88 94" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <path d="M112 94 Q122 102 132 94" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                    <path d="M88 122 Q100 130 112 122" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />
                </g>
            </g>
            <g className="breathing-buddy__ripples">
                <circle
                    cx="100"
                    cy="100"
                    r="76"
                    fill="none"
                    stroke="hsl(var(--primary) / 0.35)"
                    strokeWidth="3"
                    className={reducedMotion ? undefined : 'breathing-buddy__ripple breathing-buddy__ripple--1'}
                />
                <circle
                    cx="100"
                    cy="100"
                    r="76"
                    fill="none"
                    stroke="hsl(var(--primary) / 0.25)"
                    strokeWidth="3"
                    className={reducedMotion ? undefined : 'breathing-buddy__ripple breathing-buddy__ripple--2'}
                />
            </g>
        </svg>
    );
}
