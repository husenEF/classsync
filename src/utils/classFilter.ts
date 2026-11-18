/**
 * Narrowing a list of sessions to one class.
 *
 * "none" means sessions filed under no class — including those whose class
 * has since been deleted, which would otherwise match no filter at all and
 * vanish from the list.
 */
export type ClassFilter = 'all' | 'none' | number;

export function filterByClass<R extends {scheduleId?: number}>(
  records: readonly R[],
  filter: ClassFilter,
  classIds: readonly (number | undefined)[],
): R[] {
  if (filter === 'all') return [...records];
  if (filter === 'none') {
    const known = new Set(classIds);
    return records.filter((r) => r.scheduleId === undefined || !known.has(r.scheduleId));
  }
  return records.filter((r) => r.scheduleId === filter);
}

/** Read a filter back from a select's value or from storage. */
export function parseClassFilter(value: string | null | undefined): ClassFilter {
  if (value === 'none') return 'none';
  const id = Number(value);
  return value && Number.isInteger(id) ? id : 'all';
}
