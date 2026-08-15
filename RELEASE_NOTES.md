# design-token-pipeline v0.1.0

Первый публичный релиз CLI и TypeScript library для воспроизводимой сборки design tokens.

## Основное

- Один JSON document генерирует CSS custom properties, TypeScript constants/types и Tailwind theme object.
- Aliases `{path.to.token}` разрешаются до генерации; missing targets, cycles и type mismatch блокируют запись.
- `build --check` проверяет committed outputs и ничего не изменяет.
- Atomic writes и rollback защищают предыдущие artifacts при ошибке.
- Library API возвращает typed diagnostics без console side effects.

## Установка

```bash
npm install --save-dev design-token-pipeline@0.1.0
```

Runtime contract: Node.js `>=24.18.0`, npm `>=11.16.0`. Runtime dependencies отсутствуют.

## Поставка

Пакет публикуется через npm trusted publishing с provenance. Перед публикацией выполняются clean install, full verification, audit/signatures, SBOM, tarball allowlist и consumer smoke.

Полный contract описан в [README](README.md) и [документации](docs/cli.md).
