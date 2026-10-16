"use client";

import { useEffect } from "react";
import { CartProvider, useCart } from "@/context/cart-context";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { SiteConfigProvider } from "@/context/site-config-context";
import { SeoConfigProvider } from "@/context/seo-context";
import { CatalogProvider } from "@/context/catalog-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import CartToast from "@/components/cart/cart-toast";
import RuntimeSeo from "@/components/layout/runtime-seo";
import type { ReactNode } from "react";

function CartDrawerWrapper() {
  const { cartOpen, setCartOpen } = useCart();
  return <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />;
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        // updateViaCache: "none" makes the browser bypass its HTTP cache when
        // checking for a new worker. Without it a long max-age on /sw.js can pin
        // an old worker forever — which is exactly how a stale-cache bug once
        // survived several deploys. The hosting header for /sw.js is no-cache too.
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
      } else {
        // Dev mode: unregister any lingering service worker to prevent HMR refresh loops
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
    }
  }, []);

  return (
    <CatalogProvider>
      <SiteConfigProvider>
        <SeoConfigProvider>
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                <RuntimeSeo />
                {children}
                <CartDrawerWrapper />
                <CartToast />
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
        </SeoConfigProvider>
      </SiteConfigProvider>
    </CatalogProvider>
  );
}
