import { describe, expect, it } from 'vitest';

import { parseTokenDocument } from '../../src/core/parse-token-document.js';
import { resolveAliases } from '../../src/core/resolve-aliases.js';
import { generateTailwindTheme } from '../../src/formats/tailwind.js';
import { readFixture, resolvedBasicDocument } from '../helpers.js';

describe('generateTailwindTheme', () => {
  it('matches the committed golden output', () => {
    const result = generateTailwindTheme(resolvedBasicDocument());

    expect(result.success).toBe(true);
    if (result.success)
      expect(result.value.content).toBe(readFixture('expected/tailwind-theme.ts'));
  });

  it('warns for unmapped groups and supports strict mode', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({ custom: { $type: 'string', value: { $value: 'safe' } } }),
    );
    if (!parsed.success) throw new Error('Fixture must parse.');
    const resolved = resolveAliases(parsed.value);
    if (!resolved.success) throw new Error('Fixture must resolve.');

    const warning = generateTailwindTheme(resolved.value);
    const strict = generateTailwindTheme(resolved.value, { strict: true });

    expect(warning.success).toBe(true);
    expect(warning.diagnostics[0]?.code).toBe('format.unmapped-group');
    expect(strict.success).toBe(false);
  });
});
