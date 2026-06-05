"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";

export default function NavAuth() {
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <Link href="/admin" className="px-3 py-1.5 rounded-xl bg-teal text-white text-xs hover:bg-teal-light transition-colors">
        Admin
      </Link>
    );
  }

  if (user) {
    return (
      <Link href="/admin/login" className="px-3 py-1.5 rounded-xl border border-teal/20 text-teal text-xs hover:border-teal/40 transition-colors">
        {user.email?.split("@")[0]}
      </Link>
    );
  }

  return (
    <Link href="/admin/login" className="px-3 py-1.5 rounded-xl border border-teal/20 text-teal text-xs hover:border-teal/40 transition-colors">
      Login
    </Link>
  );
}
