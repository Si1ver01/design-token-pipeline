import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseTokenDocument } from '../src/core/parse-token-document.js';
import { resolveAliases } from '../src/core/resolve-aliases.js';
import type { ResolvedTokenDocument } from '../src/core/model.js';

export function readFixture(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', relativePath), 'utf8');
}

export function resolvedBasicDocument(): ResolvedTokenDocument {
  const parsed = parseTokenDocument(readFixture('tokens/basic.json'), 'basic.json');
  if (!parsed.success) throw new Error(JSON.stringify(parsed.diagnostics));
  const resolved = resolveAliases(parsed.value, 'basic.json');
  if (!resolved.success) throw new Error(JSON.stringify(resolved.diagnostics));
  return resolved.value;
}
