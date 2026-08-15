export const tokens = {
  "color": {
    "brand": {
      "focus": "#2563eb",
      "primary": "#2563eb",
    },
  },
  "spacing": {
    "sm": "0.5rem",
  },
} as const;

export const flatTokens = {
  "color.brand.focus": "#2563eb",
  "color.brand.primary": "#2563eb",
  "spacing.sm": "0.5rem",
} as const;

export type TokenPath = "color.brand.focus" | "color.brand.primary" | "spacing.sm";
export type TokenName = TokenPath;

export default tokens;
