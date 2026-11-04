// One documentation site for HAVEN, ELMOS and KDAL (audit E5).
// Content is copied from the three repositories at build time by
// scripts/sync.mjs, so each repository stays the single source of its pages.
import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightSidebarTopics from "starlight-sidebar-topics";

const SITE = process.env.DOCS_SITE ?? "https://nguyentrongphuc552003.codeberg.page";
const BASE = process.env.DOCS_BASE ?? "/docs";

export default defineConfig({
  site: SITE,
  base: BASE,
  // no image optimisation: avoids sharp's native install step
  image: { service: passthroughImageService() },
  integrations: [
    starlight({
      title: "HAVEN · ELMOS · KDAL",
      description:
        "An ARM64 static-partitioning hypervisor with enforcement read-back, a macOS embedded-Linux workbench, and a device abstraction layer: documentation.",
      social: [
        { icon: "codeberg", label: "Codeberg", href: "https://codeberg.org/NguyenTrongPhuc552003" },
      ],
      plugins: [
        starlightSidebarTopics([
          {
            label: "Start here",
            link: "/",
            icon: "rocket",
            items: [{ autogenerate: { directory: "start" } }],
          },
          {
            label: "HAVEN",
            link: "/haven/",
            icon: "seti:lock",
            items: [{ autogenerate: { directory: "haven" } }],
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
