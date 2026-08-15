export const SUPPORTED_TOKEN_TYPES = [
  'color',
  'dimension',
  'number',
  'string',
  'fontFamily',
  'fontWeight',
  'duration',
] as const;

export type TokenType = (typeof SUPPORTED_TOKEN_TYPES)[number];
export type TokenValue = string | number;

export interface TokenDocument {
  readonly tokens: readonly SourceToken[];
}

export interface SourceToken {
  readonly path: readonly string[];
  readonly pathString: string;
  readonly type: TokenType;
  readonly value: TokenValue;
  readonly description: string | null;
  readonly aliasTarget: string | null;
}

export function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && SUPPORTED_TOKEN_TYPES.some((type) => type === value);
}
