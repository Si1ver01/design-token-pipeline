import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import type { GeneratedArtifact } from '../formats/types.js';
import {
  assertPathInsideRoot,
  assertTrustedDirectoryChain,
  regularFileMatchesContent,
  snapshotTrustedDirectoryChain,
  type DirectorySnapshot,
} from './filesystem-security.js';
import { resolvePathWithinRoot } from './path-security.js';

export interface ArtifactCheckResult {
  readonly fresh: boolean;
  readonly stale: readonly string[];
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
}

export function checkArtifacts(
  rootDirectory: string,
  outDir: string,
  artifacts: readonly GeneratedArtifact[],
): OperationResult<ArtifactCheckResult> {
  const output = resolvePathWithinRoot(rootDirectory, outDir, 'Output directory');
  if (!output.success) return output;
  const diagnostics: Diagnostic[] = [];
  const stale: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];
  let outputChain: readonly DirectorySnapshot[] | undefined;

  if (!existsSync(output.value)) {
    for (const artifact of artifacts) {
      const displayPath = relative(rootDirectory, join(output.value, artifact.filename));
      missing.push(displayPath);
      diagnostics.push(staleDiagnostic(displayPath, 'Generated output is missing.'));
    }
    return artifactCheckResult(stale, missing, unexpected, diagnostics);
  }

  try {
    outputChain = snapshotTrustedDirectoryChain(rootDirectory, output.value, 'Output directory');
    assertPathInsideRoot(rootDirectory, output.value, 'Output directory');
  } catch (error) {
    return invalidPathResult(
      error,
      relative(rootDirectory, output.value),
      'Output directory is not a trusted directory.',
    );
  }

  for (const artifact of artifacts) {
    try {
      assertTrustedDirectoryChain(outputChain, 'Output directory');
      const target = resolvePathWithinRoot(output.value, artifact.filename, 'Output file');
      if (!target.success) return target;
      const displayPath = relative(rootDirectory, target.value);
      if (!existsSync(target.value)) {
        missing.push(displayPath);
        diagnostics.push(staleDiagnostic(displayPath, 'Generated output is missing.'));
        continue;
      }
      if (!regularFileMatchesContent(target.value, 'Generated output', artifact.content)) {
        stale.push(displayPath);
        diagnostics.push(staleDiagnostic(displayPath, 'Generated output is stale.'));
      }
    } catch (error) {
      return invalidPathResult(
        error,
        relative(rootDirectory, output.value),
        'Generated output could not be read.',
      );
    }
  }

  if (existsSync(output.value)) {
    try {
      assertTrustedDirectoryChain(outputChain, 'Output directory');
      const expectedNames = new Set(artifacts.map((artifact) => artifact.filename));
      for (const name of readdirSync(output.value).sort()) {
        if (expectedNames.has(name)) continue;
        const displayPath = relative(rootDirectory, join(output.value, name));
        unexpected.push(displayPath);
        diagnostics.push(staleDiagnostic(displayPath, 'Generated output is unexpected.'));
      }
    } catch (error) {
      return invalidPathResult(
        error,
        relative(rootDirectory, output.value),
        'Output directory could not be listed.',
      );
    }
  }

  return artifactCheckResult(stale, missing, unexpected, diagnostics);
}

function artifactCheckResult(
  stale: readonly string[],
  missing: readonly string[],
  unexpected: readonly string[],
  diagnostics: readonly Diagnostic[],
): OperationResult<ArtifactCheckResult> {
  return {
    success: true,
    value: Object.freeze({
      fresh: stale.length === 0 && missing.length === 0 && unexpected.length === 0,
      stale: Object.freeze(stale),
      missing: Object.freeze(missing),
      unexpected: Object.freeze(unexpected),
    }),
    diagnostics,
  };
}

function invalidPathResult(
  error: unknown,
  path: string,
  fallback: string,
): OperationResult<ArtifactCheckResult> {
  return {
    success: false,
    diagnostics: [
      createDiagnostic({
        severity: 'error',
        code: 'io.invalid-path',
        message: error instanceof Error ? error.message : fallback,
        path,
      }),
    ],
  };
}

function staleDiagnostic(path: string, message: string): Diagnostic {
  return createDiagnostic({ severity: 'warning', code: 'io.stale-output', message, path });
}
