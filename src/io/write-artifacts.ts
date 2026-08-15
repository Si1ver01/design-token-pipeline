import {
  existsSync,
  lstatSync,
  mkdirSync,
  renameSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';

import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import type { GeneratedArtifact } from '../formats/types.js';
import {
  assertPathInsideRoot,
  assertTrustedDirectoryChain,
  assertTrustedDirectorySnapshot,
  ensureTrustedDirectoryChain,
  identityOf,
  sameIdentity,
  snapshotTrustedDirectory,
  type DirectorySnapshot,
  type FileIdentity,
} from './filesystem-security.js';
import { resolvePathWithinRoot } from './path-security.js';

export interface WriteArtifactsResult {
  readonly files: readonly string[];
  readonly byteCount: number;
}

export function writeArtifactsAtomic(
  rootDirectory: string,
  outDir: string,
  artifacts: readonly GeneratedArtifact[],
): OperationResult<WriteArtifactsResult> {
  const output = resolvePathWithinRoot(rootDirectory, outDir, 'Output directory');
  if (!output.success) return output;
  const stageDirectory = join(output.value, `.design-token-pipeline-${randomUUID()}`);
  const promoted: string[] = [];
  const backups: Array<{ target: string; backup: string }> = [];
  let stageSnapshot: DirectorySnapshot | undefined;
  let outputChain: readonly DirectorySnapshot[] | undefined;

  try {
    const currentOutputChain = ensureTrustedDirectoryChain(
      rootDirectory,
      output.value,
      'Output directory',
    );
    outputChain = currentOutputChain;
    assertPathInsideRoot(rootDirectory, output.value, 'Output directory');
    mkdirSync(stageDirectory, { mode: 0o700 });
    const currentStageSnapshot = snapshotTrustedDirectory(stageDirectory, 'Stage directory');
    stageSnapshot = currentStageSnapshot;

    const staged = artifacts.map((artifact, index) => {
      assertOperationDirectories(currentOutputChain, currentStageSnapshot);
      if (basename(artifact.filename) !== artifact.filename) {
        throw new Error(`Artifact filename is unsafe: ${artifact.filename}`);
      }
      const target = resolvePathWithinRoot(output.value, artifact.filename, 'Output file');
      if (!target.success)
        throw new Error(target.diagnostics[0]?.message ?? 'Output path is invalid.');
      if (existsSync(target.value)) {
        const stats = lstatSync(target.value);
        if (!stats.isFile() || stats.isSymbolicLink()) {
          throw new Error(`Output target is not a regular file: ${artifact.filename}`);
        }
      }
      const stage = join(stageDirectory, `artifact-${index}`);
      writeFileSync(stage, artifact.content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      return {
        artifact,
        target: target.value,
        stage,
        backup: join(stageDirectory, `backup-${index}`),
        targetIdentity: targetIdentity(target.value),
      };
    });

    for (const item of staged) {
      assertOperationDirectories(currentOutputChain, currentStageSnapshot);
      const currentIdentity = targetIdentity(item.target);
      if (!sameOptionalIdentity(currentIdentity, item.targetIdentity)) {
        throw new Error(`Output target changed while staging: ${item.artifact.filename}`);
      }
      if (currentIdentity) {
        renameSync(item.target, item.backup);
        backups.push({ target: item.target, backup: item.backup });
      }
    }
    for (const item of staged) {
      assertOperationDirectories(currentOutputChain, currentStageSnapshot);
      if (targetIdentity(item.target)) {
        throw new Error(`Output target changed before promotion: ${item.artifact.filename}`);
      }
      renameSync(item.stage, item.target);
      promoted.push(item.target);
    }
    assertOperationDirectories(currentOutputChain, currentStageSnapshot);
    cleanupStageDirectory(stageDirectory);
    return {
      success: true,
      value: Object.freeze({
        files: Object.freeze(staged.map((item) => relative(rootDirectory, item.target))),
        byteCount: artifacts.reduce((total, artifact) => total + artifact.byteCount, 0),
      }),
      diagnostics: [],
    };
  } catch (error) {
    let failure = error;
    try {
      if (outputChain && stageSnapshot) {
        for (const target of promoted) {
          assertOperationDirectories(outputChain, stageSnapshot);
          unlinkSync(target);
        }
        for (const { target, backup } of backups.reverse()) {
          assertOperationDirectories(outputChain, stageSnapshot);
          if (existsSync(backup)) renameSync(backup, target);
        }
        assertOperationDirectories(outputChain, stageSnapshot);
        cleanupStageDirectory(stageDirectory);
      }
    } catch (rollbackError) {
      failure = new Error(
        `${errorMessage(error)} Rollback stopped because filesystem identity changed: ${errorMessage(rollbackError)}`,
      );
    }
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'io.write-failed',
          message: errorMessage(failure),
          path: outDir,
        }),
      ],
    };
  }
}

function assertOperationDirectories(
  outputChain: readonly DirectorySnapshot[] | undefined,
  stageSnapshot: DirectorySnapshot,
): void {
  if (!outputChain) throw new Error('Output directory trust was not established.');
  assertTrustedDirectoryChain(outputChain, 'Output directory');
  assertTrustedDirectorySnapshot(stageSnapshot, 'Stage directory');
}

export function cleanupStageDirectory(stageDirectory: string): void {
  const entries = readdirSync(stageDirectory);
  for (const name of entries) {
    const entry = join(stageDirectory, name);
    const stats = lstatSync(entry);
    if (!/^(?:artifact|backup)-\d+$/u.test(name) || !stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Refusing to recursively remove unexpected stage entry: ${name}`);
    }
    unlinkSync(entry);
  }
  rmdirSync(stageDirectory);
}

function targetIdentity(path: string): FileIdentity | null {
  if (!existsSync(path)) return null;
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('Output target is not a regular file and cannot be a symbolic link.');
  }
  return identityOf(stats);
}

function sameOptionalIdentity(left: FileIdentity | null, right: FileIdentity | null): boolean {
  if (left === null || right === null) return left === right;
  return sameIdentity(left, right);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Generated artifacts could not be written.';
}
