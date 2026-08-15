import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findSensitiveContent } from './package-security.mjs';

describe('findSensitiveContent', () => {
  it('detects high-confidence credentials', () => {
    assert.deepEqual(findSensitiveContent('-----BEGIN PRIVATE KEY-----'), ['private-key']);
    assert.deepEqual(findSensitiveContent(`NPM_TOKEN=${'a'.repeat(40)}`), [
      'auth-token-assignment',
    ]);
    assert.deepEqual(findSensitiveContent(`AKIA${'A'.repeat(16)}`), ['aws-access-key']);
  });

  it('does not flag documented placeholders', () => {
    assert.deepEqual(findSensitiveContent('NPM_TOKEN must not be configured.'), []);
    assert.deepEqual(findSensitiveContent('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}'), []);
  });
});
