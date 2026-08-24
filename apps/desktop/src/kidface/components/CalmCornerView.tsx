/**
 * Calm Corner — slice 1.
 *
 * A quiet room a child can enter when they feel overwhelmed, frustrated, worried,
 * tired, or simply do not know how they feel. It offers a picture-first feeling
 * grid and a breathing buddy with a 4-second-in / 6-second-out cycle. Nothing is
 * logged, nothing is scored, and nothing auto-appears.
 *
 * Reduced-motion fallback: the buddy stops animating and the child taps it to
 * advance a "Breathe in" / "Breathe out" cue.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import {
    BreathingBuddy,
    FeelingFrustratedIcon,
    FeelingOverwhelmedIcon,
    FeelingTiredIcon,
    FeelingUnknownIcon,
    FeelingWorriedIcon,
} from './CalmCornerAssets';

export interface CalmCornerViewProps {
    onClose: () => void;
}

type Feeling = 'overwhelmed' | 'frustrated' | 'worried' | 'tired' | 'unknown';

interface FeelingOption {
    key: Feeling;
    icon: ReactNode;
}

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, []);

    return reduced;
}

function pulseHaptic() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate(12);
        } catch {
            // ignore unsupported haptics
        }
    }
}

export function CalmCornerView({ onClose }: CalmCornerViewProps) {
    const { t, language } = useLanguage();
    const [selectedFeeling, setSelectedFeeling] = useState<Feeling | null>(null);
    const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale');
    const reducedMotion = usePrefersReducedMotion();

    const title = displayLabel(t, language, 'calmCorner.title', 'Calm Corner');
    const hint = displayLabel(t, language, 'calmCorner.hint', 'Pick the one that feels closest.');
    const breatheIn = displayLabel(t, language, 'calmCorner.breatheIn', 'Breathe in');
    const breatheOut = displayLabel(t, language, 'calmCorner.breatheOut', 'Breathe out');
    const ready = displayLabel(t, language, 'calmCorner.ready', "I'm ready");
    const overwhelmed = displayLabel(t, language, 'calmCorner.feelingOverwhelmed', 'Overwhelmed');
    const frustrated = displayLabel(t, language, 'calmCorner.feelingFrustrated', 'Frustrated');
    const worried = displayLabel(t, language, 'calmCorner.feelingWorried', 'Worried');
    const tired = displayLabel(t, language, 'calmCorner.feelingTired', 'Tired');
    const unknown = displayLabel(t, language, 'calmCorner.feelingUnknown', "I don't know");

    const feelingOptions: FeelingOption[] = [
        { key: 'overwhelmed', icon: <FeelingOverwhelmedIcon className="size-24" /> },
        { key: 'frustrated', icon: <FeelingFrustratedIcon className="size-24" /> },
        { key: 'worried', icon: <FeelingWorriedIcon className="size-24" /> },
        { key: 'tired', icon: <FeelingTiredIcon className="size-24" /> },
        { key: 'unknown', icon: <FeelingUnknownIcon className="size-24" /> },
    ];

    const labelForFeeling = (key: Feeling): string => {
        switch (key) {
            case 'overwhelmed': return overwhelmed;
            case 'frustrated': return frustrated;
            case 'worried': return worried;
            case 'tired': return tired;
            case 'unknown': return unknown;
        }
    };

    const handleSelectFeeling = useCallback((key: Feeling) => {
        pulseHaptic();
        setSelectedFeeling(key);
    }, []);

    const toggleBreath = useCallback(() => {
        if (!reducedMotion) return;
        pulseHaptic();
        setPhase((prev) => (prev === 'inhale' ? 'exhale' : 'inhale'));
    }, [reducedMotion]);



    return (
        <div
            className="absolute inset-0 z-20 flex flex-col bg-background kidface-room-enter-right"
            role="region"
            aria-label={title}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="kidface-drift-slow absolute -left-8 top-[12%] size-40 rounded-full bg-primary/5 blur-2xl" />
                <div className="kidface-drift absolute right-[5%] bottom-[15%] size-48 rounded-full bg-success/5 blur-3xl" />
            </div>

            <header className="relative z-10 flex items-center justify-between px-5 pt-6">
                <div className="flex items-center gap-3">
                    <Wind className="size-8 text-primary" strokeWidth={2.5} aria-hidden="true" />
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex min-h-22 items-center rounded-full bg-card px-6 text-base font-bold text-foreground shadow-sm active:scale-[0.99]"
                >
                    {ready}
                </button>
            </header>

            <main className="relative z-10 flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-8 pt-4">
                {selectedFeeling == null ? (
                    <>
                        <p className="text-lg text-muted-foreground">{hint}</p>
                        <ul
                            className="grid grid-cols-2 gap-4"
                            role="radiogroup"
                            aria-label={hint}
                        >
                            {feelingOptions.map((option) => (
                                <li key={option.key}>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={selectedFeeling === option.key}
                                        onClick={() => handleSelectFeeling(option.key)}
                                        className={cn(
                                            'flex w-full flex-col items-center gap-2 rounded-3xl border-2 bg-card p-4 shadow-sm',
                                            'transition-colors active:scale-[0.99]',
                                            'min-h-[140px]',
                                            selectedFeeling === option.key
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border hover:border-primary/50',
                                        )}
                                    >
                                        {option.icon}
                                        <span className="text-base font-bold text-foreground">
                                            {labelForFeeling(option.key)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                        <button
                            type="button"
                            onClick={toggleBreath}
                            disabled={!reducedMotion}
                            aria-label={reducedMotion ? (phase === 'inhale' ? breatheIn : breatheOut) : undefined}
                            className={cn(
                                'relative flex size-64 items-center justify-center rounded-full transition-transform',
                                reducedMotion && 'active:scale-95',
                            )}
                        >
                            <BreathingBuddy className="size-full" reducedMotion={reducedMotion} />
                        </button>
                        {reducedMotion ? (
                            <p className="text-2xl font-bold text-foreground" aria-live="polite">
                                {phase === 'inhale' ? breatheIn : breatheOut}
                            </p>
                        ) : (
                            <p className="text-lg text-muted-foreground">
                                {displayLabel(t, language, 'calmCorner.breatheWithMe', 'Breathe with the bubble.')}
                            </p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
