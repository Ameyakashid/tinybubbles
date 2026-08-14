import type { FormEvent, RefObject } from 'react';
import type { Area, Project } from '@tinybubbles/core';
import { Mic, Plus } from 'lucide-react';
import { TaskInput } from '../../Task/TaskInput';
import { cn } from '../../../lib/utils';
import { displayLabel } from '../../../lib/display-labels';
import { useLanguage } from '../../../contexts/language-context';

type ListQuickAddProps = {
    t: (key: string) => string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onOpenAudio: () => void;
    onCreateProject: (title: string) => Promise<string | null>;
    inputRef: RefObject<HTMLInputElement | null>;
    projects: Project[];
    areas: Area[];
    contexts: string[];
    people: readonly string[];
    onResetCopilot: () => void;
    dense?: boolean;
};

export function ListQuickAdd({
    t,
    value,
    onChange,
    onSubmit,
    onOpenAudio,
    onCreateProject,
    inputRef,
    projects,
    areas,
    contexts,
    people,
    onResetCopilot,
    dense = false,
}: ListQuickAddProps) {
    const { language } = useLanguage();
    // The buttons must stay shorter than the bar (min-h on the input below
    // guarantees its height regardless of font metrics) — at equal heights the
    // bar's focus ring runs straight through them and they sit flush with its
    // edges (#959).
    const iconButtonClass = cn(
        "inline-flex items-center justify-center rounded-lg border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        dense ? "h-10 w-10" : "h-11 w-11"
    );
    return (
        <form
            onSubmit={onSubmit}
            // The mic and add buttons sit inside the field, so the border and
            // focus ring belong to the bar rather than the input — drawn on the
            // input, the ring ran straight through both buttons (#959).
            className="relative rounded-lg border border-border bg-card shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30"
        >
            <TaskInput
                inputRef={inputRef}
                value={value}
                projects={projects}
                contexts={contexts}
                areas={areas}
                people={people}
                onCreateProject={onCreateProject}
                onChange={(next) => {
                    onChange(next);
                    onResetCopilot();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        inputRef.current?.blur();
                    }
                }}
                placeholder={`${displayLabel(t, language, 'nav.addTask', 'Add Task')}... ${displayLabel(t, language, 'quickAdd.example', 'e.g. Call mom /due:tomorrow @phone')}`}
                ariaLabel={t('nav.addTask')}
                className={cn(
                    "w-full rounded-lg border-0 bg-transparent focus:outline-none focus:ring-0",
                    dense ? "min-h-12 py-2.5 pl-3 pr-32 text-base" : "min-h-14 py-3.5 pl-4 pr-36 text-lg"
                )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenAudio}
                    className={cn(iconButtonClass, "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}
                    aria-label={t('quickAdd.audioCaptureLabel')}
                >
                    <Mic className="w-5 h-5" />
                </button>
                <button
                    type="submit"
                    disabled={!value.trim()}
                    className={cn(
                        iconButtonClass,
                        "w-auto gap-1.5 border-primary bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    aria-label={t('common.add')}
                >
                    <Plus className="w-5 h-5" />
                    {t('common.add')}
                </button>
            </div>
        </form>
    );
}
