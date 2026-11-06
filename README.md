# haven-docs

HAVEN's official website, with the ELMOS and KDAL documentation: one Astro
Starlight site, one sidebar per project (`starlight-sidebar-topics`).

## Where the pages come from

| Pages | Source |
| - | - |
| `src/pages/index.astro` (landing), `src/pages/ci.astro` (CI dashboard) | written here, with `src/layouts/SiteLayout.astro` |
| `src/content/docs/start/` | written here |
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

- **Production: Vercel**, https://docs-haven.vercel.app/. Vercel builds
  the repository with `npm run build` on every push to `main` and serves
  `dist/` at the root of the domain (`VERCEL` and
  `VERCEL_PROJECT_PRODUCTION_URL` set the address). `.github/workflows/rebuild.yml`
  rebuilds it nightly through a deploy hook (secret `VERCEL_DEPLOY_HOOK`).
- **Fallback: GitHub Pages** at `https://nguyentrongphuc552003.github.io/haven-docs/`,
  built and link-checked by `.github/workflows/pages.yml` on every push and
  nightly.

`DOCS_SITE` and `DOCS_BASE` override the address for other hosts.

## Look and feel

- Design tokens (colours, fonts, chart palette) are in `src/styles/tokens.css`;
  `src/styles/starlight.css` maps them onto Starlight, so the landing page,
  the CI dashboard and the documentation share one look in light and dark.
- `src/components/ThemeToggle.astro` is the light/dark button next to the
  GitHub icon (it replaces Starlight's theme select); the choice is stored
  under Starlight's key, so it holds on every page.
- The CI dashboard reads the `ci` workflow runs of haven, elmos and kdal
  from GitHub's public API in the visitor's browser (`src/scripts/ci-api.ts`,
  `src/scripts/ci-dashboard.ts`); chart colours follow the validated
  reference palette, and status always has an icon and a label.
