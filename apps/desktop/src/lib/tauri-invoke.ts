import { isTauriRuntime } from './runtime';

/**
 * The transport that actually reaches Rust. Swappable so callers get a seam
 * without each adapter growing its own dependency-injection scaffolding.
 */
export type NativeInvokeTransport = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const tauriTransport: NativeInvokeTransport = async <T>(
    command: string,
    args?: Record<string, unknown>,
): Promise<T> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
};

let transport: NativeInvokeTransport = tauriTransport;

/** Replaces the transport (tests, fakes). Pass `null` to restore the real one. */
export function setNativeInvokeTransport(next: NativeInvokeTransport | null): void {
    transport = next ?? tauriTransport;
}

/**
 * Invokes a Rust command. Rejects when there is no Tauri runtime — use this
 * when the caller has already established it is running in the desktop shell,
 * or when failing is the correct outcome elsewhere.
 */
export async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauriRuntime()) {
        throw new Error('Tauri runtime is unavailable.');
    }
    return transport<T>(command, args);
}

/**
 * Invokes a Rust command, resolving to `fallback` when there is no Tauri
 * runtime (web/dev builds), so the caller does not need its own guard.
 */
export async function invokeNativeOr<T>(
    fallback: T,
    command: string,
    args?: Record<string, unknown>,
): Promise<T> {
    if (!isTauriRuntime()) return fallback;
    return transport<T>(command, args);
}
