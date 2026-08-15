import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import { generateCss } from '../formats/css.js';
import { generateTailwindTheme } from '../formats/tailwind.js';
import { generateTypeScript } from '../formats/typescript.js';
import type { GeneratedArtifact } from '../formats/types.js';
import type { PipelineConfig } from '../config/schema.js';
import type { ResolvedTokenDocument } from './model.js';
import { parseTokenDocument } from './parse-token-document.js';
import { resolveAliases } from './resolve-aliases.js';

export interface BuildTokensResult {
  readonly document: ResolvedTokenDocument;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly diagnostics: readonly Diagnostic[];
}

export function buildTokens(
  source: string,
  config: PipelineConfig,
  file = config.input,
): OperationResult<BuildTokensResult> {
  const parsed = parseTokenDocument(source, file);
  if (!parsed.success) return parsed;
  const resolved = resolveAliases(parsed.value, file);
  if (!resolved.success) return resolved;

  const diagnostics: Diagnostic[] = [...parsed.diagnostics, ...resolved.diagnostics];
  const artifacts: GeneratedArtifact[] = [];
  for (const format of config.formats) {
    const generated =
      format === 'css'
        ? generateCss(resolved.value, config.css)
        : format === 'typescript'
          ? generateTypeScript(resolved.value, config.typescript)
          : generateTailwindTheme(resolved.value, {
              ...config.tailwind,
              strict: config.strict || config.tailwind.strict,
            });
    diagnostics.push(...generated.diagnostics);
    if (!generated.success) return { success: false, diagnostics: sortDiagnostics(diagnostics) };
    artifacts.push(generated.value);
  }

  if (config.strict && diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
    return { success: false, diagnostics: sortDiagnostics(diagnostics) };
  }
  return {
    success: true,
    value: Object.freeze({
      document: resolved.value,
      artifacts: Object.freeze(artifacts),
      diagnostics: Object.freeze(sortDiagnostics(diagnostics)),
    }),
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((left, right) =>
    (left.path ?? '') < (right.path ?? '')
      ? -1
      : (left.path ?? '') > (right.path ?? '')
        ? 1
        : left.code < right.code
          ? -1
          : left.code > right.code
            ? 1
            : 0,
  );
}
