/**
 * Make the App Router's RSC prefetch files reachable in a static export.
 *
 * Why this exists (found in the 2026-11-11 live audit): every page logged ~10
 * 404s for URLs like
 *
 *     /shop/__next.shop.__PAGE__.txt?_rsc=…
 *
 * while the export writes them as
 *
 *     out/shop/__next.shop/__PAGE__.txt
 *
 * i.e. a directory + file where the client asks for a dot-separated filename.
 * Navigation still works — Next falls back to `__next._tree.txt`, which is
 * emitted correctly — so this is not a broken link, but it is a wasted prefetch
 * on every page, ~10 console errors per route, and slower client-side nav.
 *
 * The fix is a build-time copy: for each `out/<...>/__next.<route>/__PAGE__.txt`,
 * also write `out/<...>/__next.<route>.__PAGE__.txt`. Deterministic, no config
 * change, no URL change. Runs after the SEO gate so a failing build never gets
 * patched files.
 */
import { readdirSync, copyFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const OUT = "out";

/** Every directory named `__next.*` that holds a `__PAGE__.txt`. */
function findPayloadDirs(dir, hits = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      const page = join(full, "__PAGE__.txt");
      if (existsSync(page)) hits.push({ dir: full, page });
      continue; // no need to descend further
    }
    findPayloadDirs(full, hits);
  }
  return hits;
}

if (!existsSync(OUT)) {
  console.error("[rsc-paths] out/ does not exist — run the build first");
  process.exit(1);
}

const hits = findPayloadDirs(OUT);
let copied = 0;
for (const { dir, page } of hits) {
  // out/shop/__next.shop/__PAGE__.txt -> out/shop/__next.shop.__PAGE__.txt
  const sibling = join(dir, "..", `${basename(dir)}.__PAGE__.txt`);
  copyFileSync(page, sibling);
  copied++;
}

console.log(`[rsc-paths] ${copied} RSC payload path${copied === 1 ? "" : "s"} mirrored for prefetch`);
