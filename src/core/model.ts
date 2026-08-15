import type { Diagnostic } from '../diagnostics/types.js';
import type { SourceToken, TokenType, TokenValue } from './token-types.js';

export interface ResolvedToken {
  readonly path: readonly string[];
  readonly pathString: string;
  readonly type: TokenType;
  readonly value: TokenValue;
  readonly sourceValue: TokenValue;
  readonly description: string | null;
  readonly aliasTarget: string | null;
}

export interface ResolvedTokenDocument {
  readonly tokens: readonly ResolvedToken[];
}

export interface ResolveContext {
  readonly tokenByPath: ReadonlyMap<string, SourceToken>;
  readonly diagnostics: Diagnostic[];
  readonly file: string;
}
