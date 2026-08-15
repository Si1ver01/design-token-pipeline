import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import type { ResolveContext, ResolvedToken, ResolvedTokenDocument } from './model.js';
import type { SourceToken, TokenDocument, TokenValue } from './token-types.js';
import { validateTokenSemantics } from './validate-tokens.js';

type ResolutionState = 'visiting' | 'resolved';

export function resolveAliases(
  document: TokenDocument,
  file = 'tokens.json',
): OperationResult<ResolvedTokenDocument> {
  const diagnostics = [...validateTokenSemantics(document, file)];
  const tokenByPath = new Map(document.tokens.map((token) => [token.pathString, token]));
  const context: ResolveContext = { tokenByPath, diagnostics, file };
  const states = new Map<string, ResolutionState>();
  const values = new Map<string, TokenValue>();
  const stack: string[] = [];

  for (const token of [...document.tokens].sort((left, right) =>
    compareText(left.pathString, right.pathString),
  )) {
    resolveValue(token, context, states, values, stack);
  }

  diagnostics.sort(compareDiagnostics);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { success: false, diagnostics };
  }

  const tokens = [...document.tokens]
    .sort((left, right) => compareText(left.pathString, right.pathString))
    .map((token) =>
      Object.freeze({
        path: Object.freeze([...token.path]),
        pathString: token.pathString,
        type: token.type,
        value: values.get(token.pathString) ?? token.value,
        sourceValue: token.value,
        description: token.description,
        aliasTarget: token.aliasTarget,
      } satisfies ResolvedToken),
    );

  return {
    success: true,
    value: Object.freeze({ tokens: Object.freeze(tokens) }),
    diagnostics,
  };
}

function resolveValue(
  token: SourceToken,
  context: ResolveContext,
  states: Map<string, ResolutionState>,
  values: Map<string, TokenValue>,
  stack: string[],
): TokenValue | undefined {
  if (states.get(token.pathString) === 'resolved') return values.get(token.pathString);
  if (states.get(token.pathString) === 'visiting') {
    const start = Math.max(0, stack.indexOf(token.pathString));
    const chain = [...stack.slice(start), token.pathString];
    context.diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'alias.cycle',
        message: 'Alias cycle detected.',
        path: token.pathString,
        file: context.file,
        context: { chain },
      }),
    );
    return undefined;
  }

  states.set(token.pathString, 'visiting');
  stack.push(token.pathString);

  let value: TokenValue | undefined = token.value;
  if (token.aliasTarget) {
    const target = context.tokenByPath.get(token.aliasTarget);
    if (!target) {
      context.diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'alias.missing-target',
          message: 'Alias target does not exist.',
          path: token.pathString,
          file: context.file,
          context: { target: token.aliasTarget },
        }),
      );
      value = undefined;
    } else if (target.type !== token.type) {
      context.diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'alias.type-mismatch',
          message: 'Alias target type does not match source token type.',
          path: token.pathString,
          file: context.file,
          context: { target: target.pathString, sourceType: token.type, targetType: target.type },
        }),
      );
      value = undefined;
    } else {
      value = resolveValue(target, context, states, values, stack);
    }
  }

  stack.pop();
  if (value !== undefined) {
    values.set(token.pathString, value);
    states.set(token.pathString, 'resolved');
  } else {
    states.delete(token.pathString);
  }
  return value;
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    compareText(left.path ?? '', right.path ?? '') ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
