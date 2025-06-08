export type AddVariable<TKey extends string, TValue> = {
  Variables: {
    [key in TKey]: TValue
  }
}
