/**
 * Recursively removes `undefined` values from a payload so it can be written to
 * Firestore. The Firestore Web SDK rejects any document containing `undefined`
 * field values with "Unsupported field value: undefined" unless
 * `ignoreUndefinedProperties` is enabled globally. We deliberately avoid that
 * global flag because `initializeFirestore` is not idempotent inside the
 * Next.js HMR singleton in `firebase.ts`.
 *
 * Optional fields on form/domain objects (e.g. ManagedProduct.mockupImages,
 * productAddons, variant.inventory) are frequently left `undefined`, and the
 * object spread in a save handler carries them into the write. Stripping them
 * here makes every save robust regardless of how the object was assembled.
 *
 * `null` and all real values are preserved; `undefined` array elements are dropped.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    ) as T;
  }
  return value;
}
