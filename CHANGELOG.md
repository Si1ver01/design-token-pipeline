# Changelog

Все заметные изменения проекта фиксируются в этом файле. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии следуют Semantic Versioning.

## [Unreleased]

## [0.1.0] - 2026-08-15

### Added

- JSON parser и validator для DTCG-inspired scalar token subset.
- Alias resolution с проверкой missing targets, type mismatch и cycles.
- Детерминированные generators для CSS, TypeScript и Tailwind theme.
- CLI `build` и `validate`, machine-readable `--json` и CI-oriented `--check`.
- Atomic filesystem writes, rollback и path/symlink security boundaries.
- Unit, integration, CLI, security, golden и packed-consumer tests.
- CI, Dependabot и trusted-publishing release workflow с provenance.

[Unreleased]: https://github.com/Si1ver01/design-token-pipeline/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Si1ver01/design-token-pipeline/releases/tag/v0.1.0
