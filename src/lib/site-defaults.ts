/**
 * Site theme defaults + merge logic.
 *
 * `config/site.theme` is the single source of truth for editable brand colors
 * (light + dark) and fonts. `content.ts`/`globals.css` provide the defaults;
 * `config/site` stores overrides only. mergeTheme() folds any config/site value
 * (including the legacy flat color fields) over the defaults.
 */

export interface ThemePalette {
  cream: string;
  warmSand: string;
  primary: string;
  primaryLight: string;
  gold: string;
  goldLight: string;
  goldDeep: string;
  plum: string;
  plumLight: string;
  text: string;
  foreground: string;
  white: string;
}

export interface SiteTheme {
  light: ThemePalette;
  dark: ThemePalette;
  fonts: { heading: string; body: string };
}

// Light palette — mirrors the :root / @theme values in globals.css.
export const LIGHT_THEME: ThemePalette = {
  cream: "#FAF6F0",
  warmSand: "#F0EBE3",
  primary: "#1E4D4F",
  primaryLight: "#2A6B6E",
  gold: "#D97706",
  goldLight: "#E68A00",
  goldDeep: "#B45309",
  plum: "#935B8A",
  plumLight: "#A86B9F",
  text: "#111827",
  foreground: "#111827",
  white: "#FFFFFF",
};

// Dark palette — mirrors the html.dark body overrides in globals.css.
// gold/plum/text were not overridden in dark mode; keep the light values so the
// current appearance is preserved until edited (text contrast is a later concern).
export const DARK_THEME: ThemePalette = {
  cream: "#0F172A",
  warmSand: "#1E293B",
  primary: "#F1F5F9",
  primaryLight: "#FFFFFF",
  gold: "#D97706",
  goldLight: "#E68A00",
  goldDeep: "#B45309",
  plum: "#935B8A",
  plumLight: "#A86B9F",
  text: "#111827",
  foreground: "#F1F5F9",
  white: "#1E293B",
};

export const DEFAULT_FONTS: SiteTheme["fonts"] = {
  heading: "Georgia, 'Times New Roman', serif",
  body: "system-ui, -apple-system, sans-serif",
};

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Georgia / Times (Serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "System UI (Sans-serif)", value: "system-ui, -apple-system, sans-serif" },
  { label: "Inter / Modern (Sans)", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Lora (Serif)", value: "Lora, Georgia, serif" },
  { label: "Playfair Display (Serif)", value: "'Playfair Display', Georgia, serif" },
];

const LEGACY_LIGHT_MAP: [keyof ThemePalette, string][] = [
  ["primary", "primary_color"],
  ["gold", "accent_color"],
  ["gold", "gold_color"],
  ["plum", "plum_color"],
  ["cream", "background_color"],
  ["cream", "cream_color"],
  ["warmSand", "warm_sand_color"],
  ["text", "text_color"],
];

/** Fold legacy flat config fields (primary_color, accent_color, …) into a palette. */
function applyLegacy(palette: ThemePalette, flat: Record<string, unknown>): ThemePalette {
  const out = { ...palette };
  for (const [token, key] of LEGACY_LIGHT_MAP) {
    if (flat[key]) out[token] = flat[key] as string;
  }
  // If a legacy 'background_color' was set, it maps to cream.
  return out;
}

export interface MergeThemeInput {
  theme?: {
    light?: Partial<ThemePalette>;
    dark?: Partial<ThemePalette>;
    fonts?: Partial<SiteTheme["fonts"]>;
  };
  primary_color?: string;
  accent_color?: string;
  gold_color?: string;
  plum_color?: string;
  background_color?: string;
  cream_color?: string;
  warm_sand_color?: string;
  text_color?: string;
  heading_font?: string;
  body_font?: string;
}

/**
 * Produce the effective { light, dark, fonts } from config/site (or defaults).
 * Backward compatible: reads the new `theme` object, and falls back to the legacy
 * flat color/font fields for anything not set in `theme`. Returns full palettes
 * so callers never deal with partial values.
 */
export function mergeTheme(input: MergeThemeInput | undefined | null): SiteTheme {
  const cfg = input ?? {};
  const theme = cfg.theme ?? {};

  const lightBase = applyLegacy(LIGHT_THEME, cfg as unknown as Record<string, unknown>);
  const light: ThemePalette = { ...lightBase, ...(theme.light ?? {}) };

  const dark: ThemePalette = { ...DARK_THEME, ...(theme.dark ?? {}) };

  const fonts: SiteTheme["fonts"] = {
    heading: theme.fonts?.heading || cfg.heading_font || DEFAULT_FONTS.heading,
    body: theme.fonts?.body || cfg.body_font || DEFAULT_FONTS.body,
  };

  return { light, dark, fonts };
}

/** Serialize a palette + fonts into the shape saved to `config/site.theme`. */
export function toThemeConfig(palettes: { light: ThemePalette; dark: ThemePalette }, fonts: SiteTheme["fonts"]): SiteTheme {
  return { light: { ...palettes.light }, dark: { ...palettes.dark }, fonts: { ...fonts } };
}

/** Build the CSS block that applies a theme (light on :root, dark under html.dark). */
export function themeToCss(theme: SiteTheme): string {
  const palette = (p: ThemePalette) => [
    `  --color-cream: ${p.cream};`,
    `  --color-warm-sand: ${p.warmSand};`,
    `  --color-primary: ${p.primary};`,
    `  --color-primary-light: ${p.primaryLight};`,
    `  --color-gold: ${p.gold};`,
    `  --color-gold-light: ${p.goldLight};`,
    `  --color-gold-deep: ${p.goldDeep};`,
    `  --color-plum: ${p.plum};`,
    `  --color-plum-light: ${p.plumLight};`,
    `  --color-text: ${p.text};`,
    `  --color-foreground: ${p.foreground};`,
    `  --color-white: ${p.white};`,
  ];
  return [
    ":root {",
    ...palette(theme.light),
    `  --font-display: ${theme.fonts.heading};`,
    `  --font-sans: ${theme.fonts.body};`,
    "}",
    "html.dark {",
    ...palette(theme.dark),
    "}",
  ].join("\n");
}

/** The color tokens and their labels, in display order. */
export const THEME_TOKENS: { key: keyof ThemePalette; label: string; hint?: string }[] = [
  { key: "cream", label: "Cream / Background", hint: "Page background" },
  { key: "warmSand", label: "Warm Sand", hint: "Cards & surfaces" },
  { key: "primary", label: "Primary", hint: "Nav, headings (teal)" },
  { key: "primaryLight", label: "Primary (light)" },
  { key: "gold", label: "Gold", hint: "CTAs / buttons" },
  { key: "goldLight", label: "Gold (light)" },
  { key: "goldDeep", label: "Gold (AA text)" },
  { key: "plum", label: "Plum", hint: "Highlights / badges" },
  { key: "plumLight", label: "Plum (light)" },
  { key: "text", label: "Text" },
  { key: "foreground", label: "Foreground" },
  { key: "white", label: "White" },
];
