// HAVEN's official site, with the ELMOS and KDAL documentation.
// HAVEN's own pages are written here (src/content/docs/haven/); pages that
// belong to the code (README, records, changelog) and the ELMOS and KDAL
// documentation are copied from the repositories at build time by
// scripts/sync.mjs.
import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightSidebarTopics from "starlight-sidebar-topics";

// Vercel (production) serves the site at the root of its domain; the
// GitHub Pages fallback serves it under /haven-docs.
const VERCEL_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE = process.env.DOCS_SITE ?? (VERCEL_URL ? `https://${VERCEL_URL}` : "https://nguyentrongphuc552003.github.io");
const BASE = process.env.DOCS_BASE ?? (process.env.VERCEL ? "/" : "/haven-docs");

export default defineConfig({
  site: SITE,
  base: BASE,
  // no image optimisation: avoids sharp's native install step
  image: { service: passthroughImageService() },
  integrations: [
    starlight({
      title: "Haven",
      logo: { light: "./src/assets/logo-light.svg", dark: "./src/assets/logo-dark.svg", replacesTitle: true },
      favicon: "/favicon.svg",
      // ICO and PNG fallbacks: some browsers (Safari) do not use SVG tab icons
      head: [
        { tag: "link", attrs: { rel: "icon", href: `${BASE.replace(/\/$/, "")}/favicon.ico`, sizes: "32x32" } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: `${BASE.replace(/\/$/, "")}/apple-touch-icon.png` } },
      ],
      // short, sentence-case browser-tab titles (src/tab-title.ts)
      routeMiddleware: "./src/route-data.ts",
      customCss: ["./src/styles/starlight.css"],
      // one light/dark button next to the GitHub icon instead of the select
      components: { ThemeSelect: "./src/components/ThemeToggle.astro" },
      editLink: { baseUrl: "https://github.com/NguyenTrongPhuc552003/haven-docs/edit/main/" },
      description:
        "An ARM64 static-partitioning hypervisor with enforcement read-back, a macOS embedded-Linux workbench, and a device abstraction layer: documentation.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/NguyenTrongPhuc552003" },
      ],
      plugins: [
        starlightSidebarTopics([
          {
            label: "Start here",
            link: "/start/quick-start/",
            icon: "rocket",
            items: [
              { autogenerate: { directory: "start" } },
              { label: "CI status", link: "/ci/" },
              { label: "Home", link: "/" },
            ],
          },
          {
            label: "HAVEN",
            link: "/haven/",
            icon: "seti:lock",
            items: [
              "haven",
              "haven/getting-started",
              "haven/records/try",
              "haven/roadmap",
              "haven/porting",
              { label: "From the repository", items: [{ autogenerate: { directory: "haven/records" } }] },
              { label: "Background (May to June 2026)", collapsed: true, items: [{ autogenerate: { directory: "haven/background" } }] },
            ],
          },
          {
            label: "ELMOS",
            link: "/elmos/",
            icon: "laptop",
            items: [{ autogenerate: { directory: "elmos" } }],
          },
          {
            label: "KDAL",
            link: "/kdal/",
            icon: "puzzle",
            items: [{ autogenerate: { directory: "kdal" } }],
          },
        ]),
      ],
    }),
  ],
});
