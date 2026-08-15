export const DEFAULT_TAILWIND_GROUPS: Readonly<Record<string, string>> = Object.freeze({
  color: 'colors',
  colors: 'colors',
  spacing: 'spacing',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  borderRadius: 'borderRadius',
  boxShadow: 'boxShadow',
  transitionDuration: 'transitionDuration',
});

export function resolveTailwindGroups(
  overrides: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
  return Object.freeze({ ...DEFAULT_TAILWIND_GROUPS, ...(overrides ?? {}) });
}
