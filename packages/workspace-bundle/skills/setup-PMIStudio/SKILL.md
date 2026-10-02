---
name: "setup-PMIStudio"
description: "Verify and, where safe, install this workstation's toolchain and its connection to PMI Studio: the toolkit at the pinned tag, the PMI extension and its hooks, the environment credential reference, the MCP servers, Node and Docker — and prove the credential opens this project. Ends with a table."
argument-hint: "No arguments. Run it in a project directory PMI Studio provisioned."
compatibility: "Requires a .pmi/project.json written by PMI Studio (EPIC-041). Bundle 0.2.0 (EPIC-042)."
metadata:
  author: "pmi-studio"
  bundle-version: "0.2.0"
user-invocable: true
disable-model-invocation: false
---

## What this skill does (bundle 0.2.0)

Ten checks, in order, each *check → install or guide → verify*. It is **idempotent**: a second run
on a green machine changes no file and prints the same table. It **installs** only three things —
the toolkit at the pinned tag, the PMI extension, and configuration entries — and **guides** for
everything else (`uv`, Node, Docker, the credential). It never enters a credential, never modifies
a system setting, always shows a command before running it, and writes nothing outside this
project directory. **End with the table in step 11, even after stopping at step 1.**

Before any check: this skill never asks for the credential value and never prints it. The
credential is `PMI_STUDIO_TOKEN` in the environment; the only thing it checks is that the variable
is set.

## Steps

1. **`.pmi/project.json`.** Read it. If it is absent, print the table with row 1 `missing` and
   **stop**: this directory was not provisioned by PMI Studio; a project is created in PMI Studio
   first (Projects → Create project with a root path). If `schemaVersion` is not `1`, stop and say
   which version this skill understands. Note `projectId`, `platformUrl`, `agentIntegration`,
   `scriptType`, `engineTag` and `bundleVersion` — never guess a value the file does not carry.

2. **`uv` on PATH.** Run `uv --version`. If absent: **guide** with the platform-specific install
   command from the `uv` documentation for this operating system; do not run an installer. Mark
   rows 3 and 4 `skipped`.

3. **The toolkit at the pinned tag.** Run `specify --version` and compare with `engineTag`. If
   absent or another version, **show** then run
   `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<engineTag>`
   and verify the version again. A mismatch after installation is `refused`, naming both versions.

4. **`.specify/` initialised for the recorded integration.** Check that `.specify/` exists and
   `.specify/integrations/<agentIntegration>.manifest.json` names the integration. If not, **show**
   then run `specify init --here --force --integration <agentIntegration> --script <scriptType>`
   with this directory as the working directory, and verify.

5. **The PMI extension, its hooks, the stock skills, and the toolkit range.** Call
   `pmi.project.context` and read `extensionVersion`; compare it with
   `.specify/extensions/pmi/extension.yml`'s `version`. If the extension is absent or older,
   re-copy it from the `@pmi/workspace-bundle` version `.pmi/project.json` names and merge
   `extensions-fragment.yml` into `.specify/extensions.yml` — add `pmi` to `installed` once, one
   entry per event unless present, **never touch another extension's entries**. Read
   `requires.speckit_version` from `extension.yml` and confirm `engineTag` satisfies that range;
   when it does not, report `refused` naming the tag and the range. Then recompute the SHA-256 of
   every file the integration manifest pins and compare: a stock skill that differs is reported
   `refused` with its path — **never repair it** and never edit a stock skill.

6. **`PMI_STUDIO_TOKEN` is set.** Check only that the variable is set in this shell. If it is
   not: **guide** — a connector credential is minted in PMI Studio under the project
   (Projects → the project → Connector credentials), shown once, and exported for this shell
   (`export PMI_STUDIO_TOKEN=…` or `$env:PMI_STUDIO_TOKEN = '…'` typed by the person, not by
   you). Mark row 10 `skipped`. Never ask the person to paste the value into the conversation.

7. **`.mcp.json` lists `pmi-studio`, `context7` and `github`.** Read the file. If it does not
   parse, leave it exactly as it is and report `refused` with the path. Otherwise add only the
   missing server entries, keep every existing key, and write credentials as `${VAR}` references
   only — never a value:
   - `pmi-studio`: `npx -y @pmi/mcp-server@<version>` with `PMI_STUDIO_URL: <platformUrl>` and
     `PMI_STUDIO_TOKEN: ${PMI_STUDIO_TOKEN}`;
   - `context7`: `npx -y @upstash/context7-mcp` with `CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}`;
   - `github`: `npx -y @modelcontextprotocol/server-github` with
     `GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_TOKEN}`.

8. **Docker daemon reachable** — only when `.pmi/project.json` says PMI Studio runs containerised
   on this machine (`platformUrl` on localhost with a `containerised` marker); otherwise mark the
   row `—`. Run `docker info`; if it fails, **guide** (start Docker Desktop or the daemon).

9. **Node ≥ 22.** Run `node --version`. If absent or older, **guide** with the install for this
   operating system; do not install it.

10. **`pmi.health` succeeds.** Compute the constitution digest: the SHA-256 of
    `.specify/memory/constitution.md` with the header's own `digest <64 hex>` field replaced by 64
    zeros (`null` when the file is absent). Call `pmi.health` with `extensionVersion`,
    `toolkitVersion`, `constitutionDigest`. On success, report the project id, contract version
    and API version it returned and read `constitutionState`: `missing` or `stale` → call
    `pmi.constitution.get` with `onDiskDigest` and write `content` to
    `.specify/memory/constitution.md`; `drift` → report it and **do not write** (the next
    governed command shows the difference and asks); `current` → nothing. On a refusal, report
    `structuredContent.code` (`invalid_connector_credential` means the credential does not open
    this project; `platform_unreachable` means PMI Studio at `platformUrl` did not answer).

11. **The table.** One row per check — columns *#*, *Check*, *State*, *What to do* — with state
    `ok`, `pending`, `missing`, `refused`, `unreachable` or `skipped`, and the exact next action
    or `—`. Row 10 on success carries the project id, contract version and API version.

## Never

- Ask for, print or write a credential value — not into a file, not into the conversation.
- Install `uv`, Node or Docker, or change a system setting; show the command and let the person run it.
- Edit or "repair" a stock skill file; report it and stop.
- Write any file outside this project directory.
- Run a command without showing it first.
