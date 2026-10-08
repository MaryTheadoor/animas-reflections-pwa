/**
 * Tests for the contrast floor on the editable theme.
 *
 * The failing case is REAL, not hypothetical: the live config/site document
 * carries theme.dark.goldDeep = #B45309, the value the other line's editor
 * shipped as a default. On the dark navy it measures 3.5:1, where the shipped
 * #E68A00 measures 6.8:1. With Firebase as the source of truth, a saved
 * palette must not be able to publish unreadable text.
 */
import { describe, it, expect } from "@jest/globals";
import {
  DARK_THEME,
  LIGHT_THEME,
  blend,
  contrastRatio,
  enforceContrast,
  enforceReadableTheme,
  mergeTheme,
  relativeLuminance,
  themeToCss,
} from "@/lib/site-defaults";

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(Math.round(contrastRatio("#000000", "#FFFFFF"))).toBe(21);
    expect(contrastRatio("#1E4D4F", "#1E4D4F")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#D97706", "#FAF6F0")).toBeCloseTo(contrastRatio("#FAF6F0", "#D97706"), 10);
  });

  it("expands 3-digit shorthand", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#ffffff"), 10);
  });
});

describe("blend", () => {
  it("returns the background at alpha 0 and the foreground at alpha 1", () => {
    expect(blend("#D97706", 0, "#FAF6F0")).toBe("#faf6f0");
    expect(blend("#D97706", 1, "#FAF6F0").toLowerCase()).toBe("#d97706");
  });
});

describe("enforceContrast", () => {
  it("leaves the shipped palettes untouched", () => {
    expect(enforceContrast(LIGHT_THEME, LIGHT_THEME, "light").fixes).toEqual([]);
    expect(enforceContrast(DARK_THEME, DARK_THEME, "dark").fixes).toEqual([]);
  });

  it("replaces the live document's failing dark goldDeep with the shipped value", () => {
    // Exactly what config/site.theme.dark holds today.
    const live = { ...DARK_THEME, goldDeep: "#B45309" };
    const { palette, fixes } = enforceContrast(live, DARK_THEME, "dark");
    expect(palette.goldDeep).toBe("#E68A00");
    expect(fixes).toHaveLength(1);
    expect(fixes[0].token).toBe("goldDeep");
    expect(fixes[0].attempted).toBe("#B45309");
    expect(fixes[0].applied).toBe("#E68A00");
    expect(fixes[0].ratioBefore).toBeLessThan(4.5);
    expect(fixes[0].ratioAfter).toBeGreaterThanOrEqual(4.5);
  });

  it("reports every failing gold token in dark mode at once", () => {
    const live = { ...DARK_THEME, goldDeep: "#B45309", goldInk: "#B45309" };
    const { fixes } = enforceContrast(live, DARK_THEME, "dark");
    expect(fixes.map((f) => f.token).sort()).toEqual(["goldDeep", "goldInk"]);
  });

  it("keeps the attempted value when the shipped default fails too", () => {
    // A black-on-black palette: nothing better is available, so nothing moves.
    const broken = { ...LIGHT_THEME, goldDeep: "#000000", cream: "#000000" };
    const { palette, fixes } = enforceContrast(broken, { ...LIGHT_THEME, goldDeep: "#000000" }, "light");
    expect(palette.goldDeep).toBe("#000000");
    expect(fixes).toEqual([]);
  });

  it("does not move tokens that are not part of a guarded pair", () => {
    const { fixes } = enforceContrast({ ...LIGHT_THEME, plum: "#F0F0F0" }, LIGHT_THEME, "light");
    expect(fixes).toEqual([]);
  });
});

describe("enforceReadableTheme / themeToCss", () => {
  it("reports fixes for both modes", () => {
    const { fixes } = enforceReadableTheme({
      light: { ...LIGHT_THEME, goldDeep: "#FFFFFF" },
      dark: { ...DARK_THEME, goldDeep: "#B45309" },
      fonts: { heading: "Georgia, serif", body: "system-ui" },
    });
    expect(fixes.map((f) => f.mode).sort()).toEqual(["dark", "light"]);
  });

  it("emits the corrected token, not the saved one", () => {
    const css = themeToCss({
      light: LIGHT_THEME,
      dark: { ...DARK_THEME, goldDeep: "#B45309" },
      fonts: { heading: "Georgia, serif", body: "system-ui" },
    });
    // #B45309 is correct in LIGHT mode, so scope the assertion to the dark block.
    const dark = css.slice(css.indexOf("html.dark {"));
    expect(dark).toContain("--color-gold-deep: #E68A00;");
    expect(dark).not.toContain("--color-gold-deep: #B45309;");
  });

  it("emits the accessibility tokens the editor never had to set", () => {
    const css = themeToCss(mergeTheme({}));
    expect(css).toContain(`--color-gold-ink: ${LIGHT_THEME.goldInk};`);
    expect(css).toContain(`--color-on-gold: ${LIGHT_THEME.onGold};`);
    expect(css).toContain(`--color-danger: ${LIGHT_THEME.danger};`);
    expect(css).toContain(`--color-danger: ${DARK_THEME.danger};`);
  });
});
