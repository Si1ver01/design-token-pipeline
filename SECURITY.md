# Security policy

## Поддерживаемые версии

Security fixes выпускаются для последней опубликованной minor-версии. До публикации следующей версии поддерживается линия `0.1.x`.

## Сообщение об уязвимости

Не создавайте публичный issue и не включайте exploit, token documents или credentials в открытые обсуждения.

1. Откройте страницу репозитория **Security → Advisories**.
2. Выберите **Report a vulnerability** и создайте private security advisory.
3. Укажите затронутую версию, воспроизводимый сценарий, impact и безопасный минимальный proof of concept.

Если private vulnerability reporting ещё не включён владельцем репозитория, сообщите только о необходимости приватного канала через GitHub profile владельца, не раскрывая технические детали публично.

## Что считается security boundary

- JSON token document, config и все paths считаются недоверенными.
- Prototype keys, control characters, path traversal, symlink input/output и non-regular files отклоняются.
- Filesystem operations требуют trusted stable workspace: POSIX root/output directories не должны быть group/world-writable и должны принадлежать текущему пользователю или root; concurrent writers с тем же OS user и platform ACL races не покрываются portable Node.js API.
- Generated TypeScript использует JSON serialization; CSS selector/prefix/value имеют allowlist validation.
- Публикуемый tarball проверяется на `.env`, private keys, credentials, source/tests и неожиданные files.
- Release использует npm trusted publishing, GitHub OIDC и provenance без long-lived npm token.

## Проверка исправления

Filesystem guarantee ограничена per-file atomic replacement и best-effort rollback. Node.js 24 не предоставляет portable `openat`/`renameat`/`unlinkat`; для hostile local writer требуется native OS helper.

Исправление должно включать regression test и пройти:

```bash
npm run security:check
npm run verify
```

Security advisory публикуется после доступности исправленной версии и согласованного раскрытия.
