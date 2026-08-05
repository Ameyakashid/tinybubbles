import * as SecureStore from 'expo-secure-store';

let availability: Promise<boolean> | null = null;
const sessionSecrets = new Map<string, string>();

/**
 * Cache stable availability, but never turn a rejected native probe into an
 * "unsupported" result. A later operation must be able to retry the probe.
 */
export const isSecureStoreAvailable = (): Promise<boolean> => {
    if (!availability) {
        availability = SecureStore.isAvailableAsync().catch((error) => {
            availability = null;
            throw error;
        });
    }
    return availability;
};

export const getSessionSecret = (key: string): string | null => {
    return sessionSecrets.get(key) ?? null;
};

export const setSessionSecret = (key: string, value: string): void => {
    sessionSecrets.set(key, value);
};

export const deleteSessionSecret = (key: string): void => {
    sessionSecrets.delete(key);
};

export const evacuateLegacySecretToSession = async (
    key: string,
    value: string,
    removeLegacy: () => Promise<void>,
): Promise<void> => {
    setSessionSecret(key, value);
    try {
        await removeLegacy();
    } catch (error) {
        deleteSessionSecret(key);
        throw error;
    }
};

export const __resetSecureSecretStoreForTests = (): void => {
    availability = null;
    sessionSecrets.clear();
};
