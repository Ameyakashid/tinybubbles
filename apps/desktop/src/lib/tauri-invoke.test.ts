import { afterEach, describe, expect, it, vi } from 'vitest';

import { invokeNative, invokeNativeOr, setNativeInvokeTransport } from './tauri-invoke';

const enableTauri = () => {
    (window as any).__TAURI_INTERNALS__ = {};
};

const disableTauri = () => {
    delete (window as any).__TAURI_INTERNALS__;
};

afterEach(() => {
    setNativeInvokeTransport(null);
    disableTauri();
});

describe('invokeNative', () => {
    it('rejects when there is no Tauri runtime', async () => {
        const transport = vi.fn();
        setNativeInvokeTransport(transport as never);
        await expect(invokeNative('get_thing')).rejects.toThrow('Tauri runtime is unavailable.');
        expect(transport).not.toHaveBeenCalled();
    });

    it('forwards the command and args to the transport', async () => {
        enableTauri();
        const transport = vi.fn(async () => 'ok');
        setNativeInvokeTransport(transport as never);
        await expect(invokeNative<string>('get_thing', { id: 7 })).resolves.toBe('ok');
        expect(transport).toHaveBeenCalledWith('get_thing', { id: 7 });
    });

    it('propagates transport failures', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => {
            throw new Error('boom');
        }) as never);
        await expect(invokeNative('get_thing')).rejects.toThrow('boom');
    });
});

describe('invokeNativeOr', () => {
    it('resolves to the fallback when there is no Tauri runtime', async () => {
        const transport = vi.fn();
        setNativeInvokeTransport(transport as never);
        await expect(invokeNativeOr({ enabled: false }, 'get_thing')).resolves.toEqual({ enabled: false });
        expect(transport).not.toHaveBeenCalled();
    });

    it('returns the native result when the runtime is present', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => ({ enabled: true })) as never);
        await expect(invokeNativeOr({ enabled: false }, 'get_thing')).resolves.toEqual({ enabled: true });
    });

    it('does not swallow transport failures inside the runtime', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => {
            throw new Error('boom');
        }) as never);
        await expect(invokeNativeOr('fallback', 'get_thing')).rejects.toThrow('boom');
    });
});

describe('setNativeInvokeTransport', () => {
    it('restores the real transport when passed null', async () => {
        enableTauri();
        setNativeInvokeTransport((async () => 'fake') as never);
        await expect(invokeNative<string>('get_thing')).resolves.toBe('fake');
        setNativeInvokeTransport(null);
        // The real transport reaches @tauri-apps/api/core, which has no IPC
        // handler in jsdom; the point is only that the fake is gone.
        await expect(invokeNative<string>('get_thing')).rejects.toThrow();
    });
});
