// Copy each project's documentation into the site at build time.
//
// The three repositories stay the single source of their pages; this
// script only selects, adds Starlight front matter where a page has none,
// and rewrites links: links between copied pages become site links, other
// relative links point at the file on Codeberg. The ELMOS command reference
// is generated from the code (elmos gendocs).
//
// Sources: sibling checkouts (../haven, ../haven-wiki, ../elmos, ../kdal) or
// the directory in SRC_ROOT.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.resolve(process.env.SRC_ROOT ?? path.join(ROOT, ".."));
const OUT = path.join(ROOT, "src", "content", "docs");
const BASE = (process.env.DOCS_BASE ?? "/docs").replace(/\/$/, "");
const OWNER = "https://codeberg.org/NguyenTrongPhuc552003";

// [repo, source path (file or dir), site dir or file]
const MAP = [
  ["haven", "README.md", "haven/index.md"],
  ["haven", "scripts/release/try/README.md", "haven/try.md"],
  ["haven", "tools/readback/README.md", "haven/read-back.md"],
  ["haven", "docs/research/related-work.md", "haven/related-work.md"],
  ["haven", "docs/README.md", "haven/research-records.md"],
  ["haven-wiki", "Architecture.md", "haven/wiki/architecture.md"],
  ["haven-wiki", "Isolation-Model.md", "haven/wiki/isolation-model.md"],
  ["haven-wiki", "Threat-Model.md", "haven/wiki/threat-model.md"],
  ["haven-wiki", "Porting.md", "haven/wiki/porting.md"],
  ["haven-wiki", "Testing-Guide.md", "haven/wiki/testing-guide.md"],
  ["elmos", "README.md", "elmos/index.md"],
  ["elmos", "docs/user", "elmos/guide"],
  ["elmos", "docs/developer", "elmos/developer"],
  ["kdal", "website/src/content/docs", "kdal"],
];

const copied = new Map(); // absolute source file -> site URL path

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.mdx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function sitePath(dest) {
  // haven/wiki/porting.md -> /docs/haven/wiki/porting/ ; x/index.md -> /docs/x/
  const noExt = dest.replace(/\.mdx?$/, "").toLowerCase();
  return `${BASE}/${noExt.replace(/(^|\/)index$/, "")}/`.replace(/\/+/g, "/");
}

// Plan every copy first, so links can point at pages copied later.
const plan = [];
for (const [repo, src, dest] of MAP) {
  const abs = path.join(SRC, repo, src);
  if (!fs.existsSync(abs)) {
    console.warn(`sync: missing ${repo}/${src}, skipped`);
    continue;
  }
  if (fs.statSync(abs).isDirectory()) {
    for (const f of listFiles(abs)) {
      const rel = path.relative(abs, f).toLowerCase();
      plan.push({ repo, file: f, dest: path.join(dest, rel) });
    }
  } else {
    plan.push({ repo, file: abs, dest });
  }
}
for (const p of plan) copied.set(p.file, sitePath(p.dest));

function frontMatter(text, fallback) {
  if (text.startsWith("---\n")) return text;
  const m = text.match(/^#\s+(.+)\s*$/m);
  const title = (m ? m[1] : fallback).replace(/"/g, '\\"');
  const body = m ? text.replace(m[0], "") : text;
  return `---\ntitle: "${title}"\n---\n${body}`;
}

function rewriteLinks(text, file, repo) {
  const dir = path.dirname(file);
  const repoRoot = path.join(SRC, repo);
  // Every "](target)" is a link or image target, including the outer link
  // of a badge such as [![x](img)](LICENSE).
  return text.replace(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (all, href, title = "") => {
    if (/^(https?:|mailto:|#|\/)/.test(href)) return all;
    const [target, anchor = ""] = href.split("#");
    if (!target) return all;
    const abs = path.resolve(dir, decodeURI(target));
    const hash = anchor ? `#${anchor}` : "";
    if (copied.has(abs)) return `](${copied.get(abs)}${hash}${title})`;
    const rel = path.relative(repoRoot, abs);
    if (rel.startsWith("..")) return all;
    const kind = /\.(png|jpe?g|gif|svg|webp)$/i.test(rel) ? "raw" : "src";
    return `](${OWNER}/${repo}/${kind}/branch/main/${rel}${hash}${title})`;
  });
}

for (const dir of ["haven", "elmos", "kdal"]) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
for (const p of plan) {
  let text = fs.readFileSync(p.file, "utf8");
  text = frontMatter(text, path.basename(p.dest).replace(/\.mdx?$/, ""));
  if (!p.file.endsWith(".mdx")) text = rewriteLinks(text, p.file, p.repo);
  const out = path.join(OUT, p.dest);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
}

// ELMOS command reference, generated from the Cobra definitions.
const cliDir = path.join(OUT, "elmos", "reference", "cli");
fs.mkdirSync(cliDir, { recursive: true });
const elmosBin = process.env.ELMOS_BIN ?? path.join(SRC, "elmos", "build", "elmos");
try {
  if (fs.existsSync(elmosBin)) execFileSync(elmosBin, ["gendocs", cliDir]);
  else execFileSync("go", ["run", "./cmd/elmos", "gendocs", cliDir], { cwd: path.join(SRC, "elmos") });
  for (const f of fs.readdirSync(cliDir)) {
    const p = path.join(cliDir, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/\]\(\.\.\/(elmos[^/)]*)\/\)/g, `](${BASE}/elmos/reference/cli/$1/)`));
  }
} catch (e) {
  console.warn(`sync: ELMOS command reference not generated (${e.message})`);
}
console.log(`sync: ${plan.length} pages copied from ${SRC}`);
