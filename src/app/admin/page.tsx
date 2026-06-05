"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { useAuth, RequireAdmin } from "@/context/auth-context";
import { SITE } from "@/lib/content";

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

interface DesignAsset {
  id: string;
  name: string;
  category: string;
  image_url: string;
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
      <label className="block text-sm font-medium text-teal mb-1">{label}</label>
      {children}
    </div>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState<SiteConfigData>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [designs, setDesigns] = useState<DesignAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [designCategory, setDesignCategory] = useState("");
  const [designName, setDesignName] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, "config", "site"));
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as SiteConfigData);
    };
    const loadDesigns = async () => {
      const snap = await getDoc(doc(db, "designs", "catalog"));
      if (snap.exists()) setDesigns((snap.data() as { items?: DesignAsset[] }).items ?? []);
    };
    loadConfig();
    loadDesigns();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    await setDoc(doc(db, "config", "site"), config, { merge: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !designName || !designCategory) return;
    setUploading(true);
    const fileRef = ref(storage, `designs/${Date.now()}-${file.name}`);
    const task = uploadBytesResumable(fileRef, file);
    task.on("state_changed", null, () => setUploading(false), async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      const updated = [...designs, { id: crypto.randomUUID(), name: designName, category: designCategory, image_url: url }];
      setDesigns(updated);
      await setDoc(doc(db, "designs", "catalog"), { items: updated });
      setUploading(false);
      setDesignName("");
      setDesignCategory("");
    });
  };

  const removeDesign = async (id: string) => {
    const updated = designs.filter((d) => d.id !== id);
    setDesigns(updated);
    await setDoc(doc(db, "designs", "catalog"), { items: updated });
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-teal text-white px-6 py-4">
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

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Site Settings ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-6">Site Settings</h2>

          {/* Announcement */}
          <Field label="Announcement Banner">
            <input type="text" value={config.announcement_text}
              onChange={(e) => setConfig({ ...config, announcement_text: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
            <label className="flex items-center gap-2 mt-2 text-sm text-teal/60 cursor-pointer">
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
                    className="w-12 h-10 rounded-lg border border-teal/20 cursor-pointer" />
                  <input type="text" value={config[key]}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    className="flex-1 px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none font-mono text-sm" />
                </div>
              </Field>
            ))}
          </div>

          {/* Website Copy */}
          <div className="mt-6">
            <h3 className="font-bold font-display text-sm mb-3 text-teal">Website Copy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Hero Heading">
                <input type="text" value={config.hero_heading}
                  onChange={(e) => setConfig({ ...config, hero_heading: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              </Field>
              <Field label="Hero Subheading">
                <input type="text" value={config.hero_subheading}
                  onChange={(e) => setConfig({ ...config, hero_subheading: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="About / Our Story Text">
                <textarea rows={5} value={config.about_body}
                  onChange={(e) => setConfig({ ...config, about_body: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm resize-y" />
              </Field>
            </div>
          </div>

          {/* Shipping & Pricing */}
          <div className="mt-6">
            <h3 className="font-bold font-display text-sm mb-3 text-teal">Shipping &amp; Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Stickers Rate ($)">
                <input type="number" step="0.01" value={config.shipping_tier_stickers}
                  onChange={(e) => setConfig({ ...config, shipping_tier_stickers: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Apparel Rate ($)">
                <input type="number" step="0.01" value={config.shipping_tier_apparel}
                  onChange={(e) => setConfig({ ...config, shipping_tier_apparel: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Free Shipping Threshold ($)">
                <input type="number" step="0.01" value={config.free_shipping_threshold}
                  onChange={(e) => setConfig({ ...config, free_shipping_threshold: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
              <Field label="Add-on Price ($)">
                <input type="number" step="0.01" value={config.addon_price}
                  onChange={(e) => setConfig({ ...config, addon_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none" />
              </Field>
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="mt-6 px-6 py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile">
            {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </section>

        {/* ── Design Catalog ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-4">Design Catalog</h2>
          <p className="text-sm text-teal/60 mb-6">Upload brand logos, team designs, and artwork that customers can select in the customizer.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <input type="text" value={designName} onChange={(e) => setDesignName(e.target.value)}
              placeholder="Design name" className="px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            <input type="text" value={designCategory} onChange={(e) => setDesignCategory(e.target.value)}
              placeholder="Category (e.g. Durango High Football)" className="px-4 py-2 rounded-xl border border-teal/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm" />
            <label className="flex items-center justify-center px-4 py-2 rounded-xl border-2 border-dashed border-teal/20 cursor-pointer hover:border-teal/40 transition-colors text-sm text-teal/50">
              {uploading ? "Uploading..." : "Choose File"}
              <input type="file" accept="image/*" onChange={handleDesignUpload}
                disabled={uploading || !designName || !designCategory} className="hidden" />
            </label>
          </div>
          {designs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {designs.map((d) => (
                <div key={d.id} className="bg-warm-sand/50 rounded-xl p-3 text-center relative group">
                  <Image src={d.image_url} alt={d.name} width={120} height={120} className="mx-auto rounded-lg mb-2 object-contain h-20" />
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-xs text-teal/40 truncate">{d.category}</p>
                  <button onClick={() => removeDesign(d.id)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-opacity">&times;</button>
                </div>
              ))}
            </div>
          )}
          {designs.length === 0 && <p className="text-sm text-teal/40 text-center py-8">No designs uploaded yet.</p>}
        </section>

        {/* ── Recent Orders ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-4">Recent Orders</h2>
          <OrdersSection />
        </section>

        {/* ── User Management ── */}
        <section className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
          <h2 className="text-xl font-bold font-display mb-4">User Management</h2>
          <UsersSection />
        </section>
      </main>
    </div>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState<{ id: string; state: string; total: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    httpsCallable(functions, "fetchRecentOrders")({})
      .then((r) => setOrders((r.data as { orders: typeof orders }).orders ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-teal/50">Loading orders...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!orders.length) return <p className="text-sm text-teal/40">No orders yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-teal/50 border-b border-warm-sand">
          <th className="pb-2 font-medium">Order ID</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium">Date</th>
        </tr></thead>
        <tbody>
          {orders.slice(0, 20).map((o) => (
            <tr key={o.id} className="border-b border-warm-sand/30">
              <td className="py-2 font-mono text-xs text-teal/60">{o.id?.slice(0, 12)}</td>
              <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${o.state === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.state}</span></td>
              <td className="py-2 text-right font-mono">${o.total.toFixed(2)}</td>
              <td className="py-2 text-teal/50">{new Date(o.createdAt as string).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

  if (loading) return <p className="text-sm text-teal/50">Loading users...</p>;
  if (error) {
    return (
      <div>
        <p className="text-sm text-red-500 mb-2">Could not load users: {error}</p>
        <p className="text-xs text-teal/40">
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
  if (!users.length) {
    return (
      <div>
        <p className="text-sm text-teal/40">
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
      <p className="text-xs text-teal/40 mb-3">{users.length} users registered.</p>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center justify-between text-sm p-2 bg-warm-sand/30 rounded-lg">
            <span className="font-medium">{u.email}</span>
            <span className="text-xs text-teal/40">
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
  return <RequireAdmin><DashboardContent /></RequireAdmin>;
}
