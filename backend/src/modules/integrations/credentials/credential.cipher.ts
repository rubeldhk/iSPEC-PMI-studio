/**
 * `T2173` (EPIC-039, `FR-HUB-042`, `R-039-10`) — AES-256-GCM, the repository's
 * first real encryption at rest.
 *
 * A random 12-byte IV per write; the 16-byte tag authenticates both the
 * ciphertext and the **additional authenticated data**
 * `workspaceId|projectId|registryEntryId|kind`. A row copied to, or pointed at
 * from, another project fails to decrypt — so *"project A's credential is never
 * used for project B"* (`SC-HUB-005`) holds in the cipher as well as in the
 * query. An unknown `keyId` fails closed.
 *
 * Shaped like `EPIC-025`'s `TokenCipher` port so that Epic can adopt it in place
 * of `MarkerTokenCipher`, which is base64 and not encryption (reported as a
 * finding, not fixed here).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { CredentialKeyring } from '../integrations.tokens.js';

export interface CredentialScope {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly registryEntryId: string;
  readonly kind: string;
}

export interface Sealed {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
  readonly keyId: string;
}

export class CredentialDecryptionError extends Error {
  constructor(reason: string) {
    super(`The credential could not be decrypted (${reason}). It is treated as absent; nothing is guessed.`);
    this.name = 'CredentialDecryptionError';
  }
}

export function additionalData(scope: CredentialScope): Buffer {
  return Buffer.from(`${scope.workspaceId}|${scope.projectId}|${scope.registryEntryId}|${scope.kind}`, 'utf8');
}

export class CredentialCipher {
  constructor(private readonly keyring: () => CredentialKeyring) {}

  seal(plaintext: string, scope: CredentialScope): Sealed {
    const { keyId, key } = this.keyring().activeKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(additionalData(scope));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag(), keyId };
  }

  open(sealed: Sealed, scope: CredentialScope): string {
    const key = this.keyring().key(sealed.keyId);
    if (key === null) throw new CredentialDecryptionError(`no platform key ${sealed.keyId}`);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, sealed.iv);
      decipher.setAAD(additionalData(scope));
      decipher.setAuthTag(sealed.authTag);
      return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new CredentialDecryptionError('authentication failed — wrong key, or a row that belongs to another project or adapter');
    }
  }
}
