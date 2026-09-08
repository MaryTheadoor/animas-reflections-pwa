"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import Image from "next/image";
import VariantMatrixEditor from "./variant-matrix-editor";
import { db, storage, functions } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { useSiteConfig, useSiteConfigRefresh } from "@/hooks/useSiteConfig";
import { ADDON_PRICE, DEFAULT_COLOR_TINTS } from "@/lib/constants";
import type { ManagedProduct, ManagedCategory, ProductType, DesignAsset, ProductAddon } from "@/types";
import { PRODUCT_TYPE_LABELS } from "@/types";
import AdminTooltip from "@/components/ui/admin-tooltip";

const EMPTY_PRODUCT: ManagedProduct = {
  id: "",
  name: "",
  description: "",
  categoryId: "",
  productType: "other",
  colors: [],
  tags: [],
  images: [],
  variants: [],
  active: true,
  featured: false,
  createdAt: "",
  updatedAt: "",
  designAssets: [],
};

interface Props {
  categories: ManagedCategory[];
}

export default function ProductManager({ categories }: Props) {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [allDesigns, setAllDesigns] = useState<DesignAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedProduct | null>(null);
  const [form, setForm] = useState<ManagedProduct>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newHex, setNewHex] = useState("#1E4D4F");
  const [colorPickerImage, setColorPickerImage] = useState<string | null>(null);
  const [colorPickerCanvas, setColorPickerCanvas] = useState<HTMLCanvasElement | null>(null);
  const [newVariant, setNewVariant] = useState({ name: "", price: "", sku: "" });

  // Inline category creation
  const [localCategories, setLocalCategories] = useState<ManagedCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Square push state (optional POS linkage — Square is payment-only otherwise)
  const [pushingToSquare, setPushingToSquare] = useState<string | null>(null); // productId being pushed
  const [pushError, setPushError] = useState<string | null>(null);

  // Matrix editor toggle
  const [useMatrixEditor, setUseMatrixEditor] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);
  // Tracks whether the contentEditable has focus so we don't clobber the user's
  // cursor position when form.description syncs (e.g. loading a different product).
  const descFocused = useRef(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Add-on editor ────────────────────────────────────────────────────────
  const siteConfig = useSiteConfig();
  const defaultAddonPrice = siteConfig.addon_price ?? ADDON_PRICE;
  // Working list = the product's configured add-ons, or the site-standard ones
  // (as a starting template) when the product hasn't been configured yet. Any edit
  // below materializes form.productAddons; leaving it untouched keeps it undefined
  // so the storefront keeps showing site defaults.
  const standardAddons = siteConfig.addon_defaults?.standardAddons ?? [];
  const workingAddons: ProductAddon[] =
    form.productAddons ?? standardAddons.map((a) => ({ id: a.id, name: a.name, price: a.price || defaultAddonPrice }));
  const standardIds = new Set<string>(standardAddons.map((a) => a.id));
  const customAddons = workingAddons.filter((a) => !standardIds.has(a.id));

  const setAddons = (next: ProductAddon[]) => updateField("productAddons", next);
  const toggleStandardAddon = (id: string, name: string) => {
    const exists = workingAddons.some((a) => a.id === id);
    const stdAddon = standardAddons.find((a) => a.id === id);
    const price = stdAddon?.price || defaultAddonPrice;
    setAddons(exists ? workingAddons.filter((a) => a.id !== id) : [...workingAddons, { id, name, price }]);
  };
  const updateAddon = (id: string, field: "name" | "price", value: string | number) =>
    setAddons(workingAddons.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const addCustomAddon = () => setAddons([...workingAddons, { id: crypto.randomUUID(), name: "", price: 0 }]);
  const removeAddon = (id: string) => setAddons(workingAddons.filter((a) => a.id !== id));

  // ── Color tint helpers (for mockup color preview) ────────────────────────
  const setColorTint = (color: string, hex: string) =>
    updateField("colorTints", { ...(form.colorTints ?? {}), [color]: hex });
  const clearColorTint = (color: string) => {
    const tints = { ...(form.colorTints ?? {}) };
    delete tints[color];
    updateField("colorTints", Object.keys(tints).length > 0 ? tints : undefined);
  };

  // A color key is usually a name (e.g. "neon green") which is not a valid CSS
  // color. Render the configured tint — or the key itself when it is a valid
  // hex — so swatches are always visible.
  const colorSwatch = (color: string) =>
    form.colorTints?.[color] || (/^#[0-9a-f]{6}$/i.test(color) ? color : "#cccccc");

  const setPerColorImage = (color: string, view: "front" | "back" | "sleeve" | "sideL" | "sideR", url: string) =>
    updateField("mockupImagesByColor", {
      ...(form.mockupImagesByColor ?? {}),
      [color]: { ...(form.mockupImagesByColor?.[color] ?? {}), [view]: url },
    });

  const removePerColorImage = (color: string, view: "front" | "back" | "sleeve" | "sideL" | "sideR") => {
    const perColor = { ...(form.mockupImagesByColor ?? {}) };
    const views = { ...(perColor[color] ?? {}) };
    delete views[view];
    if (Object.keys(views).length > 0) perColor[color] = views; else delete perColor[color];
    updateField("mockupImagesByColor", Object.keys(perColor).length > 0 ? perColor : undefined);
  };

  const loadProducts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "products"));
      const items: ManagedProduct[] = [];
      snap.forEach((d) => {
        const data = d.data() as ManagedProduct;
        if (!data.name || !data.id) return;
        const safe: ManagedProduct = {
          ...data,
          variants: Array.isArray(data.variants) ? data.variants : [],
          colors: Array.isArray(data.colors) ? data.colors : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          images: Array.isArray(data.images) ? data.images : [],
          categoryId: data.categoryId ?? "",
          description: data.description ?? "",
          active: data.active ?? true,
          featured: data.featured ?? false,
          createdAt: data.createdAt ?? "",
          updatedAt: data.updatedAt ?? "",
        };
        items.push(safe);
      });
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setProducts(items);
    } catch (err) {
      console.error("Product load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
    // Load all designs for product-design linking
    getDocs(collection(db, "designs")).then((snap) => {
      const designs: DesignAsset[] = [];
      snap.forEach((d) => { const data = d.data() as DesignAsset; if (data.name && data.image_url) designs.push(data); });
      setAllDesigns(designs);
    }).catch(() => {});
  }, [loadProducts]);

  // Sync contentEditable div ← form.description only when the user isn't
  // actively editing (preserves cursor position). ContentEditable grows
  // naturally — no explicit height management needed.
  useEffect(() => {
    const el = descRef.current;
    if (!el || descFocused.current) return;
    if (el.innerHTML !== (form.description || "")) {
      el.innerHTML = form.description || "";
    }
  }, [form.description]);

  const resetForm = () => {
    setForm(EMPTY_PRODUCT);
    setEditing(null);
    setNewTag("");
    setNewVariant({ name: "", price: "", sku: "" });
    setNewCategoryName("");
    setAddingCategory(false);
    setSaveError(null);
  };

  const startEdit = (p: ManagedProduct) => {
    setForm({ ...p });
    setEditing(p);
  };

  const updateField = (field: keyof ManagedProduct, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setNewTag("");
  };

  const addCustomColor = () => {
    const name = newColor.trim().toLowerCase();
    const hex = newHex.toLowerCase();
    const value = name || hex;
    if (!value || form.colors.includes(value)) return;
    setForm((prev) => ({
      ...prev,
      colors: [...prev.colors, value],
      // One-step setup: link the picked hex as this color's tint immediately so
      // the customizer preview reflects the color without a separate trip to the
      // Color Tints section.
      colorTints: { ...(prev.colorTints ?? {}), [value]: hex },
    }));
    setNewColor("");
    setNewHex("#1E4D4F");
  };

  const refreshSiteConfig = useSiteConfigRefresh();

  // Promotes an inline "custom color" to the site-wide Color Library (config/site
  // catalog_options.colors) so it becomes selectable on every product. Requires
  // the caller to be an admin (saveSiteConfig is admin-gated).
  const saveColorToLibrary = async (colorName: string) => {
    const colors = siteConfig.catalog_options?.colors ?? [];
    if (colors.some((c) => c.name.toLowerCase() === colorName.toLowerCase())) {
      alert(`${colorName} is already in the site color library`);
      return;
    }
    const hex = form.colorTints?.[colorName] ?? "#000000";
    try {
      const callable = httpsCallable(functions, "saveSiteConfig");
      await callable({
        ...siteConfig,
        catalog_options: {
          ...siteConfig.catalog_options,
          colors: [...colors, { name: colorName, hex }],
        },
      } as unknown as Record<string, unknown>);
      refreshSiteConfig();
      alert(`Saved "${colorName}" to the site color library. It's now available on every product.`);
    } catch (err) {
      alert("Failed to save to color library: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleColorPickerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setColorPickerImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageColorPick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!colorPickerCanvas) return;
    const canvas = colorPickerCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
    setNewHex(hex);
  };

  const loadCanvasImage = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !colorPickerImage) return;
    setColorPickerCanvas(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = colorPickerImage;
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const toggleColor = (color: string) => {
    setForm((prev) => {
      const isOn = !prev.colors.includes(color);
      const colors = isOn ? [...prev.colors, color] : prev.colors.filter((c) => c !== color);
      // Toggling a standard color on pre-fills its default tint so the mockup
      // preview works immediately; admin can still override below. Tints are
      // kept on toggle-off so re-adding a color doesn't lose the setting.
      const colorTints = { ...(prev.colorTints ?? {}) };
      if (isOn && !colorTints[color]) {
        const def = DEFAULT_COLOR_TINTS[color];
        if (def) colorTints[color] = def;
      }
      return { ...prev, colors, colorTints };
    });
  };

  const addVariant = () => {
    const name = newVariant.name.trim();
    const price = parseFloat(newVariant.price);
    if (!name || isNaN(price) || price < 0) return;
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { id: crypto.randomUUID(), name, price, sku: newVariant.sku.trim() },
      ],
    }));
    setNewVariant({ name: "", price: "", sku: "" });
  };

  const removeVariant = (id: string) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== id),
    }));
  };

  const updateVariant = (id: string, field: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      ),
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = editing?.id
      ? `products/${editing.id}/${Date.now()}_${safeName}`
      : `products/temp/${Date.now()}_${safeName}`;
    const fileRef = ref(storage, path);
    const task = uploadBytesResumable(fileRef, file);
    task.on(
      "state_changed",
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => {
        setUploading(false);
        setUploadError(err.message || "Upload failed");
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
        setUploading(false);
        setUploadProgress(0);
      }
    );
  };

  const removeImage = async (url: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
    try {
      const urlPath = decodeURIComponent(url.split("/o/")[1]?.split("?")[0] ?? "");
      if (urlPath) await deleteObject(ref(storage, urlPath));
    } catch {}
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.categoryId || form.variants.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const now = new Date().toISOString();
      const docId = editing?.id || crypto.randomUUID();
      const product: ManagedProduct = {
        ...form,
        id: docId,
        name: form.name.trim(),
        description: form.description.trim(),
        // For a brand-new product editing.createdAt is "" (empty string, not
        // null), so use || rather than ?? to fall back to the current timestamp.
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      // Firestore writes can hang silently on bad network conditions.
      // Promise.race with a 15s timeout ensures the UI doesn't get stuck permanently.
      await Promise.race([
        // stripUndefined drops optional fields the form leaves undefined —
        // without it the SDK rejects the whole write ("Unsupported field value:
        // undefined"), which was the root cause of failed product saves.
        setDoc(doc(db, "products", docId), stripUndefined(product)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Save timed out. Check your connection and try again.")), 15000)),
      ]);
      setSaving(false);
      setSaveError(null);
      resetForm();
      loadProducts();
    } catch (err) {
      setSaving(false);
      setSaveError(err instanceof Error ? err.message : "Failed to save product");
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newCat: ManagedCategory = { id, name, slug, order: categories.length + localCategories.length, createdAt: now, updatedAt: now };
    await setDoc(doc(db, "categories", id), newCat);
    setLocalCategories((prev) => [...prev, newCat]);
    setForm((prev) => ({ ...prev, categoryId: id }));
    setNewCategoryName("");
    setAddingCategory(false);
    // Let CategoryManager and the dashboard pick up the inline-created category.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin-categories-changed"));
    }
  };

  // Collect every Storage URL a product references (gallery, mockups,
  // per-color photos, thumbnails) for cleanup/ownership checks.
  const collectProductUrls = (p: ManagedProduct): string[] => {
    const urls = [...(p.images ?? [])];
    if (p.mockupImages) {
      urls.push(...(Object.values(p.mockupImages).filter(Boolean) as string[]));
    }
    if (p.mockupImagesByColor) {
      for (const views of Object.values(p.mockupImagesByColor)) {
        if (views) urls.push(...(Object.values(views).filter(Boolean) as string[]));
      }
    }
    if (p.colorThumbnails) {
      urls.push(...Object.values(p.colorThumbnails).filter(Boolean));
    }
    return urls;
  };

  // True when any OTHER product references the same URL. Duplicated products
  // share files — deleting one must not delete the other's images.
  const urlReferencedElsewhere = (url: string, excludeId: string): boolean =>
    products.some((p) => p.id !== excludeId && collectProductUrls(p).includes(url));

  const deleteProductStorage = async (p: ManagedProduct) => {
    for (const url of collectProductUrls(p)) {
      if (urlReferencedElsewhere(url, p.id)) continue;
      try {
        const urlPath = decodeURIComponent(url.split("/o/")[1]?.split("?")[0] ?? "");
        if (urlPath) await deleteObject(ref(storage, urlPath));
      } catch { /* already deleted or external URL — ignore */ }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    // Clean up product images from Storage before removing the doc — prevents
    // orphaned files, while skipping files still used by another product.
    const product = products.find((p) => p.id === id);
    if (product) {
      await deleteProductStorage(product);
    }
    await deleteDoc(doc(db, "products", id));
    loadProducts();
  };

  const handlePushToSquare = async (productId: string) => {
    setPushingToSquare(productId);
    setPushError(null);
    try {
      const callable = httpsCallable<{ productId: string }, { success: boolean; squareItemId: string }>(
        functions,
        "createSquareProduct"
      );
      await callable({ productId });
      await loadProducts();
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Failed to push to Square");
    } finally {
      setPushingToSquare(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const bulkSetActive = async (active: boolean) => {
    const label = active ? "Activate" : "Deactivate";
    if (!confirm(label + " " + selectedIds.size + " product(s)?")) return;
    const now = new Date().toISOString();
    for (const id of selectedIds) {
      await setDoc(doc(db, "products", id), { active, updatedAt: now }, { merge: true });
    }
    setSelectedIds(new Set());
    loadProducts();
  };

  const bulkDelete = async () => {
    if (!confirm("Permanently delete " + selectedIds.size + " product(s)? This cannot be undone.")) return;
    let deleted = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        const product = products.find((p) => p.id === id);
        if (product) await deleteProductStorage(product);
        await deleteDoc(doc(db, "products", id));
        deleted++;
      } catch (err) {
        failed++;
        console.error("Bulk delete failed for product", id, err);
      }
    }
    setSelectedIds(new Set());
    loadProducts();
    if (failed > 0) {
      alert(`Deleted ${deleted} product(s); ${failed} failed. Check the console for details.`);
    }
  };

  const handleDuplicate = async (product: ManagedProduct) => {
    const newId = crypto.randomUUID();
    const duplicated: ManagedProduct = {
      ...product,
      id: newId,
      name: product.name + " (Copy)",
      squareItemIds: undefined,
      variants: product.variants.map((v) => ({
        ...v,
        id: crypto.randomUUID(),
        squareItemId: undefined,
        squareVariationId: undefined,
        inventory: undefined,
        inventoryUpdatedAt: undefined,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // duplicated carries explicit undefineds (squareItemIds, variation IDs,
    // inventory) cleared for the copy — strip them or the SDK rejects the write.
    await setDoc(doc(db, "products", newId), stripUndefined(duplicated));
    loadProducts();
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

  return (
    <div className="space-y-6">
      {/* ── Product List ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold font-display text-lg">{products.length} Products</h3>
          <p className="text-xs text-foreground/80">
            Firestore is the master catalog — Square is payment-only
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => startEdit(EMPTY_PRODUCT)}
            className="px-4 py-2 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {pushError && (
        <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm flex items-center justify-between">
          <span>{pushError}</span>
          <button onClick={() => setPushError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && !editing && (
        <div className="flex items-center gap-3 bg-gold/10 border border-gold/20 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-gold">{selectedIds.size} selected</span>
          <button onClick={selectAll} className="text-xs text-foreground hover:text-primary">
            {selectedIds.size === products.length ? "Deselect All" : "Select All"}
          </button>
          <div className="flex-1" />
          <button onClick={() => bulkSetActive(true)} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Activate
          </button>
          <button onClick={() => bulkSetActive(false)} className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
            Deactivate
          </button>
          <button onClick={bulkDelete} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      )}

      {products.length > 0 && !editing && (
        <div className="space-y-1">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-3"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => toggleSelect(p.id)}
                className="accent-gold w-4 h-4 shrink-0"
              />
              {p.images?.[0] ? (
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  width={40}
                  height={40}
                  className="rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-warm-sand rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {p.name}
                  {!p.active && <span className="text-red-400 ml-1 text-xs">(hidden)</span>}
                </p>
                <p className="text-xs text-foreground/80">
                  {p.variants?.length ?? 0} variants · {categories.find((c) => c.id === p.categoryId)?.name ?? p.categoryId}
                  {" · "}
                  {(p.variants ?? []).reduce((sum, v) => sum + (v.inventory ?? 0), 0)} in stock
                  {p.variants?.some((v) => v.inventory !== undefined) && (
                    <span className="text-foreground/70">
                      {" · "}
                      {p.variants.filter((v) => v.inventory !== undefined).map((v) =>
                        `${v.name}:${v.inventory}`
                      ).join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.squareItemIds?.length ? (
                  <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-full font-medium">Square</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] bg-warm-sand text-foreground/80 rounded-full">Manual</span>
                )}
                <button
                  onClick={() => handleDuplicate(p)}
                  className="px-3 py-1 text-xs bg-teal/10 text-teal rounded-lg hover:bg-teal/20 transition-colors"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => startEdit(p)}
                  className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-3 py-1 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
                {!p.squareItemIds?.length && (
                  <button
                    onClick={() => handlePushToSquare(p.id)}
                    disabled={pushingToSquare === p.id}
                    className="px-3 py-1 text-xs bg-gold/10 text-gold rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
                  >
                    {pushingToSquare === p.id ? "Pushing..." : "Push → Square"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!editing && products.length === 0 && (
        <p className="text-sm text-foreground/80 text-center py-8">
          No products yet. Click &quot;+ New Product&quot; to create one.
        </p>
      )}

      {/* ── Edit Form ── */}
      {editing !== undefined && (
        <div className="bg-white border border-warm-sand rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold font-display">
              {editing?.id ? "Edit Product" : "New Product"}
            </h3>
            <button onClick={resetForm} className="text-sm text-foreground/80 hover:text-primary">
              Cancel
            </button>
          </div>

          {/* Name + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary mb-1">Category *</label>
              <select
                value={form.categoryId}
                onChange={(e) => updateField("categoryId", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              >
                <option value="">Select...</option>
                {[...categories, ...localCategories].map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!addingCategory ? (
                <button
                  onClick={() => setAddingCategory(true)}
                  className="mt-1 text-xs text-gold hover:text-gold-light transition-colors"
                >
                  + New Category
                </button>
              ) : (
                <div className="flex gap-1 mt-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                    placeholder="Category name"
                    autoFocus
                    className="flex-1 px-2 py-1 rounded-lg border border-gold text-xs focus:ring-1 focus:ring-gold outline-none"
                  />
                  <button onClick={handleAddCategory} disabled={!newCategoryName.trim()}
                    className="px-2 py-1 bg-gold text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}
                    className="px-2 py-1 text-xs text-foreground/80 hover:text-primary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description — rich text with formatting toolbar */}
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Description</label>
            {/* Formatting toolbar */}
            <div className="flex gap-1 mb-1">
              {/* preventDefault on mousedown keeps focus + selection inside the
                  contentEditable so execCommand formats the selected text. */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { descRef.current?.focus(); document.execCommand("bold"); }}
                className="px-2.5 py-0.5 text-xs rounded bg-warm-sand/50 hover:bg-warm-sand font-bold transition-colors" title="Bold">B</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { descRef.current?.focus(); document.execCommand("italic"); }}
                className="px-2.5 py-0.5 text-xs rounded bg-warm-sand/50 hover:bg-warm-sand italic transition-colors" title="Italic">I</button>
              <span className="w-px bg-primary/10 mx-0.5 self-stretch" />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { descRef.current?.focus(); document.execCommand("insertUnorderedList"); }}
                className="px-2 py-0.5 text-xs rounded bg-warm-sand/50 hover:bg-warm-sand transition-colors" title="Bullet list">• List</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { descRef.current?.focus(); document.execCommand("insertOrderedList"); }}
                className="px-2 py-0.5 text-xs rounded bg-warm-sand/50 hover:bg-warm-sand transition-colors" title="Numbered list">1. List</button>
            </div>
            <div
              ref={descRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => updateField("description", e.currentTarget.innerHTML)}
              onFocus={() => { descFocused.current = true; }}
              onBlur={(e) => { descFocused.current = false; updateField("description", e.currentTarget.innerHTML); }}
              className="desc-editor w-full min-h-[6rem] px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm bg-white"
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>

          {/* Status toggles + Product Type */}
          <div className="flex gap-6 items-center flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.customizable !== false}
                onChange={(e) => updateField("customizable", e.target.checked ? undefined : false)}
                className="accent-gold"
              />
              Customizable
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateField("active", e.target.checked)}
                className="accent-gold"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => updateField("featured", e.target.checked)}
                className="accent-gold"
              />
              Featured on homepage
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-primary">Type:</label>
              <select
                value={form.productType}
                onChange={(e) => updateField("productType", e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              >
                {(Object.entries(PRODUCT_TYPE_LABELS) as [ProductType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-product shipping override (optional — falls back to global tier) */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-primary">Shipping rate</label>
            <span className="text-foreground/80">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.shippingRate ?? ""}
              onChange={(e) => updateField("shippingRate", e.target.value === "" ? undefined : parseFloat(e.target.value) || 0)}
              placeholder="Site default"
              className="w-24 px-3 py-1.5 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
            <span className="text-[10px] text-foreground/70">leave empty for site default</span>
          </div>

          {/* SEO + weight (optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-primary block mb-1">SEO Title</label>
              <input
                type="text"
                value={form.seoTitle ?? ""}
                onChange={(e) => updateField("seoTitle", e.target.value.trim() || undefined)}
                placeholder="Defaults to product name"
                className="w-full px-3 py-1.5 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-primary block mb-1">SEO Description</label>
              <input
                type="text"
                value={form.seoDescription ?? ""}
                onChange={(e) => updateField("seoDescription", e.target.value.trim() || undefined)}
                placeholder="Defaults to description"
                className="w-full px-3 py-1.5 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-primary block mb-1">Weight (oz)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.weightOz ?? ""}
                onChange={(e) => updateField("weightOz", e.target.value === "" ? undefined : parseFloat(e.target.value) || 0)}
                placeholder="Optional"
                className="w-full px-3 py-1.5 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm"
              />
            </div>
          </div>

          {/* Mockup Images */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">Mockup Images (blank product shots for customizer)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(["front", "back", "sleeve", "sideL", "sideR"] as const).map((view) => (
                <div key={view}>
                  <label className="block text-[10px] font-medium text-foreground mb-1 capitalize">
                    {view === "sideL" ? "Left Side" : view === "sideR" ? "Right Side" : view}
                  </label>
                  <input
                    type="url"
                    value={(form.mockupImages?.[view]) ?? ""}
                    onChange={(e) => {
                      const current = form.mockupImages ?? {};
                      updateField("mockupImages", { ...current, [view]: e.target.value || undefined });
                    }}
                    placeholder="https://..."
                    className="w-full px-2 py-1.5 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs"
                  />
                  <label className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-[10px] text-foreground/80 hover:text-gold cursor-pointer border border-dashed border-primary/20 rounded-lg">
                    📷 Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        setUploadError(null);
                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                        const refId = form.id || crypto.randomUUID();
                        const path = `products/${refId}/mockup_${view}_${Date.now()}_${safeName}`;
                        const fileRef = ref(storage, path);
                        const task = uploadBytesResumable(fileRef, file);
                        task.on("state_changed",
                          () => {},
                          (err) => { setUploading(false); setUploadError(err.message || "Upload failed"); },
                          async () => {
                            const url = await getDownloadURL(task.snapshot.ref);
                            const current = form.mockupImages ?? {};
                            updateField("mockupImages", { ...current, [view]: url });
                            setUploading(false);
                          }
                        );
                      }}
                    />
                  </label>
                  {form.mockupImages?.[view] && (
                    <Image
                      src={form.mockupImages[view]!}
                      alt={`${view} mockup`}
                      width={60}
                      height={60}
                      className="mt-1 rounded-lg object-cover border border-warm-sand"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Print Zones — printable area coordinates per view (Phase 6) */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Print Zones (printable area per view, as % of mockup)
            </label>
            <p className="text-[10px] text-foreground/70 mb-2">
              Defines where the customer can place a design in the customizer. Leave a view blank to use the default zone.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(["front", "back", "sleeve", "sideL", "sideR"] as const).map((view) => {
                const zone = form.printZones?.[view];
                const setZoneField = (field: "x_percent" | "y_percent" | "width_percent" | "height_percent", value: number) => {
                  const currentZones = form.printZones ?? ({} as NonNullable<typeof form.printZones>);
                  const currentZone = currentZones[view] ?? { x_percent: 30, y_percent: 25, width_percent: 40, height_percent: 50 };
                  updateField("printZones", { ...currentZones, [view]: { ...currentZone, [field]: value } });
                };
                const clearZone = () => {
                  if (!form.printZones) return;
                  const rest = { ...form.printZones };
                  delete rest[view];
                  updateField("printZones", Object.keys(rest).length ? rest : undefined);
                };
                return (
                  <div key={view} className="border border-primary/10 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-foreground capitalize">
                        {view === "sideL" ? "Left Side" : view === "sideR" ? "Right Side" : view}
                      </span>
                      {zone && (
                        <button onClick={clearZone} className="text-[10px] text-red-400 hover:text-red-600">reset</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        ["x_percent", "X %"],
                        ["y_percent", "Y %"],
                        ["width_percent", "W %"],
                        ["height_percent", "H %"],
                      ] as const).map(([field, label]) => (
                        <div key={field}>
                          <label className="block text-[9px] text-foreground/70">{label}</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={zone?.[field] ?? ""}
                            placeholder="—"
                            onChange={(e) => setZoneField(field, parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-1 rounded border border-primary/20 focus:border-gold outline-none text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Options — dynamic variant dimensions (Phase 3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-primary">
                Product Options ({(form.options ?? []).length} configured)
              </label>
            </div>
            <p className="text-xs text-foreground/70 mb-3">
              Option dimensions define your variants (SKUs). Standard examples: Size, Color.
              Add custom dimensions like Material, Finish, or Grommet Count for non-apparel products.
              Leave empty to use the site-standard Size × Color grid.
            </p>
            <div className="space-y-2 mb-3">
              {(form.options ?? []).map((opt, idx) => (
                <div key={opt.id} className="bg-warm-sand/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => {
                        const opts = [...(form.options ?? [])];
                        opts[idx] = { ...opt, name: e.target.value };
                        updateField("options", opts);
                      }}
                      placeholder="Option name (e.g. Size)"
                      className="flex-1 px-2 py-1 rounded border border-primary/10 bg-white text-sm focus:border-gold outline-none"
                    />
                    <select
                      value={opt.type}
                      onChange={(e) => {
                        const opts = [...(form.options ?? [])];
                        opts[idx] = { ...opt, type: e.target.value as "select" | "color" | "text" };
                        updateField("options", opts);
                      }}
                      className="w-24 px-2 py-1 rounded border border-primary/10 bg-white text-xs focus:border-gold outline-none"
                    >
                      <option value="select">Select</option>
                      <option value="color">Color</option>
                      <option value="text">Text</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={opt.required}
                        onChange={(e) => {
                          const opts = [...(form.options ?? [])];
                          opts[idx] = { ...opt, required: e.target.checked };
                          updateField("options", opts);
                        }}
                        className="accent-gold"
                      />
                      Required
                    </label>
                    <button
                      onClick={() => {
                        const opts = (form.options ?? []).filter((_, i) => i !== idx);
                        updateField("options", opts);
                      }}
                      className="text-red-400 hover:text-red-600 text-xs px-2"
                    >
                      ✕
                    </button>
                  </div>
                  {opt.type !== "text" && (
                    <input
                      type="text"
                      value={opt.values.join(", ")}
                      onChange={(e) => {
                        const opts = [...(form.options ?? [])];
                        opts[idx] = { ...opt, values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) };
                        updateField("options", opts);
                      }}
                      placeholder="Values separated by commas (e.g. S, M, L, XL)"
                      className="w-full px-2 py-1 rounded border border-primary/10 bg-white text-xs focus:border-gold outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const opts = [...(form.options ?? []), { id: crypto.randomUUID(), name: "", type: "select" as const, values: [], required: true }];
                updateField("options", opts);
              }}
              className="w-full py-2 border-2 border-dashed border-primary/20 rounded-xl text-xs text-foreground/80 hover:border-primary/40 transition-colors"
            >
              + Add Option Dimension
            </button>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-primary">
                Variants * ({form.variants.length} total)
              </label>
              <button
                onClick={() => setUseMatrixEditor(!useMatrixEditor)}
                className="text-xs text-gold hover:text-gold-light transition-colors"
              >
                {useMatrixEditor ? "Manual Entry" : "Matrix Editor"}
              </button>
            </div>

            {useMatrixEditor ? (
              <VariantMatrixEditor
                variants={form.variants}
                onChange={(variants) => updateField("variants", variants)}
                options={form.options}
              />
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {form.variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 bg-warm-sand/30 rounded-lg px-3 py-2 text-sm">
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => updateVariant(v.id, "name", e.target.value)}
                        placeholder="Size / Color"
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-primary/10 bg-white text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.price}
                        onChange={(e) => updateVariant(v.id, "price", parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded-lg border border-primary/10 bg-white text-sm text-right focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                        placeholder="$0.00"
                      />
                      <input
                        type="text"
                        value={v.sku ?? ""}
                        onChange={(e) => updateVariant(v.id, "sku", e.target.value)}
                        placeholder="SKU"
                        className="w-20 px-2 py-1 rounded-lg border border-primary/10 bg-white text-xs focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={v.inventory ?? ""}
                        onChange={(e) => updateVariant(v.id, "inventory", e.target.value === "" ? undefined : parseInt(e.target.value) || 0)}
                        placeholder="Stock"
                        className="w-16 px-2 py-1 rounded-lg border border-primary/10 bg-white text-xs focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                      />
                      <button
                        onClick={() => removeVariant(v.id)}
                        className="text-red-400 hover:text-red-600 text-xs shrink-0"
                        title="Remove variant"
                      >
                        ✕
                      </button>
                      {/* Custom fields per variant — key/value attrs (grommets, material, etc.) */}
                      {(v.customFields?.length ?? 0) > 0 && (
                        <div className="w-full space-y-1">
                          <label className="block text-[10px] font-medium text-foreground">Custom Fields</label>
                          {v.customFields!.map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input type="text" value={f.key} placeholder="Key" onChange={(e) => {
                                const fields = [...(v.customFields ?? [])];
                                fields[i] = { ...fields[i], key: e.target.value };
                                updateVariant(v.id, "customFields", fields);
                              }} className="flex-1 px-2 py-1 rounded-lg border border-primary/20 focus:border-gold outline-none text-xs" />
                              <input type="text" value={f.value} placeholder="Value" onChange={(e) => {
                                const fields = [...(v.customFields ?? [])];
                                fields[i] = { ...fields[i], value: e.target.value };
                                updateVariant(v.id, "customFields", fields);
                              }} className="flex-1 px-2 py-1 rounded-lg border border-primary/20 focus:border-gold outline-none text-xs" />
                              <button onClick={() => {
                                const fields = (v.customFields ?? []).filter((_, j) => j !== i);
                                updateVariant(v.id, "customFields", fields.length > 0 ? fields : undefined);
                              }} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
                            </div>
                          ))}
                          <button
                            onClick={() => updateVariant(v.id, "customFields", [...(v.customFields ?? []), { key: "", value: "" }])}
                            className="text-[10px] text-gold hover:text-gold-light"
                          >
                            + Add field
                          </button>
                        </div>
                      )}
                      {(v.customFields?.length ?? 0) === 0 && (
                        <button
                          onClick={() => updateVariant(v.id, "customFields", [{ key: "", value: "" }])}
                          className="text-[10px] text-foreground/70 hover:text-gold"
                          title="Add custom attributes like grommets, material, etc."
                        >
                          +Attrs
                        </button>
                      )}
                    </div>
                  ))}
                  {form.variants.length === 0 && (
                    <p className="text-xs text-foreground/70">No variants. Add at least one.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                    placeholder="Name (e.g. Small / Black)"
                    className="flex-1 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                    placeholder="Price"
                    className="w-24 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                  <input
                    type="text"
                    value={newVariant.sku}
                    onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                    placeholder="SKU"
                    className="w-24 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                  <button
                    onClick={addVariant}
                    disabled={!newVariant.name || !newVariant.price}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Colors */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Colors ({form.colors.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(siteConfig.catalog_options?.colors ?? []).map((color) => (
                <button
                  key={color.name}
                  onClick={() => toggleColor(color.name.toLowerCase())}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    form.colors.includes(color.name.toLowerCase())
                      ? "bg-primary text-white"
                      : "bg-warm-sand/50 text-foreground hover:bg-warm-sand"
                  }`}
                >
                  {color.name}
                </button>
              ))}
            </div>
            {/* Custom color — prominent picker + hex input + name */}
            <div className="mt-3 pt-3 border-t border-primary/10">
              <label className="text-xs font-medium text-primary block mb-2">Add Custom Color</label>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={newHex}
                    onChange={(e) => setNewHex(e.target.value)}
                    className="w-9 h-9 rounded-lg border-2 border-primary/20 cursor-pointer hover:border-gold transition-colors shrink-0"
                    title="Pick color"
                  />
                  <input
                    type="text"
                    value={newHex}
                    onChange={(e) => setNewHex(e.target.value)}
                    placeholder="#1E4D4F"
                    className="w-24 px-2 py-2 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs font-mono"
                  />
                </div>
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomColor(); } }}
                  placeholder="Color name (e.g. neon green)"
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                />
                <button
                  onClick={addCustomColor}
                  disabled={!newColor.trim()}
                  className="px-4 py-2 bg-gold text-white rounded-xl text-sm font-medium hover:bg-gold-light transition-colors disabled:opacity-50 shrink-0"
                >
                  Add
                </button>
              </div>
              {/* Image color picker */}
              <div className="mt-3">
                <label className="text-xs text-foreground/70 block mb-1">Pick color from image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleColorPickerImageUpload}
                  className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-warm-sand file:text-foreground hover:file:bg-warm-sand/80 file:cursor-pointer"
                />
                {colorPickerImage && (
                  <div className="mt-2">
                    <p className="text-xs text-foreground/70 mb-1">Click on the image to pick a color:</p>
                    <canvas
                      ref={loadCanvasImage}
                      onClick={handleImageColorPick}
                      className="max-w-full max-h-48 border border-primary/20 rounded-lg cursor-crosshair"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <button
                      onClick={() => { setColorPickerImage(null); setColorPickerCanvas(null); }}
                      className="mt-1 text-xs text-red-400 hover:text-red-600"
                    >
                      Clear image
                    </button>
                  </div>
                )}
              </div>
            </div>
            {(siteConfig.catalog_options?.colors ?? []).length > 0 && form.colors.filter((c) => !(siteConfig.catalog_options?.colors ?? []).some((cc) => cc.name.toLowerCase() === c)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[10px] text-foreground/70 w-full">Custom colors:</span>
                {form.colors.filter((c) => !(siteConfig.catalog_options?.colors ?? []).some((cc) => cc.name.toLowerCase() === c)).map((c) => (
                  <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 rounded-full text-[10px]">
                    <span className="w-3 h-3 rounded-full border border-primary/20 inline-block" style={{ backgroundColor: colorSwatch(c) }} />
                    {c}
                    <button
                      onClick={() => saveColorToLibrary(c)}
                      className="text-gold hover:text-gold-light ml-1"
                      title="Save to the site color library (reusable on all products)"
                    >
                      Save
                    </button>
                    <button onClick={() => toggleColor(c)} className="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Color Images — assign gallery images to colors + swatch hex */}
          {form.colors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AdminTooltip content="Assign a gallery image to each color so the product page shows the right photo when a customer selects a color. The hex input sets the swatch dot color shown in the picker." dismissKey="color-images">
                  <label className="text-xs font-medium text-primary">Color Images</label>
                </AdminTooltip>
              </div>
              <div className="space-y-2">
                {form.colors.map((color) => {
                  const tint = form.colorTints?.[color] ?? "";
                  const perColor = form.mockupImagesByColor?.[color] ?? {};
                  return (
                    <div key={color} className="bg-warm-sand/30 rounded-lg px-3 py-2 space-y-2">
                      {/* Swatch hex + clear */}
                      <div className="flex items-center gap-3">
                        <span className="w-20 capitalize text-xs font-medium shrink-0">{color}</span>
                        <input
                          type="color"
                          value={tint || "#cccccc"}
                          onChange={(e) => setColorTint(color, e.target.value)}
                          className="w-9 h-9 rounded-lg border-2 border-primary/20 cursor-pointer hover:border-gold transition-colors shrink-0"
                          title={`Swatch color for ${color}`}
                        />
                        <input
                          type="text"
                          value={tint}
                          onChange={(e) => setColorTint(color, e.target.value)}
                          placeholder="#000000"
                          className="w-24 px-2 py-1.5 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs font-mono"
                        />
                        {tint && (
                          <button onClick={() => clearColorTint(color)} className="text-red-400 hover:text-red-600 text-xs shrink-0" title="Clear swatch color">✕</button>
                        )}
                      </div>
                      {/* Per-color photo row — assign gallery images to colors */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="w-20 text-[10px] text-foreground/80 shrink-0 pt-0.5">Images</span>
                        {(["front", "back", "sleeve", "sideL", "sideR"] as const).map((view) => {
                          const photo = perColor[view];
                          return (
                            <div key={view} className="flex items-center gap-1">
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white border border-primary/10 shrink-0">
                                {photo ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={photo} alt={`${color} ${view}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] text-foreground/70 capitalize">
                                    {view === "sideL" ? "Left" : view === "sideR" ? "Right" : view}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {/* Visual photo picker — click a thumbnail to assign it to this view */}
                                <div className="flex gap-0.5 flex-wrap max-w-[120px]">
                                  {form.images.length === 0 && (
                                    <span className="text-[8px] text-foreground/70">no gallery images</span>
                                  )}
                                  {form.images.map((url, i) => (
                                    <button
                                      key={url}
                                      type="button"
                                      onClick={() => setPerColorImage(color, view, url)}
                                      title={`Use image ${i + 1} for ${color} ${view}`}
                                      className={"w-6 h-6 rounded overflow-hidden border transition-all " + (
                                        photo === url
                                          ? "border-gold ring-1 ring-gold scale-110"
                                          : "border-primary/15 hover:border-gold opacity-70 hover:opacity-100"
                                      )}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`img ${i + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                                {photo && (
                                  <button onClick={() => removePerColorImage(color, view)} className="text-[9px] text-red-400 hover:text-red-600 text-left">
                                    remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[9px] text-foreground/70 w-full">
                          Click a thumbnail to assign it to this color. The front image is shown on the product page when this color is selected. Upload photos in the Image Manager first.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim()}
                className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Product Add-ons — modular per-product control */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AdminTooltip content="Add-ons customers can toggle in the customizer. Uncheck standard ones that don't apply to this product, edit any price, or add your own. Remove all to offer no add-ons." dismissKey="product-addons">
                <label className="text-xs font-medium text-primary">
                  Add-ons for this product ({workingAddons.length})
                </label>
              </AdminTooltip>
              {form.productAddons === undefined && (
                <span className="text-[10px] text-foreground/80 italic">using site defaults</span>
              )}
            </div>

            {/* Standard add-ons */}
            <div className="space-y-1 mb-3">
              {standardAddons.map((std) => {
                const active = workingAddons.find((a) => a.id === std.id);
                return (
                  <div key={std.id} className="flex items-center gap-2 bg-warm-sand/30 rounded-lg px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!active}
                      onChange={() => toggleStandardAddon(std.id, std.name)}
                      className="accent-gold w-4 h-4 shrink-0"
                    />
                    <span className="flex-1">{std.name}</span>
                    {active && (
                      <>
                        <span className="text-foreground/80">$</span>
                        <input
                          type="number" step="0.01" min="0" value={active.price}
                          onChange={(e) => updateAddon(std.id, "price", parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded-lg border border-primary/10 bg-white text-sm text-right focus:border-gold outline-none"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom add-ons */}
            <div className="space-y-2">
              {customAddons.map((a) => (
                <div key={a.id} className="flex items-center gap-2 bg-warm-sand/30 rounded-lg px-3 py-2 text-sm">
                  <input type="text" value={a.name} placeholder="Add-on name"
                    onChange={(e) => updateAddon(a.id, "name", e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg border border-primary/10 bg-white text-sm focus:border-gold outline-none" />
                  <span className="text-foreground/80">$</span>
                  <input type="number" step="0.01" min="0" value={a.price}
                    onChange={(e) => updateAddon(a.id, "price", parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 rounded-lg border border-primary/10 bg-white text-sm text-right focus:border-gold outline-none" />
                  <button onClick={() => removeAddon(a.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
              <button
                onClick={addCustomAddon}
                className="w-full py-2 border-2 border-dashed border-primary/20 rounded-xl text-xs text-foreground/80 hover:border-primary/40 transition-colors"
              >
                + Add Custom Add-on
              </button>
            </div>

            {form.productAddons !== undefined && (
              <button onClick={() => updateField("productAddons", undefined)} className="mt-2 text-xs text-foreground/80 hover:text-gold transition-colors">
                Reset to site defaults
              </button>
            )}
          </div>

          {/* Modifiers — add-ons with pricing model + text/file inputs (Phase 3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-primary">
                Modifiers ({(form.modifiers ?? []).length} configured)
              </label>
            </div>
            <p className="text-xs text-foreground/70 mb-3">
              Modifiers are add-ons that adjust price and can collect customer input.
              &quot;Fixed&quot; = dollar amount; &quot;Percent&quot; = % of base price.
              Input types: Toggle (price only), Text (e.g. name/number, engraving), File (e.g. custom artwork upload).
              Takes precedence over the legacy Add-ons section above.
            </p>
            <div className="space-y-2 mb-3">
              {(form.modifiers ?? []).map((mod, idx) => (
                <div key={mod.id} className="bg-warm-sand/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={mod.name}
                      onChange={(e) => {
                        const mods = [...(form.modifiers ?? [])];
                        mods[idx] = { ...mod, name: e.target.value };
                        updateField("modifiers", mods);
                      }}
                      placeholder="Modifier name"
                      className="flex-1 px-2 py-1 rounded border border-primary/10 bg-white text-sm focus:border-gold outline-none"
                    />
                    <select
                      value={mod.priceType}
                      onChange={(e) => {
                        const mods = [...(form.modifiers ?? [])];
                        mods[idx] = { ...mod, priceType: e.target.value as "fixed" | "percentage" };
                        updateField("modifiers", mods);
                      }}
                      className="w-24 px-2 py-1 rounded border border-primary/10 bg-white text-xs focus:border-gold outline-none"
                    >
                      <option value="fixed">$ Fixed</option>
                      <option value="percentage">% Percent</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mod.price}
                      onChange={(e) => {
                        const mods = [...(form.modifiers ?? [])];
                        mods[idx] = { ...mod, price: parseFloat(e.target.value) || 0 };
                        updateField("modifiers", mods);
                      }}
                      className="w-20 px-2 py-1 rounded border border-primary/10 bg-white text-sm text-right focus:border-gold outline-none"
                    />
                    <button
                      onClick={() => {
                        const mods = (form.modifiers ?? []).filter((_, i) => i !== idx);
                        updateField("modifiers", mods);
                      }}
                      className="text-red-400 hover:text-red-600 text-xs px-2"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={mod.inputType ?? "toggle"}
                      onChange={(e) => {
                        const mods = [...(form.modifiers ?? [])];
                        mods[idx] = { ...mod, inputType: e.target.value as "toggle" | "text" | "file" };
                        updateField("modifiers", mods);
                      }}
                      className="w-28 px-2 py-1 rounded border border-primary/10 bg-white text-xs focus:border-gold outline-none"
                    >
                      <option value="toggle">Toggle</option>
                      <option value="text">Text input</option>
                      <option value="file">File upload</option>
                    </select>
                    {(mod.inputType === "text" || mod.inputType === "file") && (
                      <input
                        type="text"
                        value={mod.inputLabel ?? ""}
                        onChange={(e) => {
                          const mods = [...(form.modifiers ?? [])];
                          mods[idx] = { ...mod, inputLabel: e.target.value };
                          updateField("modifiers", mods);
                        }}
                        placeholder="Input label (e.g. Enter name/number)"
                        className="flex-1 px-2 py-1 rounded border border-primary/10 bg-white text-xs focus:border-gold outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const mods = [...(form.modifiers ?? []), { id: crypto.randomUUID(), name: "", priceType: "fixed" as const, price: 0, inputType: "toggle" as const }];
                updateField("modifiers", mods);
              }}
              className="w-full py-2 border-2 border-dashed border-primary/20 rounded-xl text-xs text-foreground/80 hover:border-primary/40 transition-colors"
            >
              + Add Modifier
            </button>
            {form.modifiers !== undefined && (
              <button onClick={() => updateField("modifiers", undefined)} className="mt-2 text-xs text-foreground/80 hover:text-gold transition-colors">
                Reset to site defaults
              </button>
            )}
          </div>

          {/* Design Pinning — select which designs are printable on this product */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AdminTooltip content="Select up to 10 designs that customers can print on this product. These designs appear first in the customizer library when this product is selected." dismissKey="product-designs">
                <label className="text-xs font-medium text-primary">
                  Printable Designs ({form.designAssets?.length ?? 0} selected)
                </label>
              </AdminTooltip>
            </div>
            {allDesigns.length === 0 ? (
              <p className="text-xs text-foreground/70">No designs available. Add designs in the Designs tab first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {allDesigns.slice(0, 50).map((d) => {
                  const selected = form.designAssets?.some((a) => a.id === d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        const current = form.designAssets ?? [];
                        if (selected) {
                          updateField("designAssets", current.filter((a) => a.id !== d.id));
                        } else if (current.length < 10) {
                          updateField("designAssets", [...current, d]);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        selected
                          ? "bg-gold/10 border-gold/30 text-gold"
                          : "bg-warm-sand/30 border-transparent text-foreground hover:border-primary/20"
                      }`}
                    >
                      <Image
                        src={d.image_url}
                        alt={d.name}
                        width={20}
                        height={20}
                        className="rounded object-cover shrink-0"
                      />
                      <span className="truncate max-w-[120px]">{d.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Single-design constraint */}
          <div>
            <AdminTooltip content="When enabled, customers pick only ONE design for this item (a single image — the Name/Number text tool is hidden). Use for items that can only take one printed design." dismissKey="single-design">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.singleDesign}
                  onChange={(e) => updateField("singleDesign", e.target.checked ? true : undefined)}
                  className="accent-gold"
                />
                Limit to one design per item
              </label>
            </AdminTooltip>
          </div>

          {/* Product Attributes — optional visual specs (bg, shape, border, custom fields) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AdminTooltip content="Optional visual attributes shown on the product page. Leave fields empty to hide them. Custom key-value pairs can hold any extra spec (e.g. material, grommets)." dismissKey="product-attrs">
                <label className="text-xs font-medium text-primary">Product Attributes (optional)</label>
              </AdminTooltip>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-1">Background Color</label>
                <div className="flex gap-1 items-center">
                  <input
                    type="color"
                    value={form.attributes?.backgroundColor ?? "#ffffff"}
                    onChange={(e) => updateField("attributes", { ...form.attributes, backgroundColor: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-primary/20 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={form.attributes?.backgroundColor ?? ""}
                    onChange={(e) => updateField("attributes", { ...form.attributes, backgroundColor: e.target.value || undefined })}
                    placeholder="#1E4D4F"
                    className="flex-1 px-2 py-1.5 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-1">Patch Shape</label>
                <select
                  value={form.attributes?.patchShape ?? ""}
                  onChange={(e) => updateField("attributes", { ...form.attributes, patchShape: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs"
                >
                  <option value="">—</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="rounded">Rounded</option>
                  <option value="oval">Oval</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-1">Border Style</label>
                <select
                  value={form.attributes?.borderStyle ?? ""}
                  onChange={(e) => updateField("attributes", { ...form.attributes, borderStyle: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-xs"
                >
                  <option value="">—</option>
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
            </div>
            {/* Custom key-value pairs */}
            <div className="mt-3">
              <label className="block text-[10px] font-medium text-foreground mb-1">Custom Fields</label>
              <div className="space-y-1">
                {(form.attributes?.customFields ?? []).map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={f.key} placeholder="Key" onChange={(e) => {
                      const fields = [...(form.attributes?.customFields ?? [])];
                      fields[i] = { ...fields[i], key: e.target.value };
                      updateField("attributes", { ...form.attributes, customFields: fields });
                    }} className="flex-1 px-2 py-1 rounded-lg border border-primary/20 focus:border-gold outline-none text-xs" />
                    <input type="text" value={f.value} placeholder="Value" onChange={(e) => {
                      const fields = [...(form.attributes?.customFields ?? [])];
                      fields[i] = { ...fields[i], value: e.target.value };
                      updateField("attributes", { ...form.attributes, customFields: fields });
                    }} className="flex-1 px-2 py-1 rounded-lg border border-primary/20 focus:border-gold outline-none text-xs" />
                    <button onClick={() => {
                      const fields = (form.attributes?.customFields ?? []).filter((_, j) => j !== i);
                      updateField("attributes", { ...form.attributes, customFields: fields.length > 0 ? fields : undefined });
                    }} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
                  </div>
                ))}
                <button onClick={() => {
                  const fields = [...(form.attributes?.customFields ?? []), { key: "", value: "" }];
                  updateField("attributes", { ...form.attributes, customFields: fields });
                }} className="text-xs text-gold hover:text-gold-light transition-colors">+ Add field</button>
              </div>
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Images ({form.images.length})
            </label>
            {uploadError && (
              <p className="text-xs text-red-500 mb-2">{uploadError}</p>
            )}
            <div className="flex flex-wrap gap-3 mb-2">
              {form.images.map((url) => (
                <div key={url} className="relative group">
                  <Image
                    src={url}
                    alt=""
                    width={80}
                    height={80}
                    className="rounded-xl object-cover border border-warm-sand"
                  />
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary/20 rounded-xl cursor-pointer hover:border-primary/40 transition-colors text-sm text-foreground">
              {uploading ? `Uploading ${Math.round(uploadProgress)}%...` : "Choose Image"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Save */}
          <div className="space-y-2 pt-2">
            {saveError && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm flex items-center justify-between">
                <span>{saveError}</span>
                <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.categoryId || form.variants.length === 0}
                className="px-6 py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
              >
                {saving ? "Saving..." : editing?.id ? "Update Product" : "Create Product"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 text-sm text-foreground hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
