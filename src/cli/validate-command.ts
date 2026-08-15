import { relative } from 'node:path';

import { loadPipelineConfig } from '../config/load-config.js';
import { parseTokenDocument } from '../core/parse-token-document.js';
import { resolveAliases } from '../core/resolve-aliases.js';
import type { Diagnostic } from '../diagnostics/types.js';
import { readTextFileWithinRoot } from '../io/read-input.js';
import { ExitCode, type ExitCodeValue } from './exit-codes.js';
import type { CliOptions } from './parse-args.js';
import type { CliReporter } from './reporter.js';

export function runValidateCommand(
  projectRoot: string,
  options: CliOptions,
  reporter: CliReporter,
): ExitCodeValue {
  const startedAt = Date.now();
  const loaded = loadPipelineConfig(projectRoot, options.configPath, options.overrides);
  if (!loaded.success) return reportFailure(reporter, loaded.diagnostics, ExitCode.validation);
  const input = readTextFileWithinRoot(
    loaded.value.rootDirectory,
    loaded.value.config.input,
    'Token input',
  );
  if (!input.success) {
    reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-input-read-failed', {
      input: loaded.value.config.input,
      diagnosticCodes: input.diagnostics.map((diagnostic) => diagnostic.code),
    });
    return reportFailure(reporter, input.diagnostics, ExitCode.io);
  }
  reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-input-read', {
    path: relative(loaded.value.rootDirectory, input.value.path),
  });
  reporter.log('INFO', 'validation-start', {
    input: relative(loaded.value.rootDirectory, input.value.path),
  });

  const parsed = parseTokenDocument(input.value.content, input.value.path);
  if (!parsed.success) return reportFailure(reporter, parsed.diagnostics, ExitCode.validation);
  const resolved = resolveAliases(parsed.value, input.value.path);
  if (!resolved.success) return reportFailure(reporter, resolved.diagnostics, ExitCode.validation);
  const diagnostics = [...parsed.diagnostics, ...resolved.diagnostics];
  if (loaded.value.config.strict && diagnostics.some((item) => item.severity === 'warning')) {
    return reportFailure(reporter, diagnostics, ExitCode.validation);
  }

  reporter.diagnostics(diagnostics);
  reporter.result(
    {
      success: true,
      command: 'validate',
      tokenCount: resolved.value.tokens.length,
      warningCount: diagnostics.filter((item) => item.severity === 'warning').length,
      durationMs: Date.now() - startedAt,
      diagnostics,
    },
    `Проверено ${resolved.value.tokens.length} tokens.`,
  );
  return ExitCode.success;
}

function reportFailure(
  reporter: CliReporter,
  diagnostics: readonly Diagnostic[],
  exitCode: ExitCodeValue,
): ExitCodeValue {
  reporter.diagnostics(diagnostics);
  reporter.result(
    { success: false, command: 'validate', exitCode, diagnostics },
    `Команда validate завершилась с ошибкой (${exitCode}).`,
  );
  return exitCode;
}
