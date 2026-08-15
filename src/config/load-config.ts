import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { OperationResult } from '../diagnostics/types.js';
import { readTextFileWithinRoot } from '../io/read-input.js';
import { resolvePathWithinRoot } from '../io/path-security.js';
import { parsePipelineConfig, type PipelineConfig, type PipelineOverrides } from './schema.js';

export interface LoadedPipelineConfig {
  readonly rootDirectory: string;
  readonly configPath: string | null;
  readonly config: PipelineConfig;
}

export function loadPipelineConfig(
  projectRoot: string,
  configCandidate: string | null,
  overrides: PipelineOverrides = {},
): OperationResult<LoadedPipelineConfig> {
  const root = resolve(projectRoot);
  let configInput: unknown = {};
  let configPath: string | null = null;
  let configDirectory = root;

  if (configCandidate) {
    const resolved = resolvePathWithinRoot(root, configCandidate, 'Config file');
    if (!resolved.success) return resolved;
    const relativePath = relative(root, resolved.value);
    const read = readTextFileWithinRoot(root, relativePath, 'Config file');
    if (!read.success) return read;
    configPath = read.value.path;
    configDirectory = dirname(read.value.path);
    try {
      configInput = JSON.parse(read.value.content);
    } catch (error) {
      return {
        success: false,
        diagnostics: [
          createDiagnostic({
            severity: 'error',
            code: 'config.invalid',
            message:
              error instanceof SyntaxError ? error.message : 'Configuration JSON is invalid.',
            file: read.value.path,
          }),
        ],
      };
    }
  } else {
    const defaultPath = resolve(root, 'design-tokens.config.json');
    if (existsSync(defaultPath))
      return loadPipelineConfig(root, 'design-tokens.config.json', overrides);
  }

  const parsed = parsePipelineConfig(configInput, overrides, configPath ?? 'defaults');
  if (!parsed.success) return parsed;
  return {
    success: true,
    value: Object.freeze({ rootDirectory: configDirectory, configPath, config: parsed.value }),
    diagnostics: parsed.diagnostics,
  };
}
