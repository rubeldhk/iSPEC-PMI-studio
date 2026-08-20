/**
 * T832 — the wiring itself is asserted (DEF-005-001).
 *
 * This is the check whose absence let a 15/15-green epic ship an unusable
 * capability: every unit test proved behaviour GIVEN a working directory, and
 * nothing asserted a working one was bound. This resolves `USER_DIRECTORY`
 * from the composed graph — the real DI container, not a mock — so a future
 * refactor cannot silently unbind the adapter.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AuthModule, USER_DIRECTORY } from '../../../src/modules/auth/auth.module.js';
import {
  PrismaUserDirectory,
  UnconfiguredUserDirectory,
} from '../../../src/modules/auth/identity-provider.js';

const ORIGINAL = process.env['DATABASE_URL'];

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env['DATABASE_URL'];
  else process.env['DATABASE_URL'] = ORIGINAL;
});

async function resolveDirectory(): Promise<unknown> {
  const context = await NestFactory.createApplicationContext(AuthModule, { logger: false });
  try {
    return context.get(USER_DIRECTORY);
  } finally {
    await context.close();
  }
}

describe('T832 · USER_DIRECTORY is actually wired (DEF-005-001)', () => {
  it('with DATABASE_URL configured, the composed graph binds the REAL directory', async () => {
    // PrismaClient reads the env lazily; no connection is opened by resolution.
    process.env['DATABASE_URL'] = 'postgresql://composition-check:x@localhost:5432/none';
    const directory = await resolveDirectory();
    expect(directory).toBeInstanceOf(PrismaUserDirectory);
    expect(directory).not.toBeInstanceOf(UnconfiguredUserDirectory);
  });

  it('without DATABASE_URL, the refusing default remains — never a silent no-op', async () => {
    delete process.env['DATABASE_URL'];
    const directory = await resolveDirectory();
    expect(directory).toBeInstanceOf(UnconfiguredUserDirectory);
  });
});
