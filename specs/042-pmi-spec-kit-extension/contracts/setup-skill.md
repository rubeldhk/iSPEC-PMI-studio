# Contract — `/setup-PMIStudio` (`EPIC-042`, bundle `0.2.0`)

**File**: `packages/workspace-bundle/skills/setup-PMIStudio/SKILL.md`, replacing the `0.1.0`
hand-off in place · **Checked by**: `packages/workspace-bundle/tests/setup-skill.spec.ts` ·
**Research**: `R-042-9`

## 1. Invariants (`FR-EXT-030`–`FR-EXT-038`)

- Idempotent: a second run on a green machine changes no file and prints the same table.
- Shows every command before running it; writes nothing outside the project directory.
- Installs only: the toolkit at the pinned tag, the extension, configuration entries. Guides only
  for `uv`, Node, Docker and the credential.
- Never asks for, prints or writes a credential value; checks only that `PMI_STUDIO_TOKEN` is set.
- Always ends with the table, even after stopping at row 1.

## 2. The ten checks, in order

| # | Check | Source of truth | If not ok |
|---|---|---|---|
| 1 | `.pmi/project.json` present, `schemaVersion: 1` | the file | **stop**: not provisioned by PMI Studio; say where a project is created |
| 2 | `uv` on PATH | `uv --version` | guide: platform-specific install; later rows `skipped` |
| 3 | `specify` at `engineTag` | `specify --version` vs `.pmi/project.json` | show, then run `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<engineTag>`; verify |
| 4 | `.specify/` initialised for `agentIntegration` / `scriptType` | directory + `.specify/integrations/<integration>.manifest.json` | show, then run `specify init --here --force --integration <agentIntegration> --script <scriptType>`; verify |
| 5 | extension at the version `pmi.project.context` reports; hooks registered; stock skills unchanged | `.specify/extensions/pmi/extension.yml`, `.specify/extensions.yml`, the integration manifest digests | re-copy the extension from the bundle version `.pmi/project.json` names; merge the fragment; report any changed stock skill as `refused` (never repair it) |
| 6 | `PMI_STUDIO_TOKEN` set | environment | guide: where minted, how exported; row 10 `skipped` |
| 7 | `.mcp.json` lists `pmi-studio`, `context7`, `github` | the file (left untouched if unparseable → `refused` with the path) | add missing entries only; `${VAR}` references only |
| 8 | Docker daemon reachable — **only** when `.pmi/project.json` says the platform is containerised on this machine | `docker info` | guide |
| 9 | Node ≥ 22 | `node --version` | guide |
| 10 | `pmi.health { extensionVersion, toolkitVersion, constitutionDigest }` succeeds | the tool result | report `structuredContent.code`; on success write the constitution when `state` is `missing` or `stale`, report `drift` without writing |

## 3. The `.mcp.json` entries the skill may add (`FR-EXT-034`)

```json
{
  "mcpServers": {
    "pmi-studio": { "type": "stdio", "command": "npx", "args": ["-y", "@pmi/mcp-server@<version>"], "env": { "PMI_STUDIO_URL": "<platformUrl>", "PMI_STUDIO_TOKEN": "${PMI_STUDIO_TOKEN}" } },
    "context7":   { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp"], "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" } },
    "github":     { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" } }
  }
}
```

Merge rule: keep every existing key; add only absent server entries; never rewrite an existing
entry; never write a value where a `${VAR}` reference belongs.

## 4. The final table (`FR-EXT-038`)

Columns *#*, *Check*, *State*, *What to do*. States: `ok`, `pending`, `missing`, `refused`,
`unreachable`, `skipped`. A row with nothing to do says `—`. Row 10 on success carries the
project id, contract version and API version returned.

## 5. Conformance tests

| Test | Asserts |
|---|---|
| `setup-skill.spec.ts` | frontmatter names `setup-PMIStudio`, user-invocable, bundle version `0.2.0`; the ten checks appear in order; every install command is preceded by "show"; the words *ask for the token*, *paste*, and any `pmi_ct_` / `sk-` shape are absent; only the three `.mcp.json` servers of §3 are named; `${VAR}` references only (`SC-EXT-005`; mutation: add a line printing the variable → red) |
| `bundle.spec.ts` (extended) | `BUNDLE_VERSION` is `0.2.0`; the skills half carries the full skill, not the hand-off |
