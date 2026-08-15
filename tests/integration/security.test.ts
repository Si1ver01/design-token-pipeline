import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseTokenDocument } from '../../src/core/parse-token-document.js';
import { readTextFileWithinRoot } from '../../src/io/read-input.js';

describe('security boundaries', () => {
  it('does not mutate Object.prototype for malicious JSON', () => {
    const before = ({} as Record<string, unknown>).polluted;
    const result = parseTokenDocument(
      '{"__proto__":{"$type":"string","polluted":{"$value":"yes"}}}',
    );

    expect(result.success).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBe(before);
  });

  it('rejects symlink input even when it resolves inside the root', () => {
    const root = mkdtempSync(join(tmpdir(), 'design-token-pipeline-security-'));
    try {
      const target = join(root, 'real.json');
      writeFileSync(target, '{}');
      symlinkSync(target, join(root, 'tokens.json'));

      const result = readTextFileWithinRoot(root, 'tokens.json');

      expect(result.success).toBe(false);
      expect(readFileSync(target, 'utf8')).toBe('{}');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
