import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ReleaseTagError, validateReleaseTag } from './check-release-tag.mjs';

describe('validateReleaseTag', () => {
  it('accepts an exact stable version tag', () => {
    assert.deepEqual(validateReleaseTag('v0.1.0', '0.1.0'), {
      tag: 'v0.1.0',
      version: '0.1.0',
    });
  });

  it('accepts an exact prerelease version tag', () => {
    assert.deepEqual(validateReleaseTag('v1.2.3-rc.1', '1.2.3-rc.1'), {
      tag: 'v1.2.3-rc.1',
      version: '1.2.3-rc.1',
    });
  });

  it('rejects mismatched and non-strict tags', () => {
    assert.throws(() => validateReleaseTag('v0.1.1', '0.1.0'), ReleaseTagError);
    assert.throws(() => validateReleaseTag('v01.0.0', '01.0.0'), ReleaseTagError);
    assert.throws(() => validateReleaseTag('0.1.0', '0.1.0'), ReleaseTagError);
  });
});
