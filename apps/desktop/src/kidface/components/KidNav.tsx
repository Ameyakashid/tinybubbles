import { CalendarDays, Plus, Sun, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

export type KidRoom = 'today' | 'add' | 'done' | 'calendar';

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
}

function NavItem({ room, activeRoom, label, icon, onSelect }: NavItemProps) {
    const isActive = room === activeRoom;

    return (
        <button
            type="button"
            onClick={() => onSelect(room)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors',
                isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:bg-muted',
            )}
        >
            {isActive && (
                <span className="absolute inset-x-2 top-1 bottom-1 rounded-xl bg-primary/10" />
            )}
            <span className="relative z-10">{icon}</span>
            <span className="relative z-10 text-sm font-bold">{label}</span>
        </button>
    );
}

export function KidNav({ activeRoom, onChangeRoom }: KidNavProps) {
    const { t, language } = useLanguage();

    return (
        <nav
            className="relative z-10 flex h-20 shrink-0 items-center gap-2 border-t border-border bg-card/80 px-4 pb-2 pt-2 backdrop-blur-sm"
            aria-label="Kid rooms"
        >
            <NavItem
                room="today"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.today', 'Today')}
                icon={<Sun className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
            <NavItem
                room="add"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.add', 'Add')}
                icon={<Plus className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
            <NavItem
                room="done"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.done', 'Done')}
                icon={<Trophy className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
            <NavItem
                room="calendar"
                activeRoom={activeRoom}
                label={displayLabel(t, language, 'kidface.nav.calendar', 'Calendar')}
                icon={<CalendarDays className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
        </nav>
    );
}
