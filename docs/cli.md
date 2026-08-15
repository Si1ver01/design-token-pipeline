[К README](../README.md) · [Конфигурация →](configuration.md)

# CLI

CLI и library API используют один pipeline. Команды отличаются только orchestration, форматированием diagnostics и назначением exit code.

## Команды

```bash
design-token-pipeline build [tokens.json] [options]
design-token-pipeline validate [tokens.json] [options]
```

`build` проверяет tokens, разрешает aliases, генерирует выбранные formats и atomically записывает artifacts. `validate` выполняет parsing и semantic validation без генерации и записи.

Если input не указан, используется config или default `tokens.json`.

## Options

| Option                | Короткая форма | Назначение                                                     |
| --------------------- | -------------- | -------------------------------------------------------------- |
| `--config <path>`     | `-c`           | JSON config; paths внутри него считаются от каталога config    |
| `--out-dir <path>`    | `-o`           | Переопределить output directory                                |
| `--format <format>`   | `-f`           | Добавить `css`, `typescript` или `tailwind`; option repeatable |
| `--prefix <prefix>`   | `-p`           | Переопределить CSS custom-property prefix                      |
| `--check`             | —              | Сравнить generated и existing files без записи                 |
| `--strict`            | —              | Считать warnings ошибками                                      |
| `--json`              | —              | Вывести ровно один JSON result в stdout                        |
| `--log-level <level>` | —              | `DEBUG`, `INFO`, `WARN` или `ERROR`                            |
| `--help`              | `-h`           | Показать справку                                               |
| `--version`           | `-v`           | Показать package version                                       |

CLI options имеют приоритет над значениями config. Несколько `--format` формируют итоговый список formats.

## Примеры

```bash
design-token-pipeline validate tokens.json
design-token-pipeline build tokens.json --out-dir generated --format css --format typescript
design-token-pipeline build --config examples/basic/design-tokens.config.json --check --json
```

Для запуска без global install:

```bash
npx design-token-pipeline build tokens.json
```

## stdout и stderr

- Итог команды всегда идёт в stdout.
- Human diagnostics и structured progress logs идут в stderr.
- `--json` подавляет progress/diagnostic stream и оставляет один parseable JSON в stdout.
- Stack trace скрыт по умолчанию и доступен только при `LOG_LEVEL=DEBUG` для unexpected CLI error.

Команда не выводит полный token document, environment variables, headers или credentials.

## Exit codes

| Code  | Значение                                                     |
| ----- | ------------------------------------------------------------ |
| `0`   | Успех; при `--check` все artifacts актуальны                 |
| `1`   | Unexpected internal failure                                  |
| `2`   | CLI argument, config, schema или semantic validation failure |
| `3`   | `--check` нашёл stale, missing или unexpected artifacts      |
| `4`   | Input/output filesystem failure                              |
| `130` | Процесс прерван `SIGINT`                                     |

## Logging

`--log-level` переопределяет `LOG_LEVEL`. При отсутствии обоих используется `INFO`.

```bash
LOG_LEVEL=DEBUG design-token-pipeline build tokens.json
design-token-pipeline validate tokens.json --log-level ERROR
```

`DEBUG` показывает sanitized paths, stage и counts. `INFO` содержит ключевые события. `WARN` и `ERROR` предназначены для diagnostics и сбоев.

## CI check

Сначала создайте committed outputs, затем проверяйте их без записи:

```bash
design-token-pipeline build --config design-tokens.config.json
design-token-pipeline build --config design-tokens.config.json --check
```

Output directory должен содержать ровно ожидаемый набор artifacts: лишний file также делает check stale.

## См. также

- [Конфигурация](configuration.md) — defaults и overrides
- [Форматы](formats.md) — token contract и generated code
- [Поставка](delivery.md) — использование CLI в CI
