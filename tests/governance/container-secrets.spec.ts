/**
 * T150a (EPIC-014 F-11.3) — no container artifact may carry a credential.
 *
 * **The executable check Constitution V requires for a non-code output.** A
 * `Dockerfile` and a `docker-compose.yml` are configuration, and configuration
 * is exactly where "we would never commit a password" quietly replaces a gate.
 * `T452` made that argument for `README.md`; this makes it for the image.
 *
 * **Why it matters more here than in most repositories.**
 * `backend/prisma/seed.ts` already refuses to run without `SEED_USER_PASSWORD`
 * and refuses outright under `NODE_ENV=production`, and its own comment says
 * why: a seed creates a known account with a known password, *"that is right
 * for a developer machine and is a backdoor anywhere else."* An image that
 * baked one would destroy that posture the first time it was published
 * anywhere — and the seed's two refusals would still be there, still passing
 * their own tests, guarding a door that had been moved.
 *
 * `BR-0173` (secret handling) and `BR-0135` (credential isolation) are
 * `EPIC-028`'s. This check **conforms to them, it does not redefine them**.
 *
 * ## What counts as a violation
 *
 * A secret-shaped name assigned a **literal** value. An environment passthrough
 * — `AI_PROVIDER_TOKEN: ${AI_PROVIDER_TOKEN}` — is the correct pattern and must
 * not be flagged, or the check cries wolf on the very thing it is meant to
 * encourage. Both directions are asserted below, because an exemption nobody
 * tests is an exemption that quietly widens.
 *
 * Tasks: `T150a` (this file), `T150i` (the `.dockerignore` assertions).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Names that mean "this is a secret", in the forms a container file uses. */
const SECRET_NAME = String.raw`[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|_KEY|APIKEY|CREDENTIAL)`;

/**
 * A secret-shaped name assigned a literal value.
 *
 * Deliberately **not** matched:
 *   - `FOO_TOKEN: ${FOO_TOKEN}` and `${FOO_TOKEN:-}` — a passthrough, which is
 *     the pattern this check exists to encourage;
 *   - `FOO_TOKEN:` with nothing after it — a compose key inheriting from the
 *     environment;
 *   - a line that is entirely a comment.
 *
 * Both the catch and the two exemptions are asserted in the mutation block.
 */
export function credentialAssignments(text: string): string[] {
  const found: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    const match = new RegExp(`\\b(${SECRET_NAME})\\s*[:=]\\s*(\\S.*)?$`).exec(line);
    if (match === null) continue;
    const value = (match[2] ?? '').trim();
    if (value === '') continue; // `KEY:` — inherited from the environment
    if (/^["']?\$\{?[A-Za-z_]/.test(value)) continue; // `${VAR}` — a passthrough
    found.push(line);
  }
  return found;
}

/**
 * Literal secrets that are allowed to stay, each with the reason.
 *
 * **One entry, and it was found by this check on its first run.**
 * `docker-compose.yml` sets `POSTGRES_PASSWORD: pmi_local_dev` — a literal, in
 * a committed file, exactly what this check exists to refuse.
 *
 * It stays, and the reason is not "it is only local". It is that **PostgreSQL
 * bakes the superuser password into the data directory at `initdb`** and never
 * re-reads `POSTGRES_PASSWORD` for an existing volume. Parameterising it would
 * silently break every developer's existing database — the container would
 * start, the API would fail to authenticate, and the cause would be three
 * layers away from the symptom. `contracts/container-stack.md` §1 also states
 * that the existing `postgres` and `valkey` services are **not this Epic's to
 * reshape**.
 *
 * The exemption is per-line and asserted from both sides below: a stale entry
 * fails, and any *other* literal secret in the same file still fails. An
 * allowlist nobody tests is a hole nobody can see.
 */
const ALLOWED: readonly { rel: string; line: string; reason: string }[] = [
  {
    rel: 'docker-compose.yml',
    line: 'POSTGRES_PASSWORD: pmi_local_dev',
    reason:
      'initdb bakes the superuser password into the volume; changing it breaks every existing local database. Bound to localhost, never published.',
  },
];

function isAllowed(rel: string, line: string): boolean {
  return ALLOWED.some((a) => a.rel === rel && a.line === line.trim());
}

/** Container artifacts, and whether each must exist yet. */
const ARTIFACTS: readonly { rel: string; required: boolean }[] = [
  { rel: 'Dockerfile', required: true },
  { rel: 'docker-compose.yml', required: true },
  { rel: '.dockerignore', required: true },
  { rel: 'docker/entrypoint.sh', required: true },
];

describe('T150a · no container artifact carries a credential', () => {
  it.each(ARTIFACTS.map((a) => [a.rel, a] as const))('%s exists', (rel, artifact) => {
    // Written before the artifact does (`T150h`–`T150k`), so this file is RED
    // first. A check introduced alongside the thing it checks has never been
    // seen to fail, which is `T200c`'s standard and the reason for the order.
    expect(
      existsSync(join(ROOT, rel)),
      `${rel} does not exist yet — expected while F-11.3 is being built`,
    ).toBe(artifact.required);
  });

  it.each(ARTIFACTS.map((a) => [a.rel] as const))('%s assigns no literal secret', (rel) => {
    if (!existsSync(join(ROOT, rel))) return; // covered by the existence test above
    const offenders = credentialAssignments(read(rel)).filter((line) => !isAllowed(rel, line));
    expect(
      offenders,
      `${rel} assigns a literal value to a secret-shaped name:\n  ${offenders.join('\n  ')}\n` +
        'Pass it through from the environment instead — the seed refuses an unset password ' +
        'loudly, and that refusal is worth more than the convenience of a baked one.\n' +
        'If it genuinely cannot be parameterised, add it to ALLOWED with the reason.',
    ).toEqual([]);
  });

  it('every allowed literal is still present, and still needed', () => {
    // A stale exemption is a hole with a comment over it. If the line is gone,
    // the entry must go too — otherwise the allowlist grows into a place where
    // real secrets can hide behind old reasons.
    for (const entry of ALLOWED) {
      expect(
        credentialAssignments(read(entry.rel)).map((l) => l.trim()),
        `ALLOWED names "${entry.line}" in ${entry.rel}, which no longer assigns a literal — remove the exemption`,
      ).toContain(entry.line);
      expect(entry.reason.length, `${entry.line} is exempt with no real reason`).toBeGreaterThan(40);
    }
  });

  it('the seed still refuses to invent a credential', () => {
    // The posture this whole check protects. If either refusal is ever softened
    // to make a container "just work", the image becomes a backdoor and this
    // file's other assertions become decoration.
    const seed = read('backend/prisma/seed.ts');
    expect(seed, 'the seed no longer requires a password').toMatch(
      /seed requires a password/,
    );
    expect(seed, 'the seed no longer refuses NODE_ENV=production').toMatch(
      /refuses to run with NODE_ENV=production/,
    );
    expect(seed, 'the seed grew a default password').not.toMatch(
      /SEED_USER_PASSWORD'?\]?\s*\?\?\s*'[^']+'/,
    );
  });
});

describe('T150i · the build context cannot carry what must never be in an image', () => {
  const MUST_EXCLUDE = [
    '.env',
    '.env.*',
    'node_modules/',
    // **The nested ones, which the root pattern does not cover.** `node_modules/`
    // matches the root directory only, and pnpm puts one in every workspace
    // package full of symlinks to siblings — which Docker refuses to put in a
    // build context at all: `invalid file request
    // agent-adapters/claude/node_modules/@pmi/agent-contract`.
    //
    // Analysis `U1` concluded this task needed no edit because every listed
    // pattern was already present. Every listed pattern *was*. The gap was a
    // pattern nobody had listed, and only building the image found it — which
    // is the difference between checking a document and running the thing.
    '**/node_modules',
    '**/dist',
    '.git/',
    'dist/',
    'specs/',
    'SRS/',
  ] as const;

  it.each(MUST_EXCLUDE.map((p) => [p] as const))('.dockerignore excludes %s', (pattern) => {
    // `T150i` was originally written as "extend .dockerignore so it excludes…"
    // — and every one of these was ALREADY there. The task would have been
    // ticked having changed nothing (analysis `U1`, 2026-08-24). What was
    // missing was never the exclusions; it was anything that would notice if
    // they disappeared. This is that.
    const lines = read('.dockerignore')
      .split(/\r?\n/)
      .map((l) => l.trim());
    expect(lines, `.dockerignore no longer excludes ${pattern}`).toContain(pattern);
  });
});

describe('T150a · MUTATION — the check must catch what it claims to, and only that', () => {
  it('catches a literal secret in every form a container file writes one', () => {
    expect(credentialAssignments('ENV SEED_USER_PASSWORD=hunter2')).toHaveLength(1);
    expect(credentialAssignments('    SEED_USER_PASSWORD: hunter2')).toHaveLength(1);
    expect(credentialAssignments('ARG AI_PROVIDER_TOKEN=sk-live-abc')).toHaveLength(1);
    expect(credentialAssignments('ENV DATABASE_SECRET="literal"')).toHaveLength(1);
  });

  it('the exemption is per-line, so another secret in the same file still fails', () => {
    // The allowlist must not become a per-file amnesty. `docker-compose.yml`
    // is exempt for exactly one line and no other.
    const compose = 'POSTGRES_PASSWORD: pmi_local_dev\nSEED_USER_PASSWORD: hunter2';
    const offenders = credentialAssignments(compose).filter(
      (line) => !isAllowed('docker-compose.yml', line),
    );
    expect(offenders).toEqual(['SEED_USER_PASSWORD: hunter2']);
  });

  it('and the exemption does not travel to another file', () => {
    expect(isAllowed('Dockerfile', 'POSTGRES_PASSWORD: pmi_local_dev')).toBe(false);
  });

  it('does NOT catch a passthrough, an inherited key, or a comment', () => {
    // A check that fires on the correct pattern gets switched off, and then it
    // is not protecting anything at all.
    expect(credentialAssignments('  AI_PROVIDER_TOKEN: ${AI_PROVIDER_TOKEN}')).toEqual([]);
    expect(credentialAssignments('  AI_PROVIDER_TOKEN: ${AI_PROVIDER_TOKEN:-}')).toEqual([]);
    expect(credentialAssignments('  SEED_USER_PASSWORD:')).toEqual([]);
    expect(credentialAssignments('# SEED_USER_PASSWORD=example-only')).toEqual([]);
  });
});

/**
 * T150s (EPIC-014 F-11.3, convergence C-1) — the documented container
 * commands must be runnable.
 *
 * **This is the check whose absence let `C1` and `C2` through.** `T452` reads
 * `README.md` and nothing reads `quickstart.md` at all — so two of the three
 * container commands in the Epic's own validation guide were wrong, and the
 * whole suite stayed green:
 *
 *   - Scenario 5 ran `docker run … pmi-studio-app`. **No image by that name
 *     exists**: the `app` service declared `build:` with no `image:`, so Docker
 *     named it from the compose project directory. It failed for everyone, and
 *     it was the credential check's own scenario.
 *   - Scenario 6 ran `docker compose exec app … seed`. **That command fails**:
 *     the image runs `NODE_ENV=production` and `backend/prisma/seed.ts`
 *     refuses it outright. The refusal is correct — it is `R-014-6`'s entire
 *     point — and the instruction was what was wrong.
 *
 * Constitution V asks a non-code output to carry an executable check that can
 * fail. `quickstart.md` is the document that claims the product runs, and
 * **nothing was holding it to that claim**.
 *
 * It checks that commands are *runnable*, not that they succeed — running them
 * needs Docker and a database, which is `T150l`'s job. What it can catch
 * without infrastructure is the class both faults belonged to: a command that
 * names something the repository does not define.
 */
describe('T150s · every documented container command is runnable', () => {
  /**
   * Every document that tells a reader to run a container command.
   *
   * **`specs/_shared/quickstart.md` is here because of `DEF-014-001`**
   * (`T150x`). That defect was `docker compose up -d postgres redis` sitting in
   * *that file* for months against a compose file defining no `redis` — and
   * when it was closed, the check gained a guard on `README.md` only. So the
   * file the defect was actually in went back to being unwatched.
   *
   * The drift was catchable indirectly — `T452` derives the README's required
   * steps from this quickstart, so a wrong service there breaks step-coverage —
   * but it fails saying *"the README does not cover a step"*, **pointing at the
   * wrong file**. A check that fires on the innocent document sends the reader
   * to the wrong place, which costs more than the check saves.
   */
  const DOCUMENTS = [
    'README.md',
    'specs/014-devops-release/quickstart.md',
    'specs/_shared/quickstart.md',
  ] as const;

  /**
   * Documented lines that invoke docker, joined across `\` continuations and
   * **with leading `VAR=value` assignments stripped**.
   *
   * The first draft of this filter required the line to *start* with `docker `,
   * and it missed `C1` — the very fault it was written for — because the
   * quickstart writes:
   *
   *     SEED_USER_EMAIL=… SEED_USER_PASSWORD='…' \
   *       docker compose exec app … seed
   *
   * An env-prefixed command is the normal shell idiom for exactly the kind of
   * command this file inspects, so requiring `docker` first was checking a
   * shape rather than a meaning. Caught by running it against the two known
   * faults and finding it caught only one.
   */
  function dockerCommands(rel: string): string[] {
    const text = read(rel).replace(/\\\r?\n\s*/g, ' ');
    return text
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S*)\s+)+/, ''))
      .filter((line) => line.startsWith('docker '));
  }

  /** Service names `docker-compose.yml` defines. */
  function composeServices(): string[] {
    const compose = read('docker-compose.yml');
    const body = compose.slice(compose.indexOf('services:'));
    return [...body.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((m) => m[1]!);
  }

  /** Image names `docker-compose.yml` declares, whether pulled or built. */
  function composeImages(): string[] {
    return [...read('docker-compose.yml').matchAll(/^\s*image:\s*(\S+)\s*$/gm)].map((m) => m[1]!);
  }

  it('finds container commands to check, or this file proves nothing', () => {
    // Anti-vacuity, the guard every check in this Epic carries. A parser that
    // matched nothing would report both documents clean forever — which is
    // indistinguishable from the state that produced C1 and C2.
    const all = DOCUMENTS.flatMap(dockerCommands);
    expect(all.length, 'no docker commands were found in the documentation').toBeGreaterThan(4);
    expect(composeServices(), 'no services parsed out of docker-compose.yml').toContain('app');
  });

  it.each(DOCUMENTS.map((d) => [d] as const))(
    '%s runs no image the compose file does not define',
    (rel) => {
      const images = composeImages();
      const wrong = dockerCommands(rel)
        .filter((c) => /^docker run\b/.test(c))
        .map((c) => {
          // The image is the first token that is not the runner, a flag, or a
          // flag's value. `--entrypoint sh` is the case that matters here.
          const tokens = c.split(/\s+/).slice(2);
          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]!;
            if (token.startsWith('-')) {
              if (!token.includes('=') && FLAGS_WITH_VALUES.has(token)) i++;
              continue;
            }
            return { command: c, image: token };
          }
          return null;
        })
        .filter((found): found is { command: string; image: string } => found !== null)
        .filter((found) => !images.includes(found.image));

      expect(
        wrong.map((w) => w.image),
        `${rel} runs an image docker-compose.yml does not define:\n  ${wrong
          .map((w) => `${w.image}  in  ${w.command}`)
          .join('\n  ')}\n` +
          'A service with `build:` and no `image:` is named from the compose PROJECT, which is ' +
          'the directory — so the name differs per checkout and the command cannot be written down.',
      ).toEqual([]);
    },
  );

  it.each(DOCUMENTS.map((d) => [d] as const))('%s starts only services that exist', (rel) => {
    // **`DEF-014-001` itself.** `docker compose up -d postgres redis` sat in
    // `specs/_shared/quickstart.md` for months against a compose file defining
    // no `redis` — step two of the documented setup had never worked.
    //
    // Adding that file to DOCUMENTS was **not enough on its own**, and the
    // mutation proved it: reintroducing `redis` there left this file green,
    // because none of the other assertions look at `docker compose up`. A file
    // added to a list without the assertion it needed is decoration — the same
    // shape as a check that reads a string where the runtime reads a pattern.
    const services = composeServices();
    const wrong = dockerCommands(rel)
      .filter((c) => /^docker compose up\b/.test(c))
      .flatMap((c) =>
        c
          .split('#')[0]!
          .split(/\s+/)
          .slice(3)
          .filter((token) => token !== '' && !token.startsWith('-'))
          .map((service) => ({ command: c, service })),
      )
      .filter((found) => !services.includes(found.service));

    expect(
      wrong.map((w) => w.service),
      `${rel} starts a service docker-compose.yml does not define:\n  ${wrong
        .map((w) => `${w.service}  in  ${w.command}`)
        .join('\n  ')}\n` +
        'This is DEF-014-001, which is why the file is read here at all.',
    ).toEqual([]);
  });

  it.each(DOCUMENTS.map((d) => [d] as const))('%s execs into a service that exists', (rel) => {
    const services = composeServices();
    const wrong = dockerCommands(rel)
      .filter((c) => /^docker compose exec\b/.test(c))
      .map((c) => {
        const tokens = c.split(/\s+/).slice(3);
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i]!;
          if (token.startsWith('-')) {
            if (!token.includes('=') && FLAGS_WITH_VALUES.has(token)) i++;
            continue;
          }
          return { command: c, service: token };
        }
        return null;
      })
      .filter((found): found is { command: string; service: string } => found !== null)
      .filter((found) => !services.includes(found.service));

    expect(
      wrong.map((w) => w.service),
      `${rel} execs into a service docker-compose.yml does not define`,
    ).toEqual([]);
  });

  it.each(DOCUMENTS.map((d) => [d] as const))(
    '%s does not seed inside the container without overriding NODE_ENV',
    (rel) => {
      // The image sets `NODE_ENV=production` and the seed refuses it. Driven
      // and captured in the T150l transcript §1. An instruction that cannot
      // work is worse than an absent one: the reader assumes the product is
      // broken rather than the document.
      const offenders = dockerCommands(rel).filter(
        (c) => /docker compose exec/.test(c) && /\bseed\b/.test(c) && !/NODE_ENV=development/.test(c),
      );
      expect(
        offenders,
        `${rel} seeds inside the container without NODE_ENV=development:\n  ${offenders.join('\n  ')}\n` +
          'The image runs as production and backend/prisma/seed.ts refuses that outright. ' +
          'The refusal is correct (R-014-6) — the instruction is what must change.',
      ).toEqual([]);
    },
  );
});

/** Docker flags that take a separate value, so the next token is not the image. */
const FLAGS_WITH_VALUES = new Set([
  '--entrypoint',
  '-e',
  '--env',
  '--name',
  '-v',
  '--volume',
  '-p',
  '--publish',
  '--network',
  '-w',
  '--workdir',
  '-u',
  '--user',
]);

/**
 * T153c (EPIC-014 F-11.3, convergence C-3) — the release gate must run every
 * scenario the quickstart defines.
 *
 * **This is the enforcement `G-14.2` said did not exist.** That section of
 * `plan.md` wrote the prediction out in full:
 *
 *   > This will need updating again whenever any epic adds a quickstart
 *   > scenario. **Nothing enforces it** — the numbering lives in
 *   > `_shared/quickstart.md` and the gate that runs it lives here.
 *
 * Then `F-11.3` added seven scenarios, no `V`-number was allocated, and the
 * section stayed headed *"✅ current"*. **A warning that does not fire is a
 * comment.** This is the same shape `T442v` closed in `EPIC-036`: a number
 * restated in two documents drifts unless something compares them.
 *
 * The comparison is deliberately literal — it reads the committed markdown of
 * both documents — because the failure mode is a person adding a heading in one
 * file and nobody updating a sentence in the other.
 */
describe('T153c · the release gate runs every quickstart scenario', () => {
  const QUICKSTART = 'specs/_shared/quickstart.md';
  const TASKS = 'specs/014-devops-release/tasks.md';

  /**
   * Scenarios the gate deliberately does not run, each with the reason.
   *
   * An exemption with no reason is an omission with better manners — the same
   * rule `EXEMPT` follows in `EPIC-036`'s `registry-documented.spec.ts`.
   */
  const NOT_AT_THE_GATE: Readonly<Record<string, string>> = Object.freeze({
    V13: 'the real-engine smoke test, marked "nightly, not per-commit" in its own heading — it needs a live AI provider credential and metered spend, so a release gate that ran it would bill the programme per promotion',
  });

  /** Every `### V<n>` scenario the quickstart defines, in document order. */
  function definedScenarios(): string[] {
    return [...read(QUICKSTART).matchAll(/^###\s+(V\d+[a-z]?)\b/gm)].map((m) => m[1]!);
  }

  /**
   * The scenarios `T153`'s line claims, expanding `V1–V12` style ranges.
   *
   * A range is expanded rather than pattern-matched because **that is where the
   * ambiguity lives**: `V11a` sits between `V11` and `V12`, and whether
   * "V1–V12" includes it is exactly the kind of question a sentence cannot
   * answer and a list can.
   */
  function claimedScenarios(): string[] {
    const line = read(TASKS)
      .split(/\r?\n/)
      .find((l) => /^- \[[ xX]\] T153\b/.test(l));
    if (line === undefined) return [];
    const text = line.replace(/[*`]/g, '');
    const claimed = new Set<string>();

    // Ranges: `V1–V12` (en dash) or `V1-V12` (hyphen).
    for (const match of text.matchAll(/V(\d+)[a-z]?\s*[–-]\s*V(\d+)[a-z]?/g)) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      for (let n = from; n <= to; n++) claimed.add(`V${n}`);
    }
    // Individually named scenarios.
    for (const match of text.matchAll(/\bV(\d+[a-z]?)\b/g)) claimed.add(`V${match[1]}`);
    return [...claimed];
  }

  it('finds scenarios and a claim to compare, or this check proves nothing', () => {
    // Anti-vacuity. A parser that found no `V` headings would report full
    // coverage forever — which is indistinguishable from the state `G-14.2`
    // predicted and this file exists to end.
    expect(definedScenarios().length, 'no V-scenarios parsed from the quickstart').toBeGreaterThan(
      10,
    );
    expect(claimedScenarios().length, 'no V-scenarios parsed from T153').toBeGreaterThan(10);
  });

  it('T153 runs every scenario the quickstart defines, or the exemption says why', () => {
    const defined = definedScenarios();
    const claimed = new Set(claimedScenarios());
    const missed = defined.filter((v) => !claimed.has(v) && NOT_AT_THE_GATE[v] === undefined);

    expect(
      missed,
      `specs/_shared/quickstart.md defines ${missed.join(', ')}, which T153 does not run.\n` +
        'The gate that ships the platform would promote without exercising them. Either add the ' +
        'scenario to T153, or add it to NOT_AT_THE_GATE with the reason it is deliberately skipped.',
    ).toEqual([]);
  });

  it('every exemption names a scenario that exists, and gives a real reason', () => {
    // A stale exemption is a hole with a comment over it.
    const defined = definedScenarios();
    for (const [scenario, reason] of Object.entries(NOT_AT_THE_GATE)) {
      expect(
        defined,
        `NOT_AT_THE_GATE names ${scenario}, which the quickstart no longer defines`,
      ).toContain(scenario);
      expect(reason.length, `${scenario} is exempt with no real reason`).toBeGreaterThan(40);
    }
  });

  it('T153 claims no scenario the quickstart does not define', () => {
    // The other direction. A gate claiming to run `V15` when no `V15` exists
    // reads as coverage and is a typo.
    const defined = new Set(definedScenarios());
    const phantom = claimedScenarios().filter((v) => !defined.has(v));
    expect(phantom, `T153 claims ${phantom.join(', ')}, which the quickstart does not define`).toEqual(
      [],
    );
  });
});
