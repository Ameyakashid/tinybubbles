import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BubbleCheckboxProps {
    checked: boolean;
    onChange: () => void;
    label?: string;
    celebrating?: boolean;
    className?: string;
}

export const BubbleCheckbox = forwardRef<HTMLButtonElement, BubbleCheckboxProps>(
    function BubbleCheckbox({ checked, onChange, label, celebrating = false, className }, ref) {
        return (
            <button
                ref={ref}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={label}
                onClick={onChange}
                className={cn(
                    'relative flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-90',
                    checked
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60',
                    celebrating && 'kidface-celebrate',
                    className,
                )}
            >
            {/* Soft glow halo behind the bubble */}
            <span
                className={cn(
                    'pointer-events-none absolute inset-[-8px] rounded-full bg-success/25 opacity-0 blur-md transition-opacity duration-300',
                    checked && 'opacity-100 kidface-glow-pulse',
                )}
                aria-hidden="true"
            />

            {/* Expanding ripple rings on completion */}
            {celebrating && (
                <>
                    <span
                        className="pointer-events-none absolute inset-0 rounded-full border-2 border-success/70 kidface-bubble-ripple"
                        aria-hidden="true"
                    />
                    <span
                        className="pointer-events-none absolute inset-[-10px] rounded-full border-2 border-success/40 kidface-bubble-ripple-delayed"
                        aria-hidden="true"
                    />
                </>
            )}

            {/* Star sparkles that burst outward on completion */}
            {celebrating && (
                <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <span
                            key={index}
                            className={cn(
                                'kidface-sparkle size-1.5 rounded-full bg-focus-star shadow-[0_0_4px_rgba(250,204,21,0.8)]',
                                `kidface-sparkle-${index}`,
                            )}
                        />
                    ))}
                </span>
            )}

            <Check
                className={cn(
                    'relative z-10 size-8 transition-transform duration-200',
                    checked ? 'scale-100' : 'scale-0',
                    celebrating && 'kidface-check-bounce',
                )}
                strokeWidth={3}
            />
        </button>
    );
});
