import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { findSensitiveContent } from './package-security.mjs';

const projectRoot = process.cwd();
const temporaryRoot = mkdtempSync(join(tmpdir(), 'design-token-pipeline-pack-'));
const cacheDirectory = join(temporaryRoot, 'npm-cache');
const packageDirectory = join(temporaryRoot, 'package');
const consumerDirectory = join(temporaryRoot, 'consumer');
const packageManifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const logLevels = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const configuredLevel = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase();
const threshold = logLevels[configuredLevel] ?? logLevels.INFO;

mkdirSync(packageDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

function log(level, event, context = {}) {
  if (logLevels[level] < threshold) return;
  const output = JSON.stringify({ level, stage: 'pack-check', event, ...context });
  if (level === 'ERROR') process.stderr.write(`${output}\n`);
  else process.stdout.write(`${output}\n`);
}

function fail(event, context = {}) {
  log('ERROR', event, context);
  process.exitCode = 1;
  throw new Error(event);
}

function run(executable, args, options = {}) {
  const startedAt = Date.now();
  log('DEBUG', 'command-start', { executable, args });
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: cacheDirectory,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  });
  log('DEBUG', 'command-complete', {
    executable,
    status: result.status,
    durationMs: Date.now() - startedAt,
  });

  if (result.status !== 0) {
    fail('command-failed', {
      executable,
      status: result.status,
      signal: result.signal ?? undefined,
      stderr: result.stderr.trim().slice(0, 2_000),
    });
  }
  return result.stdout.trim();
}

function parsePackReport(output) {
  const report = JSON.parse(output);
  if (!Array.isArray(report) || report.length !== 1 || !Array.isArray(report[0].files)) {
    fail('invalid-pack-report');
  }
  return report[0];
}

function validateTarball(report) {
  const files = report.files.map(({ path }) => path);
  const requiredFiles = [
    'package.json',
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'dist/cli.js',
    'dist/cli.cjs',
    'dist/cli.d.ts',
    'dist/cli.d.cts',
    'README.md',
    'LICENSE',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    'SECURITY.md',
    'docs/cli.md',
    'docs/configuration.md',
    'docs/formats.md',
    'docs/architecture.md',
    'docs/delivery.md',
    'examples/basic/tokens.json',
    'examples/basic/design-tokens.config.json',
    'examples/basic/generated/tokens.css',
    'examples/basic/generated/tokens.ts',
    'examples/basic/generated/tailwind-theme.ts',
  ];
  const missingFiles = requiredFiles.filter((file) => !files.includes(file));
  if (missingFiles.length > 0) fail('missing-files', { missingFiles });

  const forbiddenFiles = files.filter((file) => {
    const normalized = file.toLowerCase();
    const filename = basename(normalized);
    return (
      normalized.startsWith('src/') ||
      normalized.startsWith('tests/') ||
      normalized.startsWith('scripts/') ||
      filename === '.env' ||
      filename.startsWith('.env.') ||
      filename === '.npmrc' ||
      filename === 'id_rsa' ||
      filename.endsWith('.pem') ||
      filename.endsWith('.key') ||
      normalized.includes('credential')
    );
  });
  if (forbiddenFiles.length > 0) fail('forbidden-files', { forbiddenFiles });

  const unexpectedExecutables = report.files
    .filter(({ mode }) => (mode & 0o111) !== 0)
    .map(({ path }) => path)
    .filter((path) => path !== 'dist/cli.js' && path !== 'dist/cli.cjs');
  if (unexpectedExecutables.length > 0) {
    fail('unexpected-executables', { unexpectedExecutables });
  }

  const sensitiveFiles = [];
  for (const file of files) {
    const sourcePath = join(projectRoot, file);
    if (!statSync(sourcePath).isFile()) continue;
    const findings = findSensitiveContent(readFileSync(sourcePath, 'utf8'));
    if (findings.length > 0) sensitiveFiles.push({ file, findings });
  }
  if (sensitiveFiles.length > 0) fail('sensitive-content', { sensitiveFiles });

  const allowedTopLevel = new Set([
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
  ]);
  const unexpectedFiles = files.filter(
    (file) =>
      !allowedTopLevel.has(file) &&
      !file.startsWith('dist/') &&
      !file.startsWith('docs/') &&
      !file.startsWith('examples/'),
  );
  if (unexpectedFiles.length > 0) fail('unexpected-files', { unexpectedFiles });

  const binPath = packageManifest.bin?.['design-token-pipeline'];
  if (binPath !== './dist/cli.js') fail('invalid-bin-target', { binPath });
  const cliPath = join(projectRoot, binPath);
  const cliContent = readFileSync(cliPath, 'utf8');
  if (!cliContent.startsWith('#!/usr/bin/env node\n')) fail('missing-cli-shebang', { binPath });
  if ((statSync(cliPath).mode & 0o111) === 0) fail('cli-not-executable', { binPath });
  const packedCli = report.files.find(({ path }) => path === 'dist/cli.js');
  if (!packedCli || (packedCli.mode & 0o111) === 0) fail('packed-cli-not-executable', { binPath });

  log('INFO', 'tarball-contract-passed', {
    tarball: report.filename,
    fileCount: files.length,
    entrypoints: Object.keys(packageManifest.exports ?? {}),
    bin: Object.keys(packageManifest.bin ?? {}),
  });
}

function validateConsumer(tarballPath) {
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    `${JSON.stringify({ name: 'design-token-pipeline-consumer', private: true }, null, 2)}\n`,
  );
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath], {
    cwd: consumerDirectory,
  });

  const expectedVersion = packageManifest.version;
  const esmVersion = run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const packageModule = await import(${JSON.stringify(packageManifest.name)}); process.stdout.write(packageModule.VERSION);`,
    ],
    { cwd: consumerDirectory },
  );
  if (esmVersion !== expectedVersion) fail('esm-version-mismatch', { expectedVersion, esmVersion });

  const cjsVersion = run(
    process.execPath,
    [
      '-e',
      `const packageModule = require(${JSON.stringify(packageManifest.name)}); process.stdout.write(packageModule.VERSION);`,
    ],
    { cwd: consumerDirectory },
  );
  if (cjsVersion !== expectedVersion) fail('cjs-version-mismatch', { expectedVersion, cjsVersion });

  const binPath = join(
    consumerDirectory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'design-token-pipeline.cmd' : 'design-token-pipeline',
  );
  accessSync(binPath, constants.X_OK);
  const cliVersion = run(binPath, ['--version'], { cwd: consumerDirectory });
  if (cliVersion !== expectedVersion) fail('cli-version-mismatch', { expectedVersion, cliVersion });

  log('DEBUG', '[FIX:package-version] version-contract-passed', {
    expectedVersion,
    esmVersion,
    cjsVersion,
    cliVersion,
  });

  log('INFO', 'consumer-smoke-passed', {
    package: `${packageManifest.name}@${packageManifest.version}`,
    entrypoints: ['import', 'require'],
    bin: 'design-token-pipeline',
  });
}

try {
  const dryRun = parsePackReport(run('npm', ['pack', '--dry-run', '--json']));
  validateTarball(dryRun);

  const packed = parsePackReport(
    run('npm', ['pack', '--json', '--pack-destination', packageDirectory]),
  );
  const tarballPath = resolve(packageDirectory, packed.filename);
  validateConsumer(tarballPath);
} catch (error) {
  if (process.exitCode !== 1) {
    log('ERROR', 'unexpected-failure', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
