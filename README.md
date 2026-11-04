# HAVEN · ELMOS · KDAL documentation site

One Astro Starlight site for the three projects, one sidebar per project
(`starlight-sidebar-topics`). Each repository stays the single source of
its pages: `scripts/sync.mjs` copies them in at build time, adds front
matter where a page has none and rewrites links; the ELMOS command
reference is generated from the code (`elmos gendocs`).

```sh
npm ci
npm run build        # sync from ../haven, ../haven-wiki, ../elmos, ../kdal, then build dist/
node scripts/check-links.mjs
npm run preview      # http://localhost:4321/docs/
```

`SRC_ROOT` points the sync at other checkouts; `DOCS_SITE` and
`DOCS_BASE` set the published address (default
`https://nguyentrongphuc552003.codeberg.page/docs/`, Codeberg Pages from
the `pages` branch of this repository).

Hand-written pages are only the ones under `src/content/docs/` that are
tracked here (`index.mdx`, `start/`). The `haven/`, `elmos/` and `kdal/`
folders are generated and ignored.
