# Locale Contribution Guide

Tiny Bubbles keeps translations under this folder so community contributions are easy to submit.

- `en.ts`: English source strings (base dictionary).
- `zh-Hans.ts`: Full Simplified Chinese dictionary.
- `zh-Hant.ts`: Full Traditional Chinese dictionary.
- `*.ts` for other languages: manual override dictionaries. These locales are partial by design; missing keys fall back to English.

English and Chinese are the only standalone dictionaries today. For languages using overrides, prefer adding explicit translations for all keys, but do not copy English strings into override files as placeholders.

Each locale carries a `translatedKeyFloor` in `i18n-locales.ts`, and CI enforces it. It is an absolute **number of keys**, not a percentage: deleting a translation always fails the gate, and adding a new English string never does. Raise a floor when real translation work lands; never lower it. A floor of `'all'` means every key in `en.ts` has to be translated — `zh` and `zh-Hant` carry it because they are full dictionaries, and `fa` and `sv` carry it because they are maintained at full parity even though they load as override dictionaries.

## What an untranslated string shows

A key a locale has not translated renders as the English copy, not as anything machine-derived. `resolveI18nText` in `packages/core/src/i18n/index.ts` is the one home for that policy, and its miss order is: an explicit fallback the caller passed, then the English string, then the raw key so a genuinely missing key stays visible. So an incomplete locale reads as clean mixed-language UI, and adding a translation is always an improvement over the English it replaces.

## When a translation matches English

Some translated UI strings are intentionally identical to English, for example short labels like `Auto` or `Compact`, product names, protocol names, and command tokens. If a translator has reviewed the string and the target-language UI should match English, keep the entry in the locale override file. Coverage counts reviewed override keys, not only strings that visually differ from English.

Tiny Bubbles also checks for verbatim English-looking values so placeholder copies do not ship by accident. If `bun run i18n:check` or `locale-parity.test.ts` flags a deliberately identical translation, add that specific key to the locale-specific mirrored-English allow-list used by both checks. Keep that list narrow and key-based; do not remove reviewed translations just to reduce the warning, and do not broadly ignore all identical strings for a locale.

Parser and command tokens stay in English inside translated help text, for example `/start:`, `/due:`, `/review:`, `/note:`, `/link:`, `/energy:`, `/next`, `/area:`, `!Area`, `@context`, `#tag`, and `+Project`.

## How to contribute a language fix

1. Open the language file (for example `vi.ts` for Vietnamese or `fr.ts` for French).
2. Add or update keys in `<lang>Overrides`.
3. For a new language, start with one entry in `i18n-locales.ts`. `Language`, `SUPPORTED_LANGUAGES`, the loader's dispatch, both apps' language pickers, and the parity rosters all derive from that table. Four places still need a manual entry: `DATE_LOCALE_BY_LANGUAGE` and `LOCALE_TAG_BY_LANGUAGE` in `date.ts`, `translationsByLocale` in `locale-parity.test.ts`, and the locale's mirrored-English allow-list in `locale-quality.ts` if it needs one.
4. Keep command tokens in English where applicable (`/start:`, `/due:`, `/review:`, `/note:`, `/energy:`, `/next`, `@context`, `#tag`, `+Project`).
5. If you touched any `starter.*` string, regenerate the seed table. `starter-seed-strings.ts` is generated and must not be hand-edited; `bun run i18n:check` fails with "starter-seed-strings.ts: out of date" until you run:

```bash
bun run scripts/i18n-locale-parity.ts --fix
```

6. Run tests:

```bash
bun run --filter @tinybubbles/core test
```

## How to find new strings to translate

You do not need to compare `en.ts` and `<lang>.ts` line by line.

From the repo root, run:

```bash
bun run scripts/i18n-locale-diff.ts de
```

Replace `de` with another locale code such as `vi`, `fr`, `it`, or `nl`.

The script reports:

- locale coverage percentage
- keys that exist in `en.ts` but are missing from the locale file and currently fall back to English
- keys that exist in the locale file but no longer exist in `en.ts`

The percentage is informational only. The gate compares the locale's translated **key count** against its `translatedKeyFloor`, so the number to watch when you are clearing a CI failure is the count of missing keys, not the percentage.
