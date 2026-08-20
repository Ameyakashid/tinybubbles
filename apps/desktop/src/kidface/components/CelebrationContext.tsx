import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { CelebrationLayer } from './CelebrationLayer';

export type CelebrationOrigin = {
    x: number;
    y: number;
};

type CelebrationContextValue = {
    /**
     * Fire a one-shot celebration burst.
     * `x` and `y` are normalized viewport coordinates (0–1). Defaults to center.
     */
    celebrate: (origin?: Partial<CelebrationOrigin>) => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

const BURST_DURATION_MS = 900;

export function CelebrationProvider({ children }: { children: ReactNode }) {
    const [bursts, setBursts] = useState<(CelebrationOrigin & { id: number })[]>([]);
    const nextIdRef = useRef(0);

    const celebrate = useCallback((origin: Partial<CelebrationOrigin> = {}) => {
        const id = nextIdRef.current++;
        const burst = {
            id,
            x: origin.x ?? 0.5,
            y: origin.y ?? 0.5,
        };
        setBursts((prev) => [...prev, burst]);

        const timeoutId = window.setTimeout(() => {
            setBursts((prev) => prev.filter((candidate) => candidate.id !== id));
        }, BURST_DURATION_MS);

        // If the provider unmounts during the burst, clean the timer.
        return () => window.clearTimeout(timeoutId);
    }, []);

    return (
        <CelebrationContext.Provider value={{ celebrate }}>
            {children}
            {bursts.map((burst) => (
                <CelebrationLayer
                    key={burst.id}
                    x={burst.x}
                    y={burst.y}
                />
            ))}
        </CelebrationContext.Provider>
    );
}

export function useCelebration(): CelebrationContextValue['celebrate'] {
    const context = useContext(CelebrationContext);
    if (!context) {
        throw new Error('useCelebration must be used within a CelebrationProvider');
    }
    return context.celebrate;
}
