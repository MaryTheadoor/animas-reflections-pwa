"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import PageLayout from "@/components/layout/page-layout";
import Link from "next/link";

type Tab = "orders" | "addresses" | "settings";

interface OrderData {
  id: string;
  squareOrderId: string;
  status: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  shipping?: { name: string; line1: string; city: string; state: string; zip: string } | null;
  totals: { subtotal: number; shipping: number; tax: number; grandTotal: number };
  trackingUrl?: string;
  trackingNumber?: string;
  createdAt: string;
}

interface AddressData {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-green-100 text-green-700",
  DELIVERED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AccountPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [profile, setProfile] = useState<ProfileData>({ firstName: "", lastName: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Address form
  const [editingAddress, setEditingAddress] = useState<AddressData | null>(null);
  const [addrForm, setAddrForm] = useState({ label: "", line1: "", line2: "", city: "", state: "", zip: "", isDefault: false });
  const [savingAddr, setSavingAddr] = useState(false);

  // Settings form
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, addrRes, profileRes] = await Promise.all([
        httpsCallable(functions, "fetchCustomerOrders")({}),
        httpsCallable(functions, "getCustomerAddresses")({}),
        httpsCallable(functions, "getCustomerProfile")({}),
      ]);
      setOrders((ordersRes.data as { orders: OrderData[] }).orders ?? []);
      setAddresses((addrRes.data as { addresses: AddressData[] }).addresses ?? []);
      setProfile((profileRes.data as { profile: ProfileData }).profile ?? { firstName: "", lastName: "" });
    } catch (err) {
      console.error("Failed to load account data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  const handleSaveAddress = async () => {
    if (!addrForm.label || !addrForm.line1 || !addrForm.city || !addrForm.state || !addrForm.zip) return;
    setSavingAddr(true);
    try {
      await httpsCallable(functions, "saveCustomerAddress")({
        id: editingAddress?.id,
        ...addrForm,
      });
      setEditingAddress(null);
      resetAddrForm();
      fetchData();
    } catch (err) {
      alert("Failed to save address: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    try {
      await httpsCallable(functions, "deleteCustomerAddress")({ addressId: id });
      fetchData();
    } catch (err) {
      alert("Failed to delete address");
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await httpsCallable(functions, "saveCustomerProfile")(profile);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      alert("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const resetAddrForm = () => {
    setAddrForm({ label: "", line1: "", line2: "", city: "", state: "", zip: "", isDefault: false });
  };

  const startEditAddress = (addr?: AddressData) => {
    if (addr) {
      setEditingAddress(addr);
      setAddrForm({ label: addr.label, line1: addr.line1, line2: addr.line2 || "", city: addr.city, state: addr.state, zip: addr.zip, isDefault: addr.isDefault });
    } else {
      setEditingAddress(null);
      resetAddrForm();
    }
  };

  if (authLoading || (loading && user)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-3">
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold font-display mb-4">My Account</h1>
        <p className="text-primary/60 mb-6">Sign in to view your orders and manage your account.</p>
        <Link
          href="/admin/login"
          className="inline-block px-6 py-3 bg-gold text-white rounded-2xl font-semibold hover:bg-gold-light transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "orders", label: "Orders" },
    { key: "addresses", label: "Addresses" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <PageLayout>
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">My Account</h1>
        <button onClick={logout} className="text-sm text-primary/40 hover:text-red-500 transition-colors">
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-warm-sand/50 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (
              tab === t.key
                ? "bg-white text-primary shadow-sm"
                : "text-primary/40 hover:text-primary/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="text-sm text-primary/40 text-center py-8">No orders yet.</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white border border-warm-sand rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-warm-sand/20 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">Order #{(order.squareOrderId || order.id).slice(-8)}</p>
                    <p className="text-xs text-primary/40">
                      {new Date(order.createdAt).toLocaleDateString()} · {order.items?.length ?? 0} item(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600")}>
                      {order.status}
                    </span>
                    <span className="text-gold font-semibold text-sm">${order.totals?.grandTotal?.toFixed(2) ?? "0.00"}</span>
                  </div>
                </button>

                {expandedOrder === order.id && (
                  <div className="px-5 pb-4 border-t border-warm-sand/50 pt-3 space-y-3">
                    {/* Items */}
                    <div>
                      <p className="text-xs font-medium text-primary/50 mb-1">Items</p>
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="text-primary/60">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Shipping */}
                    {order.shipping && (
                      <div>
                        <p className="text-xs font-medium text-primary/50 mb-1">Shipping Address</p>
                        <p className="text-sm text-primary/70">
                          {order.shipping.name}<br />
                          {order.shipping.line1}<br />
                          {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
                        </p>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="border-t border-warm-sand/50 pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-primary/50">Subtotal</span>
                        <span>${order.totals?.subtotal?.toFixed(2) ?? "0.00"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-primary/50">Shipping</span>
                        <span>${order.totals?.shipping?.toFixed(2) ?? "0.00"}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span className="text-gold">${order.totals?.grandTotal?.toFixed(2) ?? "0.00"}</span>
                      </div>
                    </div>

                    {/* Tracking */}
                    {order.trackingUrl && (
                      <div className="bg-teal/5 rounded-xl p-3">
                        <p className="text-xs font-medium text-teal mb-1">Tracking</p>
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal underline hover:text-teal/80"
                        >
                          {order.trackingNumber || "Track your package"} →
                        </a>
                      </div>
                    )}

                    {/* Admin mailto button for manual emails */}
                    {order.trackingUrl && (
                      <a
                        href={"mailto:" + (user.email || "") + "?subject=Order " + (order.squareOrderId || order.id).slice(-8) + " Tracking&body=Your tracking link: " + (order.trackingUrl || "")}
                        className="inline-block text-xs text-gold hover:text-gold-light transition-colors mt-1"
                      >
                        ✉ Open in email client
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Addresses Tab */}
      {tab === "addresses" && (
        <div className="space-y-4">
          {!editingAddress && addrForm.label === "" ? (
            <>
              {addresses.length === 0 ? (
                <p className="text-sm text-primary/40 text-center py-8">No saved addresses.</p>
              ) : (
                addresses.map((addr) => (
                  <div key={addr.id} className="bg-white border border-warm-sand rounded-2xl p-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{addr.label}</p>
                        {addr.isDefault && (
                          <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <p className="text-sm text-primary/60">
                        {addr.line1}{addr.line2 ? ", " + addr.line2 : ""}<br />
                        {addr.city}, {addr.state} {addr.zip}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditAddress(addr)}
                        className="text-xs text-primary/40 hover:text-primary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={() => startEditAddress()}
                className="w-full py-3 border-2 border-dashed border-primary/20 rounded-xl text-sm text-primary/40 hover:border-primary/40 hover:text-primary/60 transition-colors"
              >
                + Add New Address
              </button>
            </>
          ) : (
            <div className="bg-white border border-warm-sand rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold">{editingAddress ? "Edit Address" : "New Address"}</h3>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">Label</label>
                <input
                  type="text"
                  value={addrForm.label}
                  onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                  placeholder="Home, Work, etc."
                  className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={addrForm.line1}
                  onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={addrForm.line2}
                  onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">City</label>
                  <input
                    type="text"
                    value={addrForm.city}
                    onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">State</label>
                  <input
                    type="text"
                    value={addrForm.state}
                    onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                    placeholder="CO"
                    className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">ZIP</label>
                  <input
                    type="text"
                    value={addrForm.zip}
                    onChange={(e) => setAddrForm({ ...addrForm, zip: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                  className="accent-gold"
                />
                Set as default address
              </label>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveAddress}
                  disabled={savingAddr}
                  className="px-5 py-2 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50"
                >
                  {savingAddr ? "Saving..." : "Save Address"}
                </button>
                <button
                  onClick={() => { setEditingAddress(null); resetAddrForm(); }}
                  className="px-4 py-2 text-sm text-primary/40 hover:text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="bg-white border border-warm-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Profile Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary mb-1">First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary mb-1">Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={profile.phone || ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Email</label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-3 py-2 rounded-xl border border-warm-sand bg-warm-sand/30 text-primary/40 outline-none text-sm cursor-not-allowed"
            />
            <p className="text-[10px] text-primary/30 mt-1">Email is managed through your login provider.</p>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="px-5 py-2 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {savingProfile ? "Saving..." : profileSaved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      )}
    </div>
    </PageLayout>
  );
}
