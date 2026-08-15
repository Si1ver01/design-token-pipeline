import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import { normalizeCollisionKey } from '../core/validate-tokens.js';

const PREFIX_PATTERN = /^[a-z][a-z0-9-]*$/;

export function toCssVariableName(path: readonly string[], prefix = 'dt'): string {
  const normalizedPath = normalizeCollisionKey(path);
  return `--${prefix}-${normalizedPath}`;
}

export function validateCssPrefix(prefix: string): OperationResult<string> {
  if (!PREFIX_PATTERN.test(prefix)) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'format.invalid-value',
          message:
            'CSS prefix must start with a lowercase letter and contain only a-z, 0-9, or hyphens.',
          context: { prefix },
        }),
      ],
    };
  }
  return { success: true, value: prefix, diagnostics: [] };
}

export function serializeJavaScriptLiteral(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export function serializePropertyName(value: string): string {
  return JSON.stringify(value);
}
