/**
 * T112 — version comparison (FR-015).
 *
 * Line-based: what a reviewer reads. A multiset comparison — a repeated line
 * counts each occurrence — kept deliberately simpler than a positional diff:
 * FR-015 asks "what changed between these versions", not "render a patch".
 *
 * Framework-free (PC-1).
 */

export interface ComparableVersion {
  versionNumber: number;
  contentRaw: string;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  added: string[];
  removed: string[];
  unchanged: number;
  identical: boolean;
}

function lines(content: string): string[] {
  // A trailing newline does not create a phantom empty line.
  const all = content.split('\n');
  if (all[all.length - 1] === '') all.pop();
  return all;
}

export function diffVersions(a: ComparableVersion, b: ComparableVersion): VersionDiff {
  const before = lines(a.contentRaw);
  const after = lines(b.contentRaw);

  // Multiset difference: count occurrences on each side.
  const counts = new Map<string, number>();
  for (const line of before) counts.set(line, (counts.get(line) ?? 0) + 1);

  const added: string[] = [];
  let unchanged = 0;
  for (const line of after) {
    const remaining = counts.get(line) ?? 0;
    if (remaining > 0) {
      counts.set(line, remaining - 1);
      unchanged += 1;
    } else {
      added.push(line);
    }
  }

  const removed: string[] = [];
  for (const line of before) {
    const remaining = counts.get(line) ?? 0;
    if (remaining > 0) {
      counts.set(line, remaining - 1);
      removed.push(line);
    }
  }

  return {
    fromVersion: a.versionNumber,
    toVersion: b.versionNumber,
    added,
    removed,
    unchanged,
    identical: added.length === 0 && removed.length === 0,
  };
}
