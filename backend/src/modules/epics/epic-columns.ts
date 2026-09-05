/**
 * `T1573` / `T1598` (EPIC-044, `FR-EPB-023`, `FR-EPB-025`, `FR-EPB-050`) — the
 * three columns a requirement or specification row carries about its Epic:
 * the id, the number and the title, or null for *unassigned*. One function for
 * both lists, so the two screens cannot describe the same Epic differently.
 */

export interface EpicColumns {
  readonly epicId: string | null;
  readonly epicNumber: number | null;
  readonly epicTitle: string | null;
}

export function withEpicColumns<T extends { epicId?: string | null }>(rows: readonly T[], epics: readonly { id: string; number: number; title: string }[]): (T & EpicColumns)[] {
  const byId = new Map(epics.map((e) => [e.id, e]));
  return rows.map((row) => {
    const epic = row.epicId ? byId.get(row.epicId) : undefined;
    return { ...row, epicId: row.epicId ?? null, epicNumber: epic?.number ?? null, epicTitle: epic?.title ?? null };
  });
}
