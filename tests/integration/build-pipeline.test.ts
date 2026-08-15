import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { buildTokens } from '../../src/core/build-tokens.js';
import { checkArtifacts } from '../../src/io/check-artifacts.js';
import { writeArtifactsAtomic } from '../../src/io/write-artifacts.js';

describe('build pipeline integration', () => {
  it('produces byte-identical outputs across repeated builds', () => {
    const source = readFileSync('tests/fixtures/tokens/basic.json', 'utf8');
    const first = buildTokens(source, DEFAULT_CONFIG, 'basic.json');
    const second = buildTokens(source, DEFAULT_CONFIG, 'basic.json');

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.value.artifacts.map((item) => item.content)).toEqual(
      second.value.artifacts.map((item) => item.content),
    );

    const root = mkdtempSync(join(tmpdir(), 'design-token-pipeline-integration-'));
    try {
      expect(writeArtifactsAtomic(root, 'generated', first.value.artifacts).success).toBe(true);
      const checked = checkArtifacts(root, 'generated', second.value.artifacts);
      expect(checked.success && checked.value.fresh).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('turns Tailwind mapping warnings into failures in strict mode', () => {
    const source = JSON.stringify({ custom: { $type: 'string', value: { $value: 'safe' } } });
    const config = { ...DEFAULT_CONFIG, strict: true };

    const result = buildTokens(source, config);

    expect(result.success).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain('format.unmapped-group');
  });
});
