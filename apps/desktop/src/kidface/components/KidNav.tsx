import { Sun, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type KidRoom = 'today' | 'done';

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
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors',
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground active:bg-muted',
            )}
        >
            {icon}
            <span className="text-sm font-bold">{label}</span>
        </button>
    );
}

export function KidNav({ activeRoom, onChangeRoom }: KidNavProps) {
    return (
        <nav
            className="relative z-10 flex h-20 shrink-0 items-center gap-2 border-t border-border bg-card/80 px-4 pb-2 pt-2 backdrop-blur-sm"
            aria-label="Kid rooms"
        >
            <NavItem
                room="today"
                activeRoom={activeRoom}
                label="Today"
                icon={<Sun className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
            <NavItem
                room="done"
                activeRoom={activeRoom}
                label="Done"
                icon={<Trophy className="size-7" strokeWidth={2.5} />}
                onSelect={onChangeRoom}
            />
        </nav>
    );
}
