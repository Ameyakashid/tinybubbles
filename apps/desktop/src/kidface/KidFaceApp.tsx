/**
 * Root of the rebuilt kid face (owner directive #23).
 *
 * See apps/desktop/KID-FACE-CONTRACT.md for the runtime contract.
 * The living surfaces are Today, Add, Done, and Calendar; navigation stays shallow.
 */
import { useEffect, useRef, useState } from 'react';
import { useKidFaceRuntime } from './runtime';
import { useKidFaceTheme } from './use-kidface-theme';
import { isKidFacePlaygroundRoom } from './face-location';
import { CelebrationProvider } from './components/CelebrationContext';
import { KidLayout } from './components/KidLayout';
import { LoadErrorView } from './components/LoadErrorView';
import { TodayView } from './components/TodayView';
import { AddView } from './components/AddView';
import { DoneView } from './components/DoneView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { MotionPlayground } from './components/MotionPlayground';
import { CalmCornerView } from './components/CalmCornerView';
import { KidNav, type KidRoom } from './components/KidNav';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';
import './kidface.css';

const ROOM_ORDER: KidRoom[] = ['today', 'add', 'done', 'calendar', 'settings'];

export function KidFaceApp() {
    const {
        hydrated,
        loadError,
        lastSyncError,
        syncPending,
        persistError,
        persistRetrying,
        requestSync,
        retryPersistence,
        retryLoad,
    } = useKidFaceRuntime();
    const { t, language } = useLanguage();
    useKidFaceTheme();

    const searchParams = new URLSearchParams(window.location.search);
    const forceLoadError = import.meta.env.DEV && searchParams.get('kidface-force') === 'load-error';
    const forceOffline = import.meta.env.DEV && searchParams.get('kidface-force') === 'offline';
    const resolvedLoadError = forceLoadError ? 'forced load error' : loadError;
    const resolvedLastSyncError = forceOffline ? 'forced offline' : lastSyncError;
    const [activeRoom, setActiveRoom] = useState<KidRoom>('today');
    const [roomDirection, setRoomDirection] = useState<'left' | 'right'>('right');
    const [isCalmCornerOpen, setIsCalmCornerOpen] = useState(false);
    const mainRef = useRef<HTMLElement>(null);
    const activeRoomRef = useRef<KidRoom>(activeRoom);

    useEffect(() => {
        activeRoomRef.current = activeRoom;
    }, [activeRoom]);

    const roomLabel = displayLabel(t, language, `kidface.nav.${activeRoom}`, activeRoom);
    const loadingLabel = displayLabel(t, language, 'kidface.loading', 'Loading…');

    const changeRoom = (room: KidRoom) => {
        const currentIndex = ROOM_ORDER.indexOf(activeRoomRef.current);
        const nextIndex = ROOM_ORDER.indexOf(room);
        setRoomDirection(nextIndex > currentIndex ? 'right' : 'left');
        setActiveRoom(room);
    };

    const openCalmCorner = () => setIsCalmCornerOpen(true);
    const closeCalmCorner = () => setIsCalmCornerOpen(false);

    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [activeRoom]);

    const showPlayground = isKidFacePlaygroundRoom();

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

    if (resolvedLoadError) {
        return <LoadErrorView onRetry={retryLoad} />;
    }

    return (
        <CelebrationProvider>
            <KidLayout
                lastSyncError={resolvedLastSyncError}
                syncPending={syncPending}
                persistError={persistError}
                persistRetrying={persistRetrying}
                onRequestSync={requestSync}
                onRetryPersistence={retryPersistence}
            >
                <main
                    ref={mainRef}
                    tabIndex={-1}
                    aria-label={showPlayground ? 'Motion playground' : roomLabel}
                    className="relative flex flex-1 flex-col overflow-hidden outline-none"
                >
                    {showPlayground ? (
                        <MotionPlayground />
                    ) : (
                        <>
                            <div
                                key={activeRoom}
                                className={cn(
                                    'flex flex-1 flex-col overflow-hidden',
                                    roomDirection === 'right' ? 'kidface-room-enter-right' : 'kidface-room-enter-left',
                                )}
                            >
                                {activeRoom === 'today' && (
                                    <TodayView
                                        onSeeAllDone={() => changeRoom('done')}
                                        onSeeCalendar={() => changeRoom('calendar')}
                                        onOpenCalmCorner={openCalmCorner}
                                    />
                                )}
                                {activeRoom === 'add' && <AddView />}
                                {activeRoom === 'done' && <DoneView />}
                                {activeRoom === 'calendar' && <CalendarView />}
                                {activeRoom === 'settings' && <SettingsView />}
                            </div>
                            <KidNav activeRoom={activeRoom} onChangeRoom={changeRoom} />
                        </>
                    )}
                    {isCalmCornerOpen && <CalmCornerView onClose={closeCalmCorner} />}
                </main>
            </KidLayout>
        </CelebrationProvider>
    );
}
