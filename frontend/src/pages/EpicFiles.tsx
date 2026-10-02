/**
 * `T1651` / `T1655` / `T1685` (EPIC-045, `FR-ART-010`–`FR-ART-018`,
 * `FR-ART-035`, `FR-ART-009`) — the Epic detail's **Files** section: the tree,
 * the open file's header, the version picker, the refusals and the findings.
 *
 * ## A mirror, and it says so
 *
 * There is no control here that creates, uploads, renames, edits or deletes.
 * That is the design, not an omission: the project directory is authoritative,
 * and an edit made here would be silently overwritten by the next governed
 * command with the reader none the wiser. The section states which side is
 * authoritative in words, because a reader cannot infer it from absence.
 *
 * ## History is a picker, not storage
 *
 * The tree already carries every version's digest, size and delivering
 * executions — the read that built it loaded no content. Choosing a version
 * fetches exactly that one document, which is why an Epic with fifty files and
 * twenty versions each opens in one request rather than a thousand.
 *
 * ## Selection lives in the URL, but not in this component
 *
 * The host owns the address (`?file=&version=`); this component reports what
 * the reader chose through `onSelect` and renders whatever the host hands
 * back. That keeps the page reloadable and shareable without a router
 * dependency inside a section.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type ArtifactTree, type ArtifactTreeEntry, type ArtifactVersion } from '../services/api';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { MarkdownViewer } from '../design/components/MarkdownViewer';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** The first twelve hex characters — enough to recognise, short enough to read. */
function shortDigest(digest: string): string {
  return digest.slice(0, 12);
}

function when(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

/** `specs/003-reports/contracts/api.md` → `specs/003-reports/contracts`. */
function folderOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function nameOf(path: string): string {
  return path.split('/').slice(-1)[0] ?? path;
}

/** The Epic directory a synced path names, for the slug note (`FR-ART-035`). */
function epicDirectoryOf(path: string): string | null {
  const parts = path.split('/');
  return parts.length >= 3 && parts[0] === 'specs' ? (parts[1] as string) : null;
}

export interface EpicFilesSelection {
  readonly file: string | null;
  readonly version: string | null;
}

export interface EpicFilesProps {
  readonly api: ApiClient;
  readonly epicId: string;
  /** The Epic's slug today — compared against the directory its files were synced from. */
  readonly epicSlug?: string | undefined;
  readonly selectedFile?: string | undefined;
  readonly selectedVersion?: string | undefined;
  /** The reader chose a file or a version; the host writes it into the address. */
  readonly onSelect: (selection: EpicFilesSelection) => void;
}

export function EpicFiles({ api, epicId, epicSlug, selectedFile, selectedVersion, onSelect }: EpicFilesProps): ReactElement {
  const [tree, setTree] = useState<ArtifactTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ArtifactVersion | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(selectedFile ?? null);
  const [version, setVersion] = useState<string | null>(selectedVersion ?? null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getEpicArtifacts(epicId)
      .then((answer) => {
        if (live) setTree(answer);
      })
      .catch((err: unknown) => {
        if (live) setError(message(err));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return (): void => {
      live = false;
    };
  }, [api, epicId]);

  // The host's selection wins over the local one, so a back button and a
  // pasted address land on the same document a click would.
  useEffect(() => {
    if (selectedFile !== undefined) setFile(selectedFile);
  }, [selectedFile]);
  useEffect(() => {
    setVersion(selectedVersion ?? null);
  }, [selectedVersion]);

  const entry = useMemo(() => tree?.files.find((f) => f.path === file) ?? null, [tree, file]);
  const versionId = version ?? entry?.current?.versionId ?? null;

  useEffect(() => {
    if (versionId === null) {
      setOpen(null);
      return;
    }
    let live = true;
    setOpenError(null);
    api
      .getArtifactVersion(versionId)
      .then((answer) => {
        if (live) setOpen(answer);
      })
      .catch((err: unknown) => {
        if (live) {
          setOpen(null);
          setOpenError(message(err));
        }
      });
    return (): void => {
      live = false;
    };
  }, [api, versionId]);

  const choose = useCallback(
    (path: string, chosen: string | null): void => {
      setFile(path);
      setVersion(chosen);
      onSelect({ file: path, version: chosen });
    },
    [onSelect],
  );

  const syncedPaths = useMemo(() => (tree?.files ?? []).map((f) => f.path), [tree]);

  // The directory the files were synced FROM, against the Epic's slug today.
  // A rename is legitimate and common; what is not legitimate is a tree that
  // silently regroups, so the grouping stays by path and the difference is a
  // note (`FR-ART-035`, analysis `C2`).
  const syncedDirectory = useMemo(() => {
    for (const f of tree?.files ?? []) {
      const dir = epicDirectoryOf(f.path);
      if (dir !== null) return dir;
    }
    return null;
  }, [tree]);
  const slugNote = syncedDirectory !== null && epicSlug !== undefined && !syncedDirectory.endsWith(`-${epicSlug}`) ? { directory: syncedDirectory, slug: epicSlug } : null;

  const folders = useMemo(() => {
    const grouped = new Map<string, ArtifactTreeEntry[]>();
    for (const f of tree?.files ?? []) {
      const folder = folderOf(f.path);
      grouped.set(folder, [...(grouped.get(folder) ?? []), f]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tree]);

  return (
    <section className="ds-stack" aria-label="Files">
      <h3>Files</h3>
      {loading && <LoadingIndicator label="Loading files" />}
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error} The Epic&apos;s other sections are unaffected; try again, or read the files in the project directory.
        </p>
      )}

      {!loading && error === null && tree !== null && (
        <>
          <p className="ds-field__hint">
            These are the files governed commands synced. Nothing here can be edited: the project directory is authoritative and PMI Studio is a mirror of it.
          </p>
          {slugNote !== null && (
            <p className="ds-field__hint">
              Grouped by the directory the files were synced from — directory <code>{slugNote.directory}</code> · the Epic&apos;s slug is now <code>{slugNote.slug}</code>.
            </p>
          )}

          {tree.files.length === 0 && (
            <p className="ds-field__hint">No governed command has synced files for this Epic yet; the first completed specify produces `spec.md`.</p>
          )}

          {folders.map(([folder, entries]) => (
            <div key={folder} className="ds-stack">
              <p className="ds-field__hint">{folder}</p>
              <ul className="ds-list">
                {entries.map((f) => (
                  <li key={f.path}>
                    <button type="button" className="ds-link-button" aria-pressed={file === f.path} onClick={(): void => choose(f.path, null)}>
                      <span>{nameOf(f.path)}</span> · <span>{f.kind}</span> · <span>{f.current?.sizeBytes ?? 0} bytes</span> ·{' '}
                      <code title={f.current?.digest ?? ''}>{shortDigest(f.current?.digest ?? '')}</code>
                      {f.current !== null && (
                        <>
                          {' '}
                          · <span>{f.current.sync.command}</span> · <span>{f.current.sync.outcome}</span> · <span>{when(f.current.sync.at)}</span>
                        </>
                      )}
                      {f.notInLatestSync && <span className="ds-field__hint"> · not in the latest sync</span>}
                      <span className="ds-visually-hidden">{f.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {tree.refusals.length > 0 && (
            <section className="ds-stack" aria-label="Refused files">
              <h4>Refused files</h4>
              <ul className="ds-list">
                {tree.refusals.map((r) => (
                  <li key={`${r.executionId}-${r.path}`}>
                    <code>{r.path}</code> — {r.code}
                    {r.detail ? `: ${r.detail}` : ''} · execution {r.executionId} · {when(r.at)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(tree.findings.reportedNotSynced.length > 0 || tree.findings.syncedNotReported.length > 0) && (
            <section className="ds-stack" aria-label="Findings">
              <h4>Findings</h4>
              {tree.findings.reportedNotSynced.map((f) => (
                <p key={`r-${f.executionId}-${f.digest}`} className="ds-field__hint">
                  Execution {f.executionId} reported a digest that was <strong>not synced</strong> — <code title={f.digest}>{shortDigest(f.digest)}</code>.
                </p>
              ))}
              {tree.findings.syncedNotReported.map((f) => (
                <p key={`s-${f.executionId}-${f.digest}`} className="ds-field__hint">
                  Execution {f.executionId} synced a digest that was <strong>not reported</strong> by its completion — <code title={f.digest}>{shortDigest(f.digest)}</code>.
                </p>
              ))}
            </section>
          )}
        </>
      )}

      {openError !== null && (
        <p className="ds-field__error" role="alert">
          {openError}
        </p>
      )}

      {entry !== null && open !== null && (
        <section className="ds-stack" aria-label="Open file">
          <p>
            <code>{open.path}</code> · {open.kind} · Version {positionOf(entry, open.versionId)} of {entry.versions.length} ·{' '}
            <code title={open.digest}>{shortDigest(open.digest)}</code>
            {open.deliveredBy.map((d) => (
              <span key={d.syncId}>
                {' '}
                · produced by {d.command} · {d.outcome} · {when(d.at)} · execution {d.executionId}
              </span>
            ))}
          </p>
          {entry.current !== null && entry.current.versionId !== open.versionId && (
            <p className="ds-field__hint">
              <strong>Not the current version</strong> — the current one is <code title={entry.current.digest}>{shortDigest(entry.current.digest)}</code>.
            </p>
          )}

          <ul className="ds-list" role="listbox" aria-label="Versions">
            {entry.versions.map((v) => (
              <li
                key={v.versionId}
                role="option"
                aria-selected={v.versionId === open.versionId}
                tabIndex={0}
                onClick={(): void => choose(entry.path, v.versionId)}
                onKeyDown={(event): void => {
                  if (event.key === 'Enter' || event.key === ' ') choose(entry.path, v.versionId);
                }}
              >
                <code title={v.digest}>{shortDigest(v.digest)}</code> · {v.sizeBytes} bytes
                {v.deliveredBy.map((d) => (
                  <span key={d.syncId}>
                    {' '}
                    · {d.command} · {d.outcome} · {when(d.at)} · {d.executionId}
                  </span>
                ))}
              </li>
            ))}
          </ul>

          <MarkdownViewer
            markdown={open.content}
            sizeBytes={open.sizeBytes}
            path={open.path}
            syncedPaths={syncedPaths}
            onOpenSibling={(path): void => choose(path, null)}
          />
        </section>
      )}
    </section>
  );
}

/** *Version n of m*, counting from the newest — the order the picker shows. */
function positionOf(entry: ArtifactTreeEntry, versionId: string): number {
  const index = entry.versions.findIndex((v) => v.versionId === versionId);
  return index < 0 ? 1 : index + 1;
}
