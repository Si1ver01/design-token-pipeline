import { relative } from 'node:path';

import { loadPipelineConfig } from '../config/load-config.js';
import { buildTokens } from '../core/build-tokens.js';
import type { Diagnostic } from '../diagnostics/types.js';
import { checkArtifacts } from '../io/check-artifacts.js';
import { readTextFileWithinRoot } from '../io/read-input.js';
import { writeArtifactsAtomic } from '../io/write-artifacts.js';
import { ExitCode, type ExitCodeValue } from './exit-codes.js';
import type { CliOptions } from './parse-args.js';
import type { CliReporter } from './reporter.js';

export function runBuildCommand(
  projectRoot: string,
  options: CliOptions,
  reporter: CliReporter,
): ExitCodeValue {
  const startedAt = Date.now();
  const loaded = loadPipelineConfig(projectRoot, options.configPath, options.overrides);
  if (!loaded.success)
    return reportFailure(reporter, loaded.diagnostics, ExitCode.validation, 'build');
  const { rootDirectory, config } = loaded.value;
  reporter.log('DEBUG', 'config-resolved', {
    configPath: loaded.value.configPath,
    rootDirectory,
    input: config.input,
    outDir: config.outDir,
    formats: config.formats,
  });

  const input = readTextFileWithinRoot(rootDirectory, config.input, 'Token input');
  if (!input.success) {
    reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-input-read-failed', {
      input: config.input,
      diagnosticCodes: input.diagnostics.map((diagnostic) => diagnostic.code),
    });
    return reportFailure(reporter, input.diagnostics, ExitCode.io, 'build');
  }
  reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-input-read', {
    path: relative(rootDirectory, input.value.path),
  });
  reporter.log('INFO', 'build-start', {
    input: relative(rootDirectory, input.value.path),
    formats: config.formats,
  });
  const built = buildTokens(input.value.content, config, input.value.path);
  if (!built.success)
    return reportFailure(reporter, built.diagnostics, ExitCode.validation, 'build');

  if (options.check) {
    reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-output-check-start', {
      outDir: config.outDir,
      artifactCount: built.value.artifacts.length,
    });
    const checked = checkArtifacts(rootDirectory, config.outDir, built.value.artifacts);
    if (!checked.success) {
      reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-output-check-failed', {
        outDir: config.outDir,
        diagnosticCodes: checked.diagnostics.map((diagnostic) => diagnostic.code),
      });
      return reportFailure(reporter, checked.diagnostics, ExitCode.io, 'build');
    }
    if (!checked.value.fresh) {
      reporter.diagnostics(checked.diagnostics);
      reporter.result(
        {
          success: false,
          command: 'build',
          check: true,
          exitCode: ExitCode.stale,
          stale: checked.value.stale,
          missing: checked.value.missing,
          unexpected: checked.value.unexpected,
          diagnostics: checked.diagnostics,
        },
        `Generated outputs устарели: ${[
          ...checked.value.stale,
          ...checked.value.missing,
          ...checked.value.unexpected,
        ].join(', ')}`,
      );
      return ExitCode.stale;
    }
    reporter.result(
      {
        success: true,
        command: 'build',
        check: true,
        tokenCount: built.value.document.tokens.length,
        artifactCount: built.value.artifacts.length,
        diagnostics: built.value.diagnostics,
      },
      `Generated outputs актуальны (${built.value.artifacts.length}).`,
    );
    return ExitCode.success;
  }

  reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-output-write-start', {
    outDir: config.outDir,
    artifactCount: built.value.artifacts.length,
  });
  const written = writeArtifactsAtomic(rootDirectory, config.outDir, built.value.artifacts);
  if (!written.success) {
    reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-output-write-failed', {
      outDir: config.outDir,
      diagnosticCodes: written.diagnostics.map((diagnostic) => diagnostic.code),
    });
    return reportFailure(reporter, written.diagnostics, ExitCode.io, 'build');
  }
  reporter.log('DEBUG', '[FIX:filesystem-toctou] guarded-output-write', {
    outDir: config.outDir,
    artifactCount: written.value.files.length,
  });
  reporter.diagnostics(built.value.diagnostics);
  reporter.result(
    {
      success: true,
      command: 'build',
      tokenCount: built.value.document.tokens.length,
      artifactCount: written.value.files.length,
      files: written.value.files,
      byteCount: written.value.byteCount,
      durationMs: Date.now() - startedAt,
      diagnostics: built.value.diagnostics,
    },
    `Сгенерировано ${written.value.files.length} artifacts из ${built.value.document.tokens.length} tokens.`,
  );
  return ExitCode.success;
}

function reportFailure(
  reporter: CliReporter,
  diagnostics: readonly Diagnostic[],
  exitCode: ExitCodeValue,
  command: string,
): ExitCodeValue {
  reporter.diagnostics(diagnostics);
  reporter.result(
    { success: false, command, exitCode, diagnostics },
    `Команда ${command} завершилась с ошибкой (${exitCode}).`,
  );
  return exitCode;
}
