export const tokens = {
  "color": {
    "brand": {
      "focus": "#2563eb",
      "primary": "#2563eb",
    },
  },
  "fontFamily": {
    "sans": "Inter, system-ui",
  },
  "fontWeight": {
    "medium": 500,
  },
  "opacity": {
    "subdued": 0.72,
  },
  "spacing": {
    "md": "1rem",
    "sm": "0.5rem",
  },
  "transitionDuration": {
    "fast": "150ms",
  },
} as const;

export const flatTokens = {
  "color.brand.focus": "#2563eb",
  "color.brand.primary": "#2563eb",
  "fontFamily.sans": "Inter, system-ui",
  "fontWeight.medium": 500,
  "opacity.subdued": 0.72,
  "spacing.md": "1rem",
  "spacing.sm": "0.5rem",
  "transitionDuration.fast": "150ms",
} as const;

export type TokenPath = "color.brand.focus" | "color.brand.primary" | "fontFamily.sans" | "fontWeight.medium" | "opacity.subdued" | "spacing.md" | "spacing.sm" | "transitionDuration.fast";
export type TokenName = TokenPath;

export default tokens;
