"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ManagedCategory } from "@/types";

export default function CategoryManager() {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, [loadCategories]);

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await setDoc(doc(db, "categories", id), {
      id,
      name,
      slug,
      order: categories.length,
      parentId: newParentId || null,
      createdAt: now,
      updatedAt: now,
    });
    setNewName("");
    setNewParentId("");
    loadCategories();
  };

  const startEdit = (cat: ManagedCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditParentId(cat.parentId ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const slug = editName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await setDoc(doc(db, "categories", editingId), {
      ...categories.find((c) => c.id === editingId),
      name: editName.trim(),
      slug,
      parentId: editParentId || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    setEditingId(null);
    loadCategories();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Products in this category will become uncategorized.")) return;
    await deleteDoc(doc(db, "categories", id));
    loadCategories();
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const a = categories[index];
    const b = categories[index - 1];
    const batch = writeBatch(db);
    batch.set(doc(db, "categories", a.id), { ...a, order: index - 1 }, { merge: true });
    batch.set(doc(db, "categories", b.id), { ...b, order: index }, { merge: true });
    await batch.commit();
    loadCategories();
  };

  const moveDown = async (index: number) => {
    if (index >= categories.length - 1) return;
    const a = categories[index];
    const b = categories[index + 1];
    const batch = writeBatch(db);
    batch.set(doc(db, "categories", a.id), { ...a, order: index + 1 }, { merge: true });
    batch.set(doc(db, "categories", b.id), { ...b, order: index }, { merge: true });
    await batch.commit();
    loadCategories();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold font-display text-lg">{categories.length} Categories</h3>
          <p className="text-xs text-foreground/80">Drag-and-drop ordering coming soon</p>
        </div>
      </div>

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
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-foreground/50 hover:text-primary disabled:opacity-20 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(i)}
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
                    {categories.filter((c) => c.id !== cat.id).map((c) => (
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
