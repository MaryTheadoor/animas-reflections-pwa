"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteField, doc, getDoc, setDoc, type FieldValue } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { stripUndefined } from "@/lib/firestore-utils";
import { PAGE_SEO, SITE_URL, clip, pageTitle } from "@/lib/seo";
import {
  DESCRIPTION_MAX,
  SEO_CONFIG_DOC,
  TITLE_MAX,
  isReservedSlug,
  normalizeSeoConfig,
  slugifyKeyword,
  type KeywordPage,
  type SeoConfig,
} from "@/lib/seo-config";

/* ─── Admin → SEO ─────────────────────────────────────────────────────
   Two jobs for one non-developer:

     1. Page metadata — title/description overrides for every indexable
        route in PAGE_SEO. The committed defaults are shown as placeholder
        text, so a BLANK FIELD MEANS "use the default", never "publish an
        empty title". The live counters exist because the last batch of
        defects was titles over {TITLE_MAX} and descriptions over
        {DESCRIPTION_MAX} — the counters count the text that will actually
        ship, and turn amber near the limit and red past it.

     2. Keyword landing pages — the compact-keywords convention: one
        bottom-of-funnel phrase, one real URL, listed in sitemap.xml.

   Everything is stored in the single Firestore doc config/seo and read at
   BUILD time (src/lib/seo.ts), because this site is a static export and
   social scrapers never run JavaScript. Nothing here is live until the
   publish step (Section 3) rebuilds the site.

   Write path: setDoc(config/seo, stripUndefined({ pages, keywords,
   updatedAt, updatedBy }), { merge: true }). Firestore rejects undefined,
   so stripUndefined is mandatory, not decorative.
   ────────────────────────────────────────────────────────────────────── */

const THIN_CONTENT_WORDS = 150;
const NEAR_LIMIT = 10;

interface PageDraft {
  title: string;
  description: string;
}

interface KeywordDraft {
  /** Client-only React key so deleting a row cannot steal another row's input state. Never written to Firestore. */
  id: string;
  keyword: string;
  slug: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  title: string;
  description: string;
  published: boolean;
  /**
   * Hub display order. Not editable here, but it MUST round-trip: keywords are
   * written as an array, and Firestore replaces arrays wholesale, so dropping
   * it would silently reshuffle the /services/ hub on every unrelated save.
   */
  order?: number;
}

interface Drafts {
  pages: Record<string, PageDraft>;
  keywords: KeywordDraft[];
}

interface PublishResult {
  success?: boolean;
  configured?: boolean;
  message?: string;
}

type PublishStatus = "idle" | "pending" | "success" | "failed";

const INDEXABLE_PAGES = PAGE_SEO.filter((p) => p.indexable);
const BLANK_PAGE: PageDraft = { title: "", description: "" };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "k" + Math.random().toString(36).slice(2);
}

function draftsFrom(config: SeoConfig): Drafts {
  const pages: Record<string, PageDraft> = {};
  for (const [path, override] of Object.entries(config.pages ?? {})) {
    pages[path] = { title: override.title ?? "", description: override.description ?? "" };
  }
  const keywords: KeywordDraft[] = (config.keywords ?? []).map((k) => ({
    id: newId(),
    keyword: k.keyword,
    slug: k.slug,
    headline: k.headline ?? "",
    body: k.body ?? "",
    ctaLabel: k.ctaLabel ?? "",
    ctaHref: k.ctaHref ?? "",
    title: k.title ?? "",
    description: k.description ?? "",
    published: k.published,
    order: k.order,
  }));
  return { pages, keywords };
}

/** Stable serialization of the editable content, ignoring client-only ids. */
function fingerprint(drafts: Drafts): string {
  return JSON.stringify({
    pages: drafts.pages,
    keywords: drafts.keywords.map((k) => ({
      keyword: k.keyword,
      slug: k.slug,
      headline: k.headline,
      body: k.body,
      ctaLabel: k.ctaLabel,
      ctaHref: k.ctaHref,
      title: k.title,
      description: k.description,
      published: k.published,
      order: k.order,
    })),
  });
}

function emptyKeyword(): KeywordDraft {
  return {
    id: newId(),
    keyword: "",
    slug: "",
    headline: "",
    body: "",
    ctaLabel: "",
    ctaHref: "",
    title: "",
    description: "",
    published: false,
  };
}

/** The slug the build will actually emit: blank means "derive from the keyword". */
function effectiveSlug(k: KeywordDraft): string {
  return k.slug.trim() ? slugifyKeyword(k.slug) : slugifyKeyword(k.keyword);
}

/**
 * The title that will actually ship for a page: metadataFor() runs the override
 * (or the committed default) through pageTitle(), which appends the brand and
 * clamps the whole thing to TITLE_MAX. Counting the raw override would show
 * green while the published title is silently cut off.
 */
function emittedTitleFor(override: string, committed: string): string {
  return pageTitle(override.trim() || committed);
}

/**
 * True when clip() had to cut the string and appended its ellipsis. The result
 * is exactly TITLE_MAX characters long, so a bare length check cannot tell a
 * trimmed title from one that happens to fit.
 */
function wasClipped(emitted: string, source: string): boolean {
  return emitted.endsWith("\u2026") && !source.trim().endsWith("\u2026");
}

/** The meta title a keyword page will ship: the override wins, else the headline. */
function emittedKeywordTitle(k: KeywordDraft): string {
  return k.title.trim() ? pageTitle(k.title.trim()) : "";
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function meterClass(len: number, max: number): string {
  if (len > max) return "text-danger font-semibold";
  if (len > max - NEAR_LIMIT) return "text-amber-600 font-medium";
  return "text-foreground/70";
}

function bannerClass(kind: "ok" | "error" | "info"): string {
  if (kind === "ok") return "bg-green-50 border-green-200 text-green-700";
  if (kind === "error") return "bg-red-50 border-red-200 text-red-600";
  return "bg-warm-sand/40 border-warm-sand text-foreground";
}

const FIELD_CLASS =
  "w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm";
/** Same fields as FIELD_CLASS, but visibly wrong — used when a slug is unusable. */
const FIELD_ERROR_CLASS =
  "w-full px-3 py-2 rounded-xl border border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm";
const LABEL_CLASS = "text-xs font-medium text-primary";
const HINT_CLASS = "text-[11px] text-foreground/70 mt-1";
const CHIP_CLASS =
  "text-[10px] rounded-full px-2 py-0.5 border border-warm-sand bg-white text-foreground/70";

function Counter({ len, max, clipped = false }: { len: number; max: number; clipped?: boolean }) {
  return (
    <span className={"text-xs tabular-nums " + (clipped ? "text-danger font-semibold" : meterClass(len, max))}>
      {len} / {max} characters{clipped ? " — cut off" : ""}
    </span>
  );
}

export default function SeoManager() {
  const { user } = useAuth();

  const [drafts, setDrafts] = useState<Drafts>({ pages: {}, keywords: [] });
  const [snapshot, setSnapshot] = useState<string>(() => fingerprint({ pages: {}, keywords: [] }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedBy, setSavedBy] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishMessage, setPublishMessage] = useState("");
  const [publishNeedsToken, setPublishNeedsToken] = useState(false);
  // The GitHub token is only ever held in this input while it is being typed.
  // It is not persisted to state after a save, never rendered back, never logged.
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setLoadError(null);
    try {
      const snap = await getDoc(doc(db, "config", SEO_CONFIG_DOC));
      const config = normalizeSeoConfig(snap.exists() ? snap.data() : null);
      const next = draftsFrom(config);
      setDrafts(next);
      setSnapshot(fingerprint(next));
      setSavedBy(config.updatedBy && config.updatedBy.trim() ? config.updatedBy : null);
      setSavedAt(config.updatedAt ?? null);
    } catch (err) {
      console.error("SEO config load failed", err);
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred through setTimeout (same pattern as the dashboard config load)
    // so the fetch does not set state synchronously inside the effect body.
    const t = setTimeout(() => {
      void load(true);
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const dirty = useMemo(() => fingerprint(drafts) !== snapshot, [drafts, snapshot]);

  const overCount = useMemo(() => {
    let count = 0;
    for (const page of INDEXABLE_PAGES) {
      const draft = drafts.pages[page.path] ?? BLANK_PAGE;
      // The title is measured AFTER pageTitle() adds the brand and clamps it.
      const title = emittedTitleFor(draft.title, page.title);
      if (title.length > TITLE_MAX || wasClipped(title, draft.title || page.title)) count++;
      if ((draft.description.trim() || page.description).length > DESCRIPTION_MAX) count++;
    }
    for (const k of drafts.keywords) {
      const title = emittedKeywordTitle(k);
      if (title && (title.length > TITLE_MAX || wasClipped(title, k.title))) count++;
      if (k.description.trim().length > DESCRIPTION_MAX) count++;
    }
    return count;
  }, [drafts]);

  /* ── Page metadata edits ── */

  const setPageField = (path: string, field: "title" | "description", value: string) => {
    setSaveMessage(null);
    setDrafts((prev) => ({
      ...prev,
      pages: { ...prev.pages, [path]: { ...BLANK_PAGE, ...prev.pages[path], [field]: value } },
    }));
  };

  const resetPage = (path: string) => {
    setSaveMessage(null);
    setDrafts((prev) => ({ ...prev, pages: { ...prev.pages, [path]: { ...BLANK_PAGE } } }));
  };

  /* ── Keyword edits ── */

  const addKeyword = () => {
    setSaveMessage(null);
    setDrafts((prev) => ({ ...prev, keywords: [...prev.keywords, emptyKeyword()] }));
  };

  const removeKeyword = (id: string) => {
    if (!confirm("Delete this keyword page? The copy is only removed from the CMS after you save.")) return;
    setSaveMessage(null);
    setDrafts((prev) => ({ ...prev, keywords: prev.keywords.filter((k) => k.id !== id) }));
  };

  const updateKeyword = (id: string, patch: Partial<KeywordDraft>) => {
    setSaveMessage(null);
    setDrafts((prev) => ({
      ...prev,
      keywords: prev.keywords.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    }));
  };

  /**
   * Typing in the keyword field re-derives the slug live, but only while the
   * slug is still in sync with the old keyword. Once the editor types their own
   * slug it is left alone. A blank slug means "keep deriving".
   */
  const changeKeywordText = (k: KeywordDraft, value: string) => {
    const slugInSync = k.slug.trim() === "" || slugifyKeyword(k.slug) === slugifyKeyword(k.keyword);
    updateKeyword(k.id, { keyword: value, slug: slugInSync ? "" : k.slug });
  };

  /* ── Save ── */

  const save = async () => {
    const blankRow = drafts.keywords.findIndex((k) => !k.keyword.trim());
    if (blankRow >= 0) {
      setSaveMessage({
        kind: "error",
        text:
          "Keyword page #" +
          (blankRow + 1) +
          " has no keyword, so it would be dropped on save. Give it a keyword or delete the row.",
      });
      return;
    }

    const firstSeen = new Map<string, number>();
    for (let i = 0; i < drafts.keywords.length; i++) {
      const slug = effectiveSlug(drafts.keywords[i]);
      if (!slug) {
        setSaveMessage({ kind: "error", text: "Keyword page #" + (i + 1) + " does not produce a usable URL slug." });
        return;
      }
      // A reserved slug is dropped by normalizeSeoConfig() on the way back in,
      // so the page would vanish from the site with no explanation. Refuse the
      // save instead of losing it.
      if (isReservedSlug(slug)) {
        setSaveMessage({
          kind: "error",
          text:
            "Keyword page #" +
            (i + 1) +
            " uses /" +
            slug +
            "/, which already belongs to a page on the site. That page would never render — pick a different slug.",
        });
        return;
      }
      // A PUBLISHED page with no body is a thin page whose meta description
      // would fall back to a generic sentence. Refuse it rather than shipping
      // that, but leave unpublished drafts free to be empty while they are
      // being written.
      if (drafts.keywords[i].published && !drafts.keywords[i].body.trim()) {
        setSaveMessage({
          kind: "error",
          text:
            "Keyword page #" +
            (i + 1) +
            " is published but has no body copy. Write the page copy, or untick Published to keep it as a draft.",
        });
        return;
      }
      const seenAt = firstSeen.get(slug);
      if (seenAt !== undefined) {
        setSaveMessage({
          kind: "error",
          text:
            "Keyword pages #" +
            (seenAt + 1) +
            " and #" +
            (i + 1) +
            " would both publish at /" +
            slug +
            "/ — two pages cannot share one URL. Change one of the slugs.",
        });
        return;
      }
      firstSeen.set(slug, i);
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      // PRESERVE WHAT THIS TAB DOES NOT EDIT.
      //
      //  • Every route already in config/seo is carried through, not just the
      //    indexable PAGE_SEO routes listed above — an unrelated save must never
      //    delete an override for a utility route such as /checkout/.
      //  • A field the admin cleared is REMOVED explicitly with deleteField().
      //    setDoc(merge: true) merges nested maps, so merely omitting a field
      //    would leave the old override in Firestore and "Reset to default"
      //    would silently do nothing.
      type PageWrite = { title?: string | FieldValue; description?: string | FieldValue };
      const pages: Record<string, PageWrite> = {};
      const blankFields: Array<[string, "title" | "description"]> = [];
      for (const [path, draft] of Object.entries(drafts.pages)) {
        const entry: PageWrite = {};
        if (draft.title.trim()) entry.title = draft.title.trim();
        else blankFields.push([path, "title"]);
        if (draft.description.trim()) entry.description = draft.description.trim();
        else blankFields.push([path, "description"]);
        pages[path] = entry;
      }

      const keywords: KeywordPage[] = drafts.keywords.map((k) => {
        const entry: KeywordPage = {
          slug: effectiveSlug(k),
          keyword: k.keyword.trim(),
          body: k.body,
          published: k.published,
        };
        if (k.headline.trim()) entry.headline = k.headline.trim();
        if (k.ctaLabel.trim()) entry.ctaLabel = k.ctaLabel.trim();
        if (k.ctaHref.trim()) entry.ctaHref = k.ctaHref.trim();
        if (k.title.trim()) entry.title = k.title.trim();
        if (k.description.trim()) entry.description = k.description.trim();
        // Hub order is not editable here but must survive: keywords are written
        // as an array and Firestore replaces arrays wholesale.
        if (k.order !== undefined) entry.order = k.order;
        return entry;
      });

      // stripUndefined is required: the optional fields above are undefined on
      // most rows and the Firestore SDK rejects the whole document otherwise.
      const payload = stripUndefined({
        pages,
        keywords,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email ?? "",
      });

      // The deleteField() sentinels are injected AFTER stripUndefined: it
      // rebuilds every object it walks, which would flatten the sentinel into
      // an empty object and store garbage instead of deleting the field.
      for (const [path, field] of blankFields) {
        if (Object.keys(payload.pages[path] ?? {}).length === 0) {
          // Nothing is left for this route, so drop the entry itself rather
          // than leaving an empty map in the document.
          (payload.pages as Record<string, PageWrite | FieldValue>)[path] = deleteField();
          continue;
        }
        const entry = payload.pages[path] ?? {};
        if (field === "title") entry.title = deleteField();
        else entry.description = deleteField();
        payload.pages[path] = entry;
      }

      await setDoc(doc(db, "config", SEO_CONFIG_DOC), payload, { merge: true });

      // Re-read so the form shows exactly what the server stored.
      await load(false);
      setSaveMessage({
        kind: "ok",
        text: "Saved. The copy is in Firestore — run Publish to rebuild the site and make it live.",
      });
      setSaving(false);
    } catch (err) {
      console.error("SEO config save failed", err);
      setSaving(false);
      setSaveMessage({
        kind: "error",
        text: "Save failed: " + (err instanceof Error ? err.message : "unknown error"),
      });
    }
  };

  /* ── Publish ── */

  const publish = async () => {
    setPublishStatus("pending");
    setPublishMessage("");
    setPublishNeedsToken(false);
    try {
      const call = httpsCallable<Record<string, never>, PublishResult>(functions, "publishSite");
      const res = await call({});
      const data = res.data ?? {};
      setPublishMessage(data.message ?? "");
      if (data.success) {
        setPublishStatus("success");
        if (!data.message) setPublishMessage("Rebuild started. The site updates in a minute or two.");
      } else {
        setPublishStatus("failed");
        setPublishNeedsToken(data.configured === false);
        if (!data.message) setPublishMessage("The publish function reported a failure.");
      }
    } catch (err) {
      console.error("Publish failed", err);
      setPublishStatus("failed");
      setPublishMessage(err instanceof Error ? err.message : "Publish failed.");
    }
  };

  /**
   * savePublishToken stores the fine-grained GitHub PAT that publishSite uses to
   * dispatch .github/workflows/rebuild.yml. Without it publishSite always
   * answers configured:false, so the Publish button can never work.
   *
   * The token is handed straight to the callable and never kept: it is not put
   * back into state after a successful save, never logged (note the deliberate
   * absence of console.error here - the message is shown in the UI instead),
   * and Firestore rules deny every client read and write on secrets/{docId},
   * so it cannot be read back out either.
   */
  const saveToken = async () => {
    const token = tokenInput.trim();
    if (!token) {
      setTokenMessage({ kind: "error", text: "Paste the GitHub token first." });
      return;
    }
    setTokenSaving(true);
    setTokenMessage(null);
    try {
      const call = httpsCallable<{ token: string }, { success?: boolean }>(functions, "savePublishToken");
      const res = await call({ token });
      if (res.data && res.data.success) {
        // Clear the field: the value now lives server-side only.
        setTokenInput("");
        setTokenMessage({
          kind: "ok",
          text: "Token saved. Publish site now starts the rebuild workflow, so a developer is not needed.",
        });
        // The last publish said "no token configured" - that is no longer true.
        setPublishNeedsToken(false);
        setPublishStatus("idle");
        setPublishMessage("");
      } else {
        setTokenMessage({
          kind: "error",
          text: "The server did not confirm the save, so nothing was stored. Try again.",
        });
      }
    } catch (err) {
      // HttpsError messages from savePublishToken are written for the admin.
      setTokenMessage({
        kind: "error",
        text: err instanceof Error && err.message ? err.message : "Could not save the token.",
      });
    } finally {
      setTokenSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex gap-3">
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold font-display">SEO</h2>
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
          Could not load SEO settings: {loadError}
          <p className="mt-1 text-xs">
            That is usually a Firestore rules denial or an offline connection. Nothing has been changed.
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold font-display mb-1">SEO</h2>
        <p className="text-sm text-foreground/80 max-w-2xl">
          Search titles, meta descriptions and keyword landing pages for the whole site. Defaults come from the
          code; anything you set here overrides them.
        </p>
      </div>

      {/* ── Unsaved-changes state ── */}
      <div
        className={
          "flex items-center justify-between gap-3 flex-wrap rounded-xl border p-3 " +
          (dirty ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")
        }
      >
        <div className="text-sm">
          {dirty ? (
            <span className="text-amber-800 font-medium">
              Unsaved changes — nothing has been written to Firestore yet.
            </span>
          ) : (
            <span className="text-green-700 font-medium">
              All changes saved
              {savedBy ? " by " + savedBy : ""}
              {savedAt ? " on " + formatWhen(savedAt) : ""}.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!dirty && (
            <button
              onClick={() => void load(true)}
              className="text-xs text-foreground/70 hover:text-primary transition-colors"
            >
              Reload from server
            </button>
          )}
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-gold text-on-gold rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className={"rounded-xl border p-3 text-sm " + bannerClass(saveMessage.kind)}>{saveMessage.text}</div>
      )}

      {/* ── Section 1: page metadata ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-bold font-display text-lg">Page metadata</h3>
            <p className="text-sm text-foreground/80 max-w-2xl">
              Titles and descriptions for every page a search engine should index. Utility pages (search, checkout,
              account, admin) are omitted on purpose — they are marked noindex.
            </p>
          </div>
          <span
            className={
              "rounded-full px-3 py-1 text-xs font-medium border " +
              (overCount > 0
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-green-50 border-green-200 text-green-700")
            }
          >
            {overCount > 0 ? overCount + " field(s) over the limit" : "Everything within limits"}
          </span>
        </div>

        <p className="text-xs text-foreground/80 bg-warm-sand/40 border border-warm-sand rounded-xl p-3">
          <strong>Blank means default.</strong> Leave a field empty and the committed default — the grey placeholder
          — is used. A blank field never publishes an empty title or description, so clearing a field is safe; use
          Reset to default to drop an override entirely.
        </p>

        <div className="space-y-3">
          {INDEXABLE_PAGES.map((page) => {
            const draft = drafts.pages[page.path] ?? BLANK_PAGE;
            const titleText = draft.title.trim() || page.title;
            const descriptionText = draft.description.trim() || page.description;
            // pageTitle() appends " | Animas Reflections" and clamps the whole
            // result, so this - not the raw override - is what search shows.
            const emittedTitle = pageTitle(titleText);
            const titleClipped = wasClipped(emittedTitle, titleText);
            const emittedDescription = clip(descriptionText, DESCRIPTION_MAX);
            const overridden = Boolean(draft.title.trim() || draft.description.trim());
            return (
              <div key={page.path} className="border border-warm-sand rounded-xl p-4 bg-warm-sand/20">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono bg-white rounded px-2 py-1 border border-warm-sand">
                      {page.path}
                    </code>
                    <span className={CHIP_CLASS}>{overridden ? "custom copy" : "using defaults"}</span>
                  </div>
                  <button
                    onClick={() => resetPage(page.path)}
                    disabled={!overridden}
                    className="text-xs text-foreground/70 hover:text-primary disabled:opacity-40 transition-colors"
                  >
                    Reset to default
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <label className={LABEL_CLASS}>
                        Title
                        {!draft.title.trim() && <span className="ml-2 font-normal text-foreground/60">using default</span>}
                      </label>
                      <Counter len={emittedTitle.length} max={TITLE_MAX} clipped={titleClipped} />
                    </div>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setPageField(page.path, "title", e.target.value)}
                      placeholder={page.title}
                      className={FIELD_CLASS}
                    />
                    <p className={titleClipped || emittedTitle.length > TITLE_MAX ? "text-[11px] text-danger mt-1" : HINT_CLASS}>
                      {titleClipped || emittedTitle.length > TITLE_MAX
                        ? "Too long — the brand suffix pushes it past " +
                          TITLE_MAX +
                          " characters and it is cut off in search results. Shorten it. Publishes as "
                        : "Publishes as "}
                      <span className="font-mono">{emittedTitle}</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <label className={LABEL_CLASS}>
                        Description
                        {!draft.description.trim() && (
                          <span className="ml-2 font-normal text-foreground/60">using default</span>
                        )}
                      </label>
                      <Counter len={descriptionText.length} max={DESCRIPTION_MAX} />
                    </div>
                    <textarea
                      rows={3}
                      value={draft.description}
                      onChange={(e) => setPageField(page.path, "description", e.target.value)}
                      placeholder={page.description}
                      className={FIELD_CLASS + " resize-y"}
                    />
                    <p className={HINT_CLASS}>
                      {descriptionText.length > DESCRIPTION_MAX
                        ? "Too long — the build trims it at " + DESCRIPTION_MAX + " characters. Publishes as "
                        : "Publishes as "}
                      <span className="font-mono">{emittedDescription}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: keyword landing pages ── */}
      <section className="space-y-4 border-t border-warm-sand pt-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-bold font-display text-lg">Keyword landing pages</h3>
            <p className="text-sm text-foreground/80 max-w-2xl">
              One page per search phrase a customer would actually type. Each published entry becomes a real page at
              its own URL and is listed in sitemap.xml; unpublished entries stay here but emit nothing.
            </p>
          </div>
          <button
            onClick={addKeyword}
            className="px-4 py-2 bg-gold text-on-gold rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            + Add keyword page
          </button>
        </div>

        {drafts.keywords.length === 0 ? (
          <p className="text-sm text-foreground/80 text-center py-8 border border-dashed border-warm-sand rounded-xl">
            No keyword pages yet. Add one to build a landing page around a specific search phrase.
          </p>
        ) : (
          <div className="space-y-4">
            {drafts.keywords.map((k, index) => {
              const slug = effectiveSlug(k);
              const slugChanged = Boolean(k.slug.trim()) && slugifyKeyword(k.slug) !== k.slug;
              // A reserved slug is shadowed by a real top-level route or a build
              // artifact, so the page would never render even though it is still
              // listed in sitemap.xml. normalizeSeoConfig() drops it on the way
              // back in, so warn here rather than silently losing the page.
              const reserved = slug !== "" && isReservedSlug(slug);
              const takenBy = drafts.keywords.findIndex(
                (other) => other.id !== k.id && slug !== "" && effectiveSlug(other) === slug
              );
              const words = wordCount(k.body);
              const url = SITE_URL + "/" + slug + "/";
              // keywordMetadata() runs the override through pageTitle() too, so
              // the counter has to measure that string, not the raw override.
              const keywordTitle = emittedKeywordTitle(k);
              const keywordTitleClipped = keywordTitle !== "" && wasClipped(keywordTitle, k.title);
              return (
                <div key={k.id} className="border border-warm-sand rounded-xl p-4 bg-warm-sand/20 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground/70">#{index + 1}</span>
                      <span className="font-medium text-sm">{k.keyword.trim() || "Untitled keyword page"}</span>
                      <span
                        className={
                          "text-[10px] rounded-full px-2 py-0.5 font-medium " +
                          (k.published ? "bg-green-100 text-green-700" : "bg-warm-sand text-foreground/70")
                        }
                      >
                        {k.published ? "published" : "not published"}
                      </span>
                    </div>
                    <button
                      onClick={() => removeKeyword(k.id)}
                      className="text-xs text-danger hover:text-danger transition-colors"
                    >
                      Delete
                    </button>
                  </div>

                  <div
                    className={"text-xs font-mono break-all " + (reserved ? "text-danger" : "text-foreground/80")}
                  >
                    {slug ? url : "Set a keyword to get a URL"}
                    {reserved && " — taken by an existing page"}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Keyword</label>
                      <input
                        type="text"
                        value={k.keyword}
                        onChange={(e) => changeKeywordText(k, e.target.value)}
                        placeholder="custom embroidery durango"
                        className={FIELD_CLASS + " mt-1"}
                      />
                      <p className={HINT_CLASS}>The exact phrase this page targets. It is also the H1 unless a headline is set.</p>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Slug</label>
                      <input
                        type="text"
                        value={k.slug}
                        onChange={(e) => updateKeyword(k.id, { slug: e.target.value })}
                        placeholder={slugifyKeyword(k.keyword) || "custom-embroidery-durango"}
                        className={(reserved ? FIELD_ERROR_CLASS : FIELD_CLASS) + " mt-1 font-mono text-xs"}
                      />
                      <p className={reserved ? "text-xs text-danger mt-1 font-medium" : HINT_CLASS}>
                        {reserved
                          ? "This slug is already used by a page on the site. Pick a different one — a page saved at /" +
                            slug +
                            "/ would be shadowed by that route and never render."
                          : !k.slug.trim()
                            ? "Auto — follows the keyword until you type your own."
                            : slugChanged
                              ? "Will be saved as /" + slug + "/"
                              : "Custom slug."}
                      </p>
                    </div>
                  </div>

                  {takenBy >= 0 && (
                    <p className="text-xs text-danger">
                      Another keyword page (#{takenBy + 1}) already uses /{slug}/. Two pages cannot share one URL —
                      change one of the slugs before saving.
                    </p>
                  )}

                  {!k.published && (
                    <p className="text-xs text-foreground/80">
                      Not published, so no page is emitted yet. Tick Published when the copy is ready.
                    </p>
                  )}

                  <div>
                    <label className={LABEL_CLASS}>Headline</label>
                    <input
                      type="text"
                      value={k.headline}
                      onChange={(e) => updateKeyword(k.id, { headline: e.target.value })}
                      placeholder={k.keyword.trim() || "Custom Embroidery in Durango"}
                      className={FIELD_CLASS + " mt-1"}
                    />
                    <p className={HINT_CLASS}>Blank means the keyword itself is used as the page heading.</p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <label className={LABEL_CLASS}>Body</label>
                      <span className={"text-xs tabular-nums " + (words > 0 && words < THIN_CONTENT_WORDS ? "text-amber-600 font-medium" : "text-foreground/70")}>
                        {words} words
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={k.body}
                      onChange={(e) => updateKeyword(k.id, { body: e.target.value })}
                      placeholder={"Write the page copy here.\n\nLeave a blank line between paragraphs — each blank line starts a new paragraph on the page."}
                      className={FIELD_CLASS + " mt-1 resize-y"}
                    />
                    {words === 0 ? (
                      <p className="text-xs text-amber-600 mt-1">
                        No body copy yet. Thin pages are the main SEO risk with generated landing pages.
                      </p>
                    ) : words < THIN_CONTENT_WORDS ? (
                      <p className="text-xs text-amber-600 mt-1">
                        Thin content — only {words} words. Aim for 300 words or more of genuinely useful copy.
                      </p>
                    ) : (
                      <p className={HINT_CLASS}>Blank lines separate paragraphs.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>CTA label</label>
                      <input
                        type="text"
                        value={k.ctaLabel}
                        onChange={(e) => updateKeyword(k.id, { ctaLabel: e.target.value })}
                        placeholder="Shop custom apparel"
                        className={FIELD_CLASS + " mt-1"}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>CTA link</label>
                      <input
                        type="text"
                        value={k.ctaHref}
                        onChange={(e) => updateKeyword(k.id, { ctaHref: e.target.value })}
                        placeholder="/shop/"
                        className={FIELD_CLASS + " mt-1 font-mono text-xs"}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <label className={LABEL_CLASS}>Meta title override</label>
                      {keywordTitle ? (
                        <Counter len={keywordTitle.length} max={TITLE_MAX} clipped={keywordTitleClipped} />
                      ) : (
                        <span className={CHIP_CLASS}>auto from headline</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={k.title}
                      onChange={(e) => updateKeyword(k.id, { title: e.target.value })}
                      placeholder="Leave blank to generate one from the headline"
                      className={FIELD_CLASS}
                    />
                    {keywordTitle && (
                      <p className={keywordTitleClipped ? "text-[11px] text-danger mt-1" : HINT_CLASS}>
                        {keywordTitleClipped ? "Too long — cut off in search results. Publishes as " : "Publishes as "}
                        <span className="font-mono">{keywordTitle}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <label className={LABEL_CLASS}>Meta description override</label>
                      {k.description.trim() ? (
                        <Counter len={k.description.trim().length} max={DESCRIPTION_MAX} />
                      ) : (
                        <span className={CHIP_CLASS}>auto from body</span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={k.description}
                      onChange={(e) => updateKeyword(k.id, { description: e.target.value })}
                      placeholder="Leave blank to generate one from the body copy"
                      className={FIELD_CLASS + " resize-y"}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={k.published}
                      onChange={(e) => updateKeyword(k.id, { published: e.target.checked })}
                      className="accent-gold"
                    />
                    Published — emit this page at /{slug || "slug"}/
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: publish ── */}
      <section className="space-y-4 border-t border-warm-sand pt-6">
        <div>
          <h3 className="font-bold font-display text-lg">Publish</h3>
          <p className="text-sm text-foreground/80 max-w-2xl">
            SEO is baked into the static HTML at build time, so saved edits appear on the live site only after a
            rebuild.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-6 py-2.5 bg-gold text-on-gold rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={publish}
            disabled={publishStatus === "pending" || dirty || saving}
            className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {publishStatus === "pending" ? "Publishing..." : "Publish site"}
          </button>
          {dirty && <span className="text-sm text-amber-600">Save your changes before publishing.</span>}
        </div>

        {publishStatus !== "idle" && (
          <div
            className={
              "rounded-xl border p-3 text-sm " +
              (publishStatus === "success"
                ? bannerClass("ok")
                : publishStatus === "failed"
                  ? bannerClass("error")
                  : bannerClass("info"))
            }
          >
            <p className="font-medium">
              {publishStatus === "pending"
                ? "Publish in progress..."
                : publishStatus === "success"
                  ? "Publish succeeded"
                  : "Publish failed"}
            </p>
            {publishMessage && <p className="mt-1 whitespace-pre-wrap">{publishMessage}</p>}
            {publishNeedsToken && (
              <p className="mt-2 text-xs">
                No GitHub token is stored yet, so the rebuild cannot start. Save one in Rebuild access below, then
                press Publish site again.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-warm-sand bg-warm-sand/20 p-4 space-y-3">
          <div>
            <h4 className="font-bold font-display text-sm">Rebuild access (GitHub token)</h4>
            <p className="text-xs text-foreground/80 mt-1 max-w-2xl">
              Publish site needs a token before it can start a rebuild. Create a{" "}
              <strong>GitHub fine-grained personal access token</strong> for the{" "}
              <code className="font-mono">MaryTheadoor/animas-reflections-pwa</code> repository with{" "}
              <strong>Actions: write</strong> and <strong>Contents: read</strong>, then paste it here and save it
              once.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
              spellCheck={false}
              aria-label="GitHub publish token"
              className={FIELD_CLASS + " max-w-md font-mono text-xs"}
            />
            <button
              onClick={saveToken}
              disabled={tokenSaving || !tokenInput.trim()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {tokenSaving ? "Saving..." : "Save token"}
            </button>
          </div>
          {tokenMessage && (
            <p className={"text-xs " + (tokenMessage.kind === "ok" ? "text-green-700" : "text-danger")}>
              {tokenMessage.text}
            </p>
          )}
          <p className="text-xs text-foreground/70">
            The token lets you trigger the rebuild from this page instead of waiting on a developer. It is stored
            server-side only, is never shown again, and can be replaced by pasting a new one.
          </p>
        </div>

        <p className="text-xs text-foreground/70">
          Local fallback if the button is unavailable: <code className="font-mono">npm run publish</code>
        </p>
      </section>
    </div>
  );
}
