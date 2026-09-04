/**
 * `pmi-studio` bootstrap — T1399 placeholder until `T1427` composes the server.
 *
 * Exits naming the environment it needs, so a misconfigured `.mcp.json` fails
 * loudly rather than hanging on stdio.
 */
const missing = ['PMI_STUDIO_URL'].filter((name) => !process.env[name]);
if (missing.length > 0) {
  process.stderr.write(`pmi-studio: missing environment ${missing.join(', ')}\n`);
  process.exit(2);
}
process.stderr.write('pmi-studio: the server is composed by T1427\n');
process.exit(2);
