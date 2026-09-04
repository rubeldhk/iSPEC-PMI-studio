# Contract: Files the Platform Writes into a Project Directory

**Epic**: `EPIC-041` · **Feeds**: [plan.md](../plan.md) · **Decisions**: `R-041-2`, `R-041-9`, `R-041-10`

These files are the product's contract with the developer's agent. A user will look for them by
name, so their names and shapes are specification, not implementation. **One rule binds all of
them: no file under the root path may contain the credential value** (`FR-LPW-024`), and a
conformance test reads every file the platform wrote and fails on a match of `pmi_ct_[A-Za-z0-9_-]{20,}`.

## Directory after each step

```
<rootPath>/
├── .git/                          adopt_or_init_git  (prepare — only if absent)
├── .pmi/
│   └── project.json               write_project_json (prepare)
├── .mcp.json                      merge_mcp_json     (prepare — merged, never replaced)
├── .claude/skills/
│   └── setup-PMIStudio/SKILL.md   copy_setup_skill   (prepare — bundle v0.1 in this Epic)
│
│   ── process boundary: everything below is the initialise step (worker), or the setup skill ──
│
├── .specify/                      run_engine_init  (initialise)
│   ├── memory/constitution.md         Spec Kit's default until EPIC-042 generates it
│   ├── templates/ · scripts/ · …
│   ├── extensions/pmi/            copy_extension     (initialise)
│   │   ├── extension.yml
│   │   └── commands/…
│   └── extensions.yml             register_hooks     (initialise — merged)
└── .claude/skills/speckit-*/      written by specify init for --integration claude
```

`.claude/` is the layout for the `claude` integration; another integration's `specify init` writes
its own agent directory, and the setup skill location follows the integration. `agentIntegration`
is a parameter (`FR-LPW-006`).

## Skills path — `skillsPathFor(integration)`

Where the setup skill is copied is **configuration in `@pmi/workspace-bundle`**, not a literal in
provisioning code (analysis `C4`). The mapping is a table the bundle ships and `T1316` asserts:

| Integration (`specify init --integration`) | Skills directory |
|---|---|
| `claude` | `.claude/skills/` |
| *(any other)* | **no mapping** — `skillsPathFor` returns a typed refusal; the `copy_setup_skill` step fails **by name**, and the project reads `failed` with that step |

v0.1 of the bundle maps `claude` only, because it is the one integration this programme has run end
to end. Adding a row is a bundle version bump and a test, never an edit to `provisioning.service.ts`.
A refusal rather than a default is deliberate: copying a skill into another agent's directory would
"work" while installing a Claude Code skill where no Claude Code will read it.

---

## `.pmi/project.json`

```json
{
  "schemaVersion": 1,
  "projectId": "<uuid>",
  "workspaceId": "<uuid>",
  "projectName": "<name>",
  "platformUrl": "http://localhost:3000",
  "agentIntegration": "claude",
  "scriptType": "ps",
  "engineTag": "v0.16.4",
  "bundleVersion": "0.1.0",
  "provisionedBy": "pmi-studio",
  "preparedAt": "<ISO-8601>"
}
```

Rules:

- **No credential, no secret, no absolute host path other than the platform URL.** The root path
  is not written: the file already knows where it is.
- `platformUrl` (and `PMI_STUDIO_URL` in `.mcp.json`) comes from **`PMI_PUBLIC_URL`** and nowhere
  else (analysis `U2`). The API in a container cannot infer the address the user's machine reaches
  it at; the operator states it once, with the default `http://localhost:${PMI_APP_PORT:-3000}`.
- `schemaVersion` is bumped by any incompatible change; the setup skill refuses a version it does
  not know rather than guessing.
- Written with `\n` line endings and a trailing newline regardless of platform, so a git diff after
  re-provisioning is empty (`SC-LPW-004`).
- Read by: the setup skill (bundle), `EPIC-043`'s MCP server (to find `projectId` and
  `platformUrl`), `EPIC-042`'s extension commands.

---

## `.mcp.json`

Merged: if the file exists it is parsed and only `mcpServers["pmi-studio"]` is added or replaced;
every other key is preserved byte-for-byte where the parser allows, and key order is kept. If it
does not exist it is created with this single entry.

```json
{
  "mcpServers": {
    "pmi-studio": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@pmi/mcp-server@0.1.0"],
      "env": {
        "PMI_STUDIO_URL": "http://localhost:3000",
        "PMI_STUDIO_TOKEN": "${PMI_STUDIO_TOKEN}"
      }
    }
  }
}
```

Rules:

- `PMI_STUDIO_TOKEN` is **always** the literal string `${PMI_STUDIO_TOKEN}`; the agent expands it
  from the user's environment at start (Claude Code's documented `${VAR}` expansion). Writing a
  value here is the mutation `SC-LPW-003` tests for.
- The server version is configuration (`PMI_MCP_SERVER_VERSION`); the package is `EPIC-043`'s and
  may not exist yet when this file is written. The setup skill reports that state honestly.
- `context7` and `github` entries are **not** written by this Epic; `EPIC-042`'s setup skill adds
  them (PMI-DOC-007 §5.3 step 7).
- A file that fails to parse is **not** overwritten: the step fails naming `merge_mcp_json` and the
  parse error, and the user's file is left as it was.

---

## `.claude/skills/setup-PMIStudio/SKILL.md` — bundle v0.1

Frontmatter and body are `@pmi/workspace-bundle`'s; this contract fixes only what the v0.1 skill
must do and must not do, because it is the completion path for `initialisation_pending`:

Must:
1. Read `.pmi/project.json`; refuse with a clear message if absent or of an unknown `schemaVersion`.
2. Report whether `.specify/` exists. If not, show and then run the `R-041-8` command with the
   file's `agentIntegration`, `scriptType` and `engineTag`.
3. Copy `extensions/pmi/` and register its hooks if absent — from the bundle version the file names.
4. Check that `PMI_STUDIO_TOKEN` is set in the environment. **Never ask for its value; never print
   it.** If unset, explain where to mint one in PMI Studio and how to export it.
5. If `.mcp.json` lacks the `pmi-studio` entry, add it (same merge rule as above).
6. Call `GET /connector/whoami` through the platform URL with the token and report the project it
   opens, or the refusal.
7. End with a table of every check and its state.

Must not: install anything without showing the command first; modify any file outside the project
directory; write a credential anywhere.

The full skill — `uv`, Docker, Node, Context7, GitHub MCP checks and the `pmi.health` call — is
`EPIC-042`'s and replaces v0.1 in place under the same path.

---

## `.specify/extensions.yml` and `.specify/extensions/pmi/`

Written by the initialise step from the bundle. In this Epic the extension declares its identity
and version and registers **no hooks**: hooks that call `speckit.pmi.*` commands would call
commands `EPIC-042` has not written, and Spec Kit treats a registered command that does not exist
as an error at the user's next `/speckit-*` run. The v0.1 `extension.yml` therefore has an empty
`provides.commands` and an empty `hooks` block, and exists so that the *installation mechanism* is
proven end to end before the content arrives. `EPIC-042` fills both.

`extensions.yml` is merged the way `.mcp.json` is: an existing file keeps every other extension's
entries.
