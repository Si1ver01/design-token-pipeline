import type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from './types.js';

interface DiagnosticInput {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly path?: string;
  readonly file?: string;
  readonly context?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export function createDiagnostic(input: DiagnosticInput): Diagnostic {
  return Object.freeze({
    severity: input.severity,
    code: input.code,
    message: input.message,
    path: input.path ?? null,
    file: input.file ?? null,
    context: Object.freeze({ ...(input.context ?? {}) }),
  });
}
