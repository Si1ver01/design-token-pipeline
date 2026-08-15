import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import type { ResolvedToken } from '../core/model.js';
import type { ResolvedTokenDocument } from '../core/model.js';
import { normalizeCollisionKey } from '../core/validate-tokens.js';
import { serializeJavaScriptLiteral, serializePropertyName } from './naming.js';
import { resolveTailwindGroups } from './tailwind-mapping.js';
import type { GeneratedArtifact, TailwindGeneratorOptions } from './types.js';

interface ThemeNode {
  readonly children: Map<string, ThemeNode>;
  token: ResolvedToken | null;
}

export function generateTailwindTheme(
  document: ResolvedTokenDocument,
  options: TailwindGeneratorOptions = {},
): OperationResult<GeneratedArtifact> {
  const diagnostics: Diagnostic[] = [];
  const mapping = resolveTailwindGroups(options.groups);
  const root = createThemeNode();
  const outputPathByKey = new Map<string, string>();

  for (const token of sortedTokens(document)) {
    const [sourceGroup, ...rest] = token.path;
    const scale = sourceGroup ? mapping[sourceGroup] : undefined;
    if (!sourceGroup || !scale || rest.length === 0) {
      diagnostics.push(
        createDiagnostic({
          severity: options.strict ? 'error' : 'warning',
          code: 'format.unmapped-group',
          message: 'Token root group is not mapped to a Tailwind theme scale.',
          path: token.pathString,
          context: { sourceGroup: sourceGroup ?? '' },
        }),
      );
      continue;
    }

    const outputPath = [scale, ...rest];
    const collisionKey = normalizeCollisionKey(outputPath);
    const previous = outputPathByKey.get(collisionKey);
    if (previous) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'name.collision',
          message: 'Tailwind keys normalize to the same output path.',
          path: token.pathString,
          context: { outputName: collisionKey, paths: [previous, token.pathString] },
        }),
      );
      continue;
    }
    outputPathByKey.set(collisionKey, token.pathString);
    insertToken(root, outputPath, token);
  }

  diagnostics.sort(compareDiagnostics);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { success: false, diagnostics };
  }

  const content = [
    'export const theme = ' + serializeTheme(root, 0) + ' as const;',
    '',
    'export default theme;',
    '',
  ].join('\n');
  const generatedCount = outputPathByKey.size;
  return {
    success: true,
    value: Object.freeze({
      format: 'tailwind',
      filename: options.filename ?? 'tailwind-theme.ts',
      content,
      tokenCount: generatedCount,
      byteCount: Buffer.byteLength(content),
      diagnostics: Object.freeze([...diagnostics]),
    }),
    diagnostics,
  };
}

function createThemeNode(): ThemeNode {
  return { children: new Map(), token: null };
}

function insertToken(root: ThemeNode, path: readonly string[], token: ResolvedToken): void {
  let current = root;
  for (const segment of path) {
    let child = current.children.get(segment);
    if (!child) {
      child = createThemeNode();
      current.children.set(segment, child);
    }
    current = child;
  }
  current.token = token;
}

function serializeTheme(node: ThemeNode, depth: number): string {
  if (node.token) return serializeJavaScriptLiteral(node.token.value);
  const indentation = '  '.repeat(depth);
  const childIndentation = '  '.repeat(depth + 1);
  const entries = [...node.children.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (entries.length === 0) return '{}';
  return [
    '{',
    ...entries.map(
      ([name, child]) =>
        `${childIndentation}${serializePropertyName(name)}: ${serializeTheme(child, depth + 1)},`,
    ),
    `${indentation}}`,
  ].join('\n');
}

function sortedTokens(document: ResolvedTokenDocument): readonly ResolvedToken[] {
  return [...document.tokens].sort((left, right) =>
    left.pathString < right.pathString ? -1 : left.pathString > right.pathString ? 1 : 0,
  );
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return compareText(left.path ?? '', right.path ?? '') || compareText(left.code, right.code);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
