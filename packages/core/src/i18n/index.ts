export type { Language } from './i18n-types';
import { en } from './locales/en';

export type TranslateFn = (key: string) => string;

let englishTextToKey: Map<string, string> | null = null;

export function getI18nKeyForEnglishText(text: string): string | undefined {
    if (!englishTextToKey) {
        englishTextToKey = new Map();
        for (const [key, value] of Object.entries(en)) {
            if (englishTextToKey.has(value)) continue;
            englishTextToKey.set(value, key);
        }
    }
    return englishTextToKey.get(text);
}

export function getEnglishI18nValue(key: string): string | undefined {
    return en[key];
}

export function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
}

export type I18nTemplateValues = Record<string, string | number | boolean | null | undefined>;

// The one home for "resolve a display string". `t()` returns the KEY on a miss
// on both platforms, so a miss is `t(key) === key` (or empty) -- what to show
// instead is a policy, and it used to be hand-written in five app-level shapes
// where no core test could reach it. One of those shapes machine-translated the
// English word by word and shipped word salad for two years.
//
// Miss order: an explicit `fallback` (the caller knows better than the locale
// table), else the English copy, else the raw key so the miss is visible.
export function resolveI18nText(
    t: TranslateFn,
    key: string,
    options?: { fallback?: string; values?: I18nTemplateValues },
): string {
    const translated = t(key);
    const text = translated && translated !== key
        ? translated
        : options?.fallback ?? getEnglishI18nValue(key) ?? key;
    return options?.values ? formatI18nTemplate(text, options.values) : text;
}

export function formatI18nTemplate(
    template: string,
    values: I18nTemplateValues,
): string {
    return template.replace(/\{\{?\s*([A-Za-z0-9_]+)\s*\}\}?/g, (match, key: string) => (
        Object.prototype.hasOwnProperty.call(values, key)
            ? String(values[key] ?? '')
            : match
    ));
}

export const tFallback = translateWithFallback;
