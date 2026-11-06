# haven-docs

HAVEN's official website, with the ELMOS and KDAL documentation: one Astro
Starlight site, one sidebar per project (`starlight-sidebar-topics`).

## Where the pages come from

| Pages | Source |
| - | - |
| `src/content/docs/index.mdx`, `start/` | written here |
| `src/content/docs/haven/` (overview, getting started, roadmap, porting, background) | written here; replaces the former `haven-wiki` repository and the former `haven/website` site |
| `src/content/docs/haven/records/` | copied from the `haven` repository at build time (README, research records, read-back, related work, try, changelog) |
| `src/content/docs/elmos/`, `kdal/` | copied from the `elmos` and `kdal` repositories at build time; the ELMOS command reference is generated from the code (`elmos gendocs`) |

`scripts/sync.mjs` does the copying: it adds front matter where a page has
none and rewrites links (links between copied pages become site links,
other relative links point at the file on GitHub). The copied folders are
ignored by git. The pages under `haven/background/` came from the wiki and
the old website (May to June 2026); each says so at the top until it is
reviewed against the current code.

## Build

```sh
npm ci
npm run build        # fetch-sources (only if ../haven is missing), sync, astro build
node scripts/check-links.mjs
npm run preview
```

The project repositories are read from sibling checkouts (`../haven`,
`../elmos`, `../kdal`), from `SRC_ROOT`, or, when there are no siblings,
from shallow clones that `scripts/fetch-sources.mjs` makes in `.sources/`
(it also downloads Go if needed, to build ELMOS for its command reference).

## Hosting

- **Production: Vercel.** Vercel builds the repository with
  `npm run build` and serves `dist/` at the root of the project's domain
  (`VERCEL` and `VERCEL_PROJECT_PRODUCTION_URL` set the address).
- **Fallback: GitHub Pages** at `https://nguyentrongphuc552003.github.io/haven-docs/`,
  built and link-checked by `.github/workflows/pages.yml` on every push and
  nightly.

`DOCS_SITE` and `DOCS_BASE` override the address for other hosts.
