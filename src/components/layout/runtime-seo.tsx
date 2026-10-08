"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSeoConfig } from "@/context/seo-context";
import { applyRuntimeHead, runtimeHeadFor } from "@/lib/seo-runtime";

/**
 * Applies the live config/seo document to <head> on every navigation. Renders
 * nothing. Mounted once, inside SeoConfigProvider, so it also covers routes
 * that do not go through PageLayout (the home page).
 */
export default function RuntimeSeo() {
  const pathname = usePathname();
  const config = useSeoConfig();

  useEffect(() => {
    applyRuntimeHead(runtimeHeadFor(pathname, config));
  }, [pathname, config]);

  return null;
}
