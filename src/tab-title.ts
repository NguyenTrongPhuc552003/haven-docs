// Short, sentence-case browser-tab titles: "Getting started · Haven"
// instead of "Getting Started | HAVEN". Used by the Starlight route
// middleware (src/route-data.ts) and by the landing and CI pages.

// Project names as they read in running text (the HAVEN repository calls
// itself "Haven"); other all-caps words (KDAL, GIC, SMMU, QEMU, CI) stay.
const NAMES: Record<string, string> = { HAVEN: "Haven", ELMOS: "Elmos" };

// Capitalised words that are names, so they keep their capital.
const PROPER = new Set([
	"Haven", "Elmos", "Linux", "Arm", "Android", "Apple", "Windows", "Ubuntu", "Debian",
	"Alpine", "Docker", "Homebrew", "GitHub", "Codeberg", "Vercel", "Starlight", "Astro",
	"Go", "Cobra", "Python", "Rust", "Orange", "Pi", "Radxa", "Orion", "Xen", "Jailhouse",
	"Bao", "Hafnium", "Yocto", "Buildroot", "Zephyr", "FreeRTOS", "Kconfig", "Kbuild",
	"Coq", "Isabelle", "Vietnam", "Sky1",
]);

/** "ELMOS - Embedded Linux on macOS" -> "Elmos: embedded Linux on macOS" */
export function sentenceCase(title: string): string {
	const words = title.replace(/\s+-\s+/g, ": ").split(/\s+/);
	return words
		.map((w, i) => {
			const bare = w.replace(/[^A-Za-z0-9.]/g, "");
			if (NAMES[bare]) return w.replace(bare, NAMES[bare]);
			if (i === 0 || PROPER.has(bare)) return w;
			// "Getting" -> "getting"; leave "macOS", "i.MX95", "KDAL", "SMMUv3"
			return /^[A-Z][a-z]+(?:['-][a-z]+)*[,.:;)]?$/.test(w) ? w.toLowerCase() : w;
		})
		.join(" ");
}

/** Tab title for a page; `project` is the section it belongs to. */
export function tabTitle(pageTitle: string, project = "Haven"): string {
	const t = sentenceCase(pageTitle);
	return t.toLowerCase().startsWith(project.toLowerCase()) ? t : `${t} · ${project}`;
}
