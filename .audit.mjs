import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WB = path.join(os.homedir(), ".agents", "tools", "browser", "wb.mjs");
const SESSION = "audit";
const ids = JSON.parse(fs.readFileSync(".ids.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function wb(action, args = {}) {
  const argv = [WB, action];
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "boolean") { if (v) argv.push(`--${k}`); }
    else argv.push(`--${k}`, String(v));
  }
  argv.push("--session", SESSION);
  try {
    const out = execFileSync(process.execPath, argv, { encoding: "utf8", timeout: 90000 });
    return JSON.parse(out);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

const PROBE = `(()=>{
  const t = document.body.innerText || "";
  const groups = [...document.querySelectorAll("fieldset")].map(f => {
    const lg = f.querySelector("legend");
    const name = lg ? lg.textContent.replace(/\\s+/g," ").trim() : "";
    const opts = [...f.querySelectorAll("button[aria-pressed]")];
    return { name, options: opts.length, chosen: opts.filter(b=>b.getAttribute("aria-pressed")==="true").length };
  });
  const addBtn = [...document.querySelectorAll("button")].find(b=>/^Add to Cart/.test(b.textContent.trim()));
  const priceBig = [...document.querySelectorAll("p")].map(p=>p.textContent.trim()).find(x=>/^\\$[0-9]/.test(x)) || "";
  const heroImgs = [...document.querySelectorAll("img")].filter(i=>i.naturalWidth>0).length;
  const brokenImgs = [...document.querySelectorAll("img")].filter(i=>i.complete && i.naturalWidth===0).length;
  return {
    title: document.title,
    priceLine: priceBig.slice(0,60),
    groups,
    addButton: addBtn ? addBtn.textContent.trim() : null,
    addDisabled: addBtn ? addBtn.disabled : null,
    unchosenNotice: /Not chosen yet/.test(t),
    startingAt: /Starting at/.test(t),
    swatches: document.querySelectorAll("button[aria-label]").length,
    pressedOnLoad: document.querySelectorAll("button[aria-pressed=true]").length,
    imgsLoaded: heroImgs,
    imgsBroken: brokenImgs,
    designPicker: /Choose from \\d+ designs/.test(t),
    variantPicker: /Style \\/ Size/.test(t),
    outOfStock: /Out of Stock/.test(t),
    notAvailable: /Not Available Online/.test(t),
    errorish: /Something went wrong|Failed to load|cannot read/i.test(t.slice(0,1200))
  };
})()`;

const CART = `(()=>{ try { const c = JSON.parse(localStorage.getItem("animas-cart-v1") || "null"); if(!c) return {empty:true}; const it=(c.items||c); return {count:it.length, last: it[it.length-1] ? {name:it[it.length-1].name, variant:it[it.length-1].variant_name, color:it[it.length-1].selected_color||null, addons:(it[it.length-1].addons||[]).map(a=>a.label||a.name), design:!!it[it.length-1].design_url} : null}; } catch(e){ return {error:String(e.message||e)}; } })()`;

const results = [];
for (const p of ids) {
  const url = `https://animas-reflections-pwa.web.app/product/?id=${encodeURIComponent(p.id)}`;
  wb("navigate", { url });
  await sleep(6500);
  const probe = wb("evaluate", { code: PROBE });
  const row = { id: p.id, name: p.name, url, probe: probe?.value ?? probe };

  // Add to cart with defaults, then read what the cart actually stored.
  wb("evaluate", { code: `(()=>{const b=[...document.querySelectorAll("button")].find(x=>/^Add to Cart/.test(x.textContent.trim())); if(!b||b.disabled) return "skip"; b.click(); return "clicked";})()` });
  await sleep(1800);
  const cart = wb("evaluate", { code: CART });
  row.cart = cart?.value ?? cart;

  // Clear so the next product starts from an empty cart.
  wb("evaluate", { code: `(()=>{localStorage.removeItem("animas-cart-v1");return "cleared";})()` });
  results.push(row);
  console.error(`done ${results.length}/${ids.length} — ${p.name}`);
}

fs.writeFileSync(".audit.json", JSON.stringify(results, null, 1));

for (const r of results) {
  const q = r.probe || {};
  console.log(`\n=== ${r.name}`);
  console.log(`  price: ${q.priceLine || "(none)"} | add: ${q.addButton || "(no button)"}${q.addDisabled ? " [DISABLED]" : ""}`);
  console.log(`  groups: ${(q.groups || []).length} | unchosenNotice: ${q.unchosenNotice} | startingAt: ${q.startingAt} | pressedOnLoad: ${q.pressedOnLoad}`);
  console.log(`  pickers: variant=${q.variantPicker} design=${q.designPicker} | swatches=${q.swatches}`);
  console.log(`  imgs loaded=${q.imgsLoaded} broken=${q.imgsBroken} | oos=${q.outOfStock} notAvail=${q.notAvailable} err=${q.errorish}`);
  const gs = (q.groups || []).map((g) => `${g.name}(${g.options})`).join(", ");
  if (gs) console.log(`  option groups: ${gs}`);
  console.log(`  cart: ${JSON.stringify(r.cart)}`);
}
