import type { Diagnostic } from '../diagnostics/types.js';

export type OutputFormat = 'css' | 'typescript' | 'tailwind';

export interface GeneratedArtifact {
  readonly format: OutputFormat;
  readonly filename: string;
  readonly content: string;
  readonly tokenCount: number;
  readonly byteCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CssGeneratorOptions {
  readonly prefix?: string;
  readonly selector?: string;
  readonly filename?: string;
  readonly includeDescriptions?: boolean;
}

export interface TypeScriptGeneratorOptions {
  readonly filename?: string;
}

export interface TailwindGeneratorOptions {
  readonly filename?: string;
  readonly groups?: Readonly<Record<string, string>>;
  readonly strict?: boolean;
}
