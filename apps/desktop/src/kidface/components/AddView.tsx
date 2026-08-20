import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTaskStore } from '@tinybubbles/core';
import { AddBubble } from './AddBubble';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

const SUCCESS_MS = 2000;

export function AddView() {
    const { t, language } = useLanguage();
    const addTask = useTaskStore((state) => state.addTask);
    const [justAdded, setJustAdded] = useState(false);

    useEffect(() => {
        if (!justAdded) return undefined;
        const id = window.setTimeout(() => setJustAdded(false), SUCCESS_MS);
        return () => window.clearTimeout(id);
    }, [justAdded]);

    const handleAdd = async (title: string) => {
        await addTask(title, { status: 'next' });
        setJustAdded(true);
    };

    const title = displayLabel(t, language, 'kidface.add.title', 'Add something');
    const prompt = displayLabel(t, language, 'kidface.add.prompt', 'What do you need to do?');
    const success = displayLabel(t, language, 'kidface.add.success', 'Added! It is on your Today list.');
    const placeholder = displayLabel(t, language, 'kidface.add.placeholder', 'I need to…');
    const inputLabel = displayLabel(t, language, 'kidface.add.inputLabel', 'Add something to do');
    const submitLabel = displayLabel(t, language, 'kidface.add.submitLabel', 'Add');

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    {prompt}
                </h1>
            </header>

            <section className="flex flex-col gap-4">
                <AddBubble onAdd={handleAdd} placeholder={placeholder} inputLabel={inputLabel} submitLabel={submitLabel} autoFocus />

                {justAdded && (
                    <div
                        className="flex items-center gap-3 rounded-2xl bg-success p-4 text-success-foreground kidface-slide-up"
                        aria-live="polite"
                    >
                        <Sparkles className="size-6" strokeWidth={2.5} aria-hidden="true" />
                        <span className="text-lg font-semibold">{success}</span>
                    </div>
                )}
            </section>
        </div>
    );
}
