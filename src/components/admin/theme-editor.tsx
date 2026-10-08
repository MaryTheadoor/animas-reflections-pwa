"use client";

import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useSiteConfig, useSiteConfigRefresh } from "@/hooks/useSiteConfig";
import {
  LIGHT_THEME,
  DARK_THEME,
  FONT_OPTIONS,
  THEME_TOKENS,
  enforceReadableTheme,
  themeToCss,
  toThemeConfig,
  type ThemePalette,
} from "@/lib/site-defaults";

export default function ThemeEditor() {
  const config = useSiteConfig();
  const refresh = useSiteConfigRefresh();

  const [mode, setMode] = useState<"light" | "dark">("light");
  const [light, setLight] = useState<ThemePalette>(config.theme.light);
  const [dark, setDark] = useState<ThemePalette>(config.theme.dark);
  const [fonts, setFonts] = useState(config.theme.fonts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Live WYSIWYG: apply the working theme to the page so edits preview instantly.
  useEffect(() => {
    let el = document.getElementById("dsh-theme-edit") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "dsh-theme-edit";
      document.head.appendChild(el);
    }
    el.textContent = themeToCss({ light, dark, fonts });
    return () => { el.textContent = ""; };
  }, [light, dark, fonts]);

  const palette = mode === "light" ? light : dark;
  const setToken = (key: keyof ThemePalette, value: string) => {
    if (mode === "light") setLight({ ...light, [key]: value });
    else setDark({ ...dark, [key]: value });
  };
  // What the contrast floor will actually publish. A token whose value cannot be
  // read is replaced by the shipped one, so say so rather than letting the admin
  // wonder why their hex had no effect.
  const contrastFixes = useMemo(
    () => enforceReadableTheme({ light, dark, fonts }).fixes,
    [light, dark, fonts],
  );
  const resetMode = () => {
    if (mode === "light") setLight({ ...LIGHT_THEME });
    else setDark({ ...DARK_THEME });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const callable = httpsCallable(functions, "saveSiteConfig");
      await callable({ theme: toThemeConfig({ light, dark }, fonts) } as unknown as Record<string, unknown>);
      refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold font-display mb-1">Theme</h2>
          <p className="text-sm text-foreground/70">
            Edit colors + fonts for light and dark mode. Edits preview live; Save applies them site-wide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetMode}
            className="px-3 py-2 rounded-xl text-xs font-medium text-primary border border-primary/20 hover:border-primary/40 transition-colors"
          >
            Reset {mode}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gold text-on-gold hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save theme"}
          </button>
        </div>
      </div>

      {saved && <p className="text-sm text-green-700">Saved! The theme is now live.</p>}

      {contrastFixes.length > 0 && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            {contrastFixes.length === 1 ? "One colour is" : `${contrastFixes.length} colours are`} below
            the WCAG AA contrast floor and {contrastFixes.length === 1 ? "is" : "are"} being published at
            the readable default instead:
          </p>
          <ul className="text-xs text-foreground space-y-1">
            {contrastFixes.map((f) => (
              <li key={`${f.mode}-${f.token}`}>
                <strong className="font-medium">{f.mode} mode</strong> — {f.label}:{" "}
                <code className="font-mono">{f.attempted}</code> ({f.ratioBefore}:1) →{" "}
                <code className="font-mono">{f.applied}</code> ({f.ratioAfter}:1)
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-foreground/70">
            Pick a darker/lighter value to keep your own colour, or leave it and the default is used.
          </p>
        </div>
      )}

      {/* Light / Dark toggle */}
      <div className="inline-flex rounded-xl bg-warm-sand/50 p-1 gap-1">
        {(["light", "dark"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m ? "bg-primary text-white" : "text-foreground hover:bg-warm-sand"
            }`}
          >
            {m === "light" ? "Light mode" : "Dark mode"}
          </button>
        ))}
      </div>

      {/* Color tokens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {THEME_TOKENS.map((t) => (
          <div key={t.key} className="bg-warm-sand/30 rounded-xl p-3 space-y-2">
            <label className="text-xs font-medium text-primary flex items-center gap-1.5">
              {t.label}
              {t.hint && <span className="text-[10px] text-foreground/70 normal-case font-normal">— {t.hint}</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={palette[t.key]}
                onChange={(e) => setToken(t.key, e.target.value)}
                className="w-9 h-9 rounded-lg border border-primary/20 cursor-pointer hover:border-gold transition-colors shrink-0"
              />
              <input
                type="text"
                value={palette[t.key]}
                onChange={(e) => setToken(t.key, e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-primary/20 font-mono text-xs focus:border-gold outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Fonts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-primary block mb-2">Heading font</label>
          <select
            value={fonts.heading}
            onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-primary block mb-2">Body font</label>
          <select
            value={fonts.body}
            onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
