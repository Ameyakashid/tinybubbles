#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { en } from '../packages/core/src/i18n/locales/en';
import { LOCALES, isMixedEnglishChecked } from '../packages/core/src/i18n/i18n-locales';
import { hasTranslatableEnglishText, isAllowedEnglishMirrorKey } from '../packages/core/src/i18n/locale-quality';

type Dictionary = Record<string, string>;

const englishKeys = Object.keys(en).sort();
const englishKeySet = new Set(englishKeys);

// Derived from packages/core/src/i18n/i18n-locales.ts, the same table locale-parity.test.ts
// derives its rosters from. This was a hand-kept mirror of that table until 2026-08-08, plus
// hand-kept copies of its fullParity flags and its mixed-English roster, and a locale missing
// from the mirror was SILENTLY skipped — fa was, once. The stated reason for not deriving
// ("the zh entry maps to two files") was not true: LOCALES has separate zh and zh-Hant
// entries. The real mismatch was that this script keyed by filename while LOCALES keys by
// Language, which the `file` field now covers — and keying by Language also means an
// allowedEnglishMirrorKeysByLocale entry for zh (the test keys it that way) is no longer
// silently ignored here.
const localeTargets = Object.entries(LOCALES).map(([locale, descriptor]) => ({
    locale,
    path: `packages/core/src/i18n/locales/${descriptor.file}.ts`,
    // Must translate every English key, not just a floor's worth of them.
    fullParity: descriptor.translatedKeyFloor === 'all',
    mixedEnglishChecked: isMixedEnglishChecked(descriptor, englishKeys.length),
}));

const args = new Set(process.argv.slice(2));
const shouldFix = args.has('--fix');
const shouldCheck = args.has('--check') || !shouldFix;

function resolveDictionary(moduleExports: Record<string, unknown>): Dictionary {
    if (moduleExports.zhHans && typeof moduleExports.zhHans === 'object') return moduleExports.zhHans as Dictionary;
    if (moduleExports.zhHant && typeof moduleExports.zhHant === 'object') return moduleExports.zhHant as Dictionary;
    const overrideEntry = Object.entries(moduleExports).find(([name, value]) => (
        name.endsWith('Overrides') && value && typeof value === 'object'
    ));
    if (overrideEntry) return overrideEntry[1] as Dictionary;
    throw new Error('Could not find a locale dictionary export.');
}

function removeKeys(filePath: string, keys: Set<string>) {
    const entryPattern = /^\s*'([^']+)':\s*/;
    const source = readFileSync(filePath, 'utf8');
    const nextLines: string[] = [];
    for (const line of source.split('\n')) {
        const match = line.match(entryPattern);
        if (match && keys.has(match[1])) {
            if (nextLines.at(-1)?.trim() === '// English fallbacks keep shipped locale files in key parity.') {
                nextLines.pop();
            }
            continue;
        }
        nextLines.push(line);
    }
    writeFileSync(filePath, nextLines.join('\n'));
}

let problemCount = 0;

for (const target of localeTargets) {
    const modulePath = join('..', target.path);
    const moduleExports = await import(modulePath);
    const dictionary = resolveDictionary(moduleExports);
    const localeKeys = new Set(Object.keys(dictionary));

    const unknownKeys = Object.keys(dictionary).filter((key) => !englishKeySet.has(key));
    const mirroredEnglishKeys = Object.keys(dictionary)
        .filter((key) => dictionary[key] === en[key]
            && hasTranslatableEnglishText(en[key])
            && !isAllowedEnglishMirrorKey(target.locale, key));
    const mixedEnglishKeys = target.mixedEnglishChecked
        ? Object.keys(dictionary).filter((key) => hasTranslatableEnglishText(dictionary[key]))
        : [];
    const missingKeys = target.fullParity
        ? englishKeys.filter((key) => !localeKeys.has(key))
        : [];
    const fixableKeys = new Set([...unknownKeys, ...mirroredEnglishKeys, ...mixedEnglishKeys]);

    if (missingKeys.length === 0 && unknownKeys.length === 0 && mirroredEnglishKeys.length === 0 && mixedEnglishKeys.length === 0) {
        console.log(`${target.locale}: ok`);
        continue;
    }

    problemCount += missingKeys.length + unknownKeys.length + mirroredEnglishKeys.length + mixedEnglishKeys.length;
    if (missingKeys.length > 0) console.log(`${target.locale}: missing ${missingKeys.length} keys`);
    if (unknownKeys.length > 0) console.log(`${target.locale}: unknown ${unknownKeys.length} keys`);
    if (mirroredEnglishKeys.length > 0) console.log(`${target.locale}: mirrored English ${mirroredEnglishKeys.length} keys`);
    if (mixedEnglishKeys.length > 0) console.log(`${target.locale}: mixed English ${mixedEnglishKeys.length} keys`);
    if (shouldFix) {
        if (missingKeys.length > 0) {
            console.log(`${target.locale}: missing full-parity translations require manual translation`);
        }
        if (fixableKeys.size > 0) {
            removeKeys(target.path, fixableKeys);
            console.log(`${target.locale}: removed stale override entries`);
        }
    } else if (shouldCheck) {
        for (const [label, keys] of [
            ['missing', missingKeys],
            ['unknown', unknownKeys],
            ['mirrored', mirroredEnglishKeys],
            ['mixed English', mixedEnglishKeys],
        ] as const) {
            for (const key of keys.slice(0, 20)) {
                console.log(`  - ${label}: ${key}`);
            }
            if (keys.length > 20) {
                console.log(`  ...and ${keys.length - 20} more ${label}`);
            }
        }
    }
}

if (problemCount > 0 && shouldCheck && !shouldFix) {
    console.error(`Locale parity failed: ${problemCount} problems. Run bun run scripts/i18n-locale-parity.ts --fix to remove stale override entries.`);
    process.exit(1);
}
