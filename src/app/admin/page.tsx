"use client";

import { useState, useEffect, useCallback, Component, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-utils";
import { useAuth, RequireAdmin } from "@/context/auth-context";
import { SITE } from "@/lib/content";
import ProductManager from "@/components/admin/product-manager";
import CategoryManager from "@/components/admin/category-manager";
import ImageManager from "@/components/admin/image-manager";
import type { ManagedCategory, DesignAsset } from "@/types";
import PlaceholderImage from "@/components/ui/placeholder-image";
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
  gold_color: string;
  plum_color: string;
  cream_color: string;
  warm_sand_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  shipping_tier_stickers: number;
  shipping_tier_apparel: number;
  free_shipping_threshold: number;
  addon_price: number;
  hero_heading: string;
  hero_subheading: string;
  about_heading: string;
  about_body: string;
  fundraising_heading: string;
  fundraising_subheading: string;
  footer_tagline: string;
  catalog_options?: {
    colors?: { name: string; hex: string }[];
    sizes?: string[];
    productTypes?: { value: string; label: string }[];
    customOptionNames?: string[];
  };
  addon_defaults?: {
    defaultPriceType?: "fixed" | "percentage";
    defaultPrice?: number;
    standardAddons?: { id: string; name: string; priceType: "fixed" | "percentage"; price: number }[];
  };
  customer_fields?: {
    id: string;
    label: string;
    type: "text" | "email" | "tel" | "select";
    required: boolean;
    placeholder?: string;
    squareMapping?: string;
  }[];
}

const DEFAULT_CONFIG: SiteConfigData = {
  announcement_text: "Family Owned & Operated From Durango, CO USA — Free shipping on orders over $100",
  announcement_active: true,
  primary_color: "#1E4D4F",
  accent_color: "#D97706",
  background_color: "#FAF6F0",
  gold_color: "#D97706",
  plum_color: "#935B8A",
  cream_color: "#FAF6F0",
  warm_sand_color: "#F5EBE6",
  text_color: "#111827",
  heading_font: "Georgia, 'Times New Roman', serif",
  body_font: "system-ui, -apple-system, sans-serif",
  shipping_tier_stickers: 3.0,
  shipping_tier_apparel: 7.5,
  free_shipping_threshold: 100.0,
  addon_price: 5.0,
  hero_heading: "Custom Designs On An Array Of Products",
  hero_subheading: "Discover Endless Possibilities With Our Custom Designs Printed On An Array Of Products",
  about_heading: "From Our Family To Yours",
  about_body: "At Animas Reflections, we are a family-owned and operated design & print operation based in Durango, CO.",
  fundraising_heading: "Fundraising Made Easy",
  fundraising_subheading: "Raise money for your team, school, or cause with custom merchandise.",
  footer_tagline: "Family owned and operated design & print operation based in Durango, CO.",
  catalog_options: {
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Navy", hex: "#1E3A5F" },
      { name: "Heather Grey", hex: "#9CA3AF" },
      { name: "Charcoal", hex: "#4B5563" },
      { name: "Royal Blue", hex: "#2563EB" },
      { name: "Red", hex: "#DC2626" },
      { name: "Forest Green", hex: "#166534" },
      { name: "Maroon", hex: "#7F1D1D" },
      { name: "Sand", hex: "#D4A574" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    productTypes: [
      { value: "apparel", label: "Apparel" },
      { value: "sticker", label: "Sticker / Slap" },
      { value: "sign", label: "Wood Sign" },
      { value: "jewelry", label: "Jewelry" },
      { value: "accessory", label: "Accessory" },
      { value: "other", label: "Other" },
    ],
    customOptionNames: [],
  },
  addon_defaults: {
    defaultPriceType: "fixed",
    defaultPrice: 5.0,
    standardAddons: [
      { id: "back_print", name: "Back Print", priceType: "fixed", price: 5.0 },
      { id: "sleeve_print", name: "Sleeve Print", priceType: "fixed", price: 5.0 },
      { id: "personalization", name: "Name/Number", priceType: "fixed", price: 5.0 },
    ],
  },
  customer_fields: [
    { id: "firstName", label: "First Name", type: "text", required: true, squareMapping: "firstName" },
    { id: "lastName", label: "Last Name", type: "text", required: false, squareMapping: "lastName" },
    { id: "email", label: "Email", type: "email", required: true, squareMapping: "email" },
    { id: "phone", label: "Phone", type: "tel", required: false, squareMapping: "phone" },
    { id: "address", label: "Street Address", type: "text", required: true, squareMapping: "address.addressLine1" },
    { id: "city", label: "City", type: "text", required: true, squareMapping: "address.locality" },
    { id: "state", label: "State", type: "text", required: false, squareMapping: "address.administrativeDistrictLevel1" },
    { id: "zip", label: "ZIP Code", type: "text", required: true, squareMapping: "address.postalCode" },
  ],
};

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [managedCategories, setManagedCategories] = useState<ManagedCategory[]>([]);

  const loadDesigns = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "designs"));
      const items: DesignAsset[] = [];
      snap.forEach((d) => {
        const data = d.data() as DesignAsset;
        if (data.name && data.image_url) items.push(data);
      });
      items.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      setDesigns(items);
    } catch (e) {
      console.error("Designs load failed:", e);
      setDesigns([]);
    }
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try { const snap = await getDoc(doc(db, "config", "site"));
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as SiteConfigData);
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

  const handleDesignUpload = async () => {
    if (!selectedFile) return;
    if (!designName.trim() || !designCategory.trim()) { setUploadError("Name and category are required"); return; }
    if (!user) { setUploadError("You must be signed in to upload designs"); return; }
    setUploading(true); setUploadError(null); setUploadProgress(0); setUploadSuccess(false);
    const designId = crypto.randomUUID();
    const tags = designTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    try {
      const fileRef = ref(storage, `designs/${designId}_${selectedFile.name}`);
      const task = uploadBytesResumable(fileRef, selectedFile);

      // Track progress
      task.on("state_changed",
        (snapshot) => {
          setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      );

      // Await completion
      await task;
      const url = await getDownloadURL(fileRef);

      const newAsset: DesignAsset = {
        id: designId,
        name: designName.trim(),
        description: designDescription.trim() || undefined,
        category: designCategory.trim(),
        image_url: url,
        tags: tags.length > 0 ? tags : undefined,
        created_at: new Date().toISOString(),
      };

      // description/tags are undefined when left blank — strip them or the SDK
      // rejects the write ("Unsupported field value: undefined"), which surfaced
      // as the live design-upload errors.
      await setDoc(doc(db, "designs", designId), stripUndefined(newAsset));
      setDesigns((prev) => [...prev, newAsset]);
      setUploading(false);
      setUploadProgress(0);
      setDesignName(""); setDesignCategory(""); setDesignDescription(""); setDesignTags("");
      setSelectedFile(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err) {
      console.error("Design upload failed:", err);
      setUploading(false);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };
  const removeDesign = async (id: string) => {
    if (!confirm("Delete this design?")) return;
    const target = designs.find((d) => d.id === id);
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    try {
      if (target?.image_url) {
        const urlPath = decodeURIComponent(target.image_url.split("/o/")[1]?.split("?")[0] ?? "");
        if (urlPath) await deleteObject(ref(storage, urlPath));
      }
    } catch {}
    await deleteDoc(doc(db, "designs", id)).catch(() => {});
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
                  : "text-foreground hover:text-primary hover:bg-warm-sand/50"
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
        {/* ── Catalog Options ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6 mb-6">
          <h2 className="text-xl font-bold font-display mb-6">Catalog Options</h2>
          <p className="text-sm text-foreground/80 mb-6">
            Configure the available options for products across the site. These settings affect the product editor, customizer, and search filters.
          </p>

          {/* Colors */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold" /> Colors
            </h3>
            <div className="space-y-2 mb-3">
              {(config.catalog_options?.colors ?? []).map((color, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) => {
                      const colors = [...(config.catalog_options?.colors ?? [])];
                      colors[idx] = { ...color, hex: e.target.value };
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, colors } });
                    }}
                    className="w-8 h-8 rounded border border-primary/20 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={color.name}
                    onChange={(e) => {
                      const colors = [...(config.catalog_options?.colors ?? [])];
                      colors[idx] = { ...color, name: e.target.value };
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, colors } });
                    }}
                    className="flex-1 px-3 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                    placeholder="Color name"
                  />
                  <input
                    type="text"
                    value={color.hex}
                    onChange={(e) => {
                      const colors = [...(config.catalog_options?.colors ?? [])];
                      colors[idx] = { ...color, hex: e.target.value };
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, colors } });
                    }}
                    className="w-24 px-2 py-1.5 rounded border border-primary/20 focus:border-gold outline-none font-mono text-xs"
                    placeholder="#000000"
                  />
                  <button
                    onClick={() => {
                      const colors = (config.catalog_options?.colors ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, colors } });
                    }}
                    className="text-red-400 hover:text-red-600 text-xs px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const colors = [...(config.catalog_options?.colors ?? []), { name: "", hex: "#000000" }];
                setConfig({ ...config, catalog_options: { ...config.catalog_options, colors } });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Color
            </button>
          </div>

          {/* Sizes */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-plum" /> Sizes
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {(config.catalog_options?.sizes ?? []).map((size, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-warm-sand/50 rounded-lg px-3 py-1.5">
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => {
                      const sizes = [...(config.catalog_options?.sizes ?? [])];
                      sizes[idx] = e.target.value;
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, sizes } });
                    }}
                    className="w-16 px-2 py-0.5 rounded border border-primary/20 focus:border-gold outline-none text-sm text-center"
                  />
                  <button
                    onClick={() => {
                      const sizes = (config.catalog_options?.sizes ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, sizes } });
                    }}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const sizes = [...(config.catalog_options?.sizes ?? []), ""];
                setConfig({ ...config, catalog_options: { ...config.catalog_options, sizes } });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Size
            </button>
          </div>

          {/* Product Types */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" /> Product Types
            </h3>
            <div className="space-y-2 mb-3">
              {(config.catalog_options?.productTypes ?? []).map((pt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pt.value}
                    onChange={(e) => {
                      const productTypes = [...(config.catalog_options?.productTypes ?? [])];
                      productTypes[idx] = { ...pt, value: e.target.value };
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, productTypes } });
                    }}
                    className="w-32 px-3 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm font-mono"
                    placeholder="value"
                  />
                  <input
                    type="text"
                    value={pt.label}
                    onChange={(e) => {
                      const productTypes = [...(config.catalog_options?.productTypes ?? [])];
                      productTypes[idx] = { ...pt, label: e.target.value };
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, productTypes } });
                    }}
                    className="flex-1 px-3 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                    placeholder="Display label"
                  />
                  <button
                    onClick={() => {
                      const productTypes = (config.catalog_options?.productTypes ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, productTypes } });
                    }}
                    className="text-red-400 hover:text-red-600 text-xs px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const productTypes = [...(config.catalog_options?.productTypes ?? []), { value: "", label: "" }];
                setConfig({ ...config, catalog_options: { ...config.catalog_options, productTypes } });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Product Type
            </button>
          </div>

          {/* Custom Option Names */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal" /> Custom Option Names
            </h3>
            <p className="text-xs text-foreground/70 mb-3">
              Additional option dimensions beyond size/color (e.g., &quot;Material&quot;, &quot;Finish&quot;, &quot;Grommet Count&quot;)
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(config.catalog_options?.customOptionNames ?? []).map((name, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-warm-sand/50 rounded-lg px-3 py-1.5">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const customOptionNames = [...(config.catalog_options?.customOptionNames ?? [])];
                      customOptionNames[idx] = e.target.value;
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, customOptionNames } });
                    }}
                    className="w-32 px-2 py-0.5 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                  />
                  <button
                    onClick={() => {
                      const customOptionNames = (config.catalog_options?.customOptionNames ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, catalog_options: { ...config.catalog_options, customOptionNames } });
                    }}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const customOptionNames = [...(config.catalog_options?.customOptionNames ?? []), ""];
                setConfig({ ...config, catalog_options: { ...config.catalog_options, customOptionNames } });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Custom Option
            </button>
          </div>

          {/* Standard Add-ons */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold" /> Standard Add-ons
            </h3>
            <p className="text-xs text-foreground/70 mb-3">
              Default add-ons available on all products (can be overridden per product)
            </p>
            <div className="space-y-2 mb-3">
              {(config.addon_defaults?.standardAddons ?? []).map((addon, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addon.id}
                    onChange={(e) => {
                      const standardAddons = [...(config.addon_defaults?.standardAddons ?? [])];
                      standardAddons[idx] = { ...addon, id: e.target.value };
                      setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
                    }}
                    className="w-32 px-3 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm font-mono"
                    placeholder="id"
                  />
                  <input
                    type="text"
                    value={addon.name}
                    onChange={(e) => {
                      const standardAddons = [...(config.addon_defaults?.standardAddons ?? [])];
                      standardAddons[idx] = { ...addon, name: e.target.value };
                      setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
                    }}
                    className="flex-1 px-3 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                    placeholder="Name"
                  />
                  <select
                    value={addon.priceType}
                    onChange={(e) => {
                      const standardAddons = [...(config.addon_defaults?.standardAddons ?? [])];
                      standardAddons[idx] = { ...addon, priceType: e.target.value as "fixed" | "percentage" };
                      setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
                    }}
                    className="w-24 px-2 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                  >
                    <option value="fixed">$ Fixed</option>
                    <option value="percentage">% Percent</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={addon.price}
                    onChange={(e) => {
                      const standardAddons = [...(config.addon_defaults?.standardAddons ?? [])];
                      standardAddons[idx] = { ...addon, price: parseFloat(e.target.value) || 0 };
                      setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
                    }}
                    className="w-20 px-2 py-1.5 rounded border border-primary/20 focus:border-gold outline-none text-sm text-right"
                  />
                  <button
                    onClick={() => {
                      const standardAddons = (config.addon_defaults?.standardAddons ?? []).filter((_, i) => i !== idx);
                      setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
                    }}
                    className="text-red-400 hover:text-red-600 text-xs px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const standardAddons = [...(config.addon_defaults?.standardAddons ?? []), { id: "", name: "", priceType: "fixed" as const, price: 0 }];
                setConfig({ ...config, addon_defaults: { ...config.addon_defaults, standardAddons } });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Add-on
            </button>
          </div>

          {/* Customer Fields */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" /> Customer Fields
            </h3>
            <p className="text-xs text-foreground/70 mb-3">
              Fields collected at checkout for shipping and order processing
            </p>
            <div className="space-y-3 mb-3">
              {(config.customer_fields ?? []).map((field, idx) => (
                <div key={idx} className="bg-warm-sand/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={field.id}
                      onChange={(e) => {
                        const customer_fields = [...(config.customer_fields ?? [])];
                        customer_fields[idx] = { ...field, id: e.target.value };
                        setConfig({ ...config, customer_fields });
                      }}
                      className="w-32 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none text-xs font-mono"
                      placeholder="field id"
                    />
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => {
                        const customer_fields = [...(config.customer_fields ?? [])];
                        customer_fields[idx] = { ...field, label: e.target.value };
                        setConfig({ ...config, customer_fields });
                      }}
                      className="flex-1 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none text-sm"
                      placeholder="Label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const customer_fields = [...(config.customer_fields ?? [])];
                        customer_fields[idx] = { ...field, type: e.target.value as "text" | "email" | "tel" | "select" };
                        setConfig({ ...config, customer_fields });
                      }}
                      className="w-24 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none text-xs"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="select">Select</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => {
                          const customer_fields = [...(config.customer_fields ?? [])];
                          customer_fields[idx] = { ...field, required: e.target.checked };
                          setConfig({ ...config, customer_fields });
                        }}
                        className="accent-gold"
                      />
                      Required
                    </label>
                    <button
                      onClick={() => {
                        const customer_fields = (config.customer_fields ?? []).filter((_, i) => i !== idx);
                        setConfig({ ...config, customer_fields });
                      }}
                      className="text-red-400 hover:text-red-600 text-xs px-2"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={field.placeholder || ""}
                      onChange={(e) => {
                        const customer_fields = [...(config.customer_fields ?? [])];
                        customer_fields[idx] = { ...field, placeholder: e.target.value };
                        setConfig({ ...config, customer_fields });
                      }}
                      className="flex-1 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none text-xs"
                      placeholder="Placeholder text"
                    />
                    <input
                      type="text"
                      value={field.squareMapping || ""}
                      onChange={(e) => {
                        const customer_fields = [...(config.customer_fields ?? [])];
                        customer_fields[idx] = { ...field, squareMapping: e.target.value };
                        setConfig({ ...config, customer_fields });
                      }}
                      className="flex-1 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none text-xs font-mono"
                      placeholder="Square mapping (e.g., email)"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const customer_fields = [...(config.customer_fields ?? []), { id: "", label: "", type: "text" as const, required: false }];
                setConfig({ ...config, customer_fields });
              }}
              className="px-4 py-2 bg-warm-sand text-foreground rounded-xl text-sm font-medium hover:bg-warm-sand/80 transition-colors"
            >
              + Add Customer Field
            </button>
          </div>
        </section>

        {/* ── Site Settings — Theming Engine ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-6">Theme Settings</h2>

          {/* ── Brand Colors ── */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold" /> Brand Colors
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {([
                { key: "primary_color" as const, label: "Primary (Text/Nav)", hint: "Teal" },
                { key: "accent_color" as const, label: "Accent (Buttons)", hint: "Gold" },
                { key: "gold_color" as const, label: "Gold (CTAs)", hint: "Warm amber" },
                { key: "plum_color" as const, label: "Plum (Badges)", hint: "Purple" },
                { key: "background_color" as const, label: "Background", hint: "Cream" },
                { key: "cream_color" as const, label: "Cream (Surfaces)", hint: "Warm white" },
                { key: "warm_sand_color" as const, label: "Warm Sand (Cards)", hint: "Beige" },
                { key: "text_color" as const, label: "Text Color", hint: "Dark" },
              ] as const).map(({ key, label, hint }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded border border-primary/20" style={{ backgroundColor: config[key] }} />
                    <span className="text-xs font-medium text-primary">{label}</span>
                    <span className="text-[10px] text-foreground/70">{hint}</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="color" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      className="w-8 h-8 rounded border border-primary/20 cursor-pointer shrink-0" />
                    <input type="text" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      className="flex-1 px-2 py-1 rounded border border-primary/20 focus:border-gold outline-none font-mono text-[11px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Typography ── */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-plum" /> Typography
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Heading Font</label>
                <select value={config.heading_font} onChange={(e) => setConfig({ ...config, heading_font: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold outline-none text-sm">
                  <option value="Georgia, 'Times New Roman', serif">Georgia / Times (Serif)</option>
                  <option value="system-ui, -apple-system, sans-serif">System UI (Sans-serif)</option>
                  <option value="'Playfair Display', serif">Playfair Display (Elegant)</option>
                  <option value="'Arial Black', Impact, sans-serif">Impact / Arial Black</option>
                  <option value="'Courier New', monospace">Courier New (Monospace)</option>
                </select>
                <p className="text-[10px] text-foreground/70 mt-1">Used for h1-h4 headings and display text</p>
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Body Font</label>
                <select value={config.body_font} onChange={(e) => setConfig({ ...config, body_font: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold outline-none text-sm">
                  <option value="system-ui, -apple-system, sans-serif">System UI (Sans-serif)</option>
                  <option value="Georgia, 'Times New Roman', serif">Georgia / Times (Serif)</option>
                  <option value="Arial, Helvetica, sans-serif">Arial / Helvetica</option>
                  <option value="'Segoe UI', Roboto, sans-serif">Segoe UI / Roboto</option>
                </select>
                <p className="text-[10px] text-foreground/70 mt-1">Used for paragraphs, inputs, and general text</p>
              </div>
            </div>
          </div>

          {/* ── Announcement ── */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold" /> Announcement Banner
            </h3>
            <input type="text" value={config.announcement_text}
              onChange={(e) => setConfig({ ...config, announcement_text: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-primary/20 focus:border-gold outline-none text-sm mb-2" />
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={config.announcement_active}
                onChange={(e) => setConfig({ ...config, announcement_active: e.target.checked })} className="accent-gold" />
              Show announcement banner
            </label>
          </div>

          {/* ── Website Copy ── */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" /> Website Copy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Hero Heading</label>
                <input type="text" value={config.hero_heading} onChange={(e) => setConfig({ ...config, hero_heading: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Hero Subheading</label>
                <input type="text" value={config.hero_subheading} onChange={(e) => setConfig({ ...config, hero_subheading: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">About Heading</label>
                <input type="text" value={config.about_heading} onChange={(e) => setConfig({ ...config, about_heading: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Footer Tagline</label>
                <input type="text" value={config.footer_tagline} onChange={(e) => setConfig({ ...config, footer_tagline: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-primary block mb-1">About / Our Story</label>
                <textarea rows={4} value={config.about_body} onChange={(e) => setConfig({ ...config, about_body: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm resize-y" />
              </div>
            </div>
          </div>

          {/* ── Shipping & Pricing ── */}
          <div className="mb-8">
            <h3 className="font-bold font-display text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal" /> Shipping &amp; Pricing
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Stickers Rate ($)</label>
                <input type="number" step="0.01" value={config.shipping_tier_stickers}
                  onChange={(e) => setConfig({ ...config, shipping_tier_stickers: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Apparel Rate ($)</label>
                <input type="number" step="0.01" value={config.shipping_tier_apparel}
                  onChange={(e) => setConfig({ ...config, shipping_tier_apparel: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Free Shipping Over ($)</label>
                <input type="number" step="0.01" value={config.free_shipping_threshold}
                  onChange={(e) => setConfig({ ...config, free_shipping_threshold: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-primary block mb-1">Default Add-on Price ($)</label>
                <input type="number" step="0.01" value={config.addon_price}
                  onChange={(e) => setConfig({ ...config, addon_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold outline-none text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button onClick={saveConfig} disabled={saving}
              className="px-6 py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile">
              {saving ? "Saving..." : "Save Theme"}
            </button>
            {saved && <span className="text-sm text-green-600 animate-fade-in-up">Saved!</span>}
          </div>
        </section>
          </>
        )}

        {/* ── Admin Management ── */}
        {tab === "admins" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">Admin Users</h2>
            <p className="text-sm text-foreground mb-4">
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
            <p className="text-sm text-foreground/80">No admin emails configured. Add at least one to enable admin access.</p>
          )}
          <p className="text-xs text-foreground/70 mt-3">
            The hardcoded fallback admin is <code className="bg-warm-sand px-1 rounded">mary.theadoor.doctor@gmail.com</code>.
          </p>
        </section>
        )}

        {/* ── Design Catalog ── */}
        {tab === "designs" && (
          <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h2 className="text-xl font-bold font-display mb-4">Design Catalog</h2>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-foreground">
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
            {uploadSuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm">Design published successfully! It will appear in the product editor under Printable Designs.</div>
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
            <div className="flex items-center gap-3 mb-6">
              <label className={`flex-1 flex items-center justify-center px-4 py-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-sm ${
                selectedFile ? "border-gold bg-gold/5 text-gold" : "border-primary/20 text-foreground hover:border-primary/40"
              }`}>
                {selectedFile ? `File: ${selectedFile.name}` : "Choose Image File"}
                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  disabled={uploading} className="hidden" />
              </label>
              <button
                onClick={handleDesignUpload}
                disabled={uploading || !selectedFile || !designName.trim() || !designCategory.trim()}
                className="px-6 py-2 rounded-xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors disabled:opacity-40 btn-tactile btn-gold-tactile text-sm shrink-0"
              >
                {uploading ? `Uploading ${Math.round(uploadProgress)}%` : "Publish Design"}
              </button>
            </div>
          {designs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {designs.map((d) => (
                <div key={d.id} className="bg-warm-sand/50 rounded-xl p-3 relative group">
                  <div className="mx-auto mb-2 h-20 rounded-lg overflow-hidden bg-warm-sand/80 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.image_url}
                      alt={d.name}
                      className="object-contain h-20 w-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <PlaceholderImage className="hidden h-full" />
                  </div>
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-xs text-foreground/80 truncate">{d.category}</p>
                  {d.description && <p className="text-[10px] text-foreground/70 truncate mt-0.5">{d.description}</p>}
                  {d.tags && d.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 justify-center">
                      {d.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[9px] bg-primary/10 text-foreground px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => removeDesign(d.id)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity">&times;</button>
                </div>
              ))}
            </div>
          )}
          {designs.length === 0 && <p className="text-sm text-foreground/80 text-center py-8">No designs uploaded yet.</p>}
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
  const [orders, setOrders] = useState<{ id: string; squareOrderId?: string; state: string; total: number; createdAt: string; customerEmail?: string; customerName?: string; trackingUrl?: string; trackingNumber?: string; items?: { name: string; quantity: number; designUrl?: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [designOpenId, setDesignOpenId] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 15;

  const loadOrders = useCallback(() => {
    Promise.all([
      httpsCallable(functions, "fetchRecentOrders")({}),
      getDocs(collection(db, "orders")),
    ])
      .then(([r, fsSnap]) => {
        const squareOrders = (r.data as { orders: typeof orders }).orders ?? [];
        // Build a lookup of Firestore mirror orders by Square order ID to merge
        // rich data (design files, customer info, tracking) into the view.
        const fsMap = new Map<string, typeof orders[0]>();
        fsSnap.forEach((d) => {
          const data = d.data() as { squareOrderId?: string; items?: { name: string; quantity: number; designUrl?: string }[] };
          if (data.squareOrderId) fsMap.set(data.squareOrderId, data as typeof orders[0]);
        });
        setOrders(squareOrders.map((o) => ({ ...o, ...(fsMap.get(o.id as string) ?? {}) })));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const saveTracking = async (orderId: string, orderDocId: string) => {
    setSavingTracking(true);
    try {
      const callable = httpsCallable(functions, "updateOrderTracking");
      await callable({ orderId: orderDocId || `order_${orderId}`, trackingUrl, trackingNumber });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, trackingUrl, trackingNumber } : o));
      setTrackingUrl("");
      setTrackingNumber("");
    } catch (e) {
      alert("Failed to save tracking: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSavingTracking(false);
    }
  };

  const totalPages = Math.ceil(orders.length / PER_PAGE);
  const pagedOrders = orders.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (loading) return <p className="text-sm text-foreground">Loading orders...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!orders?.length) return <p className="text-sm text-foreground/80">No orders yet.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-foreground/80">
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
        <thead><tr className="text-left text-foreground border-b border-warm-sand">
          <th className="pb-2 font-medium">Order ID</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium">Designs</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Tracking</th>
        </tr></thead>
        <tbody>
          {pagedOrders.map((o) => {
            const designCount = (o.items ?? []).filter((i) => i.designUrl).length;
            const isOpen = designOpenId === o.id;
            return (
              <>
                <tr key={o.id} className="border-b border-warm-sand/30">
                  <td className="py-2 font-mono text-xs text-foreground">{o.id?.slice(0, 12)}</td>
                  <td className="py-2 text-xs text-foreground">{o.customerEmail || o.customerName || "-"}</td>
                  <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${o.state === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.state}</span></td>
                  <td className="py-2 text-right font-mono">${o.total.toFixed(2)}</td>
                  <td className="py-2 text-xs">
                    {designCount > 0 ? (
                      <button
                        onClick={() => setDesignOpenId(isOpen ? null : o.id)}
                        className="text-gold hover:underline font-medium"
                      >
                        {isOpen ? "▾" : "▸"} {designCount} file{designCount > 1 ? "s" : ""}
                      </button>
                    ) : (
                      <span className="text-foreground/70">—</span>
                    )}
                  </td>
                  <td className="py-2 text-foreground">{new Date(o.createdAt as string).toLocaleDateString()}</td>
                  <td className="py-2">
                    {o.trackingUrl ? (
                      <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold text-xs hover:underline">Track</a>
                    ) : (
                      <button
                        onClick={() => { setExpandedId(o.id); setTrackingUrl(""); setTrackingNumber(""); }}
                        className="text-xs text-foreground/70 hover:text-gold"
                      >
                        + Add
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && designCount > 0 && (
                  <tr className="bg-warm-sand/10">
                    <td colSpan={7} className="py-3 px-4">
                      <p className="text-xs font-medium text-foreground mb-2">Design files for printing:</p>
                      <div className="space-y-1">
                        {(o.items ?? []).filter((i) => i.designUrl).map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-foreground/80">{item.name} × {item.quantity}</span>
                            <a href={item.designUrl} target="_blank" rel="noopener noreferrer"
                              className="text-gold hover:underline truncate max-w-xs">
                              {item.designUrl?.split("/").pop()?.split("?")[0] ?? "View design"} ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {expandedId && (
        <div className="mt-4 p-4 bg-warm-sand/30 rounded-xl space-y-2">
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://track.carrier.com/..."
            className="w-full px-3 py-2 rounded-lg border border-primary/20 bg-white text-sm focus:border-gold outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Tracking number (e.g. 1Z999AA10123456784)"
              className="flex-1 px-3 py-2 rounded-lg border border-primary/20 bg-white text-sm focus:border-gold outline-none"
            />
            <button
              onClick={() => saveTracking(expandedId, `order_${expandedId}`)}
              disabled={savingTracking || (!trackingUrl && !trackingNumber)}
              className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {savingTracking ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setExpandedId(null)} className="px-3 py-2 text-sm text-foreground/80 hover:text-primary">Cancel</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Firestore stores timestamps as Timestamp objects (with .toDate()); some older
// docs may hold ISO strings. Normalize both to a Date, or null if invalid —
// calling `new Date()` on a raw Timestamp yields "Invalid Date".
function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = typeof (value as { toDate?: () => Date }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown): string | null {
  return toDate(value)?.toLocaleDateString() ?? null;
}

function UsersSection() {
  type UserRow = {
    uid: string;
    email: string;
    displayName?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
    orderCount: number;
  };
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load users and all orders together, then tally orders per customer email.
    // (orders/ is readable by any signed-in user per firestore.rules.)
    Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "orders"))])
      .then(([userSnap, orderSnap]) => {
        const counts = new Map<string, number>();
        orderSnap.forEach((d) => {
          const email = (d.data() as { customerEmail?: string }).customerEmail?.toLowerCase();
          if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
        });
        const rows: UserRow[] = userSnap.docs.map((d) => {
          const data = d.data() as { email?: string; displayName?: string; createdAt?: unknown; updatedAt?: unknown };
          const email = data.email ?? "";
          return {
            uid: d.id,
            email,
            displayName: data.displayName,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            orderCount: counts.get(email.toLowerCase()) ?? 0,
          };
        });
        // Most recently active first.
        rows.sort((a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0));
        setUsers(rows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-foreground">Loading users...</p>;
  if (error) {
    return (
      <div>
        <p className="text-sm text-red-500 mb-2">Could not load users: {error}</p>
        <p className="text-xs text-foreground/80">
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
        <p className="text-sm text-foreground/80">
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
      <p className="text-xs text-foreground/80 mb-3">{users.length} users registered.</p>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center justify-between gap-4 text-sm p-3 bg-warm-sand/30 rounded-lg">
            <div className="min-w-0">
              <p className="font-medium truncate">{u.displayName || u.email}</p>
              {u.displayName && <p className="text-xs text-foreground/80 truncate">{u.email}</p>}
            </div>
            <div className="flex items-center gap-4 shrink-0 text-xs text-foreground/80">
              <span className="px-2 py-0.5 bg-gold/10 text-gold rounded-full font-medium">
                {u.orderCount} {u.orderCount === 1 ? "order" : "orders"}
              </span>
              <span className="text-right leading-tight">
                {formatDate(u.createdAt) && <span className="block">Joined {formatDate(u.createdAt)}</span>}
                {formatDate(u.updatedAt) && <span className="block">Last seen {formatDate(u.updatedAt)}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return <RequireAdmin><ErrorBoundary><DashboardContent /></ErrorBoundary></RequireAdmin>;
}
