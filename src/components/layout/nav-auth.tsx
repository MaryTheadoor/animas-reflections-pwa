"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";

export default function NavAuth() {
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <Link href="/admin" className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs hover:bg-primary-light transition-colors">
        Admin
      </Link>
    );
  }

  if (user) {
    return (
      <Link href="/account" className="px-3 py-1.5 rounded-xl border border-primary/20 text-primary text-xs hover:border-primary/40 transition-colors">
        Account
      </Link>
    );
  }

  // Shoppers sign in at /login; /admin/login is for staff only.
  return (
    <Link href="/login" className="px-3 py-1.5 rounded-xl border border-primary/20 text-primary text-xs hover:border-primary/40 transition-colors">
      Login
    </Link>
  );
}
