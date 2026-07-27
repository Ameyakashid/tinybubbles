// Shared by service.ts (local adapter) and cloud-service.ts (cloud adapter) — both build a
// partial update object from optional tool inputs and need to drop the `undefined` keys
// before handing it to core/the REST API (an explicit `undefined` is not the same as an
// absent key to `Object.entries`/`JSON.stringify`).
export const filterUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
};
