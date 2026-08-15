import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import type { ResolvedTokenDocument } from '../core/model.js';
import { toCssVariableName, validateCssPrefix } from './naming.js';
import type { CssGeneratorOptions, GeneratedArtifact } from './types.js';

const SAFE_SELECTOR_PATTERN = /^(?::root|[.#][A-Za-z][A-Za-z0-9_-]*)$/;

export function generateCss(
  document: ResolvedTokenDocument,
  options: CssGeneratorOptions = {},
): OperationResult<GeneratedArtifact> {
  const prefix = options.prefix ?? 'dt';
  const prefixResult = validateCssPrefix(prefix);
  if (!prefixResult.success) return prefixResult;

  const selector = options.selector ?? ':root';
  if (!SAFE_SELECTOR_PATTERN.test(selector)) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'format.invalid-value',
          message: 'CSS selector must be :root, a simple class, or a simple ID selector.',
          context: { selector },
        }),
      ],
    };
  }

  const lines = [`${selector} {`];
  for (const token of sortedTokens(document)) {
    if (options.includeDescriptions && token.description) {
      lines.push(`  /* ${sanitizeCssComment(token.description)} */`);
    }
    lines.push(`  ${toCssVariableName(token.path, prefix)}: ${String(token.value)};`);
  }
  lines.push('}', '');
  const content = lines.join('\n');
  return {
    success: true,
    value: Object.freeze({
      format: 'css',
      filename: options.filename ?? 'tokens.css',
      content,
      tokenCount: document.tokens.length,
      byteCount: Buffer.byteLength(content),
      diagnostics: Object.freeze([]),
    }),
    diagnostics: [],
  };
}

function sortedTokens(document: ResolvedTokenDocument) {
  return [...document.tokens].sort((left, right) =>
    left.pathString < right.pathString ? -1 : left.pathString > right.pathString ? 1 : 0,
  );
}

function sanitizeCssComment(value: string): string {
  return value.replaceAll('*/', '* /').replaceAll(/\s+/g, ' ').trim();
}
