# Theme Editor — Phase 1

Phase 1 of the **Content & Theme** admin feature. Makes **both light and dark** brand
color palettes and fonts fully editable from the admin, with live preview, persisted
to `config/site`.

## What changed

- **`src/lib/site-defaults.ts`** (new): `ThemePalette` / `SiteTheme` types, the
  `LIGHT_THEME` / `DARK_THEME` / `DEFAULT_FONTS` defaults (mirroring `globals.css`),
  `FONT_OPTIONS`, `THEME_TOKENS`, and the pure helpers `mergeTheme()` (folds
  `config/site.theme` + legacy flat fields over defaults → full palettes),
  `toThemeConfig()`, and `themeToCss()`.
- **`src/context/site-config-context.tsx`**: `SiteConfig` gains `theme: SiteTheme`;
  the provider now **injects data-driven theme CSS** (light tokens on `:root`, dark
  tokens under `html.dark`, plus fonts) via a `#dsh-theme` `<style>` element, so both
  modes are editable and apply live. (Replaces the old inline `--color-*` setters.)
- **`src/app/globals.css`**: removed the hardcoded `html.dark body { --color-* }`
  block (now data-driven); `html.dark body::before` uses `var(--color-cream)`.
  Non-token component overrides (glass-card, nav-dock, announcement-banner, …) stay.
- **`src/components/admin/theme-editor.tsx`** (new): the **Content & Theme → Theme**
  editor — Light/Dark sub-tabs, a color picker + hex input per token, font dropdowns,
  a **live WYSIWYG preview** (injects a `#dsh-theme-edit` style as you type),
  Reset per mode, and **Save** (via `saveSiteConfig` + `useSiteConfigRefresh`).
  Rendered only after `config/site` loads so it initializes from the saved theme.
- **`src/app/admin/page.tsx`**: new **Content & Theme** tab.
- **`src/lib/__tests__/theme.test.ts`** (new): `mergeTheme` + `themeToCss` unit tests.

## Data flow

```
config/site.theme  ──(mergeTheme, over defaults)──▶  config.theme (SiteTheme)
                                                          │
                        SiteConfigProvider injects #dsh-theme style:
                          :root { --color-* (light) } + html.dark { --color-* (dark) }
                                                          │
                        Tailwind utilities (bg-cream, text-gold, …) follow the vars
```

## Editing

Admin → **Content & Theme** tab → choose Light or Dark mode → change a color (the page
re-themes live) → **Save theme**. A token edited in Light applies to light mode; the
same 12 tokens are editable for Dark mode. Fonts are global (both modes).

## Schema (`config/site.theme`)

- `theme.light` / `theme.dark`: 12 tokens each (`cream, warmSand, primary,
  primaryLight, gold, goldLight, goldDeep, plum, plumLight, text, foreground, white`).
- `theme.fonts`: `{ heading, body }`.
- **Backward compatible:** if `theme` is absent, the storefront + editor use the
  defaults (`LIGHT_THEME`/`DARK_THEME`), and the legacy flat fields
  (`primary_color`, `cream_color`, …) are still honored.

## Phase 1 status

✅ Light + dark palettes editable with live preview · ✅ fonts editable · ✅ saved via
`saveSiteConfig` · ✅ applied in both modes · ✅ backward compatible.

**Next (Phase 2):** the page-by-page **copy editor** for all site text (per-page
wireframe diagrams + fields), building on `config/site.content`.
