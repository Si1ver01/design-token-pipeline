const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['npm-token', /npm_[A-Za-z0-9]{36}/],
  ['github-token', /gh[oprsu]_[A-Za-z0-9]{36,255}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ['auth-token-assignment', /(?:NODE_AUTH_TOKEN|NPM_TOKEN)\s*=\s*[^\s${][^\s]*/],
];

export function findSensitiveContent(content) {
  return SENSITIVE_PATTERNS.filter(([, pattern]) => pattern.test(content)).map(([name]) => name);
}
