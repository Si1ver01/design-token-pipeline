import type { PipelineConfig } from './schema.js';

export const DEFAULT_CONFIG: PipelineConfig = Object.freeze({
  input: 'tokens.json',
  outDir: 'generated',
  formats: Object.freeze(['css', 'typescript', 'tailwind'] as const),
  strict: false,
  css: Object.freeze({
    prefix: 'dt',
    selector: ':root',
    filename: 'tokens.css',
    includeDescriptions: false,
  }),
  typescript: Object.freeze({ filename: 'tokens.ts' }),
  tailwind: Object.freeze({
    filename: 'tailwind-theme.ts',
    groups: Object.freeze({}),
    strict: false,
  }),
});
