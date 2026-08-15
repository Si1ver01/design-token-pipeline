import { describe, expect, it } from 'vitest';

import { parseTokenDocument } from '../../src/core/parse-token-document.js';
import { resolveAliases } from '../../src/core/resolve-aliases.js';
import { readFixture } from '../helpers.js';

describe('resolveAliases', () => {
  it('resolves alias chains to immutable values', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({
        color: {
          $type: 'color',
          primary: { $value: '#2563eb' },
          focus: { $value: '{color.primary}' },
          active: { $value: '{color.focus}' },
        },
      }),
    );
    if (!parsed.success) throw new Error('Fixture must parse.');

    const result = resolveAliases(parsed.value);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.tokens.map((token) => token.value)).toEqual([
      '#2563eb',
      '#2563eb',
      '#2563eb',
    ]);
    expect(Object.isFrozen(result.value.tokens)).toBe(true);
  });

  it('detects cycles with a stable chain', () => {
    const parsed = parseTokenDocument(readFixture('aliases/cycle.json'));
    if (!parsed.success) throw new Error('Fixture must parse.');

    const result = resolveAliases(parsed.value);

    expect(result.success).toBe(false);
    const diagnostic = result.diagnostics.find((item) => item.code === 'alias.cycle');
    expect(diagnostic?.context.chain).toEqual(['color.a', 'color.b', 'color.a']);
  });

  it('detects missing and incompatible alias targets', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({
        color: {
          $type: 'color',
          missing: { $value: '{color.unknown}' },
          wrong: { $value: '{spacing.sm}' },
        },
        spacing: { $type: 'dimension', sm: { $value: '0.5rem' } },
      }),
    );
    if (!parsed.success) throw new Error('Fixture must parse.');

    const result = resolveAliases(parsed.value);

    expect(result.success).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['alias.missing-target', 'alias.type-mismatch']),
    );
  });

  it('detects output name collisions before generation', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({
        color: {
          $type: 'color',
          'brand-primary': { $value: '#000000' },
          brand_primary: { $value: '#ffffff' },
        },
      }),
    );
    if (!parsed.success) throw new Error('Fixture must parse.');

    const result = resolveAliases(parsed.value);

    expect(result.success).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain('name.collision');
  });
});
