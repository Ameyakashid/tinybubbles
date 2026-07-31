export type NotifyProfile = {
    listenerCount: number;
    timedCalls: number;
    timedTotalMs: number;
    maxMs: number;
    top5Ms: number[];
    top5Names: string[];
};

type TimedEntry = {
    ms: number;
    name: string;
};

type ProfileCollection = {
    entries: TimedEntry[];
};

type InstrumentableStore = {
    subscribe: (...args: never[]) => unknown;
};

let activeListenerCount = 0;
let currentProfile: ProfileCollection | null = null;
const instrumentedStores = new WeakSet<object>();
const listenerNames = new WeakMap<object, string>();

const now = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

/**
 * Labels a store listener so slow-pipeline logs can attribute time to it by
 * name instead of an anonymous slot in `notifyTop5Ms` (#766: one ~420ms
 * subscriber stayed unidentified for a whole round). Only ever pass fixed
 * string literals — the name lands in diagnostic logs.
 */
export const nameNotifyListener = <T extends object>(name: string, listener: T): T => {
    listenerNames.set(listener, name);
    return listener;
};

const resolveListenerName = (listener: object): string => {
    const named = listenerNames.get(listener);
    if (named) return named;
    const fnName = (listener as { name?: string }).name;
    return fnName && fnName.length > 0 ? fnName : 'anonymous';
};

const timeListener = (
    listener: (...args: unknown[]) => unknown,
): ((...args: unknown[]) => unknown) =>
    function (this: unknown, ...listenerArgs: unknown[]): unknown {
        const profile = currentProfile;
        if (!profile) return listener.apply(this, listenerArgs);

        const startedAt = now();
        try {
            return listener.apply(this, listenerArgs);
        } finally {
            profile.entries.push({
                ms: now() - startedAt,
                name: resolveListenerName(listener),
            });
        }
    };

export const instrumentStoreSubscribe = <TStore extends InstrumentableStore>(
    api: TStore,
): void => {
    if (instrumentedStores.has(api)) return;

    const originalSubscribe = api.subscribe as unknown as (
        ...args: unknown[]
    ) => unknown;
    const subscribe = function (this: unknown, ...args: unknown[]): unknown {
        // Hook form is subscribe(listener); selector form is
        // subscribe(selector, listener[, options]) — time the listener in both
        // so setNotifyMs minus notifyTimedMs isolates React render time.
        let subscribeArgs = args;
        if (args.length === 1 && typeof args[0] === 'function') {
            subscribeArgs = [timeListener(args[0] as (...a: unknown[]) => unknown)];
        } else if (
            args.length >= 2
            && typeof args[0] === 'function'
            && typeof args[1] === 'function'
        ) {
            subscribeArgs = [
                args[0],
                timeListener(args[1] as (...a: unknown[]) => unknown),
                ...args.slice(2),
            ];
        }
        const unsubscribe = originalSubscribe.apply(this, subscribeArgs);
        if (typeof unsubscribe !== 'function') return unsubscribe;

        activeListenerCount += 1;
        let active = true;
        return () => {
            if (!active) return;
            active = false;
            activeListenerCount -= 1;
            unsubscribe();
        };
    };

    api.subscribe = subscribe as TStore['subscribe'];
    instrumentedStores.add(api);
};

export const beginNotifyProfile = (): void => {
    currentProfile = { entries: [] };
};

export const endNotifyProfile = (): NotifyProfile | null => {
    const profile = currentProfile;
    if (!profile) return null;
    currentProfile = null;

    profile.entries.sort((left, right) => right.ms - left.ms);
    const top5 = profile.entries.slice(0, 5);
    return {
        listenerCount: activeListenerCount,
        timedCalls: profile.entries.length,
        timedTotalMs: profile.entries.reduce(
            (total, entry) => total + entry.ms,
            0,
        ),
        maxMs: profile.entries[0]?.ms ?? 0,
        top5Ms: top5.map((entry) => entry.ms),
        top5Names: top5.map((entry) => entry.name),
    };
};
