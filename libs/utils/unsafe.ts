export const unsafe = async <T = any>(
  unsafeFn: (...params: any[]) => T | Promise<T>,
  safeFn: T | ((...params: any[]) => T | Promise<T>),
): Promise<T> => {
  try {
    const r = unsafeFn()

    if (r instanceof Promise) {
      // @ts-expect-error
      return r.catch((e) => (typeof safeFn === 'function' ? safeFn(e) : safeFn))
    }

    return r
  } catch (e) {
    // @ts-expect-error
    return typeof safeFn === 'function' ? safeFn(e) : safeFn
  }
}
