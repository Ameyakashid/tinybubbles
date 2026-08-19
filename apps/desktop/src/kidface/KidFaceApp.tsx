/**
 * Root of the rebuilt kid face (owner directive #23).
 *
 * See apps/desktop/KID-FACE-CONTRACT.md for the runtime contract.
 * The proof markup has been replaced with the first living surface: Today.
 */
import { useKidFaceRuntime } from './runtime';
import { KidLayout } from './components/KidLayout';
import { TodayView } from './components/TodayView';
import './kidface.css';

export function KidFaceApp() {
    const { hydrated, lastSyncError, requestSync } = useKidFaceRuntime();

    if (!hydrated) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 animate-pulse rounded-full bg-primary/20" />
                    <p className="text-lg text-muted-foreground">Loading…</p>
                </div>
            </div>
        );
    }

    return (
        <KidLayout lastSyncError={lastSyncError} onRequestSync={requestSync}>
            <TodayView />
        </KidLayout>
    );
}
