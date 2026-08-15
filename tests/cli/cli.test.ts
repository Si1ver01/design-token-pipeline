import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/main.js';
import { ExitCode } from '../../src/cli/exit-codes.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('CLI', () => {
  it('prints help and version without diagnostics', () => {
    const root = fixtureRoot();
    const help = capture(['--help'], root);
    const version = capture(['--version'], root);

    expect(help).toMatchObject({ code: ExitCode.success, stderr: '' });
    expect(help.stdout).toContain('design-token-pipeline build');
    expect(version).toEqual({ code: ExitCode.success, stdout: '0.1.0\n', stderr: '' });
  });

  it('builds, checks, and validates with JSON-only stdout', () => {
    const root = fixtureRoot();
    const build = capture(['build', 'tokens.json', '--json'], root);
    const check = capture(['build', 'tokens.json', '--check', '--json'], root);
    const validate = capture(['validate', 'tokens.json', '--json'], root);

    expect(build.code).toBe(ExitCode.success);
    expect(check.code).toBe(ExitCode.success);
    expect(validate.code).toBe(ExitCode.success);
    expect(JSON.parse(build.stdout)).toMatchObject({ success: true, artifactCount: 3 });
    expect(JSON.parse(check.stdout)).toMatchObject({ success: true, check: true });
    expect(JSON.parse(validate.stdout)).toMatchObject({ success: true, tokenCount: 3 });
    expect(build.stderr).toBe('');
    expect(readFileSync(join(root, 'generated', 'tokens.css'), 'utf8')).toContain(
      '--dt-color-brand-primary',
    );
  });

  it('returns the stale exit code without writing', () => {
    const root = fixtureRoot();
    mkdirSync(join(root, 'generated'));
    writeFileSync(join(root, 'generated', 'tokens.css'), 'stale\n');

    const result = capture(['build', 'tokens.json', '--check', '--json'], root);

    expect(result.code).toBe(ExitCode.stale);
    expect(JSON.parse(result.stdout)).toMatchObject({ success: false, exitCode: ExitCode.stale });
    expect(readFileSync(join(root, 'generated', 'tokens.css'), 'utf8')).toBe('stale\n');
  });

  it('keeps argument errors as one JSON document on stdout', () => {
    const result = capture(['build', '--format', 'unknown', '--json'], fixtureRoot());

    expect(result.code).toBe(ExitCode.validation);
    expect(JSON.parse(result.stdout)).toMatchObject({
      success: false,
      exitCode: ExitCode.validation,
    });
    expect(result.stderr).toBe('');
  });

  it('sends human-readable diagnostics to stderr', () => {
    const root = fixtureRoot();
    writeFileSync(join(root, 'tokens.json'), '{broken');

    const result = capture(['validate', 'tokens.json'], root);

    expect(result.code).toBe(ExitCode.validation);
    expect(result.stdout).toContain('ошибкой');
    expect(result.stderr).toContain('json.invalid');
  });

  it('supports project paths with spaces and non-ASCII characters', () => {
    const root = fixtureRoot('design token тест-');

    const result = capture(['build', 'tokens.json', '--json'], root);

    expect(result.code).toBe(ExitCode.success);
    expect(JSON.parse(result.stdout)).toMatchObject({ success: true, artifactCount: 3 });
    expect(readFileSync(join(root, 'generated', 'tokens.css'), 'utf8')).toContain(':root');
  });

  it('emits filesystem hardening diagnostics only at DEBUG level', () => {
    const root = fixtureRoot();

    const info = capture(['build', 'tokens.json'], root);
    const debug = capture(['build', 'tokens.json', '--log-level', 'DEBUG'], root);

    expect(info.stderr).not.toContain('[FIX:filesystem-toctou]');
    expect(debug.stderr).toContain('[FIX:filesystem-toctou] guarded-input-read');
    expect(debug.stderr).toContain('[FIX:filesystem-toctou] guarded-output-write');
  });
});

function fixtureRoot(prefix = 'design-token-pipeline-cli-test-'): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(root);
  writeFileSync(join(root, 'tokens.json'), readFileSync('tests/fixtures/tokens/basic.json'));
  return root;
}

function capture(argv: readonly string[], root: string) {
  let stdout = '';
  let stderr = '';
  const code = main(argv, root, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}
