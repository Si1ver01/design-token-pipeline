import type { Diagnostic } from '../diagnostics/types.js';
import type { CliLogLevel } from './parse-args.js';

export interface CliStreams {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface CliReporter {
  readonly json: boolean;
  log(level: CliLogLevel, message: string, context?: Readonly<Record<string, unknown>>): void;
  diagnostics(diagnostics: readonly Diagnostic[]): void;
  result(payload: Readonly<Record<string, unknown>>, humanMessage: string): void;
}

const LEVELS: Readonly<Record<CliLogLevel, number>> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export function createReporter(
  level: CliLogLevel,
  json: boolean,
  streams: CliStreams = defaultStreams,
): CliReporter {
  const threshold = LEVELS[level];
  return {
    json,
    log(logLevel, message, context = {}) {
      if (json || LEVELS[logLevel] < threshold) return;
      streams.stderr(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: logLevel,
          scope: 'design-token-pipeline',
          message,
          ...context,
        })}\n`,
      );
    },
    diagnostics(items) {
      if (json) return;
      for (const diagnostic of items) {
        streams.stderr(
          `${JSON.stringify({
            level: diagnostic.severity === 'error' ? 'ERROR' : 'WARN',
            code: diagnostic.code,
            message: diagnostic.message,
            path: diagnostic.path,
            file: diagnostic.file,
            context: diagnostic.context,
          })}\n`,
        );
      }
    },
    result(payload, humanMessage) {
      streams.stdout(`${json ? JSON.stringify(payload) : humanMessage}\n`);
    },
  };
}

const defaultStreams: CliStreams = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
