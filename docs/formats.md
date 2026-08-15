[← Конфигурация](configuration.md) · [К README](../README.md) · [Архитектура →](architecture.md)

# Token contract и formats

Версия `0.1.0` реализует ограниченный DTCG-inspired JSON subset. Это не заявление о полной совместимости с Design Tokens Community Group (DTCG) specification.

## Структура token document

Каждый group или token является JSON object. Group может задать `$type` и `$description`; token определяется наличием `$value`.

```json
{
  "color": {
    "$type": "color",
    "brand": {
      "primary": {
        "$value": "#2563eb",
        "$description": "Основной цвет бренда"
      },
      "focus": {
        "$value": "{color.brand.primary}"
      }
    }
  }
}
```

Token наследует `$type` от ближайшего parent group. Unknown `$` properties и unknown token fields блокируют validation.

Path segment должен начинаться с ASCII letter или digit и содержать только `A-Z`, `a-z`, `0-9`, `_`, `-`. `__proto__`, `prototype` и `constructor` запрещены.

## Поддерживаемые types

| `$type`      | Допустимый `$value`                                                                   |
| ------------ | ------------------------------------------------------------------------------------- |
| `color`      | Hex, CSS color keyword или allowlisted functional color без `{}`, `;` и control chars |
| `dimension`  | `0` или число с `px`, `rem`, `em`, `%`, viewport/physical unit                        |
| `number`     | Конечный JSON number                                                                  |
| `string`     | Непустая безопасная string                                                            |
| `fontFamily` | Непустая безопасная string                                                            |
| `fontWeight` | Integer `1..1000` либо `normal`, `bold`, `bolder`, `lighter`                          |
| `duration`   | `0` либо неотрицательное число с `ms` или `s`                                         |

Composite typography, shadow и border objects не поддерживаются.

## Aliases

Alias занимает всё значение и имеет точную форму `{path.to.token}`.

```json
{
  "color": {
    "$type": "color",
    "base": { "$value": "#2563eb" },
    "focus": { "$value": "{color.base}" }
  }
}
```

Source и target должны иметь одинаковый `$type`. Pipeline разрешает chains, но отклоняет missing target, self-reference и cycles. Generators получают только immutable resolved values.

## Naming и порядок

Tokens сортируются лексикографически по dot path без locale-dependent comparison. CSS/output collision key переводит segments в lowercase и заменяет `_` на `-`; например `brand_primary` конфликтует с `brand-primary`.

Все generated files используют `\n` и заканчиваются newline.

## CSS

Default output `tokens.css`:

```css
:root {
  --dt-color-brand-focus: #2563eb;
  --dt-color-brand-primary: #2563eb;
}
```

Prefix и selector проходят allowlist validation. `$description` comments отключены по умолчанию и sanitized при включении.

## TypeScript

Default output `tokens.ts` экспортирует:

- nested `tokens` object `as const`;
- `flatTokens` с dot-path keys;
- union types `TokenPath` и `TokenName`;
- default export `tokens`.

Generated module не импортирует `design-token-pipeline`. Strings сериализуются через JSON rules, включая escaping code-like input и Unicode line separators.

## Tailwind

Default output `tailwind-theme.ts` экспортирует `theme` object, подходящий для `theme.extend`:

```ts
import theme from './generated/tailwind-theme.js';

export default {
  theme: { extend: theme },
};
```

Первый token path segment выбирает theme scale через built-in или custom mapping. Unmapped group даёт `format.unmapped-group`; strict mode превращает его в error.

Generated module не зависит от установленного Tailwind package.

## См. также

- [Конфигурация](configuration.md) — output options и group mapping
- [Архитектура](architecture.md) — validation/generation data flow
- [CLI](cli.md) — build и check mode
