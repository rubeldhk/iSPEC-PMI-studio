---
name: "setup-PMIStudio"
description: "Verify this directory's connection to PMI Studio and complete a pending Spec Kit initialisation. Bundle v0.1 — the hand-off half of the skill; EPIC-042 delivers the full toolchain setup."
argument-hint: "No arguments. Run it in a project directory PMI Studio provisioned."
compatibility: "Requires a .pmi/project.json written by PMI Studio (EPIC-041)."
metadata:
  author: "pmi-studio"
  bundle-version: "0.1.0"
user-invocable: true
disable-model-invocation: false
---

## What this skill does (v0.1)

This is the **hand-off** half of `/setup-PMIStudio`. PMI Studio prepares a project directory from
the platform; on a host without the Spec Kit initialiser it records the project as *initialisation
pending* and leaves this skill behind so the initialisation can be finished here, on the developer's
machine. The full skill — `uv`, Docker, Node, Context7 and GitHub MCP checks and the `pmi.health`
call — is EPIC-042's and replaces this file in place.

Run every step in order. **Show each command before running it.** Never modify any file outside
this project directory. End with the table in step 7.

## Steps

1. **Read `.pmi/project.json`.** If it is absent, stop: this directory was not provisioned by PMI
   Studio; explain that a project is created in PMI Studio first. If `schemaVersion` is not `1`,
   stop and say which version this skill understands rather than guessing.

2. **Report whether `.specify/` exists.** If it does not, initialisation is pending. Show, then run,
   with the project directory as the working directory and the values from `.pmi/project.json`:

   ```
   uvx --from git+https://github.com/github/spec-kit.git@<engineTag> specify init --here --force --integration <agentIntegration> --script <scriptType>
   ```

   If `uv` is not installed, say so and point at the `uv` installation page for this platform. Do
   not install it silently.

3. **Install the PMI extension if absent.** If `.specify/extensions/pmi/extension.yml` does not
   exist, copy the extension from the `@pmi/workspace-bundle` version named in `.pmi/project.json`
   (`bundleVersion`) into `.specify/extensions/pmi/`, and merge its hook fragment into
   `.specify/extensions.yml` without touching any other extension's entries.

4. **Check that `PMI_STUDIO_TOKEN` is set in the environment.** Check only that it is set. **Never
   ask for its value and never print it** — a credential in a transcript is a credential in a
   log. If it is unset, explain that a connector credential is minted in PMI Studio under the
   project (Projects → the project → Connector credentials) and shown once, and show how to export
   it for this shell.

5. **Check `.mcp.json` carries the `pmi-studio` server.** If the entry is missing, add it with the
   same merge rule PMI Studio uses: keep every other server, add only `mcpServers["pmi-studio"]`,
   with `PMI_STUDIO_TOKEN` written as the literal `${PMI_STUDIO_TOKEN}` reference.

6. **Verify the credential opens this project.** Call `GET <platformUrl>/v1/connector/whoami` with
   `Authorization: Bearer $PMI_STUDIO_TOKEN` and report the project id it returns, or the refusal.
   If the platform is unreachable, say so; do not retry in a loop.

7. **End with a table** — one row per step, columns *Check*, *State* (`ok`, `pending`, `missing`,
   `refused`, `unreachable`), *What to do*. A row with nothing to do says `—`.

## Never

- Install anything without showing the command first.
- Write a credential value anywhere — not into a file, not into the conversation.
- Modify any file outside this project directory.
- Guess a value `.pmi/project.json` does not carry.
