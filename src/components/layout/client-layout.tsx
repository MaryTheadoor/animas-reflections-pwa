"use client";

import { useEffect } from "react";
import { CartProvider } from "@/context/cart-context";
import { AuthProvider } from "@/context/auth-context";
import CartDrawer from "@/components/cart/cart-drawer";
import DebugPanel from "@/components/ui/debug-panel";
import type { ReactNode } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        {children}
        <CartDrawer />
        <DebugPanel />
      </CartProvider>
    </AuthProvider>
  );
}
