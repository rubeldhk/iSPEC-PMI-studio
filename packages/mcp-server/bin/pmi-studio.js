#!/usr/bin/env node
// `pmi-studio` — the stdio MCP server the user's agent starts from `.mcp.json`
// (EPIC-041 writes the entry; EPIC-043 makes the name true). The published
// package ships compiled output; a checkout runs the same entry through tsx via
// PMI_MCP_SERVER_COMMAND (R-043-11).
import('../dist/main.js').catch(async () => import('../src/main.ts'));
