// Check that every internal link in the built site (dist/) points at a page
// that exists. Usage: node scripts/check-links.mjs   (after npm run build)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/$/, "");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".html") ? [path.join(dir, e.name)] : []);
}

const pages = walk(DIST);
let bad = 0;
for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  for (const m of html.matchAll(/<a [^>]*href="([^"#?]+)[^"]*"/g)) {
    let href = m[1];
    if (/^(https?:|mailto:)/.test(href)) continue;
    if (!href.startsWith("/")) href = path.posix.join(path.posix.dirname("/" + path.relative(DIST, file)), href);
    else if (href.startsWith(BASE)) href = href.slice(BASE.length) || "/";
    else continue;
    const target = path.join(DIST, href);
    const ok = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
    if (!ok) {
      bad++;
      console.log(`${path.relative(DIST, file)}: ${m[1]}`);
    }
  }
}
console.log(`${pages.length} pages, ${bad} broken internal link(s)`);
process.exit(bad ? 1 : 0);
