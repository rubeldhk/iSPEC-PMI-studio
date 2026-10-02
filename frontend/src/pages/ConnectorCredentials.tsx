/**
 * EPIC-041 T1381 — connector credentials for a project (`FR-LPW-052`, `UX-0040`).
 *
 * List with label, creator, created, last used, revoked; filterable by
 * revoked and label (PMI-DOC-005); mint shows the value once; revoke asks for
 * confirmation naming the label. No cell ever renders a value or a digest —
 * the row is built from named fields, never spread from the record
 * (`FR-LPW-053`).
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type ConnectorCredential, type MintedConnectorCredential } from '../services/api';
import { CredentialOnce } from '../components/CredentialOnce';
import { Button } from '../design/components/Button';
import { Checkbox } from '../design/components/Checkbox';
import { FormField } from '../design/components/FormField';
import { Modal } from '../design/components/Modal';
import { PageHeader } from '../design/components/PageHeader';
import { Table } from '../design/components/Table';
import { TextInput } from '../design/components/TextInput';

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

export interface ConnectorCredentialsPageProps {
  api: ApiClient;
  projectId: string;
}

const COLUMNS = [
  { key: 'label', header: 'Label' },
  { key: 'creator', header: 'Creator' },
  { key: 'created', header: 'Created' },
  { key: 'lastUsed', header: 'Last used' },
  { key: 'revoked', header: 'Revoked' },
  { key: 'actions', header: 'Actions' },
];

export function ConnectorCredentialsPage({ api, projectId }: ConnectorCredentialsPageProps): ReactElement {
  const [rows, setRows] = useState<ConnectorCredential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokedOnly, setRevokedOnly] = useState(false);
  const [labelFilter, setLabelFilter] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [minted, setMinted] = useState<MintedConnectorCredential | null>(null);
  const [confirming, setConfirming] = useState<ConnectorCredential | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setRows(
        await api.listConnectorCredentials(projectId, {
          ...(revokedOnly ? { revoked: true } : {}),
          ...(labelFilter.trim() !== '' ? { label: labelFilter.trim() } : {}),
        }),
      );
      setError(null);
    } catch (err) {
      setError(message(err));
    }
  }, [api, projectId, revokedOnly, labelFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function mint(event: FormEvent): Promise<void> {
    event.preventDefault();
    setActionError(null);
    try {
      const result = await api.mintConnectorCredential(projectId, newLabel.trim());
      setMinted(result);
      setNewLabel('');
      await refresh();
    } catch (err) {
      setActionError(message(err));
    }
  }

  async function revoke(): Promise<void> {
    if (confirming === null) return;
    setActionError(null);
    try {
      await api.revokeConnectorCredential(confirming.id);
      setConfirming(null);
      await refresh();
    } catch (err) {
      setActionError(message(err));
    }
  }

  return (
    <main className="ds-page">
      <PageHeader title="Connector credentials" />
      <p className="ds-field__hint">
        A credential opens exactly one project to the agent on your machine. The value is shown once when minted and
        stored only as a digest; revoking it is immediate and cannot be undone.
      </p>
      {minted !== null && <CredentialOnce label={minted.label} value={minted.value} onDismiss={() => setMinted(null)} />}
      <form className="ds-row" onSubmit={(e) => void mint(e)}>
        <FormField id="credential-label" label="New credential label">
          <TextInput value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </FormField>
        <Button type="submit" disabled={newLabel.trim() === ''}>
          Mint
        </Button>
      </form>
      {actionError !== null && (
        <p className="ds-field__error" role="alert">
          {actionError}
        </p>
      )}
      <div className="ds-row">
        <FormField id="credential-filter-label" label="Filter by label">
          <TextInput value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} />
        </FormField>
        <label>
          <Checkbox checked={revokedOnly} onChange={(e) => setRevokedOnly(e.target.checked)} /> Show revoked only
        </label>
      </div>
      <Table
        caption="Connector credentials"
        columns={COLUMNS}
        loading={rows === null && error === null}
        {...(error !== null ? { error } : {})}
        emptyTitle="No connector credentials."
        emptyExplanation="Mint one above to let the agent on your machine reach this project."
        rowKey={(_row, index) => rows?.[index]?.id ?? String(index)}
        rows={(rows ?? []).map((row) => ({
          // Named fields only: the value never exists here, and the digest never leaves the API.
          label: row.label,
          creator: row.createdById,
          created: row.createdAt,
          lastUsed: row.lastUsedAt ?? '—',
          revoked: row.revokedAt ?? '—',
          actions:
            row.revokedAt === null ? (
              <Button type="button" variant="danger" onClick={() => setConfirming(row)}>
                Revoke
              </Button>
            ) : (
              <span className="ds-field__hint">revoked by {row.revokedById}</span>
            ),
        }))}
      />
      <Modal
        open={confirming !== null}
        title={confirming === null ? 'Revoke' : `Revoke "${confirming.label}"?`}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void revoke()}>
              Revoke
            </Button>
          </>
        }
      >
        <p>
          The credential <strong>{confirming?.label}</strong> stops working immediately and cannot be restored. Anything
          on your machine that uses it will need a new one.
        </p>
      </Modal>
    </main>
  );
}
