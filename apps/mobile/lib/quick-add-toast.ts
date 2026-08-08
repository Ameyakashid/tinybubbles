import type { ToastOptions } from '@/contexts/toast-context';

/**
 * The one warning a capture surface shows when quick-add reports a date command
 * it could not read. The literal was copy-pasted at six mobile sites, which is
 * six chances for the wording, tone or duration to drift apart.
 */
export function showInvalidDateCommandToast(
    showToast: (options: ToastOptions) => void,
    t: (key: string) => string,
    invalidDateCommands: readonly string[],
): void {
    showToast({
        title: t('common.notice'),
        message: `${t('quickAdd.invalidDateCommand')}: ${invalidDateCommands.join(', ')}`,
        tone: 'warning',
        durationMs: 4200,
    });
}
