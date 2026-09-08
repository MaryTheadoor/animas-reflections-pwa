import { describe, it, expect } from "@jest/globals";
import { mergeTheme, themeToCss, LIGHT_THEME, DARK_THEME, DEFAULT_FONTS } from "@/lib/site-defaults";

describe("mergeTheme", () => {
  it("returns defaults when given nothing", () => {
    const t = mergeTheme({});
    expect(t.light).toEqual(LIGHT_THEME);
    expect(t.dark).toEqual(DARK_THEME);
    expect(t.fonts).toEqual(DEFAULT_FONTS);
  });

  it("overrides only the tokens provided", () => {
    const t = mergeTheme({ theme: { light: { primary: "#000000" } } });
    expect(t.light.primary).toBe("#000000");
    expect(t.light.cream).toBe(LIGHT_THEME.cream); // others keep defaults
    expect(t.dark.cream).toBe(DARK_THEME.cream);
  });

  it("honors dark-mode overrides", () => {
    const t = mergeTheme({ theme: { dark: { cream: "#0b0b0b" } } });
    expect(t.dark.cream).toBe("#0b0b0b");
    expect(t.light.cream).toBe(LIGHT_THEME.cream);
  });

  it("reads legacy flat color fields when theme.light is absent", () => {
    const t = mergeTheme({ primary_color: "#123456", cream_color: "#abcdef" });
    expect(t.light.primary).toBe("#123456");
    expect(t.light.cream).toBe("#abcdef");
  });

  it("prefers new theme.* over legacy flat fields", () => {
    const t = mergeTheme({ primary_color: "#123456", theme: { light: { primary: "#000000" } } });
    expect(t.light.primary).toBe("#000000");
  });

  it("uses legacy/font defaults for fonts", () => {
    const t = mergeTheme({ heading_font: "Custom Font" });
    expect(t.fonts.heading).toBe("Custom Font");
    expect(t.fonts.body).toBe(DEFAULT_FONTS.body);
  });
});

describe("themeToCss", () => {
  it("emits :root (light) and html.dark (dark) blocks", () => {
    const css = themeToCss(mergeTheme({}));
    expect(css).toContain(":root {");
    expect(css).toContain("html.dark {");
    expect(css).toContain(`--color-cream: ${LIGHT_THEME.cream};`);
    expect(css).toContain(`--color-cream: ${DARK_THEME.cream};`);
    expect(css).toContain(`--font-display: ${DEFAULT_FONTS.heading};`);
  });
});
