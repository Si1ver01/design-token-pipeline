import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic } from '../diagnostics/types.js';
import type { SourceToken, TokenDocument } from './token-types.js';

export function validateTokenSemantics(
  document: TokenDocument,
  file = 'tokens.json',
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tokenByPath = new Map<string, SourceToken>();
  const pathByOutputName = new Map<string, string>();

  for (const token of document.tokens) {
    const existing = tokenByPath.get(token.pathString);
    if (existing) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'name.collision',
          message: 'Duplicate normalized token path.',
          path: token.pathString,
          file,
          context: { paths: [existing.pathString, token.pathString] },
        }),
      );
      continue;
    }
    tokenByPath.set(token.pathString, token);

    const outputName = normalizeCollisionKey(token.path);
    const previousPath = pathByOutputName.get(outputName);
    if (previousPath && previousPath !== token.pathString) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'name.collision',
          message: 'Token paths normalize to the same output name.',
          path: token.pathString,
          file,
          context: { outputName, paths: [previousPath, token.pathString] },
        }),
      );
    } else {
      pathByOutputName.set(outputName, token.pathString);
    }
  }

  return Object.freeze(diagnostics.sort(compareDiagnostics));
}

export function normalizeCollisionKey(path: readonly string[]): string {
  return path.map((segment) => segment.toLowerCase().replaceAll('_', '-')).join('-');
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return compareText(left.path ?? '', right.path ?? '') || compareText(left.code, right.code);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
