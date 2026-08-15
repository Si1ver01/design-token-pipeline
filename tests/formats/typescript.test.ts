import { describe, expect, it } from 'vitest';

import { generateTypeScript } from '../../src/formats/typescript.js';
import { serializeJavaScriptLiteral } from '../../src/formats/naming.js';
import { readFixture, resolvedBasicDocument } from '../helpers.js';

describe('generateTypeScript', () => {
  it('matches the committed golden output', () => {
    const result = generateTypeScript(resolvedBasicDocument());

    expect(result.success).toBe(true);
    if (result.success) expect(result.value.content).toBe(readFixture('expected/tokens.ts'));
  });

  it('serializes code-like strings as inert literals', () => {
    expect(serializeJavaScriptLiteral('"; process.exit(1); //')).toBe(
      String.raw`"\"; process.exit(1); //"`,
    );
  });
});
