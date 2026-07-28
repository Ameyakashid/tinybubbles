import { getEnglishI18nValue } from './i18n';

// Single source for which settings-label keys each settings page surfaces to
// search. Desktop imports this directly as its `SETTINGS_PAGE_LABEL_KEYS`
// (see apps/desktop/src/components/views/settings/labels.ts, which owns the
// `keyof SettingsLabels` vocabulary these bare key names come from); mobile
// derives its row keywords from the same arrays (see
// apps/mobile/components/settings/settings.constants.ts). Keep this in step
// with the desktop settings pages and their nav items.
export type SettingsSearchPageId =
    | 'main'
    | 'gtd'
    | 'manage'
    | 'notifications'
    | 'sync'
    | 'data'
    | 'integrations'
    | 'ai'
    | 'advanced'
    | 'about';

export const SETTINGS_SEARCH_PAGE_KEYS: Record<SettingsSearchPageId, readonly string[]> = {
    main: [
        'general', 'appearance', 'density', 'textSize', 'showTaskAge', 'language',
        'weekStart', 'dateFormat', 'calendarSystem', 'timeFormat', 'keybindings',
        'windowDecorations', 'closeBehavior', 'showTray', 'launchAtStartup',
        'undoNotifications',
    ],
    gtd: [
        'gtd', 'features', 'featurePomodoro', 'autoArchive', 'defaultScheduleTime',
        'focusTaskLimit', 'defaultProjectFlowMode', 'projectFlowParallel',
        'projectFlowSequential', 'timeEstimatePresets', 'captureDefault',
        'defaultArea', 'quickAddAutoClean', 'naturalLanguageDates', 'markdownEditorAssist',
        'weeklyReviewConfig', 'inboxProcessing', 'taskEditorLayout',
        'taskEditorPresentation',
    ],
    manage: ['manage'],
    notifications: ['notifications'],
    sync: ['sync', 'backgroundSync', 'calendarFeed'],
    data: ['dataTransfer', 'restoreBackup', 'importTodoist', 'importTickTick', 'importDgt', 'importOmniFocus'],
    integrations: ['integrations', 'obsidianVault', 'calendarChooseLocalFile'],
    ai: ['ai'],
    advanced: ['advanced', 'localApiServer'],
    about: ['about'],
};

// The only bare key above whose real i18n key isn't the default
// `settings.<key>` (mirrors desktop's own `labelKeyOverrides` for this one
// entry — every other override in that map resolves a key not used by any
// page's search roster, or resolves to the same string the default rule
// would produce anyway).
const SEARCH_KEY_I18N_OVERRIDES: Record<string, string> = {
    keybindings: 'keybindings.helpTitle',
};

export function resolveSettingsSearchI18nKey(key: string): string {
    return SEARCH_KEY_I18N_OVERRIDES[key] ?? `settings.${key}`;
}

// Desktop page-search keys that mobile does not need to index verbatim, each
// with the reason it's safe to skip: the feature doesn't exist on mobile, or
// the key is a value-option/section-heading label whose parent setting is
// indexed on its own. Every key in SETTINGS_SEARCH_PAGE_KEYS must be either
// resolvable on mobile or listed here — see settings-search-keys.test.ts.
export const SETTINGS_SEARCH_MOBILE_EXCLUSIONS: Record<string, string> = {
    density: 'No adjustable list density setting on mobile.',
    textSize: 'Mobile follows the OS text-size setting automatically; no in-app override.',
    keybindings: 'No hardware-keyboard shortcuts configuration on mobile.',
    windowDecorations: 'Desktop window chrome; not applicable on mobile.',
    closeBehavior: 'Desktop window-close behavior (ask/tray/quit); mobile apps background instead of closing.',
    showTray: 'No system tray on mobile.',
    launchAtStartup: 'No user-facing autostart setting on mobile.',
    undoNotifications: 'Desktop-only preference; not present on mobile.',
    projectFlowParallel: 'Value-option label for defaultProjectFlowMode, which is indexed on its own.',
    projectFlowSequential: 'Value-option label for defaultProjectFlowMode, which is indexed on its own.',
    taskEditorPresentation: 'Desktop-only inline/modal task-editor choice; the mobile editor has one fixed presentation.',
    dataTransfer: 'Section heading, not a standalone feature — its settings (restore, imports) are indexed individually.',
    localApiServer: 'No local API server on mobile.',
    calendarFeed: 'The self-hosted server\'s calendar subscription is published and revoked from desktop settings only (#952).',
    integrations: 'No mobile settings row for this desktop page (folds Obsidian + local calendar-file import, neither of which exists on mobile).',
    obsidianVault: 'No Obsidian vault integration on mobile (desktop-only, needs local filesystem access).',
    calendarChooseLocalFile: 'No local .ics file picker on mobile (same Integrations page as obsidianVault above).',
};

// English text for a page's search keys, skipping excluded keys — the actual
// "resolves to a real string" invariant the original bug report was about.
export function getSettingsSearchPageEnglishText(pageId: SettingsSearchPageId): string[] {
    return SETTINGS_SEARCH_PAGE_KEYS[pageId]
        .filter((key) => !(key in SETTINGS_SEARCH_MOBILE_EXCLUSIONS))
        .map((key) => getEnglishI18nValue(resolveSettingsSearchI18nKey(key)))
        .filter((value): value is string => Boolean(value && value.trim()));
}
