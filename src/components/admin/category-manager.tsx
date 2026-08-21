"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import type { ManagedCategory } from "@/types";

/** Collect every descendant of `id` (children, grandchildren, ...). */
function collectDescendants(list: ManagedCategory[], id: string, out: Set<string>): void {
  for (const c of list) {
    if (c.parentId === id && !out.has(c.id)) {
      out.add(c.id);
      collectDescendants(list, c.id, out);
    }
  }
}

/** Broadcast after any category mutation so other admin components can refresh. */
function notifyCategoriesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("admin-categories-changed"));
  }
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");

  const loadCategories = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      const items: ManagedCategory[] = [];
      snap.forEach((d) => {
        const data = d.data() as ManagedCategory;
        if (!data.id || !data.name) return;
        items.push({
          id: data.id,
          name: data.name,
          slug: data.slug ?? "",
          order: data.order ?? 0,
          parentId: data.parentId || undefined,
          createdAt: data.createdAt ?? "",
          updatedAt: data.updatedAt ?? "",
        });
      });
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setCategories(items);
    } catch (err) {
      console.error("Category load failed", err);
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, [loadCategories]);

  // Slug names must be unique — URL/SEO routing depends on them.
  const uniqueSlug = (base: string, excludeId: string | null): string => {
    const taken = new Set(categories.filter((c) => c.id !== excludeId).map((c) => c.slug));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await setDoc(doc(db, "categories", id), {
        id,
        name,
        slug: uniqueSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), null),
        order: categories.length,
        parentId: newParentId || null,
        createdAt: now,
        updatedAt: now,
      });
      setNewName("");
      setNewParentId("");
      notifyCategoriesChanged();
      loadCategories();
    } catch (err) {
      console.error("Category save failed", err);
      setError("Failed to save category");
    }
  };

  const startEdit = (cat: ManagedCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditParentId(cat.parentId ?? "");
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setError(null);
    const existing = categories.find((c) => c.id === editingId);
    if (!existing) return;
    try {
      await setDoc(doc(db, "categories", editingId), stripUndefined({
        ...existing,
        name: editName.trim(),
        slug: uniqueSlug(editName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), editingId),
        parentId: editParentId || null,
        updatedAt: new Date().toISOString(),
      }), { merge: true });
      setEditingId(null);
      notifyCategoriesChanged();
      loadCategories();
    } catch (err) {
      console.error("Category edit failed", err);
      setError("Failed to save category");
    }
  };

  const deleteCategory = async (id: string) => {
    setError(null);
    // A category that still has children would orphan them, and one that still
    // has products would leave dangling categoryIds on those products. Block
    // both and ask the admin to reassign first.
    const children = categories.filter((c) => c.parentId === id);
    if (children.length > 0) {
      setError(
        `Cannot delete — ${children.length} subcategor${children.length === 1 ? "y is" : "ies are"} still under it. Move or delete them first.`
      );
      return;
    }
    try {
      const productSnap = await getDocs(
        query(collection(db, "products"), where("categoryId", "==", id), limit(1))
      );
      if (!productSnap.empty) {
        setError("Cannot delete — products are still assigned to this category. Reassign them first.");
        return;
      }
    } catch (err) {
      console.error("Product assignment check failed", err);
      setError("Could not verify the category is empty — try again.");
      return;
    }

    const name = categories.find((c) => c.id === id)?.name ?? "this category";
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      notifyCategoriesChanged();
      loadCategories();
    } catch (err) {
      console.error("Category delete failed", err);
      setError("Failed to delete category");
    }
  };

  const reorder = async (index: number, direction: -1 | 1) => {
    const other = index + direction;
    if (other < 0 || other >= categories.length) return;
    setError(null);
    const a = categories[index];
    const b = categories[other];
    try {
      const batch = writeBatch(db);
      // stripUndefined is critical here: top-level categories carry
      // parentId: undefined in memory, which the Firestore SDK rejects.
      batch.set(doc(db, "categories", a.id), stripUndefined({ ...a, order: other }), { merge: true });
      batch.set(doc(db, "categories", b.id), stripUndefined({ ...b, order: index }), { merge: true });
      await batch.commit();
      notifyCategoriesChanged();
      loadCategories();
    } catch (err) {
      console.error("Category reorder failed", err);
      setError("Failed to reorder categories");
    }
  };

  // A category may not be its own descendant (cycle prevention) — exclude the
  // whole subtree, not just the category itself, from the parent selector.
  const descendants = new Set<string>();
  if (editingId) collectDescendants(categories, editingId, descendants);
  const allowedParents = categories.filter(
    (c) => c.id !== editingId && !descendants.has(c.id)
  );

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold font-display text-lg">{categories.length} Categories</h3>
          <p className="text-xs text-foreground/80">Drag-and-drop ordering coming soon</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
          placeholder="New category name..."
          className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
        />
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-primary/20 focus:border-gold outline-none text-sm"
          title="Parent category (leave as Top-level for a main category)"
        >
          <option value="">Top-level</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={addCategory}
          disabled={!newName.trim()}
          className="px-4 py-2 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-foreground/80 text-center py-8">
          No categories yet. Create one to start organizing products.
        </p>
      ) : (
        <div className="space-y-1">
          {categories.map((cat, i) => {
            const parent = cat.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;
            return (
            <div
              key={cat.id}
              className={"flex items-center gap-2 bg-warm-sand/30 rounded-xl px-4 py-3" + (parent ? " ml-8" : "")}
            >
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => reorder(i, -1)}
                  disabled={i === 0}
                  className="text-foreground/50 hover:text-primary disabled:opacity-20 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => reorder(i, 1)}
                  disabled={i >= categories.length - 1}
                  className="text-foreground/50 hover:text-primary disabled:opacity-20 text-xs leading-none"
                >
                  ▼
                </button>
              </div>
              {editingId === cat.id ? (
                <div className="flex-1 flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                    className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                    autoFocus
                  />
                  <select
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-primary/20 bg-white text-xs"
                    title="Parent category"
                  >
                    <option value="">Top-level</option>
                    {allowedParents.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1 bg-gold text-white rounded-lg text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-xs text-foreground/80 hover:text-primary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-medium text-sm">
                    {parent && <span className="text-foreground/60 text-xs mr-1">↳</span>}
                    {cat.name}
                  </span>
                  {parent && (
                    <span className="text-[10px] text-foreground/70 bg-primary/10 rounded-full px-2 py-0.5">
                      under {parent.name}
                    </span>
                  )}
                  <span className="text-xs text-foreground/70">{cat.slug}</span>
                  <button
                    onClick={() => startEdit(cat)}
                    className="px-2 py-1 text-xs text-foreground/80 hover:text-primary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
