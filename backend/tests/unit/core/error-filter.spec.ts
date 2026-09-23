/**
 * T1009 (EPIC-001) — `DEF-001-006`: the transport half of the error model.
 *
 * The filter mapped **every** non-`PlatformError` to 500, and Nest raises its
 * own `NotFoundException` when no route matches. So
 * `GET /v1/no-such-route` answered **500 `internal_error`**, and a genuine 404
 * became indistinguishable from a crash on every route in the API.
 *
 * ## The two halves, and why both are asserted
 *
 * The status bug is the obvious half. The other half is the one a fix is most
 * likely to destroy: `toErrorBody` refuses to echo an unrecognised error's
 * text *"because it may carry a connection string, a token, or engine
 * output."* That refusal is **correct**. The fix is not "expose the
 * exception" — it is "trust the status, never the text", so a framework error
 * gets a fixed message chosen by us rather than its own.
 *
 * Assert both, or fixing one silently pays for it with the other.
 */
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ErrorFilter } from '../../../src/core/error.filter.js';
import { NotFoundError } from '../../../src/core/errors.js';

interface Captured {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
}

/** Drive the filter the way Nest does, and capture what reaches the client. */
function run(exception: unknown): Captured {
  const captured = { status: 0, body: undefined as unknown } as {
    status: number;
    body: unknown;
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status(code: number) {
          captured.status = code;
          return {
            json(body: unknown) {
              captured.body = body;
            },
          };
        },
      }),
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new ErrorFilter().catch(exception, host as any);
  return captured as Captured;
}

describe('T1009 · a framework exception keeps its own status (DEF-001-006)', () => {
  it('an unmatched route is 404, not 500', () => {
    // The reproduction from the defect record, at the layer that decides it.
    expect(run(new NotFoundException()).status).toBe(404);
  });

  it('a framework-level client error keeps its status too', () => {
    // 404 alone could be satisfied by special-casing NotFoundException, which
    // would leave 400/405/415 still reporting as server errors.
    expect(run(new BadRequestException()).status).toBe(400);
    expect(run(new HttpException('teapot', 418)).status).toBe(418);
  });

  it('a platform error is unaffected — this is the behaviour being preserved', () => {
    const captured = run(new NotFoundError('Project not found.'));
    expect(captured.status).toBe(404);
    expect(captured.body.error.code).toBe('not_found');
    expect(captured.body.error.message).toBe('Project not found.');
  });
});

describe('T1009 · an unrecognised error is still 500, and still says nothing', () => {
  const SECRET = 'postgres://user:hunter2@db:5432/pmi';

  it('an unrecognised error is 500', () => {
    expect(run(new Error(SECRET)).status).toBe(500);
    expect(run({ weird: true }).status).toBe(500);
  });

  it('and its text never reaches the client', () => {
    // The half most likely to be lost while fixing the status above.
    const serialised = JSON.stringify(run(new Error(SECRET)).body);
    expect(serialised, 'the error message leaked into the response').not.toContain(SECRET);
    expect(serialised).not.toContain('hunter2');
  });

  it('a FRAMEWORK error is given a message of ours, never its own', () => {
    // `HttpException` carries author-supplied text. Trusting its status is
    // safe; trusting its text is the same mistake as trusting any other
    // unrecognised error's, because the platform did not raise it.
    const serialised = JSON.stringify(run(new HttpException(SECRET, 404)).body);
    expect(serialised, 'a framework exception echoed its own text').not.toContain(SECRET);
    expect(serialised).not.toContain('hunter2');
  });

  it('every response carries a code and a message, whatever the input', () => {
    // Anti-vacuity: the assertions above are all satisfied by a body of `{}`.
    for (const thrown of [new NotFoundException(), new Error('x'), 'a string', null]) {
      const body = run(thrown).body;
      expect(body.error.code, `no code for ${String(thrown)}`).toBeTypeOf('string');
      expect(body.error.message.length, `empty message for ${String(thrown)}`).toBeGreaterThan(0);
    }
  });
});
