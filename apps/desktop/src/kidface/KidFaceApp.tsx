/**
 * Root of the rebuilt kid face (owner directive #23).
 *
 * See apps/desktop/KID-FACE-CONTRACT.md for the runtime contract.
 * The living surfaces are Today, Add, Done, and Calendar; navigation stays shallow.
 */
import { useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useKidFaceRuntime } from './runtime';
import { KidLayout } from './components/KidLayout';
import { TodayView } from './components/TodayView';
import { AddView } from './components/AddView';
import { DoneView } from './components/DoneView';
import { CalendarView } from './components/CalendarView';
import { KidNav, type KidRoom } from './components/KidNav';
import './kidface.css';

export function KidFaceApp() {
    const { hydrated, loadError, lastSyncError, requestSync } = useKidFaceRuntime();
    const [activeRoom, setActiveRoom] = useState<KidRoom>('today');

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

    if (loadError) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
                <div className="flex size-28 items-center justify-center rounded-full bg-warning/10">
                    <AlertCircle className="size-14 text-warning" />
                </div>
                <div className="flex max-w-xs flex-col gap-2">
                    <h1 className="text-2xl font-extrabold">Could not load your morning</h1>
                    <p className="text-lg text-muted-foreground">
                        Something went wrong while waking up. Your tasks are still there — tap below to try again.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={requestSync}
                    className="flex min-h-14 items-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground active:scale-[0.99]"
                >
                    <RotateCcw className="size-6" />
                    Try again
                </button>
            </div>
        );
    }

    return (
        <KidLayout lastSyncError={lastSyncError} onRequestSync={requestSync}>
            <div className="flex flex-1 flex-col overflow-hidden">
                {activeRoom === 'today' && <TodayView onSeeAllDone={() => setActiveRoom('done')} />}
                {activeRoom === 'add' && <AddView />}
                {activeRoom === 'done' && <DoneView />}
                {activeRoom === 'calendar' && <CalendarView />}
                <KidNav activeRoom={activeRoom} onChangeRoom={setActiveRoom} />
            </div>
        </KidLayout>
    );
}
