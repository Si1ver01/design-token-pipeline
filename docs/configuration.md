[← CLI](cli.md) · [К README](../README.md) · [Форматы →](formats.md)

# Конфигурация

Config является JSON object. По умолчанию CLI ищет `design-tokens.config.json` в project root; `--config` выбирает другой file.

Paths `input` и `outDir` разрешаются относительно каталога config. CLI отклоняет config path за пределами project root, symlink и non-regular file.

## Полный пример

```json
{
  "input": "tokens.json",
  "outDir": "generated",
  "formats": ["css", "typescript", "tailwind"],
  "strict": true,
  "css": {
    "prefix": "brand",
    "selector": ":root",
    "filename": "tokens.css",
    "includeDescriptions": true
  },
  "typescript": {
    "filename": "tokens.ts"
  },
  "tailwind": {
    "filename": "tailwind-theme.ts",
    "groups": {
      "semanticColor": "colors"
    },
    "strict": true
  }
}
```

Unknown properties являются ошибкой: опечатка не игнорируется молча.

## Root fields

| Field     | Type    | Default       | Назначение                      |
| --------- | ------- | ------------- | ------------------------------- |
| `input`   | string  | `tokens.json` | Входной JSON file               |
| `outDir`  | string  | `generated`   | Каталог generated artifacts     |
| `formats` | array   | все три       | `css`, `typescript`, `tailwind` |
| `strict`  | boolean | `false`       | Превращать warnings в errors    |

Список `formats` не может быть пустым. CLI overrides: positional input, `--out-dir`, repeatable `--format`, `--strict` и `--prefix`.

## CSS

| Field                 | Default      | Ограничение                                     |
| --------------------- | ------------ | ----------------------------------------------- |
| `prefix`              | `dt`         | lowercase ASCII letter, затем `a-z`, `0-9`, `-` |
| `selector`            | `:root`      | `:root`, простой `.class` или `#id`             |
| `filename`            | `tokens.css` | Только basename без `/` и `\`                   |
| `includeDescriptions` | `false`      | Добавлять sanitized `$description` comments     |

## TypeScript

`typescript.filename` по умолчанию равен `tokens.ts`. Filename должен быть basename и не может выполнять path traversal.

## Tailwind

| Field      | Default             | Назначение                                      |
| ---------- | ------------------- | ----------------------------------------------- |
| `filename` | `tailwind-theme.ts` | Имя generated module                            |
| `groups`   | `{}`                | Дополнительный root-group → theme-scale mapping |
| `strict`   | `false`             | Ошибка вместо warning для unmapped group        |

Built-in mapping включает `color/colors → colors`, `spacing → spacing`, `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `borderRadius`, `boxShadow` и `transitionDuration`.

Custom mapping объединяется с built-in mapping:

```json
{
  "tailwind": {
    "groups": {
      "opacity": "opacity",
      "semanticColor": "colors"
    }
  }
}
```

Prototype keys `__proto__`, `prototype`, `constructor`, control characters и invalid identifiers отклоняются.

## Приоритет значений

```text
defaults → JSON config → CLI overrides
```

`--strict` также включает strict Tailwind mapping. Repeatable `--format` полностью заменяет config formats, а не дополняет их.

## См. также

- [CLI](cli.md) — options и exit codes
- [Форматы](formats.md) — Tailwind mapping и filenames
- [Архитектура](architecture.md) — config/filesystem boundaries
