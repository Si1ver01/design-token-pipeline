import {
  closeSync,
  chmodSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkArtifacts } from '../src/io/check-artifacts.js';
import {
  assertDirectorySnapshot,
  assertOpenedFileIdentity,
  snapshotDirectory,
} from '../src/io/filesystem-security.js';
import { resolvePathWithinRoot } from '../src/io/path-security.js';
import { readTextFileWithinRoot } from '../src/io/read-input.js';
import { cleanupStageDirectory, writeArtifactsAtomic } from '../src/io/write-artifacts.js';
import type { GeneratedArtifact } from '../src/formats/types.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('filesystem pipeline', () => {
  it('writes atomically and detects stale, missing, and unexpected output', () => {
    const root = temporaryRoot();
    const artifact = createArtifact('tokens.css', ':root {}\n');

    const written = writeArtifactsAtomic(root, 'generated', [artifact]);
    const fresh = checkArtifacts(root, 'generated', [artifact]);
    writeFileSync(join(root, 'generated', 'tokens.css'), 'stale\n');
    writeFileSync(join(root, 'generated', 'extra.css'), 'unexpected\n');
    const stale = checkArtifacts(root, 'generated', [artifact]);
    rmSync(join(root, 'generated', 'tokens.css'));
    const missing = checkArtifacts(root, 'generated', [artifact]);

    expect(written.success).toBe(true);
    expect(fresh.success && fresh.value.fresh).toBe(true);
    expect(stale.success && stale.value.fresh).toBe(false);
    expect(stale.success ? stale.value.stale : []).toEqual(['generated/tokens.css']);
    expect(stale.success ? stale.value.unexpected : []).toEqual(['generated/extra.css']);
    expect(missing.success ? missing.value.missing : []).toEqual(['generated/tokens.css']);
  });

  it('rejects path traversal', () => {
    const root = temporaryRoot();

    const result = resolvePathWithinRoot(root, '../outside', 'Output directory');

    expect(result.success).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('io.invalid-path');
  });

  it('reports all outputs missing without following a newly created output path', () => {
    const root = temporaryRoot();
    const artifacts = [createArtifact('tokens.css', ':root {}\n')];

    const result = checkArtifacts(root, 'generated', artifacts);

    expect(result.success).toBe(true);
    expect(result.success ? result.value.missing : []).toEqual(['generated/tokens.css']);
  });

  it('rejects an input path replaced after its descriptor is opened', () => {
    const root = temporaryRoot();
    const input = join(root, 'tokens.json');
    const replaced = join(root, 'tokens-original.json');
    writeFileSync(input, '{"safe":true}\n');
    const before = lstatSync(input);
    const descriptor = openSync(input, 'r');

    try {
      const opened = fstatSync(descriptor);
      renameSync(input, replaced);
      writeFileSync(input, '{"attacker":true}\n');

      expect(() => assertOpenedFileIdentity(input, before, opened, 'Token input')).toThrow(
        'changed while it was being opened',
      );
      expect(readFileSync(descriptor, 'utf8')).toBe('{"safe":true}\n');
    } finally {
      closeSync(descriptor);
    }
  });

  it('rejects an output directory replaced after validation', () => {
    const root = temporaryRoot();
    const output = join(root, 'generated');
    const original = join(root, 'generated-original');
    mkdirSync(output);
    const snapshot = snapshotDirectory(output);
    renameSync(output, original);
    mkdirSync(output);

    expect(() => assertDirectorySnapshot(snapshot)).toThrow(
      'Directory identity changed while the operation was in progress',
    );
  });

  it('reads regular input through a guarded descriptor', () => {
    const root = temporaryRoot();
    writeFileSync(join(root, 'tokens.json'), '{"color":"#fff"}\n');

    const result = readTextFileWithinRoot(root, 'tokens.json', 'Token input');

    expect(result.success).toBe(true);
    expect(result.success ? result.value.content : '').toBe('{"color":"#fff"}\n');
  });

  it('rejects intermediate input symlinks before opening the file', () => {
    const root = temporaryRoot();
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'tokens.json'), '{"outside":true}\n');
    symlinkSync(outside, join(root, 'linked-input'));

    const result = readTextFileWithinRoot(root, 'linked-input/tokens.json', 'Token input');

    expect(result.success).toBe(false);
  });

  it('does not create outside output through an intermediate symlink', () => {
    const root = temporaryRoot();
    const outside = join(root, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(root, 'linked-output'));

    const result = writeArtifactsAtomic(root, 'linked-output/generated', [
      createArtifact('tokens.css', 'safe\n'),
    ]);

    expect(result.success).toBe(false);
    expect(existsSync(join(outside, 'generated'))).toBe(false);
  });

  it('fails closed for group/world-writable roots on POSIX', () => {
    if (process.platform === 'win32') return;
    const root = temporaryRoot();
    chmodSync(root, 0o777);

    const result = writeArtifactsAtomic(root, 'generated', [
      createArtifact('tokens.css', 'safe\n'),
    ]);

    expect(result.success).toBe(false);
    chmodSync(root, 0o700);
  });

  it('never recursively removes an unexpected stage directory', () => {
    const root = temporaryRoot();
    const stage = join(root, 'stage');
    const nested = join(stage, 'unexpected');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'sentinel.txt'), 'keep\n');

    expect(() => cleanupStageDirectory(stage)).toThrow('Refusing to recursively remove');
    expect(existsSync(join(nested, 'sentinel.txt'))).toBe(true);
  });

  it('leaves unknown regular stage entries untouched', () => {
    const root = temporaryRoot();
    const stage = join(root, 'stage');
    mkdirSync(stage);
    const unexpected = join(stage, 'notes.txt');
    writeFileSync(unexpected, 'keep\n');

    expect(() => cleanupStageDirectory(stage)).toThrow('Refusing to recursively remove');
    expect(readFileSync(unexpected, 'utf8')).toBe('keep\n');
  });

  it('rejects symlink output targets without modifying the linked file', () => {
    const root = temporaryRoot();
    const outside = join(root, 'outside.css');
    const generated = join(root, 'generated');
    writeFileSync(outside, 'original\n');
    const initial = writeArtifactsAtomic(root, 'generated', [
      createArtifact('placeholder.css', 'ok\n'),
    ]);
    expect(initial.success).toBe(true);
    symlinkSync(outside, join(generated, 'tokens.css'));

    const result = writeArtifactsAtomic(root, 'generated', [
      createArtifact('tokens.css', 'changed\n'),
    ]);

    expect(result.success).toBe(false);
    expect(readFileSync(outside, 'utf8')).toBe('original\n');
    expect(existsSync(join(generated, 'placeholder.css'))).toBe(true);
  });

  it('does not modify existing artifacts when staging fails', () => {
    const root = temporaryRoot();
    const generated = join(root, 'generated');
    const initial = writeArtifactsAtomic(root, 'generated', [
      createArtifact('tokens.css', 'old\n'),
    ]);
    expect(initial.success).toBe(true);

    const result = writeArtifactsAtomic(root, 'generated', [
      createArtifact('tokens.css', 'new\n'),
      createArtifact('../unsafe.css', 'unsafe\n'),
    ]);

    expect(result.success).toBe(false);
    expect(readFileSync(join(generated, 'tokens.css'), 'utf8')).toBe('old\n');
    expect(existsSync(join(root, 'unsafe.css'))).toBe(false);
  });
});

function temporaryRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'design-token-pipeline-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createArtifact(filename: string, content: string): GeneratedArtifact {
  return {
    format: 'css',
    filename,
    content,
    tokenCount: 1,
    byteCount: Buffer.byteLength(content),
    diagnostics: [],
  };
}
