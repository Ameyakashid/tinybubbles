/**
 * One honest way to mock `@mindwtr/core` in mobile tests.
 *
 * Mobile vitest cannot render a component that calls the real `useTaskStore`:
 * zustand under `packages/core/node_modules` resolves the root React while
 * react-test-renderer resolves `apps/mobile/node_modules/react`, so the hook
 * gets a null dispatcher (`Cannot read properties of null (reading 'useRef')`).
 * The store hook therefore has to be replaced — but ONLY the store hook.
 *
 * A mock that returns a bare object instead of spreading the real module
 * replaces every core function the component touches with a hand-written stub,
 * and the suite can then only confirm the stubs' own assumptions. Two mobile
 * tests were found re-implementing `getProjectNextActionPromptData` without its
 * `scope` field or its section-scoped branch, so #911's behaviour was untestable
 * by construction.
 *
 * Usage — the factory must import this lazily, because `vi.mock` is hoisted
 * above the file's own imports:
 *
 * ```ts
 * const storeState = vi.hoisted(() => ({ tasks: [], updateTask: vi.fn() }));
 *
 * vi.mock('@mindwtr/core', async (importOriginal) => {
 *   const { mockCore } = await import('../test-support/mock-core');
 *   return mockCore(importOriginal, () => storeState);
 * });
 * ```
 *
 * Pass `overrides` only for things that genuinely cannot run in this
 * environment (native modules, wall-clock formatting) — never to reshape a pure
 * core function into what the test wishes it did.
 */
export async function mockCore(
    importOriginal: () => Promise<Record<string, unknown>>,
    getState: () => unknown,
    overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
    const actual = await importOriginal();
    const useTaskStore = Object.assign(
        (selector?: (state: unknown) => unknown) => (
            typeof selector === 'function' ? selector(getState()) : getState()
        ),
        {
            getState,
            setState: (partial: unknown) => Object.assign(
                getState() as Record<string, unknown>,
                typeof partial === 'function'
                    ? (partial as (state: unknown) => Record<string, unknown>)(getState())
                    : partial,
            ),
            subscribe: () => () => {},
        },
    );

    return {
        ...actual,
        useTaskStore,
        // Real `shallow` compares store slices across two React copies; identity
        // is enough when the state object is a test-owned singleton.
        shallow: Object.is,
        ...overrides,
    };
}
