import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import {
  isTokenType,
  type SourceToken,
  type TokenDocument,
  type TokenType,
  type TokenValue,
} from './token-types.js';

const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ALIAS_PATTERN = /^\{([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\}$/;
const UNSAFE_VALUE_PATTERN = /[;{}]/;
const DIMENSION_PATTERN =
  /^(?:0|-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc))$/;
const DURATION_PATTERN = /^(?:0|(?:\d+|\d*\.\d+)(?:ms|s))$/;
const COLOR_PATTERN =
  /^(?:#[\da-fA-F]{3,8}|[A-Za-z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([A-Za-z0-9.,%+\- /]+\))$/;

type UnknownRecord = Record<string, unknown>;

export function normalizeTokenDocument(
  input: unknown,
  file = 'tokens.json',
): OperationResult<TokenDocument> {
  const diagnostics: Diagnostic[] = [];
  const tokens: SourceToken[] = [];

  if (!isRecord(input)) {
    return {
      success: false,
      diagnostics: [
        createDiagnostic({
          severity: 'error',
          code: 'schema.root-not-object',
          message: 'Token document root must be a JSON object.',
          file,
        }),
      ],
    };
  }

  visitGroup(input, [], null, file, tokens, diagnostics);
  diagnostics.sort(compareDiagnostics);

  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { success: false, diagnostics };
  }

  return {
    success: true,
    value: Object.freeze({ tokens: Object.freeze(tokens) }),
    diagnostics,
  };
}

function visitGroup(
  group: UnknownRecord,
  path: readonly string[],
  inheritedType: TokenType | null,
  file: string,
  tokens: SourceToken[],
  diagnostics: Diagnostic[],
): void {
  let groupType = inheritedType;
  if ('$type' in group) {
    if (isTokenType(group.$type)) groupType = group.$type;
    else addInvalidType(group.$type, path, file, diagnostics);
  }

  if ('$description' in group && typeof group.$description !== 'string') {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'schema.invalid-description',
        message: '$description must be a string.',
        path: path.join('.'),
        file,
      }),
    );
  }

  const entries = Object.entries(group)
    .filter(([key]) => !key.startsWith('$'))
    .sort(([left], [right]) => compareText(left, right));

  for (const key of Object.keys(group).filter((name) => name.startsWith('$'))) {
    if (!['$type', '$description'].includes(key)) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'schema.unknown-property',
          message: `Unknown group property ${key}.`,
          path: path.join('.'),
          file,
        }),
      );
    }
  }

  if (entries.length === 0 && path.length > 0) {
    diagnostics.push(
      createDiagnostic({
        severity: 'warning',
        code: 'schema.empty-group',
        message: 'Token group is empty.',
        path: path.join('.'),
        file,
      }),
    );
  }

  for (const [key, value] of entries) {
    const childPath = [...path, key];
    if (!validatePathSegment(key, childPath, file, diagnostics)) continue;
    if (!isRecord(value)) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'schema.invalid-node',
          message: 'Every group member must be an object.',
          path: childPath.join('.'),
          file,
        }),
      );
      continue;
    }
    if ('$value' in value) visitToken(value, childPath, groupType, file, tokens, diagnostics);
    else visitGroup(value, childPath, groupType, file, tokens, diagnostics);
  }
}

function visitToken(
  node: UnknownRecord,
  path: readonly string[],
  inheritedType: TokenType | null,
  file: string,
  tokens: SourceToken[],
  diagnostics: Diagnostic[],
): void {
  const pathString = path.join('.');
  const allowed = new Set(['$value', '$type', '$description']);
  for (const key of Object.keys(node)) {
    if (!allowed.has(key)) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'schema.unknown-property',
          message: `Unknown token property ${key}.`,
          path: pathString,
          file,
        }),
      );
    }
  }

  const type = '$type' in node ? node.$type : inheritedType;
  if (!isTokenType(type)) {
    if (type === null || type === undefined) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'schema.missing-type',
          message: 'Token must define or inherit a supported $type.',
          path: pathString,
          file,
        }),
      );
    } else addInvalidType(type, path, file, diagnostics);
    return;
  }

  if ('$description' in node && typeof node.$description !== 'string') {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'schema.invalid-description',
        message: '$description must be a string.',
        path: pathString,
        file,
      }),
    );
  }

  const value = node.$value;
  const aliasTarget = typeof value === 'string' ? (ALIAS_PATTERN.exec(value)?.[1] ?? null) : null;
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}') && !aliasTarget) {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'alias.invalid-reference',
        message: 'Alias must use the exact form {path.to.token}.',
        path: pathString,
        file,
      }),
    );
    return;
  }

  if (!aliasTarget && !isValidValue(type, value)) {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'schema.invalid-value',
        message: `Value is invalid for token type ${type}.`,
        path: pathString,
        file,
        context: { type },
      }),
    );
    return;
  }

  tokens.push(
    Object.freeze({
      path: Object.freeze([...path]),
      pathString,
      type,
      value: value as TokenValue,
      description: typeof node.$description === 'string' ? node.$description : null,
      aliasTarget,
    }),
  );
}

function isValidValue(type: TokenType, value: unknown): value is TokenValue {
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'fontWeight') {
    return (
      (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000) ||
      (typeof value === 'string' && ['normal', 'bold', 'bolder', 'lighter'].includes(value))
    );
  }
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    UNSAFE_VALUE_PATTERN.test(value) ||
    hasControlCharacter(value)
  ) {
    return false;
  }
  if (type === 'dimension') return DIMENSION_PATTERN.test(value);
  if (type === 'duration') return DURATION_PATTERN.test(value);
  if (type === 'color') return COLOR_PATTERN.test(value);
  return true;
}

function validatePathSegment(
  segment: string,
  path: readonly string[],
  file: string,
  diagnostics: Diagnostic[],
): boolean {
  if (DANGEROUS_SEGMENTS.has(segment)) {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'schema.unsafe-path-segment',
        message: 'Token path contains a reserved prototype key.',
        path: path.join('.'),
        file,
      }),
    );
    return false;
  }
  if (!PATH_SEGMENT_PATTERN.test(segment)) {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'schema.invalid-path-segment',
        message: 'Token path segments must use ASCII letters, digits, underscores, or hyphens.',
        path: path.join('.'),
        file,
      }),
    );
    return false;
  }
  return true;
}

function addInvalidType(
  type: unknown,
  path: readonly string[],
  file: string,
  diagnostics: Diagnostic[],
): void {
  diagnostics.push(
    createDiagnostic({
      severity: 'error',
      code: 'schema.invalid-type',
      message: 'Token $type is not supported.',
      path: path.join('.'),
      file,
      context: { received: String(type) },
    }),
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    compareText(left.path ?? '', right.path ?? '') ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}
