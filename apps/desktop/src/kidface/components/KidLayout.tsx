import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';

interface KidLayoutProps {
    children: ReactNode;
    lastSyncError: string | null;
    onRequestSync: () => void;
}

const SYNCED_FLASH_MS = 1200;

export function KidLayout({ children, lastSyncError, onRequestSync }: KidLayoutProps) {
    const { t, language } = useLanguage();
    const [isRetrying, setIsRetrying] = useState(false);
    const [showSynced, setShowSynced] = useState(false);
    const previousErrorRef = useRef(lastSyncError);
    const syncedTimeoutRef = useRef<number | null>(null);

    const offlineMessage = displayLabel(t, language, 'kidface.offline.message', 'Offline — your changes are saved.');
    const offlineAction = displayLabel(t, language, 'kidface.offline.action', 'Try syncing');
    const tryingLabel = displayLabel(t, language, 'kidface.offline.trying', 'Trying to sync…');
    const syncedLabel = displayLabel(t, language, 'kidface.offline.synced', 'Synced!');

    useEffect(() => {
        return () => {
            if (syncedTimeoutRef.current) {
                window.clearTimeout(syncedTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const previous = previousErrorRef.current;
        if (previous && !lastSyncError && isRetrying) {
            setShowSynced(true);
            syncedTimeoutRef.current = window.setTimeout(() => {
                setIsRetrying(false);
                setShowSynced(false);
            }, SYNCED_FLASH_MS);
        } else if (!previous && lastSyncError) {
            setIsRetrying(false);
            setShowSynced(false);
        }
        previousErrorRef.current = lastSyncError;
    }, [lastSyncError, isRetrying]);

    const handleRequestSync = () => {
        if (isRetrying) return;
        setIsRetrying(true);
        onRequestSync();
    };

    const bannerVisible = lastSyncError || isRetrying || showSynced;
    const bannerBusy = isRetrying && !showSynced;

    return (
        <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="kidface-drift absolute -left-8 top-[8%] size-40 rounded-full bg-primary/5 blur-2xl" />
                <div className="kidface-drift-medium absolute right-[5%] top-[20%] size-56 rounded-full bg-success/5 blur-3xl" />
                <div className="kidface-drift-slow absolute bottom-[12%] left-[20%] size-48 rounded-full bg-info/5 blur-2xl" />
                <div className="kidface-drift-very-slow absolute bottom-[5%] right-[15%] size-64 rounded-full bg-focus-star/5 blur-3xl" />
                <div className="kidface-drift absolute left-[45%] top-[4%] size-32 rounded-full bg-info/5 blur-2xl" />
            </div>

            {bannerVisible && (
                <button
                    type="button"
                    onClick={handleRequestSync}
                    disabled={bannerBusy}
                    aria-busy={bannerBusy}
                    aria-live="polite"
                    className={cn(
                        'relative z-10 flex w-full items-center justify-center gap-2 px-4 py-3 text-center text-base font-medium transition-colors active:scale-[0.99] disabled:active:scale-100',
                        showSynced
                            ? 'bg-success text-success-foreground'
                            : 'bg-warning text-warning-foreground',
                    )}
                >
                    {showSynced ? (
                        <span>{syncedLabel}</span>
                    ) : bannerBusy ? (
                        <>
                            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                            <span>{tryingLabel}</span>
                        </>
                    ) : (
                        <>
                            <span>{offlineMessage}</span>
                            <span className="underline">{offlineAction}</span>
                        </>
                    )}
                </button>
            )}

            <div className="relative z-0 flex flex-1 flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
