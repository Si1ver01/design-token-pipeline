import { parseArgs } from 'node:util';

import type { OutputFormat } from '../formats/types.js';
import type { PipelineOverrides } from '../config/schema.js';

export type CliCommand = 'build' | 'validate';
export type CliLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface CliOptions {
  readonly command: CliCommand | null;
  readonly configPath: string | null;
  readonly inputPath: string | null;
  readonly check: boolean;
  readonly json: boolean;
  readonly help: boolean;
  readonly version: boolean;
  readonly logLevel: CliLogLevel;
  readonly overrides: PipelineOverrides;
}

export function parseCliArgs(argv: readonly string[]): CliOptions {
  const parsed = parseArgs({
    args: [...argv],
    strict: true,
    allowPositionals: true,
    options: {
      config: { type: 'string', short: 'c' },
      'out-dir': { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', multiple: true },
      prefix: { type: 'string', short: 'p' },
      check: { type: 'boolean' },
      strict: { type: 'boolean' },
      json: { type: 'boolean' },
      'log-level': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  const [commandValue, inputPath, ...extra] = parsed.positionals;
  if (extra.length > 0) throw new TypeError('CLI принимает не более одного input path.');
  const command = commandValue === 'build' || commandValue === 'validate' ? commandValue : null;
  if (commandValue && !command) throw new TypeError(`Неизвестная команда: ${commandValue}`);

  const formats = parsed.values.format
    ? parsed.values.format.map((format) => parseFormat(format))
    : undefined;
  const logLevel = parseLogLevel(parsed.values['log-level'] ?? process.env.LOG_LEVEL ?? 'INFO');
  const overrides: PipelineOverrides = {
    ...(inputPath ? { input: inputPath } : {}),
    ...(parsed.values['out-dir'] ? { outDir: parsed.values['out-dir'] } : {}),
    ...(formats ? { formats } : {}),
    ...(parsed.values.strict === true ? { strict: true } : {}),
    ...(parsed.values.prefix ? { cssPrefix: parsed.values.prefix } : {}),
  };

  return Object.freeze({
    command,
    configPath: parsed.values.config ?? null,
    inputPath: inputPath ?? null,
    check: parsed.values.check ?? false,
    json: parsed.values.json ?? false,
    help: parsed.values.help ?? false,
    version: parsed.values.version ?? false,
    logLevel,
    overrides: Object.freeze(overrides),
  });
}

function parseFormat(value: string): OutputFormat {
  if (value === 'css' || value === 'typescript' || value === 'tailwind') return value;
  throw new TypeError(`Неизвестный format: ${value}`);
}

function parseLogLevel(value: string): CliLogLevel {
  const normalized = value.toUpperCase();
  if (
    normalized === 'DEBUG' ||
    normalized === 'INFO' ||
    normalized === 'WARN' ||
    normalized === 'ERROR'
  ) {
    return normalized;
  }
  throw new TypeError(`Неизвестный log level: ${value}`);
}
