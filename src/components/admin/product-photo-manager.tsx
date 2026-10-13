"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { useProductPhotos } from "@/hooks/useProductPhotos";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useCatalog } from "@/hooks/useCatalog";
import {
  PRODUCT_PHOTO_VIEWS,
  PRODUCT_PHOTO_VIEW_LABELS,
  type ProductPhoto,
  type ProductPhotoView,
  type ProductType,
} from "@/types";
import {
  blankPhotoSets,
  filterPhotos,
  inferViewFromFilename,
  safePhotoName,
} from "@/lib/product-photos";

/* ─── Admin → Product Photos ──────────────────────────────────────────
   The reusable library of blank-product photos.

   Why this exists: building a product meant uploading the same blank garment
   over and over — five mockup views per product, plus one per colour. Here it is
   uploaded once, with its blank product and view recorded, so a product can be
   filled from the library instead of from the filesystem.

   The list is grouped into blank-product sets rather than shown as a flat grid,
   because that is the unit that gets applied: "Gildan 18500 Hoodie" with front,
   back and sleeve already covered is one click, and it says which views are
   still missing rather than leaving that to be discovered afterwards.

   Distinction to keep in mind: the Images tab manages ONE product's photos; this
   manages the shared library those products draw from.
   ────────────────────────────────────────────────────────────────────── */

interface FormState {
  name: string;
  view: "" | ProductPhotoView;
  color: string;
  productType: "" | ProductType;
  categoryIds: string[];
  tags: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  view: "",
  color: "",
  productType: "",
  categoryIds: [],
  tags: "",
};

export default function ProductPhotoManager() {
  const { photos, loading, error: loadError, refresh } = useProductPhotos();
  const siteConfig = useSiteConfig();
  const { categories } = useCatalog();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colorOptions = siteConfig.catalog_options?.colors ?? [];
  const typeOptions = siteConfig.catalog_options?.productTypes ?? [];

  const sets = useMemo(() => blankPhotoSets(photos), [photos]);
  const visible = useMemo(() => filterPhotos(photos, { query }), [photos, query]);

  /** Sets, each with its member photos, narrowed to the current search. */
  const shownSets = useMemo(() => {
    const visibleIds = new Set(visible.map((p) => p.id));
    return sets
      .map((set) => ({
        set,
        members: photos
          .filter((p) => ((p.name ?? "").trim() || "Untitled blank") === set.name)
          .filter((p) => visibleIds.has(p.id)),
      }))
      .filter((entry) => entry.members.length > 0);
  }, [sets, photos, visible]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFiles([]);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const payload = () => {
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      name: form.name.trim(),
      // An empty category list means "fits anywhere" (absent), not "excluded
      // from everything" — that opt-out is data-level, not a UI choice.
      categoryIds: form.categoryIds.length > 0 ? form.categoryIds : null,
      tags: tags.length > 0 ? tags : null,
      color: form.color.trim() || null,
      productType: form.productType || null,
    };
  };

  /** Create one library entry per chosen file. */
  const handleUpload = async () => {
    const cleanName = form.name.trim();
    if (!cleanName) {
      setError("Give the blank product a name — it is what groups the views together.");
      return;
    }
    if (files.length === 0) {
      setError("Choose at least one image.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const meta = payload();
      let done = 0;
      for (const file of files) {
        setStatus(`Uploading ${done + 1} of ${files.length}…`);
        const id = crypto.randomUUID();
        const objectRef = ref(storage, `product-photos/${id}_${safePhotoName(file.name)}`);
        await uploadBytes(objectRef, file);
        const image_url = await getDownloadURL(objectRef);
        // The chosen view wins; otherwise read it out of the filename, so
        // "gildan-front.png" + "gildan-back.png" can be uploaded in one go.
        const view = form.view || inferViewFromFilename(file.name) || null;
        await setDoc(
          doc(db, "product_photos", id),
          stripUndefined({
            id,
            image_url,
            view,
            // `meta` already carries the trimmed name, category list and tags.
            ...meta,
            created_at: new Date().toISOString(),
          }) as unknown as ProductPhoto,
        );
        done += 1;
      }
      setStatus(`Added ${done} photo${done === 1 ? "" : "s"} to “${cleanName}”.`);
      resetForm();
      await refresh();
    } catch (err) {
      setError("Upload failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  /** Save metadata edits, and replace the image only if a new file was chosen. */
  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!form.name.trim()) {
      setError("A photo needs a blank product name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let image_url: string | undefined;
      let view: ProductPhotoView | null = form.view || null;
      if (files[0]) {
        const objectRef = ref(storage, `product-photos/${editingId}_${safePhotoName(files[0].name)}`);
        await uploadBytes(objectRef, files[0]);
        image_url = await getDownloadURL(objectRef);
        // A replacement keeps the view unless the operator changed it.
        if (!form.view) view = inferViewFromFilename(files[0].name) ?? null;
      }
      await setDoc(
        doc(db, "product_photos", editingId),
        stripUndefined({ ...payload(), view, ...(image_url ? { image_url } : {}) }),
        { merge: true },
      );
      setStatus("Saved.");
      resetForm();
      await refresh();
    } catch (err) {
      setError("Save failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (photo: ProductPhoto) => {
    if (!confirm(`Delete this photo of “${photo.name}”?`)) return;
    setError(null);
    try {
      const urlPath = decodeURIComponent(photo.image_url.split("/o/")[1]?.split("?")[0] ?? "");
      if (urlPath) await deleteObject(ref(storage, urlPath));
    } catch {
      // An external URL has no Storage object to remove.
    }
    try {
      await deleteDoc(doc(db, "product_photos", photo.id));
      await refresh();
    } catch (err) {
      setError("Delete failed: " + (err instanceof Error ? err.message : "unknown error"));
    }
  };

  const startEdit = (photo: ProductPhoto) => {
    setEditingId(photo.id);
    setFiles([]);
    setError(null);
    setStatus(null);
    setForm({
      name: photo.name ?? "",
      view: photo.view ?? "",
      color: photo.color ?? "",
      productType: photo.productType ?? "",
      categoryIds: photo.categoryIds ?? [],
      tags: (photo.tags ?? []).join(", "),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")));
  };

  const inferred = files.map((f) => inferViewFromFilename(f.name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-display mb-1">Product Photo Library</h2>
        <p className="text-sm text-foreground/70">
          Upload a blank product once and reuse it on every product that uses it. Record which
          view each photo is, and upload all the views at once — the filename decides the view
          when you leave it on <em>Auto</em>. The <strong>Images</strong> tab still manages one
          product&rsquo;s own photos; this is the shared library those products draw from.
        </p>
      </div>

      {/* ── Add / edit ── */}
      <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-5 space-y-4">
        <h3 className="font-bold font-display text-sm">
          {editingId ? "Edit photo" : "Add photos"}
        </h3>

        {editingId && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-gold/10 border border-gold/40 px-3 py-2">
            <p className="text-xs text-foreground">Editing an existing photo. Choose a file only to replace the image.</p>
            <button onClick={resetForm} className="text-xs font-medium text-gold-deep hover:underline">
              Cancel
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="pp-name" className="text-xs font-medium text-primary block mb-1">
              Blank product *
            </label>
            <input
              id="pp-name"
              list="pp-name-options"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Gildan 18500 Hoodie"
              className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
            />
            <datalist id="pp-name-options">
              {sets.map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="pp-view" className="text-xs font-medium text-primary block mb-1">
              View
            </label>
            <select
              id="pp-view"
              value={form.view}
              onChange={(e) => set("view", e.target.value as FormState["view"])}
              className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
            >
              <option value="">Auto (read from the filename)</option>
              {PRODUCT_PHOTO_VIEWS.map((v) => (
                <option key={v} value={v}>
                  {PRODUCT_PHOTO_VIEW_LABELS[v]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pp-color" className="text-xs font-medium text-primary block mb-1">
              Colour (optional)
            </label>
            <input
              id="pp-color"
              list="pp-color-options"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              placeholder="Leave blank for a tinted photo"
              className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
            />
            <datalist id="pp-color-options">
              {colorOptions.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="pp-type" className="text-xs font-medium text-primary block mb-1">
              Product type
            </label>
            <select
              id="pp-type"
              value={form.productType}
              onChange={(e) => set("productType", e.target.value as FormState["productType"])}
              className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
            >
              <option value="">Any type</option>
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pp-tags" className="text-xs font-medium text-primary block mb-1">
              Tags (comma separated)
            </label>
            <input
              id="pp-tags"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="fleece, heavyweight"
              className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
            />
          </div>
        </div>

        {/* Categories: none selected = fits any category */}
        <div>
          <span className="text-xs font-medium text-primary block mb-1.5">
            Categories <span className="text-foreground/70 font-normal">— none selected fits any category</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 && (
              <span className="text-xs text-foreground/70">No categories yet.</span>
            )}
            {categories.map((cat) => {
              const on = form.categoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set(
                      "categoryIds",
                      on ? form.categoryIds.filter((id) => id !== cat.id) : [...form.categoryIds, cat.id],
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    on ? "bg-primary text-white" : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="pp-files" className="text-xs font-medium text-primary block mb-1">
            {editingId ? "Replace image (optional)" : "Images *"}
          </label>
          <input
            id="pp-files"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={!editingId}
            onChange={handleFiles}
            className="w-full text-sm text-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-warm-sand file:text-foreground file:text-xs file:font-medium"
          />
          {!editingId && files.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-foreground/70">
              {files.map((f, i) => (
                <li key={f.name + i}>
                  {f.name}{" "}
                  <span className="text-gold-deep">
                    → {inferred[i] ? PRODUCT_PHOTO_VIEW_LABELS[inferred[i]!] : form.view ? PRODUCT_PHOTO_VIEW_LABELS[form.view] : "no view — pick one"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={editingId ? handleSaveEdit : handleUpload}
            disabled={busy}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gold text-on-gold hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {busy ? "Working…" : editingId ? "Save changes" : `Add ${files.length > 1 ? `${files.length} photos` : "photo"}`}
          </button>
          {status && <span className="text-xs text-foreground/70">{status}</span>}
          {error && (
            <span role="alert" className="text-xs text-danger">
              {error}
            </span>
          )}
          {loadError && <span role="alert" className="text-xs text-danger">Library read failed: {loadError}</span>}
        </div>
      </section>

      {/* ── Library ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blank products, colours, tags…"
            aria-label="Search the photo library"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-primary/20 bg-white focus:border-gold outline-none text-sm"
          />
          <span className="text-xs text-foreground/70">
            {photos.length} photo{photos.length === 1 ? "" : "s"} · {sets.length} blank
            {sets.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading && <p className="text-sm text-foreground/70">Loading the library…</p>}

        {!loading && shownSets.length === 0 && (
          <p className="text-sm text-foreground/70">
            {photos.length === 0
              ? "Nothing here yet. Add a blank product's photos above and they can be reused on every product."
              : "No blank products match that search."}
          </p>
        )}

        {shownSets.map(({ set: blank, members }) => {
          const missing = PRODUCT_PHOTO_VIEWS.filter((v) => !blank.byView[v]);
          return (
            <div key={blank.name} className="bg-white rounded-2xl shadow-card border border-warm-sand p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h3 className="font-bold font-display text-sm">{blank.name}</h3>
                  <p className="text-xs text-foreground/70 mt-0.5">
                    {members.length} photo{members.length === 1 ? "" : "s"} · covers{" "}
                    {PRODUCT_PHOTO_VIEWS.filter((v) => blank.byView[v])
                      .map((v) => PRODUCT_PHOTO_VIEW_LABELS[v])
                      .join(", ") || "no views yet"}
                    {missing.length > 0 && ` · missing ${missing.map((v) => PRODUCT_PHOTO_VIEW_LABELS[v]).join(", ")}`}
                  </p>
                  {blank.productType && (
                    <span className="inline-block mt-1 mr-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      {typeOptions.find((t) => t.value === blank.productType)?.label ?? blank.productType}
                    </span>
                  )}
                  {blank.categoryIds.map((id) => (
                    <span key={id} className="inline-block mt-1 mr-1 px-2 py-0.5 rounded-full bg-plum/10 text-plum-ink text-[10px] font-medium">
                      {categories.find((c) => c.id === id)?.name ?? id}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {members.map((photo) => (
                  <figure key={photo.id} className="space-y-1">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-warm-sand/40 border border-warm-sand">
                      {photo.image_url ? (
                        <Image
                          src={photo.image_url}
                          alt={`${photo.name}${photo.view ? ` — ${PRODUCT_PHOTO_VIEW_LABELS[photo.view]}` : ""}`}
                          width={200}
                          height={200}
                          className="w-full h-full object-contain"
                        />
                      ) : null}
                    </div>
                    <figcaption className="text-[10px] text-foreground/70 leading-tight">
                      {photo.view ? PRODUCT_PHOTO_VIEW_LABELS[photo.view] : "no view"}
                      {photo.color ? ` · ${photo.color}` : ""}
                    </figcaption>
                    <div className="flex gap-2 text-[10px]">
                      <button onClick={() => startEdit(photo)} className="text-primary hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(photo)} className="text-danger hover:underline">
                        Delete
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
