import { describe, expect, it } from 'vitest';

import { parsePipelineConfig } from '../src/config/schema.js';

describe('parsePipelineConfig', () => {
  it('applies validated config and CLI overrides', () => {
    const result = parsePipelineConfig(
      {
        input: 'source/tokens.json',
        outDir: 'build',
        formats: ['css'],
        css: { prefix: 'brand' },
        tailwind: { groups: { palette: 'colors' } },
      },
      { formats: ['typescript'], outDir: 'generated' },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.formats).toEqual(['typescript']);
    expect(result.value.outDir).toBe('generated');
    expect(result.value.css.prefix).toBe('brand');
    expect(result.value.tailwind.groups).toEqual({ palette: 'colors' });
  });

  it('rejects unknown keys and unsafe filenames', () => {
    const result = parsePipelineConfig({
      unexpected: true,
      css: { filename: '../tokens.css' },
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.every((item) => item.code === 'config.invalid')).toBe(true);
  });

  it('rejects prototype keys in Tailwind mapping', () => {
    const result = parsePipelineConfig(
      JSON.parse('{"tailwind":{"groups":{"__proto__":"colors"}}}'),
    );

    expect(result.success).toBe(false);
  });
});
