"use client";

import { useState, useEffect, useCallback } from "react";
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
import { db, storage, functions } from "@/lib/firebase";
import type { ManagedProduct, ManagedCategory } from "@/types";

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
};

const AVAILABLE_COLORS = [
  "black", "white", "gray", "navy", "blue", "red", "green", "sage",
  "cream", "heather", "charcoal", "maroon", "purple", "pink", "orange",
];

interface Props {
  categories: ManagedCategory[];
}

export default function ProductManager({ categories }: Props) {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedProduct | null>(null);
  const [form, setForm] = useState<ManagedProduct>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newTag, setNewTag] = useState("");
  const [newVariant, setNewVariant] = useState({ name: "", price: "", sku: "" });

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ products: number; categories: number; items: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pushingToSquare, setPushingToSquare] = useState<string | null>(null); // productId being pushed

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
  }, [loadProducts]);

  const resetForm = () => {
    setForm(EMPTY_PRODUCT);
    setEditing(null);
    setNewTag("");
    setNewVariant({ name: "", price: "", sku: "" });
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

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const toggleColor = (color: string) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter((c) => c !== color)
        : [...prev.colors, color],
    }));
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const fileRef = ref(storage, `products/${Date.now()}-${file.name}`);
    const task = uploadBytesResumable(fileRef, file);
    task.on(
      "state_changed",
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      () => setUploading(false),
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
    const now = new Date().toISOString();
    const docId = editing?.id ?? crypto.randomUUID();
    const product: ManagedProduct = {
      ...form,
      id: docId,
      name: form.name.trim(),
      description: form.description.trim(),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await setDoc(doc(db, "products", docId), product);
    setSaving(false);
    resetForm();
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await deleteDoc(doc(db, "products", id));
    loadProducts();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const callable = httpsCallable<object, { success: boolean; products: number; categories: number; items: number; errors: string[] }>(
        functions,
        "syncProducts"
      );
      const result = await callable({});
      const data = result.data;
      setSyncResult({ products: data.products ?? 0, categories: data.categories ?? 0, items: data.items ?? 0 });
      if (data.errors?.length) {
        setSyncError(data.errors.slice(0, 3).join("; "));
      }
      await loadProducts();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handlePushToSquare = async (productId: string) => {
    setPushingToSquare(productId);
    try {
      const callable = httpsCallable<{ productId: string }, { success: boolean; squareItemId: string }>(
        functions,
        "createSquareProduct"
      );
      await callable({ productId });
      await loadProducts();
    } catch (err) {
      alert("Failed to push to Square: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setPushingToSquare(null);
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

  return (
    <div className="space-y-6">
      {/* ── Product List ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold font-display text-lg">{products.length} Products</h3>
          <p className="text-xs text-primary/40">
            {products.filter((p) => p.squareItemIds?.length).length} synced from Square
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 btn-tactile btn-primary-tactile"
            title="Pull latest products from Square and sync to Firestore"
          >
            {syncing ? "Syncing..." : "Sync from Square"}
          </button>
          <button
            onClick={() => startEdit(EMPTY_PRODUCT)}
            className="px-4 py-2 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncResult && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xl font-bold text-green-700">{syncResult.products}</p>
            <p className="text-xs text-green-600">Products</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xl font-bold text-green-700">{syncResult.categories}</p>
            <p className="text-xs text-green-600">Categories</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xl font-bold text-green-700">{syncResult.items}</p>
            <p className="text-xs text-green-600">Square Items</p>
          </div>
        </div>
      )}
      {syncError && (
        <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{syncError}</div>
      )}

      {products.length > 0 && !editing && (
        <div className="space-y-1">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-warm-sand/30 rounded-xl px-4 py-3"
            >
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
                <p className="text-xs text-primary/40">
                  {p.variants?.length ?? 0} variants · {categories.find((c) => c.id === p.categoryId)?.name ?? p.categoryId}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.squareItemIds?.length ? (
                  <span className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-full font-medium">Square</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] bg-warm-sand text-primary/40 rounded-full">Manual</span>
                )}
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
        <p className="text-sm text-primary/40 text-center py-8">
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
            <button onClick={resetForm} className="text-sm text-primary/40 hover:text-primary">
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm resize-y"
            />
          </div>

          {/* Status toggles */}
          <div className="flex gap-6">
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
          </div>

          {/* Variants */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Variants * (size, style, etc.)
            </label>
            <div className="space-y-2 mb-3">
              {form.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2 bg-warm-sand/30 rounded-lg px-3 py-2 text-sm">
                  <span className="flex-1 font-medium">{v.name}</span>
                  <span className="text-gold font-medium">${v.price.toFixed(2)}</span>
                  {v.sku && <span className="text-primary/30 text-xs">{v.sku}</span>}
                  <button
                    onClick={() => removeVariant(v.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {form.variants.length === 0 && (
                <p className="text-xs text-primary/30">No variants. Add at least one.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newVariant.name}
                onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                placeholder="Name (e.g. Small)"
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
          </div>

          {/* Colors */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Colors ({form.colors.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    form.colors.includes(color)
                      ? "bg-primary text-white"
                      : "bg-warm-sand/50 text-primary/60 hover:bg-warm-sand"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

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

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-primary mb-2">
              Images ({form.images.length})
            </label>
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
            <label className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary/20 rounded-xl cursor-pointer hover:border-primary/40 transition-colors text-sm text-primary/50">
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
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.categoryId || form.variants.length === 0}
              className="px-6 py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
            >
              {saving ? "Saving..." : editing?.id ? "Update Product" : "Create Product"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 text-sm text-primary/50 hover:text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
