// A value the test's own data says is there (a catalog's entry, a list's first item), checked: missing,
// the test fails here, naming it, rather than further on with "cannot read properties of undefined".
// In place of `!`, which the lint rules forbid (plans/checked-everywhere.md).
export function got<T>(value: T | null | undefined, what = "a value the test expects"): T {
  if (value === undefined || value === null) {
    throw new Error(`missing: ${what}`);
  }
  return value;
}
