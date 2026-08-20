import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddBubbleProps {
    onAdd: (title: string) => void | Promise<void>;
    placeholder?: string;
    autoFocus?: boolean;
}

export function AddBubble({ onAdd, placeholder = 'I need to…', autoFocus = false }: AddBubbleProps) {
    const [draft, setDraft] = useState('');

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const title = draft.trim();
        if (!title) return;
        void onAdd(title);
        setDraft('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                aria-label="Add something to do"
                className={cn(
                    'h-14 flex-1 rounded-xl border border-input bg-background px-4 text-lg text-foreground placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50',
                )}
            />
            <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Add"
                className={cn(
                    'flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90',
                    'disabled:opacity-50 disabled:active:scale-100',
                )}
            >
                <Plus className="size-8" strokeWidth={2.5} />
            </button>
        </form>
    );
}
