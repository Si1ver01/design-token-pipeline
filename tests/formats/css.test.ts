import { describe, expect, it } from 'vitest';

import { generateCss } from '../../src/formats/css.js';
import { readFixture, resolvedBasicDocument } from '../helpers.js';

describe('generateCss', () => {
  it('matches the committed golden output', () => {
    const result = generateCss(resolvedBasicDocument());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.content).toBe(readFixture('expected/tokens.css'));
    expect(result.value.byteCount).toBe(Buffer.byteLength(result.value.content));
  });

  it('rejects unsafe selectors and prefixes', () => {
    expect(generateCss(resolvedBasicDocument(), { prefix: 'bad;prefix' }).success).toBe(false);
    expect(generateCss(resolvedBasicDocument(), { selector: 'body, script' }).success).toBe(false);
  });

  it('sanitizes description comments when enabled', () => {
    const result = generateCss(resolvedBasicDocument(), { includeDescriptions: true });

    expect(result.success).toBe(true);
    if (result.success) expect(result.value.content).toContain('/* Основной цвет бренда */');
  });
});
