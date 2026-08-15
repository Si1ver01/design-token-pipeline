[← Форматы](formats.md) · [К README](../README.md) · [Поставка →](delivery.md)

# Архитектура

Проект использует layered library/CLI architecture. Чистые core и generators отделены от filesystem, environment и process lifecycle.

## Структура

```text
src/index.ts          public library exports
src/core/             parse, normalize, validate, aliases, build in memory
src/formats/          CSS, TypeScript и Tailwind generators
src/config/           defaults, JSON config validation, CLI merge
src/io/               safe reads, check mode, atomic transaction
src/diagnostics/      typed diagnostic model
src/cli/              argument parsing, reporter, command orchestration
src/cli.ts            executable boundary и SIGINT handling
scripts/              package, docs, security и release gates
tests/                unit, integration, CLI, security и fixtures
examples/basic/       committed end-to-end contract
```

Public API экспортируется только из `src/index.ts`. Deep imports во внутренние modules не являются compatibility contract.

## Data flow

```text
JSON source
  → JSON.parse
  → schema normalization + inherited types
  → semantic validation + collision checks
  → alias resolution
  → immutable ResolvedTokenDocument
  → independent generators
  → artifacts in memory
  → check OR atomic filesystem transaction
```

Ошибка до последнего этапа не изменяет filesystem. При write transaction каждый artifact сначала записывается во временный sibling directory; existing targets получают backup, promotion выполняется per-file rename, а failure запускает best-effort rollback.

## Dependency rules

- `core` и `formats` не читают filesystem или environment и не пишут в console.
- `config` и `io` преобразуют внешние данные в typed results.
- `cli` вызывает тот же library pipeline и единственный назначает process exit codes.
- Generators не зависят друг от друга и не создают runtime imports.
- Diagnostics сортируются по path/code и не требуют сравнения human-readable text.

## Public result model

Library functions возвращают discriminated union:

```ts
type OperationResult<T> =
  | { success: true; value: T; diagnostics: readonly Diagnostic[] }
  | { success: false; diagnostics: readonly Diagnostic[] };
```

Основные entrypoints: `parseTokenDocument`, `resolveAliases`, `buildTokens`, generators, config helpers и IO helpers. `VERSION` совпадает с `package.json`.

## Детерминизм

- Сортировка использует byte-stable lexical comparison, не locale.
- Object keys сериализуются в фиксированном порядке.
- Newline всегда `\n`; каждый artifact заканчивается newline.
- Alias resolution завершается до генерации.
- Generated output зависит только от source и effective config.

## Security boundaries

Вход, config и paths недоверенные. До генерации отклоняются prototype keys, invalid segments, control characters, unsafe scalar values и normalized-name collisions.

Filesystem layer:

- удерживает input/config/output внутри разрешённого root;
- требует стабильный trusted workspace: POSIX root и output namespace не должны быть group/world-writable и должны принадлежать текущему пользователю или root;
- создаёт отсутствующие output directories по одному компоненту и отклоняет intermediate symlink/non-directory;
- требует regular input/config files;
- отклоняет symlink input, output directory и output target;
- не следует path traversal;
- удаляет из temporary stage только ожидаемые regular entries, не выполняет recursive cleanup;
- защищает операции от недоверенных writers в trusted workspace; hostile concurrent process с тем же OS user и platform ACL races не входят в portable Node.js guarantee.

Atomicity ограничена заменой каждого отдельного file и best-effort rollback. Node.js 24 не предоставляет portable `openat`/`renameat`/`unlinkat`; для hostile local writer или crash-durable multi-file transaction нужен native OS helper и отдельный generation/pointer protocol.

CLI logging содержит stage, counts, diagnostic code и sanitized path, но не token values или environment dump.

## Сборка package

`tsup` создаёт ESM `dist/index.js`, CJS `dist/index.cjs`, declarations, sourcemaps и executable `dist/cli.js` с shebang. Package smoke устанавливает tarball в temporary consumer и проверяет ESM import, CJS require и CLI version.

## См. также

- [Форматы](formats.md) — schema и generators
- [Поставка](delivery.md) — CI и supply-chain gates
- [Security policy](../SECURITY.md) — сообщение об уязвимости
