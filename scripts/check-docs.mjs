import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const projectRoot = process.cwd();
const packageManifest = JSON.parse(readFileSync('package.json', 'utf8'));
const documentationOrder = [
  'docs/cli.md',
  'docs/configuration.md',
  'docs/formats.md',
  'docs/architecture.md',
  'docs/delivery.md',
];
const requiredFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'RELEASE_NOTES.md',
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/dependabot.yml',
  ...documentationOrder,
  'examples/basic/tokens.json',
  'examples/basic/design-tokens.config.json',
  'examples/basic/generated/tokens.css',
  'examples/basic/generated/tokens.ts',
  'examples/basic/generated/tailwind-theme.ts',
];
const errors = [];

function log(level, event, context = {}) {
  const output = JSON.stringify({ level, stage: 'docs-check', event, ...context });
  if (level === 'ERROR') process.stderr.write(`${output}\n`);
  else process.stdout.write(`${output}\n`);
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(projectRoot, file)))
    errors.push(`Missing required documentation file: ${file}`);
}

const readableFiles = requiredFiles.filter(
  (file) => existsSync(resolve(projectRoot, file)) && file.endsWith('.md'),
);
const contents = new Map(
  readableFiles.map((file) => [file, readFileSync(resolve(projectRoot, file), 'utf8')]),
);
const readme = contents.get('README.md') ?? '';
if (readme.split('\n').length > 150) errors.push('README.md must remain under 150 lines.');
for (const section of [
  '# design-token-pipeline',
  '## Быстрый старт',
  '## Пример',
  '## Документация',
  '## Лицензия',
]) {
  if (!readme.includes(section)) errors.push(`README.md is missing section: ${section}`);
}

for (const [index, file] of documentationOrder.entries()) {
  const content = contents.get(file) ?? '';
  if (!content.includes('[К README](../README.md)'))
    errors.push(`${file} is missing README navigation.`);
  if (index > 0 && !content.split('\n')[0]?.includes('←'))
    errors.push(`${file} is missing previous navigation.`);
  if (index < documentationOrder.length - 1 && !content.split('\n')[0]?.includes('→')) {
    errors.push(`${file} is missing next navigation.`);
  }
  const seeAlso = content.match(/## См\. также\n\n((?:- .*\n?){2,3})$/);
  if (!seeAlso) errors.push(`${file} must end with 2-3 related links in "См. также".`);
}

for (const [file, content] of contents) {
  const links = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  for (const [, rawTarget] of links) {
    if (/^(?:https?:|mailto:|#)/.test(rawTarget)) continue;
    const target = decodeURIComponent(rawTarget.split('#')[0] ?? '');
    if (!target) continue;
    const resolved = resolve(projectRoot, dirname(file), target);
    if (!existsSync(resolved)) errors.push(`${file} contains a broken link: ${rawTarget}`);
  }
}

const allDocumentation = [...contents.values()].join('\n');
for (const script of Object.keys(packageManifest.scripts ?? {})) {
  if (!allDocumentation.includes(`npm run ${script}`)) {
    errors.push(`Package script is not documented: npm run ${script}`);
  }
}

for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
  const content = readFileSync(resolve(projectRoot, workflow), 'utf8');
  for (const match of content.matchAll(/^\s*uses:\s*([^\s]+)\s*(?:#.*)?$/gm)) {
    const reference = match[1] ?? '';
    if (!/@[0-9a-f]{40}$/.test(reference)) {
      errors.push(`${workflow} contains a non-immutable action reference: ${reference}`);
    }
  }
}

if (existsSync(resolve(projectRoot, 'dist/cli.js'))) {
  const example = spawnSync(
    process.execPath,
    [
      'dist/cli.js',
      'build',
      '--config',
      'examples/basic/design-tokens.config.json',
      '--check',
      '--json',
    ],
    { cwd: projectRoot, encoding: 'utf8', shell: false },
  );
  if (example.status !== 0) {
    errors.push(
      `Committed example is stale: ${example.stdout.trim()} ${example.stderr.trim()}`.trim(),
    );
  } else {
    try {
      const result = JSON.parse(example.stdout);
      if (result.success !== true || result.artifactCount !== 3) {
        errors.push('Committed example check returned an unexpected result.');
      }
    } catch {
      errors.push('Committed example check did not return valid JSON.');
    }
  }
} else errors.push('dist/cli.js is missing; run npm run build before npm run docs:check.');

if (errors.length > 0) {
  for (const message of errors) log('ERROR', 'documentation-invalid', { message });
  process.exitCode = 1;
} else {
  log('INFO', 'documentation-valid', {
    markdownFiles: readableFiles.length,
    internalLinks: [...contents.values()].reduce(
      (total, content) =>
        total + [...content.matchAll(/\[[^\]]+\]\((?!https?:|mailto:|#)[^)]+\)/g)].length,
      0,
    ),
    exampleArtifacts: 3,
  });
}
