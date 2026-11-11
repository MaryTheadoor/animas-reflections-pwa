"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavAuth from "@/components/layout/nav-auth";
import { ThemeToggle } from "@/context/theme-context";
import CartNavButton from "@/components/cart/cart-nav-button";
import { useSiteContent } from "@/hooks/useSiteConfig";

const NAV_LINKS = [
  { href: "/", label: "Home", d: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" },
  { href: "/shop", label: "Shop", d: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" },
  { href: "/about", label: "About", d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" },
];

export default function HeaderBar() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const c = useSiteContent();
  // The CMS primary list drives the slots AFTER the fixed Home slot, so a "/"
  // entry in it would render Home twice.
  const primary = c.navigation.primary.filter((link) => link.href !== "/");
  const [offline, setOffline] = useState(false);
  // Mobile collapses to five primary slots plus this disclosure; the desktop
  // pill hides the trigger entirely (`.nav-more-toggle`, see globals.css).
  const [moreOpen, setMoreOpen] = useState(false);

  // Everything that does not fit a 390px-wide row. Slot 1 of the CMS list is
  // the link the desktop pill renders fourth, and /about ("Our Story") has no
  // pill slot of its own, so it is resolved from the CMS list with a label
  // fallback rather than hard-coded.
  const aboutLink = primary.find((link) => link.href === "/about") || {
    label: "Our Story",
    href: "/about",
  };
  const secondaryHref = primary[1]?.href || "/customizer";
  const secondaryLabel = primary[1]?.label || "Customizer";
  const moreLinks = [
    { href: secondaryHref, label: secondaryLabel },
    ...(aboutLink.href === secondaryHref ? [] : [aboutLink]),
    { href: "/fundraising", label: "Fundraising" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];

  // Measure the fixed header wrapper height and expose it as a CSS variable
  // so page content can offset itself below the header with padding-top.
  // Do NOT apply position:fixed directly to the nav-dock — the outer wrapper
  // (this div) is the positioned element. The nav-dock inside is a centered pill.
  // The bounding rect, not `contentRect`: the latter excludes the dock's own
  // padding and border, which under-reported the mobile header by ~9px.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        "--header-height",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    };
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("has-announcement", c.global.announcementActive);
  }, [c.global.announcementActive]);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize offline state on mount
    setOffline(!navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // "More" is a disclosure, not a modal: Escape closes it and puts focus back
  // on the trigger, a press anywhere outside the header closes it, and the
  // panel's own links close it before navigating.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [moreOpen]);

  const isActive = (href: string) => pathname === href;

  return (
    <div ref={ref} className="fixed top-0 left-0 right-0 z-50">
      {/* Red face keeps its value in both themes, so its label must too:
          `text-on-plum` is the one token that stays #FFFFFF under html.dark
          (`text-white` remaps to slate-800, 3.0:1 here). The gold banner below
          keeps `text-white` because gold-deep REMAPS to a light gold. */}
      {offline && (
        <div className="bg-red-600 text-on-plum text-center text-xs py-1.5 px-4 font-medium">
          You&apos;re offline — cached pages still available
        </div>
      )}
      {c.global.announcementActive && (
        <div className="announcement-banner bg-gold-deep text-white text-center text-sm py-2 px-4 font-medium">
          {c.global.announcementText}
        </div>
      )}
      <nav className="nav-dock">
        {/* DOM order == visual order at BOTH breakpoints, which keeps the Tab
            order matching what is on screen. The desktop-only group below is
            display:none under 768px, so the mobile grid's six slots come out as
            Home, Shop, Cart, Search, Account, More. */}
        {/* Home — always first and always "/". The CMS primary list now starts
            at Shop, so reading primary[0] here (the old behaviour) replaced the
            only route back to the homepage with a second Shop link. Any "/"
            entry an editor adds to the CMS list is dropped below so the slot
            can never appear twice. */}
        <Link
          href="/"
          className={`nav-dock-link${isActive("/") ? " active" : ""}`}
          aria-label="Home"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[0].d} />
          </svg>
          <span>Home</span>
        </Link>

        {/* Shop — CMS slot 1 (primary[0]) */}
        <Link
          href={primary[0]?.href || "/shop"}
          className={`nav-dock-link${isActive(primary[0]?.href || "/shop") ? " active" : ""}`}
          aria-label={primary[0]?.label || "Shop"}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={NAV_LINKS[1].d} />
          </svg>
          <span>{primary[0]?.label || "Shop"}</span>
        </Link>

        {/* Cart — wrapped so the component is one grid cell / one flex item. */}
        <div className="flex justify-center min-w-0">
          <CartNavButton />
        </div>

        {/* Wide screens keep the full pill. Under 768px this whole group is
            display:none and the same links live in the More panel. */}
        <div className="hidden md:flex md:items-center md:gap-1">
          {/* CMS slot 2 (primary[1]) */}
          <Link
            href={secondaryHref}
            className={`nav-dock-link${isActive(secondaryHref) ? " active" : ""}`}
            aria-label={secondaryLabel}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={NAV_LINKS[2].d} />
            </svg>
            <span>{secondaryLabel}</span>
          </Link>

          {/* Fundraising */}
          <Link
            href="/fundraising"
            className={`nav-dock-link${isActive("/fundraising") ? " active" : ""}`}
            aria-label="Fundraising"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
            </svg>
            <span>Fundraising</span>
          </Link>

          {/* FAQ */}
          <Link
            href="/faq"
            className={`nav-dock-link${isActive("/faq") ? " active" : ""}`}
            aria-label="FAQ"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>FAQ</span>
          </Link>

          {/* Contact */}
          <Link
            href="/contact"
            className={`nav-dock-link${isActive("/contact") ? " active" : ""}`}
            aria-label="Contact"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
            <span>Contact</span>
          </Link>
        </div>

        {/* Search — fourth mobile slot, eighth on desktop. */}
        <Link
          href="/search"
          className={`nav-dock-link${isActive("/search") ? " active" : ""}`}
          aria-label="Search"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span>Search</span>
        </Link>

        {/* Theme toggle — desktop pill only; on mobile it is the last cell of
            the More panel (so it stays reachable there). */}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        {/* Auth — fifth mobile slot, last on desktop. */}
        <div className="nav-dock-auth flex justify-center min-w-0">
          <NavAuth />
        </div>

        {/* More — mobile only. A disclosure, not a modal: it opens the panel
            rendered after </nav> and reports state through aria-expanded. */}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={`nav-dock-link nav-more-toggle${moreOpen ? " active" : ""}`}
          aria-expanded={moreOpen}
          aria-controls="nav-more-panel"
          aria-label="More"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {/* Absolutely positioned against the fixed wrapper, so opening it never
          changes the wrapper's height — and therefore never changes
          --header-height or the page padding derived from it. */}
      {moreOpen && (
        <div
          id="nav-more-panel"
          role="group"
          aria-label="More navigation"
          className="nav-more-panel"
        >
          {moreLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMoreOpen(false)}
              className={`nav-more-link${isActive(link.href) ? " active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      )}
    </div>
  );
}
