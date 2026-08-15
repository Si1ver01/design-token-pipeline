import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export class ReleaseTagError extends Error {}

export function validateReleaseTag(tag, packageVersion) {
  if (!SEMVER_PATTERN.test(packageVersion)) {
    throw new ReleaseTagError(`Package version is not strict SemVer: ${packageVersion}`);
  }
  if (tag !== `v${packageVersion}`) {
    throw new ReleaseTagError(
      `Release tag ${tag} must exactly match package version v${packageVersion}.`,
    );
  }
  return { tag, version: packageVersion };
}

function log(level, event, context = {}) {
  const payload = JSON.stringify({ level, stage: 'release-check-tag', event, ...context });
  if (level === 'ERROR') process.stderr.write(`${payload}\n`);
  else process.stdout.write(`${payload}\n`);
}

function parseOptions(argv) {
  let tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') dryRun = true;
    else if (argument === '--tag') {
      tag = argv[index + 1];
      index += 1;
      if (!tag) throw new ReleaseTagError('--tag requires a value.');
    } else throw new ReleaseTagError(`Unknown option: ${argument}`);
  }
  return { tag, dryRun };
}

function git(args, { allowFailure = false } = {}) {
  const startedAt = Date.now();
  const result = spawnSync('git', args, { encoding: 'utf8', shell: false });
  if ((process.env.LOG_LEVEL ?? '').toUpperCase() === 'DEBUG') {
    log('DEBUG', 'git-command-complete', {
      args,
      status: result.status,
      durationMs: Date.now() - startedAt,
    });
  }
  if (result.status !== 0 && !allowFailure) {
    throw new ReleaseTagError(
      `Git command failed (${args.join(' ')}): ${result.stderr.trim().slice(0, 1000)}`,
    );
  }
  return result;
}

function main() {
  const packageManifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const options = parseOptions(process.argv.slice(2));
  const tag = options.tag ?? (options.dryRun ? `v${packageManifest.version}` : undefined);
  if (!tag) throw new ReleaseTagError('Release tag is required. Use --tag vX.Y.Z.');
  validateReleaseTag(tag, packageManifest.version);

  if (git(['rev-parse', '--is-inside-work-tree']).stdout.trim() !== 'true') {
    throw new ReleaseTagError('Release check must run inside a Git worktree.');
  }
  const changes = git(['status', '--porcelain']).stdout.trim();
  if (changes) throw new ReleaseTagError('Release worktree must be clean.');

  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  git(['rev-parse', '--verify', 'refs/remotes/origin/main']);
  const ancestor = git(['merge-base', '--is-ancestor', head, 'refs/remotes/origin/main'], {
    allowFailure: true,
  });
  if (ancestor.status !== 0) {
    throw new ReleaseTagError('Release commit must be contained in origin/main.');
  }

  if (!options.dryRun) {
    const tagType = git(['cat-file', '-t', `refs/tags/${tag}`]).stdout.trim();
    if (tagType !== 'tag') throw new ReleaseTagError('Release tag must be annotated.');
    const tagCommit = git(['rev-list', '-n', '1', tag]).stdout.trim();
    if (tagCommit !== head) throw new ReleaseTagError('Release tag must point to HEAD.');
  } else {
    log('WARN', 'manual-settings-required', {
      settings: ['npm trusted publisher', 'GitHub environment npm'],
    });
  }

  log('INFO', 'release-tag-valid', {
    package: packageManifest.name,
    version: packageManifest.version,
    tag,
    commit: head,
    dryRun: options.dryRun,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    log('ERROR', 'release-tag-invalid', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}
