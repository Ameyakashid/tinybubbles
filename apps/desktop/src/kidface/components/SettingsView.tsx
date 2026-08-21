import { useState } from 'react';
import { Check } from 'lucide-react';
import {
    SUPPORTED_LANGUAGES,
    LOCALES,
    useTaskStore,
    type AppTheme,
    type Language,
} from '@tinybubbles/core';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';
import { Dialog, DialogBody, DialogHeader, DialogFooter } from '@/components/ui/Dialog';

const THEME_ORDER: AppTheme[] = [
    'system',
    'light',
    'dark',
    'eink',
    'nord',
    'sepia',
    'material3-light',
    'material3-dark',
    'oled',
    'catppuccin-macchiato',
    'dracula',
];

const THEME_SWATCHES: Record<AppTheme, string> = {
    system: 'bg-gradient-to-br from-white to-slate-900 border-border',
    light: 'bg-white border-border',
    dark: 'bg-slate-900',
    eink: 'bg-white border-2 border-black',
    nord: 'bg-slate-700',
    sepia: 'bg-amber-100 border-amber-200',
    'material3-light': 'bg-sky-100',
    'material3-dark': 'bg-slate-900',
    oled: 'bg-black',
    'catppuccin-macchiato': 'bg-pink-300',
    dracula: 'bg-purple-600',
};

function languageNativeName(language: Language): string {
    if (language === 'en') return 'English';
    return LOCALES[language]?.native ?? language;
}

interface ThemeButtonProps {
    theme: AppTheme;
    selected: boolean;
    label: string;
    onSelect: (theme: AppTheme) => void;
}

function ThemeButton({ theme, selected, label, onSelect }: ThemeButtonProps) {
    return (
        <button
            type="button"
            onClick={() => onSelect(theme)}
            aria-pressed={selected}
            className={cn(
                'group relative flex flex-col items-center gap-2 rounded-2xl bg-card p-3 shadow-sm transition-all',
                'hover:shadow-md active:scale-[0.99]',
                selected && 'ring-2 ring-primary',
            )}
        >
            <span
                className={cn(
                    'flex size-14 items-center justify-center rounded-full border shadow-sm',
                    THEME_SWATCHES[theme],
                )}
                aria-hidden="true"
            >
                {selected && (
                    <span
                        className={cn(
                            'flex size-8 items-center justify-center rounded-full',
                            theme === 'light' || theme === 'eink' || theme === 'sepia' || theme === 'material3-light'
                                ? 'bg-foreground text-background'
                                : 'bg-background text-foreground',
                        )}
                    >
                        <Check className="size-5" strokeWidth={3} />
                    </span>
                )}
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
        </button>
    );
}

interface LanguageButtonProps {
    language: Language;
    selected: boolean;
    label: string;
    onSelect: (language: Language) => void;
}

function LanguageButton({ language, selected, label, onSelect }: LanguageButtonProps) {
    return (
        <button
            type="button"
            onClick={() => onSelect(language)}
            aria-pressed={selected}
            className={cn(
                'flex min-h-[88px] items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-sm transition-all',
                'hover:shadow-md active:scale-[0.99]',
                selected && 'bg-primary text-primary-foreground',
            )}
        >
            <span className="text-lg font-semibold">{label}</span>
            {selected && (
                <Check className="size-8" strokeWidth={3} aria-hidden="true" />
            )}
        </button>
    );
}

export function SettingsView() {
    const { t, language, setLanguage } = useLanguage();
    const settings = useTaskStore((state) => state.settings);
    const updateSettings = useTaskStore((state) => state.updateSettings);
    const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);

    const currentTheme = settings?.theme ?? 'system';

    const handleThemeChange = (theme: AppTheme) => {
        void updateSettings({ theme });
    };

    const applyLanguageChange = (nextLanguage: Language) => {
        setLanguage(nextLanguage);
        void updateSettings({ language: nextLanguage });
    };

    const requestLanguageChange = (nextLanguage: Language) => {
        if (nextLanguage === language) return;
        setPendingLanguage(nextLanguage);
    };

    const cancelLanguageChange = () => {
        setPendingLanguage(null);
    };

    const confirmLanguageChange = () => {
        if (pendingLanguage) {
            applyLanguageChange(pendingLanguage);
        }
        setPendingLanguage(null);
    };

    const title = displayLabel(t, language, 'kidface.settings.title', 'Me');
    const heading = displayLabel(t, language, 'kidface.settings.heading', 'Your settings');
    const subtitle = displayLabel(t, language, 'kidface.settings.subtitle', 'Make it feel like you.');
    const themeSectionLabel = displayLabel(t, language, 'kidface.settings.themeSection', 'Look and feel');
    const languageSectionLabel = displayLabel(t, language, 'kidface.settings.languageSection', 'Language');

    const themeLabel = (theme: AppTheme) => displayLabel(
        t,
        language,
        `kidface.settings.theme.${theme}`,
        theme.charAt(0).toUpperCase() + theme.slice(1).replace(/-/g, ' '),
    );

    const confirmTitle = displayLabel(t, language, 'kidface.settings.languageConfirm.title', 'Switch language?');
    const confirmMessage = displayLabel(t, language, 'kidface.settings.languageConfirm.message', 'This will change the words in the app to {target}.')
        .replace('{target}', pendingLanguage ? languageNativeName(pendingLanguage) : '');
    const keepLabel = displayLabel(t, language, 'kidface.settings.languageConfirm.keep', 'Keep {current}')
        .replace('{current}', languageNativeName(language));
    const switchLabel = displayLabel(t, language, 'kidface.settings.languageConfirm.switch', 'Switch to {target}')
        .replace('{target}', pendingLanguage ? languageNativeName(pendingLanguage) : '');

    return (
        <div className="flex h-full flex-col gap-6 px-5 pb-8 pt-6">
            <header className="flex flex-col gap-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{heading}</h1>
                <p className="text-lg text-muted-foreground">{subtitle}</p>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2">
                <div className="flex flex-col gap-3 kidface-slide-up">
                    <h2 className="text-xl font-bold text-foreground">{themeSectionLabel}</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {THEME_ORDER.map((theme) => (
                            <ThemeButton
                                key={theme}
                                theme={theme}
                                selected={currentTheme === theme}
                                label={themeLabel(theme)}
                                onSelect={handleThemeChange}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-3 kidface-slide-up" style={{ animationDelay: '80ms' }}>
                    <h2 className="text-xl font-bold text-foreground">{languageSectionLabel}</h2>
                    <div className="flex flex-col gap-2">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <LanguageButton
                                key={lang}
                                language={lang}
                                selected={language === lang}
                                label={languageNativeName(lang)}
                                onSelect={requestLanguageChange}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {pendingLanguage && (
                <Dialog
                    onClose={cancelLanguageChange}
                    label={confirmTitle}
                    closeOnBackdrop={false}
                    overlayClassName="bg-black/30"
                    panelClassName="max-w-sm rounded-2xl border bg-card text-card-foreground shadow-2xl"
                >
                    <DialogHeader className="px-5 pt-5">
                        <h2 className="text-2xl font-extrabold text-foreground">{confirmTitle}</h2>
                    </DialogHeader>
                    <DialogBody className="px-5 pb-2">
                        <p className="text-lg text-muted-foreground">{confirmMessage}</p>
                    </DialogBody>
                    <DialogFooter className="flex flex-col gap-3 p-5">
                        <button
                            type="button"
                            onClick={confirmLanguageChange}
                            className="flex min-h-[88px] items-center justify-center rounded-full bg-primary px-6 text-lg font-bold text-primary-foreground shadow-sm active:scale-[0.99]"
                        >
                            {switchLabel}
                        </button>
                        <button
                            type="button"
                            onClick={cancelLanguageChange}
                            className="flex min-h-[88px] items-center justify-center rounded-full bg-card px-6 text-lg font-semibold text-foreground shadow-sm active:scale-[0.99]"
                        >
                            {keepLabel}
                        </button>
                    </DialogFooter>
                </Dialog>
            )}
        </div>
    );
}
