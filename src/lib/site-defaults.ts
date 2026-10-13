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
  /**
   * Gold-family TEXT colour for text sitting on a gold/10 tint. The tint lifts
   * the background toward the text, so this must be DEEPER than gold-deep to
   * hold 4.5:1.
   */
  goldInk: string;
  /**
   * Label colour for a gold-FILLED surface. The gold button face keeps the same
   * value in both themes, so its label stays dark in both — a light label on
   * gold only reaches 3.2:1.
   */
  onGold: string;
  /** Semantic error/danger colour; darker on light, lighter on the dark navy. */
  danger: string;
  plum: string;
  plumLight: string;
  /**
   * Plum-family TEXT colour for text on a plum tint (mirrors goldInk). A tint
   * lifts the background toward the text, so this must be deeper on light and
   * lighter on dark — bare `plum` on a plum tint measured 4.2:1 light / 3.3:1 dark.
   */
  plumInk: string;
  /**
   * Label colour for a plum-FILLED surface. Plum keeps a mid-tone in both modes,
   * so the label stays white in both — `text-white` cannot be used here because
   * that token is remapped to a dark slate in dark mode (2.9:1 on plum).
   */
  onPlum: string;
  foreground: string;
  white: string;
}

export interface SiteTheme {
  light: ThemePalette;
  dark: ThemePalette;
  fonts: { heading: string; body: string };
}

// Light palette — mirrors the @theme block in globals.css. Keep the two in step.
export const LIGHT_THEME: ThemePalette = {
  cream: "#FAF6F0",
  warmSand: "#F0EBE3",
  primary: "#1E4D4F",
  primaryLight: "#2A6B6E",
  gold: "#D97706",
  goldLight: "#E68A00",
  goldDeep: "#B45309",
  goldInk: "#92400E",
  onGold: "#111827",
  danger: "#dc2626",
  plum: "#935B8A",
  plumLight: "#8E5484",
  plumInk: "#7E4B76",
  onPlum: "#FFFFFF",
  foreground: "#111827",
  white: "#FFFFFF",
};

// Dark palette — mirrors the colour tokens that used to sit in the html.dark
// block of globals.css.
//
//   goldDeep/goldInk flip to a LIGHT gold on the dark navy (#E68A00 reaches
//   6.8:1 on #0F172A where gold-deep would manage 3.6:1); goldInk goes lighter
//   still (#F5B84D) because it also has to clear a gold/20 tint.
//   danger flips to the lighter red. onGold/onPlum deliberately do NOT move: the
//   surfaces they label are mid-tones that keep their value in both modes, so a
//   light label on gold would only reach 3.2:1.
//   plumLight is darker than plum here on purpose — it is the hover face of a
//   white label, and a lighter face cannot carry one in either mode.
export const DARK_THEME: ThemePalette = {
  cream: "#0F172A",
  warmSand: "#1E293B",
  primary: "#F1F5F9",
  primaryLight: "#FFFFFF",
  gold: "#D97706",
  goldLight: "#E68A00",
  goldDeep: "#E68A00",
  goldInk: "#F5B84D",
  onGold: "#111827",
  danger: "#f87171",
  plum: "#935B8A",
  plumLight: "#8E5484",
  plumInk: "#C08BB6",
  onPlum: "#FFFFFF",
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
  // The old `--color-text` token was never used by a class; `text_color` now
  // feeds the token that actually renders, so a document that set it still works.
  ["foreground", "text_color"],
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

/* ─── Contrast floor ─────────────────────────────────────────────────
   config/site.theme is editable and Firebase is the source of truth, so an
   admin CAN save a palette whose text does not meet WCAG AA — and one already
   has: the live document carries a dark-mode goldDeep of #B45309, which is
   3.6:1 on the dark navy. The pairs below are the ones the shipped palette was
   audited against (see _webbridge/contrast.py — keep the two lists in step).
   When a pair fails, the FOREGROUND token is replaced by the shipped default
   and the substitution is reported, so the site degrades to readable rather
   than to published-but-illegible.
   ───────────────────────────────────────────────────────────────────── */

/** WCAG AA for normal-size text. */
export const TEXT_MIN_RATIO = 4.5;

/** sRGB relative luminance (WCAG 2.1 definition). */
export function relativeLuminance(hex: string): number {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(full.slice(0, 2), 16) || 0);
  const g = channel(parseInt(full.slice(2, 4), 16) || 0);
  const b = channel(parseInt(full.slice(4, 6), 16) || 0);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `fg` over `bg` at `alpha` (0–1) — e.g. a gold/10 tint over cream. */
export function blend(fg: string, alpha: number, bg: string): string {
  const parse = (hex: string) => {
    const h = hex.trim().replace(/^#/, "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const f = parse(fg);
  const b = parse(bg);
  const mix = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

interface GuardPair {
  /** Token that carries the TEXT. */
  fg: keyof ThemePalette;
  /** What the text sits on, derived from the palette itself. */
  bg: (p: ThemePalette) => string;
  label: string;
  /**
   * Replace THIS token with the shipped value instead of the foreground. For a
   * pair no label colour can fix — a surface lighter than the readable band,
   * e.g. a plum hover face, where both a light and a dark label land under
   * 4.5:1 — the surface is what has to move.
   */
  surface?: keyof ThemePalette;
}

const GUARD_PAIRS: GuardPair[] = [
  { fg: "goldDeep", bg: (p) => p.cream, label: "gold text on the page background" },
  { fg: "goldDeep", bg: (p) => p.white, label: "gold text on a card" },
  // The tint is deliberately the LIGHTEST one the components use (gold/20), so a
  // tinted pill is judged at its worst rather than at the gold/10 default.
  { fg: "goldInk", bg: (p) => blend(p.gold, 0.2, p.cream), label: "gold-ink on a gold tint" },
  { fg: "danger", bg: (p) => p.white, label: "error text on a card" },
  { fg: "onGold", bg: (p) => p.gold, label: "label on a gold button face" },
  { fg: "white", bg: (p) => p.goldDeep, label: "white text on a gold-deep badge" },
  { fg: "plumInk", bg: (p) => blend(p.plum, 0.2, p.cream), label: "plum-ink on a plum tint" },
  { fg: "onPlum", bg: (p) => p.plum, label: "label on a plum button face" },
  {
    fg: "onPlum",
    bg: (p) => p.plumLight,
    surface: "plumLight",
    label: "label on the plum hover face",
  },
];

export interface ContrastFix {
  mode: "light" | "dark";
  token: keyof ThemePalette;
  label: string;
  attempted: string;
  applied: string;
  ratioBefore: number;
  ratioAfter: number;
}

/**
 * Fold a palette back inside the contrast floor.
 *
 * A token is only replaced when its own value fails AND the shipped default
 * passes — if both fail there is nothing better to offer, so the admin's value
 * is kept and no fix is reported. Substitution is measured on a trial palette
 * so the reported ratio is the one that actually ships.
 */
export function enforceContrast(
  palette: ThemePalette,
  shipped: ThemePalette,
  mode: "light" | "dark",
): { palette: ThemePalette; fixes: ContrastFix[] } {
  const out = { ...palette };
  const fixes: ContrastFix[] = [];
  for (const pair of GUARD_PAIRS) {
    const ratioBefore = contrastRatio(out[pair.fg], pair.bg(out));
    if (ratioBefore >= TEXT_MIN_RATIO) continue;
    const target = pair.surface ?? pair.fg;
    const candidate = shipped[target];
    const trial = { ...out, [target]: candidate };
    const ratioAfter = contrastRatio(trial[pair.fg], pair.bg(trial));
    if (ratioAfter < TEXT_MIN_RATIO) continue;
    fixes.push({
      mode,
      token: target,
      label: pair.label,
      attempted: out[target],
      applied: candidate,
      ratioBefore: Math.round(ratioBefore * 100) / 100,
      ratioAfter: Math.round(ratioAfter * 100) / 100,
    });
    out[target] = candidate;
  }
  return { palette: out, fixes };
}

/** Both palettes brought inside the contrast floor, with a report of what moved. */
export function enforceReadableTheme(theme: SiteTheme): { theme: SiteTheme; fixes: ContrastFix[] } {
  const light = enforceContrast(theme.light, LIGHT_THEME, "light");
  const dark = enforceContrast(theme.dark, DARK_THEME, "dark");
  return {
    theme: { ...theme, light: light.palette, dark: dark.palette },
    fixes: [...light.fixes, ...dark.fixes],
  };
}

/** Build the CSS block that applies a theme (light on :root, dark under html.dark). */
export function themeToCss(theme: SiteTheme): string {
  const guarded = enforceReadableTheme(theme).theme;
  const palette = (p: ThemePalette) => [
    `  --color-cream: ${p.cream};`,
    `  --color-warm-sand: ${p.warmSand};`,
    `  --color-primary: ${p.primary};`,
    `  --color-primary-light: ${p.primaryLight};`,
    `  --color-gold: ${p.gold};`,
    `  --color-gold-light: ${p.goldLight};`,
    `  --color-gold-deep: ${p.goldDeep};`,
    `  --color-gold-ink: ${p.goldInk};`,
    `  --color-on-gold: ${p.onGold};`,
    `  --color-danger: ${p.danger};`,
    `  --color-plum: ${p.plum};`,
    `  --color-plum-light: ${p.plumLight};`,
    `  --color-plum-ink: ${p.plumInk};`,
    `  --color-on-plum: ${p.onPlum};`,
    `  --color-foreground: ${p.foreground};`,
    `  --color-white: ${p.white};`,
  ];
  return [
    ":root {",
    ...palette(guarded.light),
    `  --font-display: ${theme.fonts.heading};`,
    `  --font-sans: ${theme.fonts.body};`,
    "}",
    "html.dark {",
    ...palette(guarded.dark),
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
  { key: "goldInk", label: "Gold ink", hint: "Text on a gold tint — needs 4.5:1" },
  { key: "onGold", label: "Label on gold", hint: "Must stay dark in both modes" },
  { key: "danger", label: "Danger", hint: "Errors, destructive actions" },
  { key: "plum", label: "Plum", hint: "Highlights / badges" },
  { key: "plumLight", label: "Plum (hover face)", hint: "Must stay dark enough for a white label" },
  { key: "plumInk", label: "Plum ink", hint: "Text on a plum tint — needs 4.5:1" },
  { key: "onPlum", label: "Label on plum", hint: "Must stay light in both modes" },
  { key: "foreground", label: "Foreground", hint: "Default body text" },
  { key: "white", label: "White", hint: "Text on dark surfaces" },
];
