import { describe, expect, it, vi } from 'vitest';

import {
    KEYRING_FALLBACK_WARNING_EVENT,
    formatKeyringFallbackWarning,
    installKeyringFallbackWarningListener,
} from './keyring-fallback-warning';

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('keyring fallback warnings', () => {
    it('allows known labels while discarding arbitrary payload bytes', () => {
        expect(formatKeyringFallbackWarning(
            'Dropbox recovery credentials stored in plaintext because the system keyring is unavailable.',
        )).toBe(
            'Dropbox recovery credentials stored in plaintext because the system keyring is unavailable.',
        );

        const unsafe = '/home/alice/private/token=secret-value';
        const warning = formatKeyringFallbackWarning(
            `${unsafe} stored in plaintext because the system keyring is unavailable.`,
        );
        expect(warning).toBe(
            'A credential is stored in plaintext because the system keyring is unavailable.',
        );
        expect(warning).not.toContain('/home/alice');
        expect(warning).not.toContain('secret-value');
    });

    it('subscribes once, forwards the sanitized payload, and unlistens on cleanup', async () => {
        let handler: ((event: { payload: unknown }) => void) | undefined;
        const unlisten = vi.fn();
        const listen = vi.fn(async (
            eventName: string,
            nextHandler: (event: { payload: unknown }) => void,
        ) => {
            expect(eventName).toBe(KEYRING_FALLBACK_WARNING_EVENT);
            handler = nextHandler;
            return unlisten;
        });
        const onWarning = vi.fn();
        const dispose = installKeyringFallbackWarningListener({
            onWarning,
            loadEventApi: async () => ({ listen }),
        });
        await flushPromises();

        handler?.({
            payload: 'Cloud token stored in plaintext because the system keyring is unavailable.',
        });
        expect(onWarning).toHaveBeenCalledWith(
            'Cloud token stored in plaintext because the system keyring is unavailable.',
        );

        dispose();
        expect(unlisten).toHaveBeenCalledTimes(1);
        handler?.({ payload: 'WebDAV password stored in plaintext because the system keyring is unavailable.' });
        expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('unlistens if cleanup wins the asynchronous setup race', async () => {
        let resolveEventApi!: (api: { listen: ReturnType<typeof vi.fn> }) => void;
        const eventApiPromise = new Promise<{ listen: ReturnType<typeof vi.fn> }>((resolve) => {
            resolveEventApi = resolve;
        });
        const unlisten = vi.fn();
        const listen = vi.fn(async () => unlisten);
        const dispose = installKeyringFallbackWarningListener({
            onWarning: vi.fn(),
            loadEventApi: () => eventApiPromise,
        });

        dispose();
        resolveEventApi({ listen });
        await flushPromises();

        expect(unlisten).toHaveBeenCalledTimes(1);
    });
});
