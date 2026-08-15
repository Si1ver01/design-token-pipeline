import type { OperationResult } from '../diagnostics/types.js';
import type { ResolvedToken, ResolvedTokenDocument } from '../core/model.js';
import { serializeJavaScriptLiteral, serializePropertyName } from './naming.js';
import type { GeneratedArtifact, TypeScriptGeneratorOptions } from './types.js';

interface TreeNode {
  readonly children: Map<string, TreeNode>;
  token: ResolvedToken | null;
}

export function generateTypeScript(
  document: ResolvedTokenDocument,
  options: TypeScriptGeneratorOptions = {},
): OperationResult<GeneratedArtifact> {
  const root = createTreeNode();
  const sorted = [...document.tokens].sort((left, right) =>
    left.pathString < right.pathString ? -1 : left.pathString > right.pathString ? 1 : 0,
  );

  for (const token of sorted) insertToken(root, token);

  const union =
    sorted.map((token) => serializeJavaScriptLiteral(token.pathString)).join(' | ') || 'never';
  const content = [
    'export const tokens = ' + serializeTree(root, 0) + ' as const;',
    '',
    'export const flatTokens = {',
    ...sorted.map(
      (token) =>
        `  ${serializePropertyName(token.pathString)}: ${serializeJavaScriptLiteral(token.value)},`,
    ),
    '} as const;',
    '',
    `export type TokenPath = ${union};`,
    'export type TokenName = TokenPath;',
    '',
    'export default tokens;',
    '',
  ].join('\n');

  return {
    success: true,
    value: Object.freeze({
      format: 'typescript',
      filename: options.filename ?? 'tokens.ts',
      content,
      tokenCount: sorted.length,
      byteCount: Buffer.byteLength(content),
      diagnostics: Object.freeze([]),
    }),
    diagnostics: [],
  };
}

function createTreeNode(): TreeNode {
  return { children: new Map(), token: null };
}

function insertToken(root: TreeNode, token: ResolvedToken): void {
  let current = root;
  for (const segment of token.path) {
    let child = current.children.get(segment);
    if (!child) {
      child = createTreeNode();
      current.children.set(segment, child);
    }
    current = child;
  }
  current.token = token;
}

function serializeTree(node: TreeNode, depth: number): string {
  if (node.token) return serializeJavaScriptLiteral(node.token.value);
  const indentation = '  '.repeat(depth);
  const childIndentation = '  '.repeat(depth + 1);
  const entries = [...node.children.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (entries.length === 0) return '{}';
  const lines = entries.map(
    ([name, child]) =>
      `${childIndentation}${serializePropertyName(name)}: ${serializeTree(child, depth + 1)},`,
  );
  return ['{', ...lines, `${indentation}}`].join('\n');
}
