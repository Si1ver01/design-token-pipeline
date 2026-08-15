# design-token-pipeline

> Один JSON source of truth для воспроизводимой генерации CSS, TypeScript и Tailwind theme.

`design-token-pipeline` проверяет design tokens, разрешает aliases и создаёт byte-identical artifacts. CLI не оставляет частично записанные файлы, а library API не пишет в console и не завершает process.

## Быстрый старт

Требуются Node.js `24.18.0` или новее и npm `11.16.0` или новее.

```bash
npm install --save-dev design-token-pipeline
npx design-token-pipeline build tokens.json
```

По умолчанию команда создаёт `generated/tokens.css`, `generated/tokens.ts` и `generated/tailwind-theme.ts`.

## Возможности

- **Проверяемая схема** — JSON contract с `$type`, `$value`, `$description` и наследованием type от группы.
- **Безопасные aliases** — ссылки `{path.to.token}`, проверка отсутствующих targets, type mismatch и cycles.
- **Три формата** — CSS custom properties, типизированный TypeScript и `theme.extend`-совместимый Tailwind object.
- **Детерминированный output** — стабильная сортировка, `\n` и одинаковые bytes при повторной сборке.
- **Atomic writes** — validation или IO error не оставляет смешанный набор artifacts.
- **CI check mode** — `--check` находит stale, missing и unexpected outputs без записи.

## Пример

```json
{
  "color": {
    "$type": "color",
    "brand": {
      "primary": { "$value": "#2563eb" },
      "focus": { "$value": "{color.brand.primary}" }
    }
  },
  "spacing": {
    "$type": "dimension",
    "sm": { "$value": "0.5rem" }
  }
}
```

```bash
npx design-token-pipeline build tokens.json --out-dir generated --prefix brand
npx design-token-pipeline build tokens.json --out-dir generated --prefix brand --check
```

Готовый end-to-end вариант находится в [`examples/basic`](examples/basic/).

## Library API

```ts
import { buildTokens, DEFAULT_CONFIG } from 'design-token-pipeline';

const jsonSource = JSON.stringify({
  color: {
    $type: 'color',
    primary: { $value: '#2563eb' },
  },
});
const result = buildTokens(jsonSource, DEFAULT_CONFIG, 'tokens.json');
if (!result.success) {
  console.error(result.diagnostics);
} else {
  console.log(result.value.artifacts.map((artifact) => artifact.filename));
}
```

API возвращает discriminated `OperationResult<T>` и typed diagnostics. Запись на filesystem выполняется только при явном вызове IO API.

## Документация

| Руководство                           | Содержание                                |
| ------------------------------------- | ----------------------------------------- |
| [CLI](docs/cli.md)                    | Команды, options, logging и exit codes    |
| [Конфигурация](docs/configuration.md) | JSON config, defaults и CLI overrides     |
| [Форматы](docs/formats.md)            | Token schema, aliases и generated outputs |
| [Архитектура](docs/architecture.md)   | Модули, data flow и security boundaries   |
| [Поставка](docs/delivery.md)          | CI, dependency baseline и release flow    |

Также доступны [правила участия](CONTRIBUTING.md), [security policy](SECURITY.md), [changelog](CHANGELOG.md) и [release notes](RELEASE_NOTES.md).

## Ограничения v0.1.0

Поддерживается документированный DTCG-inspired scalar subset. YAML, composite tokens, themes/modes, watch mode, remote sources и полная совместимость с DTCG не заявлены.

## Лицензия

[MIT](LICENSE)
