"use client";

import { useEffect } from "react";
import { CartProvider, useCart } from "@/context/cart-context";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import type { ReactNode } from "react";

function CartDrawerWrapper() {
  const { cartOpen, setCartOpen } = useCart();
  return <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />;
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          {children}
          <CartDrawerWrapper />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
