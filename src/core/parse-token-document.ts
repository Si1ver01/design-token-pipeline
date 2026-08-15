import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import { normalizeTokenDocument } from './normalize-tokens.js';
import type { TokenDocument } from './token-types.js';

export function parseTokenDocument(
  source: string,
  file = 'tokens.json',
): OperationResult<TokenDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'json.invalid',
          message: error instanceof SyntaxError ? error.message : 'Invalid JSON input.',
          file,
        }),
      ],
    };
  }
  return normalizeTokenDocument(parsed, file);
}
