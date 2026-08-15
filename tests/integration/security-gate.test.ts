import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dependency security gate', () => {
  it.each([
    ['audit', ['audit', '--omit=dev']],
    ['signature', ['audit', 'signatures']],
  ] as const)('fails closed for %s verification errors', (failure, expectedArgs) => {
    const fakeBin = createFakeNpm();
    const result = spawnSync(process.execPath, ['scripts/check-security-dependencies.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
        FAKE_NPM_FAILURE: failure,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('security-command-failed');
    for (const argument of expectedArgs) expect(result.stderr).toContain(argument);
  });
});

function createFakeNpm(): string {
  const directory = mkdtempSync(join(tmpdir(), 'design-token-pipeline-fake-npm-'));
  temporaryDirectories.push(directory);
  const executable = join(directory, 'npm');
  writeFileSync(
    executable,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const failure = process.env.FAKE_NPM_FAILURE;
const failsAudit = failure === 'audit' && args[0] === 'audit' && args.includes('--omit=dev');
const failsSignature = failure === 'signature' && args[0] === 'audit' && args[1] === 'signatures';
if (failsAudit || failsSignature) {
  process.stderr.write(failsSignature ? 'unsigned package\\n' : 'high advisory\\n');
  process.exit(1);
}
process.stdout.write('{}\\n');
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return directory;
}
