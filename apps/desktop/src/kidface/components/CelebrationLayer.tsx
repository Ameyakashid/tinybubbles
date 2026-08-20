import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CelebrationLayerProps {
    x: number;
    y: number;
}

const PARTICLE_COUNT = 20;
const GRAVITY_PX = 90;

const CONFETTI_COLORS = [
    '#facc15', // yellow-400
    '#fb923c', // orange-400
    '#f87171', // red-400
    '#60a5fa', // blue-400
    '#a78bfa', // violet-400
    '#34d399', // emerald-400
    '#f472b6', // pink-400
];

interface Particle {
    id: number;
    tx: number;
    ty: number;
    size: number;
    color: string;
    delay: number;
    duration: number;
    rotation: number;
}

function createParticles(): Particle[] {
    return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const angle = (360 / PARTICLE_COUNT) * index + (Math.random() * 24 - 12);
        const distance = 70 + Math.random() * 100;
        const radians = (angle * Math.PI) / 180;
        const tx = Math.cos(radians) * distance;
        const ty = Math.sin(radians) * distance + GRAVITY_PX;

        return {
            id: index,
            tx,
            ty,
            size: 5 + Math.random() * 7,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            delay: Math.random() * 80,
            duration: 650 + Math.random() * 250,
            rotation: 360 + Math.random() * 720,
        };
    });
}

export function CelebrationLayer({ x, y }: CelebrationLayerProps) {
    const particles = useMemo(createParticles, []);

    return (
        <div
            className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
            aria-hidden="true"
        >
            <div
                className="absolute"
                style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                }}
            >
                {/* Expanding ring that carries the initial blast shape. */}
                <span className="absolute left-1/2 top-1/2 size-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-success/40 kidface-celebration-ring" />

                {particles.map((particle) => (
                    <span
                        key={particle.id}
                        className={cn(
                            'absolute left-1/2 top-1/2 block rounded-full kidface-confetti',
                            // Give roughly half the particles a little shape variety.
                            particle.id % 3 === 0 && 'rounded-sm',
                        )}
                        style={{
                            ['--confetti-tx' as string]: `${particle.tx}px`,
                            ['--confetti-ty' as string]: `${particle.ty}px`,
                            ['--confetti-rotation' as string]: `${particle.rotation}deg`,
                            width: particle.size,
                            height: particle.size,
                            backgroundColor: particle.color,
                            animationDelay: `${particle.delay}ms`,
                            animationDuration: `${particle.duration}ms`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
