import { CalendarDays, Plus, Settings, Sun, Trophy } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

export type KidRoom = 'today' | 'add' | 'done' | 'calendar' | 'settings';

interface KidNavProps {
    activeRoom: KidRoom;
    onChangeRoom: (room: KidRoom) => void;
}

interface NavItemProps {
    room: KidRoom;
    activeRoom: KidRoom;
    label: string;
    icon: ReactNode;
    onSelect: (room: KidRoom) => void;
    setItemRef: (room: KidRoom) => (element: HTMLButtonElement | null) => void;
}

function NavItem({ room, activeRoom, label, icon, onSelect, setItemRef }: NavItemProps) {
    const isActive = room === activeRoom;

    return (
        <button
            ref={setItemRef(room)}
            type="button"
            onClick={() => onSelect(room)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
                'relative z-10 flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors',
                isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:bg-muted',
            )}
        >
            <span className={cn('relative z-10 transition-transform', isActive && 'kidface-nav-icon-bounce')}>
                {icon}
            </span>
            <span className="relative z-10 text-sm font-bold">{label}</span>
        </button>
    );
}

export function KidNav({ activeRoom, onChangeRoom }: KidNavProps) {
    const { t, language } = useLanguage();
    const navRef = useRef<HTMLElement>(null);
    const itemRefs = useRef<Map<KidRoom, HTMLButtonElement>>(new Map());
    const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
        left: 0,
        width: 0,
        opacity: 0,
    });

    useEffect(() => {
        const updateIndicator = () => {
            const nav = navRef.current;
            const activeButton = itemRefs.current.get(activeRoom);
            if (!nav || !activeButton) return;

            const navRect = nav.getBoundingClientRect();
            const itemRect = activeButton.getBoundingClientRect();
            setIndicatorStyle({
                left: itemRect.left - navRect.left,
                width: itemRect.width,
                opacity: 1,
            });
        };

        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [activeRoom]);

    const setItemRef = (room: KidRoom) => (element: HTMLButtonElement | null) => {
        if (element) {
            itemRefs.current.set(room, element);
        } else {
            itemRefs.current.delete(room);
        }
    };

    return (
        <nav
            ref={navRef}
            className="relative z-10 flex h-24 shrink-0 items-center gap-2 border-t border-border bg-card/80 px-4 pb-2 pt-2 backdrop-blur-sm"
            aria-label="Kid rooms"
        >
            <span
                className="absolute top-1 bottom-1 rounded-2xl bg-primary/10 transition-all duration-300 ease-out"
                style={indicatorStyle}
                aria-hidden="true"
            />
            <NavItem
                room="today"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.today', 'Today')}
                icon={<Sun className="size-8" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
                setItemRef={setItemRef}
            />
            <NavItem
                room="add"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.add', 'Add')}
                icon={<Plus className="size-8" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
                setItemRef={setItemRef}
            />
            <NavItem
                room="done"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.done', 'Done')}
                icon={<Trophy className="size-8" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
                setItemRef={setItemRef}
            />
            <NavItem
                room="calendar"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.calendar', 'Calendar')}
                icon={<CalendarDays className="size-8" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
                setItemRef={setItemRef}
            />
            <NavItem
                room="settings"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.settings', 'Me')}
                icon={<Settings className="size-8" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
                setItemRef={setItemRef}
            />
        </nav>
    );
}
