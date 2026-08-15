import { createDiagnostic } from '../diagnostics/create-diagnostic.js';
import type { Diagnostic, OperationResult } from '../diagnostics/types.js';
import type { OutputFormat } from '../formats/types.js';
import { DEFAULT_CONFIG } from './defaults.js';

export interface PipelineConfig {
  readonly input: string;
  readonly outDir: string;
  readonly formats: readonly OutputFormat[];
  readonly strict: boolean;
  readonly css: {
    readonly prefix: string;
    readonly selector: string;
    readonly filename: string;
    readonly includeDescriptions: boolean;
  };
  readonly typescript: { readonly filename: string };
  readonly tailwind: {
    readonly filename: string;
    readonly groups: Readonly<Record<string, string>>;
    readonly strict: boolean;
  };
}

export interface PipelineOverrides {
  readonly input?: string;
  readonly outDir?: string;
  readonly formats?: readonly OutputFormat[];
  readonly strict?: boolean;
  readonly cssPrefix?: string;
}

type UnknownRecord = Record<string, unknown>;

export function parsePipelineConfig(
  input: unknown,
  overrides: PipelineOverrides = {},
  file = 'design-tokens.config.json',
): OperationResult<PipelineConfig> {
  const diagnostics: Diagnostic[] = [];
  const object = isRecord(input) ? input : {};
  if (!isRecord(input)) {
    diagnostics.push(
      createDiagnostic({
        severity: 'error',
        code: 'config.invalid',
        message: 'Configuration root must be a JSON object.',
        file,
      }),
    );
  }

  reportUnknownKeys(
    object,
    ['input', 'outDir', 'formats', 'strict', 'css', 'typescript', 'tailwind'],
    file,
    diagnostics,
  );

  const inputPath = readString(object.input, DEFAULT_CONFIG.input, 'input', file, diagnostics);
  const outDir = readString(object.outDir, DEFAULT_CONFIG.outDir, 'outDir', file, diagnostics);
  const formats = readFormats(object.formats, file, diagnostics);
  const strict = readBoolean(object.strict, DEFAULT_CONFIG.strict, 'strict', file, diagnostics);
  const css = readCssConfig(object.css, file, diagnostics);
  const typescript = readTypeScriptConfig(object.typescript, file, diagnostics);
  const tailwind = readTailwindConfig(object.tailwind, file, diagnostics);

  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { success: false, diagnostics };
  }

  const mergedFormats = overrides.formats ?? formats;
  if (mergedFormats.length === 0) {
    return {
      success: false,
      diagnostics: [
        ...diagnostics,
        createDiagnostic({
          severity: 'error',
          code: 'config.invalid',
          message: 'At least one output format must be enabled.',
          file,
        }),
      ],
    };
  }

  return {
    success: true,
    value: Object.freeze({
      input: overrides.input ?? inputPath,
      outDir: overrides.outDir ?? outDir,
      formats: Object.freeze([...new Set(mergedFormats)]),
      strict: overrides.strict ?? strict,
      css: Object.freeze({ ...css, prefix: overrides.cssPrefix ?? css.prefix }),
      typescript: Object.freeze(typescript),
      tailwind: Object.freeze({ ...tailwind, strict: overrides.strict ?? tailwind.strict }),
    }),
    diagnostics,
  };
}

function readCssConfig(value: unknown, file: string, diagnostics: Diagnostic[]) {
  const object = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) addInvalid('css', file, diagnostics);
  reportUnknownKeys(
    object,
    ['prefix', 'selector', 'filename', 'includeDescriptions'],
    file,
    diagnostics,
    'css',
  );
  return {
    prefix: readString(object.prefix, DEFAULT_CONFIG.css.prefix, 'css.prefix', file, diagnostics),
    selector: readString(
      object.selector,
      DEFAULT_CONFIG.css.selector,
      'css.selector',
      file,
      diagnostics,
    ),
    filename: readFilename(
      object.filename,
      DEFAULT_CONFIG.css.filename,
      'css.filename',
      file,
      diagnostics,
    ),
    includeDescriptions: readBoolean(
      object.includeDescriptions,
      DEFAULT_CONFIG.css.includeDescriptions,
      'css.includeDescriptions',
      file,
      diagnostics,
    ),
  };
}

function readTypeScriptConfig(value: unknown, file: string, diagnostics: Diagnostic[]) {
  const object = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) addInvalid('typescript', file, diagnostics);
  reportUnknownKeys(object, ['filename'], file, diagnostics, 'typescript');
  return {
    filename: readFilename(
      object.filename,
      DEFAULT_CONFIG.typescript.filename,
      'typescript.filename',
      file,
      diagnostics,
    ),
  };
}

function readTailwindConfig(value: unknown, file: string, diagnostics: Diagnostic[]) {
  const object = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) addInvalid('tailwind', file, diagnostics);
  reportUnknownKeys(object, ['filename', 'groups', 'strict'], file, diagnostics, 'tailwind');
  const groups = readGroupMapping(object.groups, file, diagnostics);
  return {
    filename: readFilename(
      object.filename,
      DEFAULT_CONFIG.tailwind.filename,
      'tailwind.filename',
      file,
      diagnostics,
    ),
    groups,
    strict: readBoolean(
      object.strict,
      DEFAULT_CONFIG.tailwind.strict,
      'tailwind.strict',
      file,
      diagnostics,
    ),
  };
}

function readGroupMapping(
  value: unknown,
  file: string,
  diagnostics: Diagnostic[],
): Readonly<Record<string, string>> {
  if (value === undefined) return DEFAULT_CONFIG.tailwind.groups;
  if (!isRecord(value)) {
    addInvalid('tailwind.groups', file, diagnostics);
    return {};
  }
  const result: Record<string, string> = Object.create(null);
  for (const [source, target] of Object.entries(value).sort(([left], [right]) =>
    compareText(left, right),
  )) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(source) ||
      typeof target !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]*$/.test(target)
    ) {
      addInvalid(`tailwind.groups.${source}`, file, diagnostics);
      continue;
    }
    if (['__proto__', 'prototype', 'constructor'].includes(source)) {
      addInvalid(`tailwind.groups.${source}`, file, diagnostics);
      continue;
    }
    result[source] = target;
  }
  return Object.freeze(result);
}

function readFormats(
  value: unknown,
  file: string,
  diagnostics: Diagnostic[],
): readonly OutputFormat[] {
  if (value === undefined) return DEFAULT_CONFIG.formats;
  if (!Array.isArray(value)) {
    addInvalid('formats', file, diagnostics);
    return DEFAULT_CONFIG.formats;
  }
  const result: OutputFormat[] = [];
  for (const item of value) {
    if (item === 'css' || item === 'typescript' || item === 'tailwind') result.push(item);
    else addInvalid('formats', file, diagnostics);
  }
  return Object.freeze(result);
}

function readFilename(
  value: unknown,
  fallback: string,
  key: string,
  file: string,
  diagnostics: Diagnostic[],
): string {
  const filename = readString(value, fallback, key, file, diagnostics);
  if (filename === '.' || filename === '..' || filename.includes('/') || filename.includes('\\')) {
    addInvalid(key, file, diagnostics);
    return fallback;
  }
  return filename;
}

function readString(
  value: unknown,
  fallback: string,
  key: string,
  file: string,
  diagnostics: Diagnostic[],
): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length === 0 || hasControlCharacter(value)) {
    addInvalid(key, file, diagnostics);
    return fallback;
  }
  return value;
}

function readBoolean(
  value: unknown,
  fallback: boolean,
  key: string,
  file: string,
  diagnostics: Diagnostic[],
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    addInvalid(key, file, diagnostics);
    return fallback;
  }
  return value;
}

function reportUnknownKeys(
  object: UnknownRecord,
  allowed: readonly string[],
  file: string,
  diagnostics: Diagnostic[],
  prefix = '',
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      diagnostics.push(
        createDiagnostic({
          severity: 'error',
          code: 'config.invalid',
          message: 'Unknown configuration property.',
          path: prefix ? `${prefix}.${key}` : key,
          file,
        }),
      );
    }
  }
}

function addInvalid(key: string, file: string, diagnostics: Diagnostic[]): void {
  diagnostics.push(
    createDiagnostic({
      severity: 'error',
      code: 'config.invalid',
      message: 'Configuration value is invalid.',
      path: key,
      file,
    }),
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
