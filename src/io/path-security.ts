import { isAbsolute, relative, resolve } from 'node:path';

import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';

export function resolvePathWithinRoot(
  rootDirectory: string,
  candidate: string,
  label: string,
): OperationResult<string> {
  const root = resolve(rootDirectory);
  const target = resolve(root, candidate);
  const relativePath = relative(root, target);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relativePath)
  ) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'io.invalid-path',
          message: `${label} must remain inside the configured root directory.`,
          path: candidate,
          context: { root },
        }),
      ],
    };
  }
  return { success: true, value: target, diagnostics: [] };
}
