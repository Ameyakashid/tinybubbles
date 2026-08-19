import type { ReactNode } from 'react';

interface KidLayoutProps {
    children: ReactNode;
    lastSyncError: string | null;
    onRequestSync: () => void;
}

export function KidLayout({ children, lastSyncError, onRequestSync }: KidLayoutProps) {
    return (
        <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="kidface-drift absolute -left-8 top-[8%] size-40 rounded-full bg-primary/5 blur-2xl" />
                <div className="kidface-drift-medium absolute right-[5%] top-[20%] size-56 rounded-full bg-success/5 blur-3xl" />
                <div className="kidface-drift-slow absolute bottom-[12%] left-[20%] size-48 rounded-full bg-info/5 blur-2xl" />
            </div>

            {lastSyncError && (
                <button
                    type="button"
                    onClick={onRequestSync}
                    className="relative z-10 w-full bg-warning px-4 py-3 text-center text-base font-medium text-warning-foreground active:scale-[0.99]"
                >
                    Could not sync. Tap to try again.
                </button>
            )}

            <div className="relative z-0 flex flex-1 flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
