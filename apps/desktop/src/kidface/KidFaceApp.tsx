/**
 * Root of the rebuilt kid face (owner directive #23).
 *
 * See apps/desktop/KID-FACE-CONTRACT.md for the runtime contract.
 * The living surfaces are Today, Add, Done, and Calendar; navigation stays shallow.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useKidFaceRuntime } from './runtime';
import { useKidFaceTheme } from './use-kidface-theme';
import { KidLayout } from './components/KidLayout';
import { TodayView } from './components/TodayView';
import { AddView } from './components/AddView';
import { DoneView } from './components/DoneView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { KidNav, type KidRoom } from './components/KidNav';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';
import './kidface.css';

const ROOM_ORDER: KidRoom[] = ['today', 'add', 'done', 'calendar', 'settings'];

export function KidFaceApp() {
    const { hydrated, loadError, lastSyncError, requestSync, retryLoad } = useKidFaceRuntime();
    const { t, language } = useLanguage();
    useKidFaceTheme();
    const [activeRoom, setActiveRoom] = useState<KidRoom>('today');
    const [roomDirection, setRoomDirection] = useState<'left' | 'right'>('right');
    const mainRef = useRef<HTMLElement>(null);
    const previousRoom = useRef<KidRoom | null>(null);

    const roomLabel = displayLabel(t, language, `kidface.nav.${activeRoom}`, activeRoom);
    const loadingLabel = displayLabel(t, language, 'kidface.loading', 'Loading…');
    const loadErrorTitle = displayLabel(t, language, 'kidface.loadError.title', 'Could not load your morning');
    const loadErrorMessage = displayLabel(
        t,
        language,
        'kidface.loadError.message',
        'Something went wrong while waking up. Your tasks are still there — tap below to try again.',
    );
    const loadErrorAction = displayLabel(t, language, 'kidface.loadError.action', 'Try again');

    useEffect(() => {
        if (previousRoom.current !== null && previousRoom.current !== activeRoom) {
            const previousIndex = ROOM_ORDER.indexOf(previousRoom.current);
            const nextIndex = ROOM_ORDER.indexOf(activeRoom);
            setRoomDirection(nextIndex > previousIndex ? 'right' : 'left');
            mainRef.current?.focus({ preventScroll: true });
        }
        previousRoom.current = activeRoom;
    }, [activeRoom]);

    if (!hydrated) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-12 animate-pulse rounded-full bg-primary/20" />
                    <p className="text-lg text-muted-foreground">{loadingLabel}</p>
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
                    <h1 className="text-2xl font-extrabold">{loadErrorTitle}</h1>
                    <p className="text-lg text-muted-foreground">
                        {loadErrorMessage}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={retryLoad}
                    className="flex min-h-14 items-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground active:scale-[0.99]"
                >
                    <RotateCcw className="size-6" />
                    {loadErrorAction}
                </button>
            </div>
        );
    }

    return (
        <KidLayout lastSyncError={lastSyncError} onRequestSync={requestSync}>
            <main
                ref={mainRef}
                tabIndex={-1}
                aria-label={roomLabel}
                className="relative flex flex-1 flex-col overflow-hidden outline-none"
            >
                <div
                    key={activeRoom}
                    className={cn(
                        'flex flex-1 flex-col overflow-hidden',
                        roomDirection === 'right' ? 'kidface-room-enter-right' : 'kidface-room-enter-left',
                    )}
                >
                    {activeRoom === 'today' && <TodayView onSeeAllDone={() => setActiveRoom('done')} />}
                    {activeRoom === 'add' && <AddView />}
                    {activeRoom === 'done' && <DoneView />}
                    {activeRoom === 'calendar' && <CalendarView />}
                    {activeRoom === 'settings' && <SettingsView />}
                </div>
                <KidNav activeRoom={activeRoom} onChangeRoom={setActiveRoom} />
            </main>
        </KidLayout>
    );
}
