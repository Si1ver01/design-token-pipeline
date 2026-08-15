# Участие в разработке

## Требования

- Node.js `24.18.0` из `.nvmrc`.
- npm `11.16.0`.
- Git без незакоммиченных generated secrets или `.env` files.

```bash
nvm use
npm ci --ignore-scripts
npm run verify
```

## Рабочий процесс

1. Создайте focused change с тестом для изменяемого contract.
2. Не добавляйте runtime dependency без обоснования security и bundle impact.
3. Обновите соответствующее руководство и `CHANGELOG.md` для user-facing изменений.
4. Запустите `npm run verify` перед pull request.

Commit messages пишутся на английском по Conventional Commits, например `feat: add token format` или `fix: reject unsafe output path`.

## Команды

| Команда                     | Назначение                                          |
| --------------------------- | --------------------------------------------------- |
| `npm run build`             | Собрать ESM/CJS, CLI, declarations и sourcemaps     |
| `npm run typecheck`         | Проверить strict TypeScript без emit                |
| `npm run lint`              | Запустить ESLint с zero-warning policy              |
| `npm run format:check`      | Проверить Prettier formatting                       |
| `npm run format`            | Применить Prettier formatting                       |
| `npm run test`              | Запустить Vitest и release-tag tests                |
| `npm run test:watch`        | Запустить Vitest в watch mode                       |
| `npm run pack:check`        | Проверить tarball и temporary consumer              |
| `npm run docs:check`        | Проверить links, docs contract и example outputs    |
| `npm run security:check`    | Выполнить clean install, audits, signatures и SBOM  |
| `npm run release:check-tag` | Проверить SemVer tag и `origin/main`                |
| `npm run verify`            | Последовательно выполнить все release-quality gates |

## Pull request

В описании укажите поведение до/после, риск, добавленные tests и документацию. Не прикладывайте environment dumps, registry headers, OIDC assertions или token document с приватными значениями.

## Release changes

Не создавайте и не переиспользуйте tag вручную при красном gate. Полный порядок описан в [руководстве по поставке](docs/delivery.md).
