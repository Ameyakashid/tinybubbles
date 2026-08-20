import { useEffect, useRef, useState } from 'react';
import { CloudOff, Loader2 } from 'lucide-react';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';
import { AmbientField } from './AmbientField';

interface LoadErrorViewProps {
    onRetry: () => void;
}

const RETRY_FEEDBACK_MS = 800;

export function LoadErrorView({ onRetry }: LoadErrorViewProps) {
    const { t, language } = useLanguage();
    const [isRetrying, setIsRetrying] = useState(false);
    const [shakeKey, setShakeKey] = useState(0);
    const timeoutRef = useRef<number | null>(null);

    const title = displayLabel(t, language, 'kidface.loadError.title', 'Could not load your morning');
    const message = displayLabel(
        t,
        language,
        'kidface.loadError.message',
        'Something went wrong while waking up. Your tasks are still there — tap below to try again.',
    );
    const actionLabel = displayLabel(t, language, 'kidface.loadError.action', 'Try again');
    const tryingLabel = displayLabel(t, language, 'kidface.loadError.trying', 'Waking up…');

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleRetry = () => {
        if (isRetrying) return;
        setIsRetrying(true);
        onRetry();
        timeoutRef.current = window.setTimeout(() => {
            setIsRetrying(false);
            setShakeKey((prev) => prev + 1);
        }, RETRY_FEEDBACK_MS);
    };

    return (
        <div
            role="alert"
            aria-live="polite"
            className="relative flex h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 text-center text-foreground"
        >
            <AmbientField />

            <div className="relative flex size-32 items-center justify-center rounded-full bg-warning/10 kidface-breathe-soft">
                <CloudOff className="relative z-10 size-14 text-warning" strokeWidth={2} aria-hidden="true" />
            </div>

            <div className="relative flex max-w-xs flex-col gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
                <p className="text-lg text-muted-foreground">{message}</p>
            </div>

            <div key={shakeKey} className={cn('relative', shakeKey > 0 && 'kidface-shake')}>
                <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    aria-busy={isRetrying}
                    className="flex min-h-[88px] items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.99] disabled:opacity-80 disabled:active:scale-100"
                >
                    {isRetrying ? (
                        <>
                            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                            <span>{tryingLabel}</span>
                        </>
                    ) : (
                        <>
                            <CloudOff className="size-6" aria-hidden="true" />
                            <span>{actionLabel}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
