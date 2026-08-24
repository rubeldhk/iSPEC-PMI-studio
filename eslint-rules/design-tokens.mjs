/**
 * T878 (EPIC-029) — the literal-value rule: no visual literal outside the
 * token file (FR-DS-001, FR-DS-051, SC-DS-003; research R-029-5).
 *
 * Two surfaces, one rule:
 *  - stylesheets: ESLint has no CSS language, so a processor wraps each CSS
 *    file line-preservingly into a JS template literal; the rule scans the
 *    raw lines and postprocess maps every report back to the original line.
 *  - inline `style=` props in TSX: the rule visits the style object and flags
 *    literal strings and numbers (React numbers are px).
 *
 * The allowlist is research R-029-5's, stated once so it is not invented
 * per-file: `0`, `1px` (hairlines), `100%`, `100vh`, `auto`, `currentColor`.
 * Anything else is a token. `tokens.css`/`themes.css` are exempted in
 * eslint.config.js — they are the one home literals have.
 *
 * Unit tests: tests/governance/eslint-design-tokens.spec.ts (T876, T877 —
 * the mutation test proving the rule can fail).
 */

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(/g;
const LENGTH = /(?<![\w-])(-?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|pt|ch|ex|%)(?![\w-])/g;

/** R-029-5's allowlist. A zero of any unit is zero. */
function lengthAllowed(number, unit) {
  const value = Number.parseFloat(number);
  if (value === 0) return true;
  if (value === 1 && unit === 'px') return true;
  if (value === 100 && (unit === '%' || unit === 'vh')) return true;
  return false;
}

/** Scan one line of CSS (or one string value); return offending fragments. */
function scanText(text) {
  // Token references are the point of the system — nothing inside var() is a
  // violation, including a numeric fallback the token file vouches for.
  const outsideVar = text.replace(/var\(--[^)]*\)/g, (m) => ' '.repeat(m.length));
  const found = [];
  for (const m of outsideVar.matchAll(HEX)) found.push({ value: m[0], index: m.index });
  for (const m of outsideVar.matchAll(FUNCTIONAL_COLOR))
    found.push({ value: m[0].slice(0, -1) + '(…)', index: m.index });
  for (const m of outsideVar.matchAll(LENGTH)) {
    if (!lengthAllowed(m[1], m[2])) found.push({ value: m[0], index: m.index });
  }
  return found;
}

/** Strip CSS comments without moving anything: same length, same lines. */
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'No literal visual value outside frontend/src/design/tokens.css — use a design token (FR-DS-051)',
    },
    schema: [],
    messages: {
      literal:
        "Literal visual value '{{value}}' — use a design token from design/tokens.css (FR-DS-051)",
    },
  },
  create(context) {
    const filename = String(context.filename ?? context.getFilename());

    // --- stylesheet mode: a virtual block the processor produced -----------
    if (/\.css[\\/][^\\/]+\.js$/.test(filename)) {
      return {
        Program(node) {
          const lines = context.sourceCode.text.split('\n');
          const css = blankComments(lines.slice(1).join('\n')).split('\n');
          css.forEach((line, i) => {
            for (const hit of scanText(line)) {
              context.report({
                node,
                messageId: 'literal',
                data: { value: hit.value },
                // +2: virtual line 1 is the wrapper; css lines are 1-based.
                loc: {
                  start: { line: i + 2, column: hit.index },
                  end: { line: i + 2, column: hit.index + hit.value.length },
                },
              });
            }
          });
        },
      };
    }

    // --- TSX mode: inline style objects ------------------------------------
    /** Report every literal inside one style-object property value. */
    function checkStyleValue(valueNode) {
      switch (valueNode.type) {
        case 'Literal': {
          if (typeof valueNode.value === 'number') {
            // React treats bare numbers as px; 0 and the 1px hairline pass.
            if (valueNode.value !== 0 && valueNode.value !== 1) {
              context.report({
                node: valueNode,
                messageId: 'literal',
                data: { value: String(valueNode.value) },
              });
            }
          } else if (typeof valueNode.value === 'string') {
            for (const hit of scanText(valueNode.value)) {
              context.report({ node: valueNode, messageId: 'literal', data: { value: hit.value } });
            }
          }
          return;
        }
        case 'TemplateLiteral': {
          for (const quasi of valueNode.quasis) {
            for (const hit of scanText(quasi.value.raw)) {
              context.report({ node: quasi, messageId: 'literal', data: { value: hit.value } });
            }
          }
          return;
        }
        case 'ConditionalExpression':
          checkStyleValue(valueNode.consequent);
          checkStyleValue(valueNode.alternate);
          return;
        default:
        // Identifiers, calls, member expressions: values the rule cannot see.
        // The stylesheet half and the token-sufficiency check (T900c) carry
        // the guarantee for computed styling.
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'style') return;
        const expr = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null;
        if (expr?.type !== 'ObjectExpression') return;
        for (const prop of expr.properties) {
          if (prop.type === 'Property') checkStyleValue(prop.value);
        }
      },
    };
  },
};

/** Line-preserving CSS → JS wrapper; reports map back with line - 1. */
const cssProcessor = {
  meta: { name: 'design-css', version: '1.0.0' },
  supportsAutofix: false,
  preprocess(text) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return [{ text: 'const css = `\n' + escaped + '`;\nvoid css;\n', filename: 'stylesheet.js' }];
  },
  postprocess(messageLists) {
    return (messageLists[0] ?? []).map((m) => ({
      ...m,
      line: Math.max(1, (m.line ?? 1) - 1),
      endLine: m.endLine === undefined ? m.endLine : Math.max(1, m.endLine - 1),
    }));
  },
};

const plugin = {
  meta: { name: 'eslint-plugin-design', version: '1.0.0' },
  rules: { 'no-literal-visual-values': rule },
  processors: { css: cssProcessor },
};

export default plugin;
