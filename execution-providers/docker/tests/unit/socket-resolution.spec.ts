/**
 * T668 · `DEF-028-004` — where the Docker Engine API is reached.
 *
 * `T570` tests this provider against a **mocked daemon**, which is the right
 * call: it verifies request construction and every `ADR-0002` flag without
 * needing a runtime. But the mock replaces the transport, and the transport is
 * where the defect was — `unixSocketDockerApi` defaulted to
 * `/var/run/docker.sock` and stripped only a `unix://` prefix from
 * `DOCKER_HOST`. Both POSIX-only. On Windows the provider could not reach a
 * daemon at all, which is why `T646b` was blocked by something no test could
 * see: **the one function the mock stands in for is the one no test exercised.**
 *
 * `resolveDockerSocketPath` is pure so that gap closes here, with no daemon.
 */
import { describe, expect, it } from 'vitest';
import { resolveDockerSocketPath } from '../../src/index';

describe('T668 · resolveDockerSocketPath (DEF-028-004)', () => {
  it('defaults to the unix socket on POSIX', () => {
    expect(resolveDockerSocketPath('linux', {})).toBe('/var/run/docker.sock');
    expect(resolveDockerSocketPath('darwin', {})).toBe('/var/run/docker.sock');
  });

  it('defaults to the named pipe on Windows', () => {
    // The whole defect in one assertion. Before the fix this returned
    // /var/run/docker.sock, which does not exist on Windows, and the provider
    // failed with ENOENT before a single API call.
    expect(resolveDockerSocketPath('win32', {})).toBe('//./pipe/docker_engine');
  });

  it('strips a unix:// scheme from DOCKER_HOST', () => {
    expect(resolveDockerSocketPath('linux', { DOCKER_HOST: 'unix:///var/run/docker.sock' })).toBe(
      '/var/run/docker.sock',
    );
  });

  it('normalises both npipe:// forms Docker writes', () => {
    // Docker Desktop writes the short form; some tooling writes the long one.
    // A named pipe path must begin with //, so the short form was not merely
    // unstripped before the fix — it produced './pipe/docker_engine', a
    // relative filesystem path handed to http.request.
    expect(resolveDockerSocketPath('win32', { DOCKER_HOST: 'npipe://./pipe/docker_engine' })).toBe(
      '//./pipe/docker_engine',
    );
    expect(
      resolveDockerSocketPath('win32', { DOCKER_HOST: 'npipe:////./pipe/docker_engine' }),
    ).toBe('//./pipe/docker_engine');
  });

  it('leaves a remote scheme untouched rather than mangling it into a path', () => {
    // tcp:// is not a socket path. Returning it unchanged means the caller's
    // error names the real cause; stripping the scheme would produce
    // "ENOENT: 127.0.0.1:2375", which sends someone looking for a file.
    expect(resolveDockerSocketPath('linux', { DOCKER_HOST: 'tcp://127.0.0.1:2375' })).toBe(
      'tcp://127.0.0.1:2375',
    );
  });

  it('lets an explicit argument win over both environment and platform', () => {
    expect(
      resolveDockerSocketPath('win32', { DOCKER_HOST: 'unix:///var/run/docker.sock' }, '/custom.sock'),
    ).toBe('/custom.sock');
  });

  it('prefers DOCKER_HOST over the platform default', () => {
    // Order matters: a machine with a remote daemon configured must not be
    // silently redirected to a local socket that happens to exist.
    expect(resolveDockerSocketPath('win32', { DOCKER_HOST: 'unix:///var/run/docker.sock' })).toBe(
      '/var/run/docker.sock',
    );
  });
});
