"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavAuth from "@/components/layout/nav-auth";
import { ThemeToggle } from "@/context/theme-context";
import CartNavButton from "@/components/cart/cart-nav-button";
import { ANNOUNCEMENT } from "@/lib/content";

const NAV_LINKS = [
  { href: "/", label: "Home", d: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" },
  { href: "/shop", label: "Shop", d: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" },
  { href: "/search", label: "Search", d: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" },
  { href: "/about", label: "About", d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" },
  { href: "/contact", label: "Contact", d: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" },
];

export default function HeaderBar() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--header-height",
          `${Math.round(entry.contentRect.height)}px`
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("has-announcement", ANNOUNCEMENT.active);
  }, []);

  return (
    <div ref={ref} className="fixed top-0 left-0 right-0 z-50">
      {ANNOUNCEMENT.active && (
        <div className="bg-gold text-white text-center text-sm py-2 px-4 font-medium">
          {ANNOUNCEMENT.text}
        </div>
      )}
      <nav className="nav-dock">
        <Link
          href="/"
          className={`nav-dock-link${pathname === "/" ? " active" : ""}`}
          aria-label="Home"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[0].d} />
          </svg>
          <span>Home</span>
        </Link>
        <Link
          href="/shop"
          className={`nav-dock-link${pathname === "/shop" ? " active" : ""}`}
          aria-label="Shop"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[1].d} />
          </svg>
          <span>Shop</span>
        </Link>
        <CartNavButton />
        <Link
          href="/search"
          className={`nav-dock-link${pathname === "/search" ? " active" : ""}`}
          aria-label="Search"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[2].d} />
          </svg>
          <span>Search</span>
        </Link>
        <Link
          href="/about"
          className={`nav-dock-link${pathname === "/about" ? " active" : ""}`}
          aria-label="About"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[3].d} />
          </svg>
          <span>About</span>
        </Link>
        <Link
          href="/fundraising"
          className={`nav-dock-link${pathname === "/fundraising" ? " active" : ""}`}
          aria-label="Fundraising"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
          </svg>
          <span>Fundraising</span>
        </Link>
        <Link
          href="/faq"
          className={`nav-dock-link${pathname === "/faq" ? " active" : ""}`}
          aria-label="FAQ"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>FAQ</span>
        </Link>
        <Link
          href="/contact"
          className={`nav-dock-link${pathname === "/contact" ? " active" : ""}`}
          aria-label="Contact"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[4].d} />
          </svg>
          <span>Contact</span>
        </Link>
        <ThemeToggle />
        <NavAuth />
      </nav>
    </div>
  );
}
