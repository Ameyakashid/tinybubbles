import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Move,
    Orbit,
    Plus,
    RotateCcw,
    Sparkles,
    Sun,
    Trophy,
    Wind,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BubbleCheckbox } from './BubbleCheckbox';
import { useCelebration } from './CelebrationContext';

const BREATHE_MS = 5000;
const TRANSITION_MS = 350;

function TriggerButton({
    label,
    onClick,
    icon,
}: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-14 items-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition-transform active:scale-90"
        >
            {icon}
            {label}
        </button>
    );
}

function PlaygroundCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {children}
        </div>
    );
}

function Stage({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                'relative flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-secondary/50',
                className,
            )}
        >
            {children}
        </div>
    );
}

function useRetrigger() {
    const [key, setKey] = useState(0);
    const trigger = useCallback(() => setKey((prev) => prev + 1), []);
    return { key, trigger };
}

export function MotionPlayground() {
    const celebrate = useCelebration();
    const heroRef = useRef<HTMLButtonElement>(null);

    const pop = useRetrigger();
    const elastic = useRetrigger();
    const shake = useRetrigger();
    const squish = useRetrigger();
    const jelly = useRetrigger();
    const flip = useRetrigger();
    const leftEnter = useRetrigger();
    const rightEnter = useRetrigger();
    const trophy = useRetrigger();
    const morph = useRetrigger();
    const pendulum = useRetrigger();
    const pulse = useRetrigger();

    const [breathing, setBreathing] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [orbit, setOrbit] = useState(false);
    const [stagger, setStagger] = useState(false);
    const [heroDone, setHeroDone] = useState(false);

    const stageClass = reducedMotion ? 'motion-reduce' : undefined;

    useEffect(() => {
        if (!stagger) return undefined;
        const id = window.setTimeout(() => setStagger(false), 1200);
        return () => window.clearTimeout(id);
    }, [stagger]);

    const particles = useMemo(
        () =>
            Array.from({ length: 6 }, (_, index) => ({
                id: index,
                angle: 60 * index,
                delay: index * 80,
            })),
        [],
    );

    const handleHeroCelebrate = () => {
        setHeroDone(true);
        const rect = heroRef.current?.getBoundingClientRect();
        const origin = rect
            ? {
                  x: (rect.left + rect.width / 2) / window.innerWidth,
                  y: (rect.top + rect.height / 2) / window.innerHeight,
              }
            : undefined;
        celebrate(origin);
        window.setTimeout(() => setHeroDone(false), 1200);
    };

    return (
        <div className={cn('flex h-full flex-col gap-6 overflow-y-auto px-5 pb-8 pt-6', stageClass)}>
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Motion playground</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Go nuts, safely</h1>
                <p className="text-lg text-muted-foreground">
                    A dev sandbox for kid-face motion. Reach it with{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm">?face=next&room=playground</code>.
                </p>
            </header>

            <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <button
                    type="button"
                    onClick={() => setReducedMotion((prev) => !prev)}
                    className={cn(
                        'flex size-14 items-center justify-center rounded-full border-2 transition-colors',
                        reducedMotion
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground',
                    )}
                    aria-pressed={reducedMotion}
                    aria-label="Toggle reduced motion preview"
                >
                    <Wind className="size-7" strokeWidth={2.5} />
                </button>
                <div className="flex flex-col">
                    <span className="text-base font-bold text-foreground">Reduced-motion preview</span>
                    <span className="text-sm text-muted-foreground">
                        {reducedMotion ? 'Motion is suppressed in this sandbox.' : 'Motion is playing normally.'}
                    </span>
                </div>
            </div>

            <section className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2">
                <PlaygroundCard title="Hero celebration">
                    <Stage>
                        <button
                            ref={heroRef}
                            type="button"
                            onClick={handleHeroCelebrate}
                            className={cn(
                                'relative flex size-28 items-center justify-center rounded-full border-4 border-success bg-success text-success-foreground shadow-lg transition-transform active:scale-90',
                                heroDone && 'kidface-celebrate',
                            )}
                        >
                            {heroDone ? (
                                <Check className="size-14" strokeWidth={3} />
                            ) : (
                                <Sun className="size-14" strokeWidth={2.5} />
                            )}
                            {!reducedMotion &&
                                particles.map((particle) => (
                                    <span
                                        key={particle.id}
                                        className={cn(
                                            'kidface-sparkle size-2 rounded-full bg-focus-star',
                                            `kidface-sparkle-${particle.id}`,
                                            !heroDone && 'opacity-0',
                                        )}
                                        style={{ animationDelay: `${particle.delay}ms` }}
                                    />
                                ))}
                        </button>
                    </Stage>
                    <p className="text-sm text-muted-foreground">Tap the sun. Confetti, sparkles, and a pop.</p>
                </PlaygroundCard>

                <PlaygroundCard title="Button pops">
                    <Stage className="gap-6">
                        <div key={pop.key} className="kidface-pop">
                            <TriggerButton label="Pop" onClick={pop.trigger} icon={<Plus className="size-5" />} />
                        </div>
                        <div key={elastic.key} className="kidface-elastic-pop">
                            <TriggerButton
                                label="Elastic pop"
                                onClick={elastic.trigger}
                                icon={<Zap className="size-5" />}
                            />
                        </div>
                    </Stage>
                    <p className="text-sm text-muted-foreground">Press feedback scaled for small hands.</p>
                </PlaygroundCard>

                <PlaygroundCard title="Reaction motions">
                    <Stage className="gap-8">
                        <div key={shake.key} className="kidface-shake">
                            <TriggerButton label="Shake no" onClick={shake.trigger} />
                        </div>
                        <div key={squish.key} className="kidface-squish">
                            <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                                <Move className="size-8" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div key={jelly.key} className="kidface-jelly">
                            <div className="flex size-20 items-center justify-center rounded-2xl bg-info text-info-foreground">
                                <RotateCcw className="size-8" strokeWidth={2.5} />
                            </div>
                        </div>
                    </Stage>
                    <p className="text-sm text-muted-foreground">Non-verbal feedback: no, squish, jelly.</p>
                </PlaygroundCard>

                <PlaygroundCard title="Room transitions">
                    <Stage>
                        <div
                            key={rightEnter.key}
                            className={cn(
                                'flex size-32 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md',
                                rightEnter.key > 0 && 'kidface-room-enter-right',
                            )}
                            style={{ animationDuration: `${TRANSITION_MS}ms` }}
                        >
                            <ArrowRight className="size-10" strokeWidth={2.5} />
                        </div>
                        <div
                            key={leftEnter.key}
                            className={cn(
                                'flex size-32 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-md',
                                leftEnter.key > 0 && 'kidface-room-enter-left',
                            )}
                            style={{ animationDuration: `${TRANSITION_MS}ms` }}
                        >
                            <ArrowLeft className="size-10" strokeWidth={2.5} />
                        </div>
                    </Stage>
                    <div className="flex flex-wrap gap-2">
                        <TriggerButton label="Enter right" onClick={rightEnter.trigger} />
                        <TriggerButton label="Enter left" onClick={leftEnter.trigger} />
                    </div>
                </PlaygroundCard>

                <PlaygroundCard title="Trophy shine">
                    <Stage>
                        <div
                            key={trophy.key}
                            className="relative flex size-28 items-center justify-center overflow-hidden rounded-full bg-success/10"
                        >
                            <Trophy className="relative z-10 size-14 text-success kidface-float" />
                            <span
                                className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-transparent via-success-foreground/30 to-transparent kidface-trophy-shine"
                                aria-hidden="true"
                            />
                        </div>
                    </Stage>
                    <TriggerButton label="Replay shine" onClick={trophy.trigger} icon={<Sparkles className="size-5" />} />
                </PlaygroundCard>

                <PlaygroundCard title="Breathing buddy">
                    <Stage>
                        <div
                            className={cn(
                                'relative flex size-32 items-center justify-center rounded-full bg-primary/20 text-primary',
                                breathing && !reducedMotion && 'kidface-breathe',
                            )}
                        >
                            <span className="absolute inset-0 rounded-full bg-primary/10" />
                            <Wind className="relative z-10 size-14" strokeWidth={2} />
                        </div>
                    </Stage>
                    <div className="flex flex-wrap items-center gap-3">
                        <TriggerButton
                            label={breathing ? 'Pause breath' : 'Resume breath'}
                            onClick={() => setBreathing((prev) => !prev)}
                        />
                        <span className="text-sm text-muted-foreground">{BREATHE_MS / 1000}s cadence</span>
                    </div>
                </PlaygroundCard>

                <PlaygroundCard title="Ambient field">
                    <Stage>
                        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                            <div className="kidface-drift absolute -left-4 top-[10%] size-16 rounded-full bg-primary/20 blur-xl" />
                            <div className="kidface-drift-slow absolute bottom-[15%] right-[10%] size-20 rounded-full bg-success/20 blur-xl" />
                            <div className="kidface-drift-medium absolute left-[40%] top-[5%] size-14 rounded-full bg-info/20 blur-xl" />
                        </div>
                        <span className="relative z-10 text-sm font-medium text-muted-foreground">Background drift</span>
                    </Stage>
                    <p className="text-sm text-muted-foreground">Slow, non-competing motion for empty states.</p>
                </PlaygroundCard>

                <PlaygroundCard title="Morph & orbit">
                    <Stage>
                        <div className="relative flex size-32 items-center justify-center">
                            <div
                                key={morph.key}
                                className={cn(
                                    'absolute inset-0 bg-gradient-to-br from-primary/40 to-success/40',
                                    morph.key > 0 && 'kidface-morph',
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => setOrbit((prev) => !prev)}
                                className="relative z-10 flex size-14 items-center justify-center rounded-full bg-card shadow-md transition-transform active:scale-90"
                            >
                                <Orbit className="size-7 text-foreground" strokeWidth={2.5} />
                            </button>
                            {orbit && (
                                <>
                                    <span
                                        className="kidface-orbit absolute left-1/2 top-1/2 size-4 rounded-full bg-focus-star"
                                        style={{ '--orbit-radius': '48px', '--orbit-duration': '2.5s' } as React.CSSProperties}
                                    />
                                    <span
                                        className="kidface-orbit absolute left-1/2 top-1/2 size-3 rounded-full bg-info"
                                        style={{ '--orbit-radius': '48px', '--orbit-duration': '3.5s' } as React.CSSProperties}
                                    />
                                </>
                            )}
                        </div>
                    </Stage>
                    <div className="flex flex-wrap gap-2">
                        <TriggerButton label="Morph shape" onClick={morph.trigger} />
                        <TriggerButton label="Toggle orbit" onClick={() => setOrbit((prev) => !prev)} />
                    </div>
                </PlaygroundCard>

                <PlaygroundCard title="Pendulum & flip">
                    <Stage>
                        <div key={pendulum.key} className="kidface-pendulum">
                            <div className="flex size-16 items-center justify-center rounded-2xl bg-warning text-warning-foreground shadow-md">
                                <Move className="size-8" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div
                            key={flip.key}
                            className={cn(
                                'flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md',
                                flip.key > 0 && 'kidface-flip',
                            )}
                        >
                            <ArrowRight className="size-8" strokeWidth={2.5} />
                        </div>
                    </Stage>
                    <div className="flex flex-wrap gap-2">
                        <TriggerButton label="Pendulum" onClick={pendulum.trigger} />
                        <TriggerButton label="Flip" onClick={flip.trigger} />
                    </div>
                </PlaygroundCard>

                <PlaygroundCard title="Pulse rings">
                    <Stage>
                        <button
                            type="button"
                            onClick={pulse.trigger}
                            className="relative flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-90"
                        >
                            <Zap className="size-8" strokeWidth={2.5} />
                            {Array.from({ length: 3 }).map((_, index) => (
                                <span
                                    key={`${pulse.key}-${index}`}
                                    className="pointer-events-none absolute left-1/2 top-1/2 size-20 rounded-full border-2 border-primary/60 kidface-pulse-ring"
                                    style={{ animationDelay: `${index * 200}ms` }}
                                    aria-hidden="true"
                                />
                            ))}
                        </button>
                    </Stage>
                    <p className="text-sm text-muted-foreground">Ripple callouts that do not demand a tap.</p>
                </PlaygroundCard>

                <PlaygroundCard title="List stagger">
                    <Stage className="px-4">
                        <ul className="flex w-full flex-col gap-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <li
                                    key={index}
                                    className={cn(
                                        'rounded-xl bg-card p-3 text-center text-sm font-semibold text-foreground shadow-sm',
                                        stagger && 'kidface-slide-up',
                                    )}
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    Row {index + 1}
                                </li>
                            ))}
                        </ul>
                    </Stage>
                    <TriggerButton label="Replay stagger" onClick={() => setStagger(true)} />
                </PlaygroundCard>

                <PlaygroundCard title="Bubble checkbox">
                    <Stage>
                        <BubbleCheckbox
                            checked={heroDone}
                            onChange={handleHeroCelebrate}
                            label="Toggle celebration checkbox"
                            celebrating={heroDone}
                        />
                    </Stage>
                    <p className="text-sm text-muted-foreground">The production complete control, isolated.</p>
                </PlaygroundCard>
            </section>
        </div>
    );
}
