import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import { dirname } from 'node:path';

import {
  assertPathInsideRoot,
  assertTrustedDirectoryChain,
  readRegularFileByDescriptor,
  snapshotTrustedDirectoryChain,
} from './filesystem-security.js';
import { resolvePathWithinRoot } from './path-security.js';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export function readTextFileWithinRoot(
  rootDirectory: string,
  candidate: string,
  label = 'Input file',
): OperationResult<{ readonly path: string; readonly content: string }> {
  const resolved = resolvePathWithinRoot(rootDirectory, candidate, label);
  if (!resolved.success) return resolved;

  try {
    const directoryChain = snapshotTrustedDirectoryChain(
      rootDirectory,
      dirname(resolved.value),
      label,
    );
    assertPathInsideRoot(rootDirectory, resolved.value, label);
    const opened = readRegularFileByDescriptor(resolved.value, label, MAX_INPUT_BYTES);
    assertTrustedDirectoryChain(directoryChain, label);
    if (opened.stats.size > MAX_INPUT_BYTES) throw new Error(`${label} exceeds the 10 MiB limit.`);
    const realFile = assertPathInsideRoot(rootDirectory, resolved.value, label);
    return {
      success: true,
      value: Object.freeze({ path: realFile, content: opened.content }),
      diagnostics: [],
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'io.read-failed',
          message: error instanceof Error ? error.message : `${label} could not be read.`,
          path: candidate,
        }),
      ],
    };
  }
}
