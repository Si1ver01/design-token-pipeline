import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const root = lockfile.packages?.[''];
const temporaryRoot = mkdtempSync(join(tmpdir(), 'design-token-pipeline-security-'));
const cacheDirectory = join(temporaryRoot, 'npm-cache');

process.once('exit', () => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

function log(level, message, context = {}) {
  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    scope: 'dependency-security',
    message,
    ...context,
  });
  if (level === 'ERROR') console.error(output);
  else console.log(output);
}

function run(command, args, { cwd = process.cwd() } = {}) {
  const startedAt = Date.now();
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NPM_CONFIG_CACHE: cacheDirectory,
        npm_config_audit: 'true',
        npm_config_fund: 'false',
      },
    });
    if ((process.env.LOG_LEVEL ?? '').toUpperCase() === 'DEBUG') {
      log('DEBUG', 'security-command-passed', {
        command,
        args,
        durationMs: Date.now() - startedAt,
      });
    }
    return { ok: true, stdout };
  } catch (error) {
    const status = error?.status ?? 1;
    const detail = `${String(error?.stdout ?? '')}\n${String(error?.stderr ?? '')}`
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
    log('ERROR', 'security-command-failed', { command, args, status, detail });
    process.exit(status);
  }
}

log('INFO', 'security-baseline-start', {
  package: packageJson.name,
  version: packageJson.version,
  node: process.version,
  npm: process.env.npm_config_user_agent?.split(' ')[0] ?? 'unknown',
});

if (!root || root.name !== packageJson.name || root.version !== packageJson.version) {
  log('ERROR', 'lockfile-root-mismatch', {
    expected: { name: packageJson.name, version: packageJson.version },
    actual: root ? { name: root.name, version: root.version } : 'missing',
  });
  process.exit(1);
}

const directDependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
const lockDependencies = {
  ...(root.dependencies ?? {}),
  ...(root.devDependencies ?? {}),
};
const inconsistent = Object.entries(directDependencies)
  .filter(([name, range]) => lockDependencies[name] !== range)
  .map(([name, range]) => ({
    name,
    packageRange: range,
    lockRange: lockDependencies[name] ?? null,
  }));
if (inconsistent.length > 0) {
  log('ERROR', 'lockfile-dependency-mismatch', { inconsistent });
  process.exit(1);
}

copyFileSync('package.json', join(temporaryRoot, 'package.json'));
copyFileSync('package-lock.json', join(temporaryRoot, 'package-lock.json'));
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temporaryRoot });
log('INFO', 'clean-install-passed');

const audit = run('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  cwd: temporaryRoot,
});
if (audit.ok) log('INFO', 'production-audit-passed');
const toolingAudit = run('npm', ['audit', '--include=dev', '--audit-level=high', '--json'], {
  cwd: temporaryRoot,
});
if (toolingAudit.ok) log('INFO', 'tooling-audit-passed');

const tree = run('npm', ['ls', '--all', '--json'], { cwd: temporaryRoot });
if (tree.ok) log('INFO', 'production-tree-valid');

run('npm', ['audit', 'signatures', '--json'], { cwd: temporaryRoot });
log('INFO', 'registry-signatures-passed');
run('npm', ['sbom', '--sbom-format=cyclonedx', '--omit=dev'], { cwd: temporaryRoot });
log('INFO', 'sbom-generation-passed');

const prohibitedScripts = ['preinstall', 'install', 'postinstall'].filter(
  (name) => packageJson.scripts?.[name],
);
if (prohibitedScripts.length > 0) {
  log('ERROR', 'install-scripts-present', { scripts: prohibitedScripts });
  process.exit(1);
}

log('INFO', 'security-baseline-passed', {
  directDependencyCount: Object.keys(directDependencies).length,
  lockfileVersion: lockfile.lockfileVersion,
});
