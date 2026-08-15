import { describe, expect, it } from 'vitest';

import { parseTokenDocument } from '../../src/core/parse-token-document.js';
import { readFixture } from '../helpers.js';

describe('parseTokenDocument', () => {
  it('normalizes inherited types and deterministic paths', () => {
    const result = parseTokenDocument(readFixture('tokens/basic.json'), 'basic.json');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.tokens.map((token) => token.pathString)).toEqual([
      'color.brand.focus',
      'color.brand.primary',
      'spacing.sm',
    ]);
    expect(result.value.tokens[0]?.type).toBe('color');
  });

  it('returns a typed diagnostic for malformed JSON', () => {
    const result = parseTokenDocument('{"color":', 'broken.json');

    expect(result.success).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('json.invalid');
  });

  it('rejects prototype pollution path segments', () => {
    const result = parseTokenDocument(readFixture('security/prototype.json'), 'prototype.json');

    expect(result.success).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain('schema.unsafe-path-segment');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects unsafe scalar values and invalid dimensions', () => {
    const result = parseTokenDocument(
      JSON.stringify({
        text: { $type: 'string', unsafe: { $value: 'ok; color: red' } },
        spacing: { $type: 'dimension', invalid: { $value: '12' } },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.diagnostics.filter((item) => item.code === 'schema.invalid-value')).toHaveLength(
      2,
    );
  });

  it('reports empty groups as warnings without failing validation', () => {
    const result = parseTokenDocument(JSON.stringify({ empty: {} }));

    expect(result.success).toBe(true);
    expect(result.diagnostics[0]?.code).toBe('schema.empty-group');
  });
});
