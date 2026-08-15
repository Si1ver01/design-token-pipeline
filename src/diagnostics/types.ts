export type DiagnosticSeverity = 'warning' | 'error';

export type DiagnosticCode =
  | 'json.invalid'
  | 'schema.root-not-object'
  | 'schema.unknown-property'
  | 'schema.invalid-node'
  | 'schema.invalid-description'
  | 'schema.invalid-type'
  | 'schema.missing-type'
  | 'schema.invalid-value'
  | 'schema.invalid-path-segment'
  | 'schema.unsafe-path-segment'
  | 'schema.empty-group'
  | 'alias.invalid-reference'
  | 'alias.missing-target'
  | 'alias.type-mismatch'
  | 'alias.cycle'
  | 'name.collision'
  | 'format.invalid-value'
  | 'format.unmapped-group'
  | 'config.invalid'
  | 'io.invalid-path'
  | 'io.read-failed'
  | 'io.write-failed'
  | 'io.stale-output'
  | 'internal.error';

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly path: string | null;
  readonly file: string | null;
  readonly context: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export type OperationResult<T> =
  | {
      readonly success: true;
      readonly value: T;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly success: false;
      readonly diagnostics: readonly Diagnostic[];
    };
