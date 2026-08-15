[← Архитектура](architecture.md) · [К README](../README.md)

# Поставка и security baseline

Baseline зафиксирован 2026-08-15 после проверки npm registry и совместимости с Node.js `24.18.0`.

## Runtime

- Node.js `24.18.0` и npm `11.16.0`.
- Runtime dependencies отсутствуют; CLI использует Node.js standard library.
- `package-lock.json` version 3 фиксирует transitive dependency tree.
- CI и security gate используют `npm ci --ignore-scripts`.

## Dependency baseline

| Package             | Declared range | Resolved stable |
| ------------------- | -------------- | --------------- |
| `@eslint/js`        | `^10.0.1`      | `10.0.1`        |
| `@types/node`       | `^24.9.1`      | `24.13.3`       |
| `eslint`            | `^10.8.0`      | `10.8.1`        |
| `globals`           | `^17.9.0`      | `17.11.0`       |
| `prettier`          | `^3.9.6`       | `3.9.6`         |
| `tsup`              | `^8.5.1`       | `8.5.1`         |
| `typescript`        | `^6.0.3`       | `6.0.3`         |
| `typescript-eslint` | `^8.67.0`      | `8.67.0`        |
| `vitest`            | `^4.1.10`      | `4.1.10`        |

`typescript@7.0.2` сознательно не используется: `typescript-eslint@8.67.0` ограничивает peer dependency диапазоном `<6.1.0`. `@types/node@26` не соответствует закреплённому Node.js 24 runtime contract. `--force` и `--legacy-peer-deps` запрещены.

## Security gate

`npm run security:check` создаёт clean temporary install и fail-closed проверяет:

- package/lock consistency и отсутствие install lifecycle scripts;
- `npm audit --omit=dev --audit-level=high`;
- tooling audit с dev dependencies;
- `npm ls --all`;
- `npm audit signatures`;
- CycloneDX SBOM через `npm sbom`.

CI дополнительно запускает Gitleaks. High/critical advisory, invalid tree, unsigned package или SBOM failure блокирует pipeline. Исключение допускается только с документированными причиной, scope, owner и expiry date.

## GitHub Actions baseline

Stable tags проверены 2026-08-15 и закреплены immutable commit SHA:

| Action                     | Stable tag |
| -------------------------- | ---------- |
| `actions/checkout`         | `v7.0.1`   |
| `actions/setup-node`       | `v7.0.0`   |
| `actions/upload-artifact`  | `v7.0.1`   |
| `gitleaks/gitleaks-action` | `v3.0.0`   |

Dependabot еженедельно проверяет npm и GitHub Actions. Workflow имеет read-only default permissions, job timeouts и concurrency cancellation; diagnostic logs загружаются только при failure и хранятся 7 дней.

## Package contract

`npm run pack:check` выполняет `npm pack --dry-run --json`, allowlist/denylist проверку, shebang и executable-mode check. Затем tarball устанавливается с `--ignore-scripts` во временный consumer для ESM, CJS и CLI smoke.

Каждый включённый file, в том числе sourcemap, сканируется на high-confidence private keys и registry/cloud tokens. Executable mode разрешён только CLI bundles.

Tarball содержит bundles, declarations, sourcemaps, README, license, contribution/security/release metadata, guides и example. `.env`, credentials, private keys, `src`, `tests` и `scripts` запрещены.

## CI stages

Основной job выполняет:

```bash
npm ci --ignore-scripts
npm run verify
```

`npm run verify` последовательно запускает formatting, lint, security, typecheck, tests, build, package smoke и docs/example check. Отдельный security job повторяет supply-chain gates в более строгом install context.

## Настройка trusted publishing

До первого release владелец package должен создать npm trusted publisher:

| Поле npm          | Значение                                 |
| ----------------- | ---------------------------------------- |
| Organization/User | владелец package `design-token-pipeline` |
| Repository        | `Si1ver01/design-token-pipeline`         |
| Workflow filename | `release.yml`                            |
| Environment       | `npm`                                    |

В GitHub следует создать environment `npm` с required reviewer. Long-lived `NPM_TOKEN` не нужен и не должен добавляться в secrets.

## Release flow

1. Убедиться, что package name свободен, `origin/main` актуален, worktree чист и `npm run verify` зелёный.
2. Обновить `CHANGELOG.md` и `RELEASE_NOTES.md`.
3. Запустить dry-run workflow или локальный `npm run release:check-tag -- --dry-run`.
4. После явного подтверждения создать annotated tag `v0.1.0` на commit из `origin/main` и push tag.
5. Release workflow повторяет verification и публикует `npm publish --provenance --access public` через OpenID Connect (OIDC).
6. Workflow создаёт GitHub Release из `RELEASE_NOTES.md`.
7. Проверить `npm view`, provenance/attestation, clean install и CLI/library smoke.

Внешняя публикация и tag не выполняются автоматически локальными implementation checks.

## Все npm scripts

| Script                      | Gate                               |
| --------------------------- | ---------------------------------- |
| `npm run build`             | Bundles и declarations             |
| `npm run typecheck`         | Strict TypeScript                  |
| `npm run test`              | Unit/integration/CLI/release tests |
| `npm run test:watch`        | Local Vitest watch                 |
| `npm run lint`              | ESLint                             |
| `npm run format:check`      | Prettier validation                |
| `npm run format`            | Prettier rewrite                   |
| `npm run pack:check`        | Tarball/consumer contract          |
| `npm run docs:check`        | Links и committed example          |
| `npm run security:check`    | Audits, signatures и SBOM          |
| `npm run release:check-tag` | Tag/package/origin validation      |
| `npm run verify`            | Полный gate                        |

## См. также

- [Архитектура](architecture.md) — build и filesystem boundaries
- [CLI](cli.md) — automation и exit codes
- [Security policy](../SECURITY.md) — private disclosure
