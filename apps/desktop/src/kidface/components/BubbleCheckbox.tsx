import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BubbleCheckboxProps {
    checked: boolean;
    onChange: () => void;
    label?: string;
    className?: string;
}

export function BubbleCheckbox({ checked, onChange, label, className }: BubbleCheckboxProps) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            onClick={onChange}
            className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-90',
                checked
                    ? 'border-success bg-success text-success-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/60',
                className,
            )}
        >
            <Check
                className={cn(
                    'size-8 transition-transform duration-150',
                    checked ? 'scale-100' : 'scale-0',
                )}
                strokeWidth={3}
            />
        </button>
    );
}
