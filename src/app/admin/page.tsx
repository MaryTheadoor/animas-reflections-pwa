"use client";

import { useState, useEffect, useCallback, Component, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { useAuth, RequireAdmin } from "@/context/auth-context";
import { SITE } from "@/lib/content";
import ProductManager from "@/components/admin/product-manager";
import CategoryManager from "@/components/admin/category-manager";
import ImageManager from "@/components/admin/image-manager";
import type { ManagedCategory, DesignAsset } from "@/types";
import { DismissedTooltipsCount } from "@/components/ui/admin-tooltip";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-cream">
          <div className="text-center p-8">
            <h1 className="text-xl font-bold font-display mb-4">Dashboard Error</h1>
            <p className="text-red-500 text-sm mb-4 font-mono">{this.state.error}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="px-6 py-3 bg-gold text-white rounded-2xl font-semibold">
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SiteConfigData {
  announcement_text: string;
  announcement_active: boolean;
  primary_color: string;
  accent_color: string;
  background_color: string;
  shipping_tier_stickers: number;
  shipping_tier_apparel: number;
  free_shipping_threshold: number;
  addon_price: number;
  hero_heading: string;
  hero_subheading: string;
  about_body: string;
}

const DEFAULT_CONFIG: SiteConfigData = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,
  primary_color: "#1E4D4F",
  accent_color: "#D97706",
  background_color: "#FAF6F0",
  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,
  hero_heading: "Custom Designs On An Array Of Products",
  hero_subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  about_body: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary mb-1">{label}</label>
      {children}
    </div>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"products" | "categories" | "settings" | "designs" | "images" | "orders" | "users" | "admins">("products");
  const [config, setConfig] = useState<SiteConfigData>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [designs, setDesigns] = useState<DesignAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [designCategory, setDesignCategory] = useState("");
  const [designName, setDesignName] = useState("");
  const [designDescription, setDesignDescription] = useState("");
  const [designTags, setDesignTags] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ products: number; categories: number; items: number } | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [managedCategories, setManagedCategories] = useState<ManagedCategory[]>([]);

  const loadDesigns = useCallback(async () => {
    try {
      // Read from designs/ collection (individual docs)
      const snap = await getDocs(collection(db, "designs"));
      const items: DesignAsset[] = [];
      snap.forEach((d) => {
        const data = d.data() as DesignAsset;
        if (data.name && data.image_url) items.push(data);
      });
      items.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      setDesigns(items);
    } catch {
      // Fallback: old format designs/catalog doc
      try {
        const snap = await getDoc(doc(db, "designs", "catalog"));
        if (snap.exists()) {
          setDesigns((snap.data() as { items?: DesignAsset[] }).items ?? []);
        } else {
          setDesigns([]);
        }
      } catch {
        setDesigns([]);
      }
    }
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try { const snap = await getDoc(doc(db, "config", "site"));
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as SiteConfigData);
      } catch {}
    };
    const loadSyncStatus = async () => {
      try { const snap = await getDoc(doc(db, "config", "sync_status"));
      if (snap.exists()) {
        const data = snap.data() as { productCount?: number; categoryCount?: number; itemCount?: number };
        setSyncResult({ products: data.productCount ?? 0, categories: data.categoryCount ?? 0, items: data.itemCount ?? 0 });
      }
      } catch {}
    };
    const loadAdmins = async () => {
      try { const snap = await getDoc(doc(db, "config", "admin"));
      if (snap.exists()) setAdminEmails((snap.data() as { emails?: string[] }).emails ?? []);
      } catch {}
    };
    const loadCats = async () => {
      try { const snap = await getDocs(collection(db, "categories"));
      const cats: ManagedCategory[] = [];
      snap.forEach((d) => { const data = d.data() as ManagedCategory; if (data.id && data.name) cats.push(data); });
      cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setManagedCategories(cats);
      } catch {}
    };
    loadConfig();
    loadSyncStatus();
    loadAdmins();
    loadCats();
  }, []);

  // Reload designs when switching tabs
  useEffect(() => {
    if (tab !== "designs") return;
    const t = setTimeout(() => loadDesigns(), 0);
    return () => clearTimeout(t);
  }, [tab, loadDesigns]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const callable = httpsCallable(functions, "saveSiteConfig");
      await callable(config as unknown as Record<string, unknown>);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaving(false);
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const migrateDesigns = async () => {
    if (!confirm("Migrate all designs from old catalog format to individual docs?")) return;
    try {
      const snap = await getDoc(doc(db, "designs", "catalog"));
      if (!snap.exists()) {
        alert("No old catalog to migrate.");
        return;
      }
      const items = (snap.data() as { items?: DesignAsset[] }).items ?? [];
      if (items.length === 0) {
        alert("No designs to migrate.");
        return;
      }
      for (const item of items) {
        await setDoc(doc(db, "designs", item.id), item);
      }
      await deleteDoc(doc(db, "designs", "catalog"));
      setDesigns(items);
      alert(`Migrated ${items.length} designs to individual docs.`);
    } catch (err) {
      alert("Migration failed: " + (err instanceof Error ? err.message : "Unknown"));
    }
  };

  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!designName.trim() || !designCategory.trim()) {
      setUploadError("Name and category are required");
      return;
    }
    if (!user) {
      setUploadError("You must be signed in to upload designs");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const designId = crypto.randomUUID();
    const tags = designTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      const fileRef = ref(storage, `designs/${designId}_${file.name}`);
      const task = uploadBytesResumable(fileRef, file);

      task.on("state_changed",
        (snapshot) => {
          setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (err) => {
          setUploading(false);
          setUploadError(err.message || "Upload failed");
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const newAsset: DesignAsset = {
            id: designId,
            name: designName.trim(),
            description: designDescription.trim() || undefined,
            category: designCategory.trim(),
            image_url: url,
            tags: tags.length > 0 ? tags : undefined,
            created_at: new Date().toISOString(),
          };

          // Write as individual doc in designs/ collection
          await setDoc(doc(db, "designs", designId), newAsset);
          setDesigns((prev) => [...prev, newAsset]);
          setUploading(false);
          setUploadProgress(0);
          setDesignName("");
          setDesignCategory("");
          setDesignDescription("");
          setDesignTags("");
        }
      );
    } catch (err) {
      setUploading(false);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }

    e.target.value = "";
  };

  const removeDesign = async (id: string) => {
    if (!confirm("Delete this design?")) return;
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    // Delete individual design doc
    await deleteDoc(doc(db, "designs", id)).catch(() => {});
    // Also try removing from old catalog format if it exists
    try {
      const snap = await getDoc(doc(db, "designs", "catalog"));
      if (snap.exists()) {
        const items = (snap.data() as { items?: DesignAsset[] }).items ?? [];
        const updated = items.filter((d) => d.id !== id);
        if (updated.length === 0) {
          await deleteDoc(doc(db, "designs", "catalog"));
        } else {
          await setDoc(doc(db, "designs", "catalog"), { items: updated });
        }
      }
    } catch {}
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
        setSyncError(data.errors.join(", "));
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const callable = httpsCallable<object, { imported: number; errors: string[] }>(
        functions,
        "importProducts"
      );
      const result = await callable({});
      const data = result.data;
      setSyncResult({ products: data.imported ?? 0, categories: 0, items: data.imported ?? 0 });
      if (data.errors?.length) {
        setSyncError(data.errors.join(", "));
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Delete ALL products, categories, designs, and instances?")) return;
    setSyncing(true);
    try {
      const callable = httpsCallable<object, { success: boolean; message: string }>(
        functions,
        "clearProducts"
      );
      await callable({});
      setSyncResult({ products: 0, categories: 0, items: 0 });
      setSyncing(false);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Clear failed");
      setSyncing(false);
    }
  };

  const handlePipeline = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const callable = httpsCallable<object, { baseProducts: number; designs: number; instances: number; items: number; errors: string[] }>(
        functions,
        "runPipeline"
      );
      const result = await callable({});
      const data = result.data;
      setSyncResult({ products: data.instances ?? 0, categories: (data.baseProducts ?? 0) + (data.designs ?? 0), items: data.items ?? 0 });
      if (data.errors?.length) {
        setSyncError(data.errors.slice(0, 3).join("; "));
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setSyncing(false);
    }
  };

  const addAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || adminEmails.includes(email)) return;
    const updated = [...adminEmails, email];
    setAdminEmails(updated);
    try {
      const callable = httpsCallable(functions, "saveAdminEmails");
      await callable({ emails: updated });
    } catch {}
    setNewAdminEmail("");
  };

  const removeAdmin = async (email: string) => {
    const updated = adminEmails.filter((e) => e !== email);
    setAdminEmails(updated);
    try {
      const callable = httpsCallable(functions, "saveAdminEmails");
      await callable({ emails: updated });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-primary text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt={SITE.name} width={36} height={36} className="rounded-lg" />
            <div><h1 className="font-bold font-display">Admin Dashboard</h1><p className="text-xs text-white/60">{user?.email}</p></div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">View Site</Link>
            <button onClick={logout} className="text-sm px-3 py-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-4 space-y-6">
        <DismissedTooltipsCount />

        {/* ── Tab Navigation ── */}
        <div className="flex flex-wrap gap-1 bg-white rounded-2xl p-1.5 border border-warm-sand">
          {[
            { key: "products" as const, label: "Products" },
            { key: "categories" as const, label: "Categories" },
            { key: "settings" as const, label: "Settings" },
            { key: "designs" as const, label: "Designs" },
            { key: "images" as const, label: "Images" },
            { key: "orders" as const, label: "Orders" },
            { key: "users" as const, label: "Users" },
            { key: "admins" as const, label: "Admins" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-white"
                  : "text-primary/50 hover:text-primary hover:bg-warm-sand/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Products ── */}
        {tab === "products" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <ProductManager categories={managedCategories} />
          </section>
        )}

        {/* ── Categories ── */}
        {tab === "categories" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <CategoryManager />
          </section>
        )}

        {/* ── Settings ── */}
        {tab === "settings" && (
          <>
            {/* ── Square Sync ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold font-display">Catalog Sync</h2>
              <p className="text-sm text-primary/60 mt-1">
                Pull products from Square and build composite product catalog
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 btn-tactile btn-primary-tactile"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
              <button
                onClick={handleImport}
                disabled={syncing}
                className="px-4 py-2.5 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
              >
                {syncing ? "Importing..." : "Import from Square"}
              </button>
              <button
                onClick={handlePipeline}
                disabled={syncing}
                className="px-4 py-2.5 bg-plum text-white rounded-xl text-sm font-semibold hover:bg-plum-light transition-colors disabled:opacity-50 btn-tactile btn-plum-tactile"
              >
                {syncing ? "Running..." : "Run Pipeline"}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          {syncResult && (
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="bg-warm-sand/50 rounded-xl p-3">
                <p className="text-2xl font-bold text-primary">{syncResult.products}</p>
                <p className="text-xs text-primary/50">Products</p>
              </div>
              <div className="bg-warm-sand/50 rounded-xl p-3">
                <p className="text-2xl font-bold text-primary">{syncResult.categories}</p>
                <p className="text-xs text-primary/50">Categories</p>
              </div>
              <div className="bg-warm-sand/50 rounded-xl p-3">
                <p className="text-2xl font-bold text-primary">{syncResult.items}</p>
                <p className="text-xs text-primary/50">Square Items</p>
              </div>
            </div>
          )}
          {syncError && (
            <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{syncError}</div>
          )}
          <p className="text-xs text-primary/30">
            Sync runs automatically daily at 4 AM Mountain Time. Click &quot;Sync Now&quot; to run manually.
          </p>
        </section>

        {/* ── Site Settings ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-6">Site Settings</h2>

          {/* Announcement */}
          <Field label="Announcement Banner">
            <input type="text" value={config.announcement_text}
              onChange={(e) => setConfig({ ...config, announcement_text: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
            <label className="flex items-center gap-2 mt-2 text-sm text-primary/60 cursor-pointer">
              <input type="checkbox" checked={config.announcement_active}
                onChange={(e) => setConfig({ ...config, announcement_active: e.target.checked })} className="accent-gold" />
              Show announcement banner
            </label>
          </Field>

          {/* Colors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
            {[
              { key: "primary_color" as const, label: "Primary Color" },
              { key: "accent_color" as const, label: "Accent Color" },
              { key: "background_color" as const, label: "Background Color" },
            ].map(({ key, label }) => (
              <Field key={key} label={label}>
                <div className="flex gap-2 items-center">
                  <input type="color" value={config[key]}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    className="w-12 h-10 rounded-lg border border-primary/20 cursor-pointer" />
                  <input type="text" value={config[key]}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    className="flex-1 px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none font-mono text-sm" />
                </div>
              </Field>
            ))}
          </div>

          {/* Website Copy */}
          <div className="mt-6">
            <h3 className="font-bold font-display text-sm mb-3 text-primary">Website Copy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Hero Heading">
                <input type="text" value={config.hero_heading}
                  onChange={(e) => setConfig({ ...config, hero_heading: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              </Field>
              <Field label="Hero Subheading">
                <input type="text" value={config.hero_subheading}
                  onChange={(e) => setConfig({ ...config, hero_subheading: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="About / Our Story Text">
                <textarea rows={5} value={config.about_body}
                  onChange={(e) => setConfig({ ...config, about_body: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm resize-y" />
              </Field>
            </div>
          </div>

          {/* Shipping & Pricing */}
          <div className="mt-6">
            <h3 className="font-bold font-display text-sm mb-3 text-primary">Shipping &amp; Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Stickers Rate ($)">
                <input type="number" step="0.01" value={config.shipping_tier_stickers}
                  onChange={(e) => setConfig({ ...config, shipping_tier_stickers: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Apparel Rate ($)">
                <input type="number" step="0.01" value={config.shipping_tier_apparel}
                  onChange={(e) => setConfig({ ...config, shipping_tier_apparel: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Free Shipping Threshold ($)">
                <input type="number" step="0.01" value={config.free_shipping_threshold}
                  onChange={(e) => setConfig({ ...config, free_shipping_threshold: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Add-on Price ($)">
                <input type="number" step="0.01" value={config.addon_price}
                  onChange={(e) => setConfig({ ...config, addon_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="mt-6 px-6 py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile">
            {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </section>
        </>
        )}

        {/* ── Admin Management ── */}
        {tab === "admins" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">Admin Users</h2>
            <p className="text-sm text-primary/60 mb-4">
              Users listed here have full access to the admin dashboard. They must sign in first via the login page.
            </p>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Add admin email..."
              className="flex-1 px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
            <button
              onClick={addAdmin}
              disabled={!newAdminEmail.trim()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {adminEmails.length > 0 ? (
            <div className="space-y-1">
              {adminEmails.map((email) => (
                <div key={email} className="flex items-center justify-between bg-warm-sand/30 rounded-lg px-4 py-2 text-sm">
                  <span className="text-primary">{email}</span>
                  <button
                    onClick={() => removeAdmin(email)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-primary/40">No admin emails configured. Add at least one to enable admin access.</p>
          )}
          <p className="text-xs text-primary/30 mt-3">
            The hardcoded fallback admin is <code className="bg-warm-sand px-1 rounded">mary.theadoor.doctor@gmail.com</code>.
          </p>
        </section>
        )}

        {/* ── Design Catalog ── */}
        {tab === "designs" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">Design Catalog</h2>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-primary/60">
                {designs.length} designs. Upload brand logos, team designs, and artwork. Each design has its own database record.
              </p>
              <button
                onClick={migrateDesigns}
                className="px-3 py-1 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                title="Migrate from old catalog format to individual design docs"
              >
                Migrate Old Data
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center justify-between">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input type="text" value={designName} onChange={(e) => setDesignName(e.target.value)}
                placeholder="Design name *" className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              <input type="text" value={designCategory} onChange={(e) => setDesignCategory(e.target.value)}
                placeholder="Category * (e.g. Durango High Football)" className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              <input type="text" value={designDescription} onChange={(e) => setDesignDescription(e.target.value)}
                placeholder="Description (optional)" className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              <input type="text" value={designTags} onChange={(e) => setDesignTags(e.target.value)}
                placeholder="Tags: comma, separated" className="px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            </div>
            <div className="mb-6">
              <label className={`flex items-center justify-center px-4 py-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-sm ${
                uploading ? "border-gold/50 bg-gold/5 text-gold" : "border-primary/20 text-primary/50 hover:border-primary/40"
              }`}>
                {uploading ? `Uploading ${Math.round(uploadProgress)}%` : "Choose File"}
                <input type="file" accept="image/*" onChange={handleDesignUpload}
                  disabled={uploading || !designName.trim() || !designCategory.trim()} className="hidden" />
              </label>
            </div>
          {designs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {designs.map((d) => (
                <div key={d.id} className="bg-warm-sand/50 rounded-xl p-3 relative group">
                  <Image src={d.image_url} alt={d.name} width={120} height={120} className="mx-auto rounded-lg mb-2 object-contain h-20" />
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-xs text-primary/40 truncate">{d.category}</p>
                  {d.description && <p className="text-[10px] text-primary/30 truncate mt-0.5">{d.description}</p>}
                  {d.tags && d.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 justify-center">
                      {d.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[9px] bg-primary/10 text-primary/60 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => removeDesign(d.id)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity">&times;</button>
                </div>
              ))}
            </div>
          )}
          {designs.length === 0 && <p className="text-sm text-primary/40 text-center py-8">No designs uploaded yet.</p>}
        </section>
        )}

        {/* ── Image Manager ── */}
        {tab === "images" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <ImageManager />
          </section>
        )}

        {/* ── Recent Orders ── */}
        {tab === "orders" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">Recent Orders</h2>
            <OrdersSection />
          </section>
        )}

        {/* ── User Management ── */}
        {tab === "users" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">User Management</h2>
            <UsersSection />
          </section>
        )}
      </main>
    </div>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState<{ id: string; squareOrderId?: string; state: string; total: number; createdAt: string; customerEmail?: string; customerName?: string; trackingUrl?: string; trackingNumber?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 15;

  const loadOrders = useCallback(() => {
    httpsCallable(functions, "fetchRecentOrders")({})
      .then((r) => setOrders((r.data as { orders: typeof orders }).orders ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const saveTracking = async (orderId: string, orderDocId: string) => {
    setSavingTracking(true);
    try {
      const callable = httpsCallable(functions, "updateOrderTracking");
      await callable({ orderId: orderDocId || `order_${orderId}`, trackingUrl, trackingNumber: "" });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, trackingUrl } : o));
      setTrackingUrl("");
    } catch (e) {
      alert("Failed to save tracking: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSavingTracking(false);
    }
  };

  const totalPages = Math.ceil(orders.length / PER_PAGE);
  const pagedOrders = orders.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (loading) return <p className="text-sm text-primary/50">Loading orders...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!orders?.length) return <p className="text-sm text-primary/40">No orders yet.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-primary/40">
        <span>{orders.length} orders</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 rounded hover:bg-warm-sand disabled:opacity-30">&laquo;</button>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-warm-sand disabled:opacity-30">&lsaquo;</button>
            <span className="px-2">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-warm-sand disabled:opacity-30">&rsaquo;</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-warm-sand disabled:opacity-30">&raquo;</button>
          </div>
        )}
      </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-primary/50 border-b border-warm-sand">
          <th className="pb-2 font-medium">Order ID</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Tracking</th>
        </tr></thead>
        <tbody>
          {pagedOrders.map((o) => (
            <tr key={o.id} className="border-b border-warm-sand/30">
              <td className="py-2 font-mono text-xs text-primary/60">{o.id?.slice(0, 12)}</td>
              <td className="py-2 text-xs text-primary/60">{o.customerEmail || o.customerName || "-"}</td>
              <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${o.state === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.state}</span></td>
              <td className="py-2 text-right font-mono">${o.total.toFixed(2)}</td>
              <td className="py-2 text-primary/50">{new Date(o.createdAt as string).toLocaleDateString()}</td>
              <td className="py-2">
                {o.trackingUrl ? (
                  <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold text-xs hover:underline">Track</a>
                ) : (
                  <button
                    onClick={() => { setExpandedId(o.id); setTrackingUrl(""); }}
                    className="text-xs text-primary/30 hover:text-gold"
                  >
                    + Add
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {expandedId && (
        <div className="mt-4 p-4 bg-warm-sand/30 rounded-xl flex items-center gap-2">
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://track.carrier.com/..."
            className="flex-1 px-3 py-2 rounded-lg border border-primary/20 bg-white text-sm focus:border-gold outline-none"
          />
          <button
            onClick={() => saveTracking(expandedId, `order_${expandedId}`)}
            disabled={savingTracking || !trackingUrl}
            className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {savingTracking ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setExpandedId(null)} className="px-3 py-2 text-sm text-primary/40 hover:text-primary">Cancel</button>
        </div>
      )}
      </div>
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<{ uid: string; email: string; created: string; updatedAt?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then((snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as typeof users[0])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-primary/50">Loading users...</p>;
  if (error) {
    return (
      <div>
        <p className="text-sm text-red-500 mb-2">Could not load users: {error}</p>
        <p className="text-xs text-primary/40">
          Manage authentication in{" "}
          <a
            href="https://console.firebase.google.com/project/animas-reflections-pwa/authentication/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            Firebase Console
          </a>
          . Update Firestore rules if needed.
        </p>
      </div>
    );
  }
  if (!users?.length) {
    return (
      <div>
        <p className="text-sm text-primary/40">
          No registered users found. Manage authentication in{" "}
          <a
            href="https://console.firebase.google.com/project/animas-reflections-pwa/authentication/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            Firebase Console
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-primary/40 mb-3">{users.length} users registered.</p>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center justify-between text-sm p-2 bg-warm-sand/30 rounded-lg">
            <span className="font-medium">{u.email}</span>
            <span className="text-xs text-primary/40">
              {u.updatedAt
                ? `Last seen ${new Date(u.updatedAt).toLocaleDateString()}`
                : u.created
                  ? `Joined ${new Date(u.created).toLocaleDateString()}`
                  : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return <RequireAdmin><ErrorBoundary><DashboardContent /></ErrorBoundary></RequireAdmin>;
}
