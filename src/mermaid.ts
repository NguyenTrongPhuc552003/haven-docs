// Draw the page's Mermaid diagrams (src/mermaid-blocks.mjs) in the site's
// colours from tokens.css, and draw them again when the theme changes.
// Mermaid is loaded only on pages that have a diagram.

const SELECTOR = ".hv-mermaid";

function themeVariables() {
	const style = getComputedStyle(document.documentElement);
	const v = (name: string) => style.getPropertyValue(name).trim();
	const dark = document.documentElement.dataset.theme !== "light";
	return {
		darkMode: dark,
		fontFamily: v("--hv-font"),
		fontSize: "14px",
		background: v("--hv-surface"),
		primaryColor: v("--hv-elevated"),
		primaryTextColor: v("--hv-heading"),
		primaryBorderColor: v("--hv-muted"),
		secondaryColor: v("--hv-accent-soft"),
		tertiaryColor: v("--hv-surface"),
		lineColor: v("--hv-muted"),
		textColor: v("--hv-fg"),
		mainBkg: v("--hv-elevated"),
		nodeBorder: v("--hv-muted"),
		clusterBkg: v("--hv-surface"),
		clusterBorder: v("--hv-border"),
		titleColor: v("--hv-heading"),
		edgeLabelBackground: v("--hv-surface"),
		noteBkgColor: v("--hv-accent-soft"),
		noteTextColor: v("--hv-heading"),
		noteBorderColor: v("--hv-accent"),
		actorBkg: v("--hv-elevated"),
		actorBorder: v("--hv-muted"),
		actorTextColor: v("--hv-heading"),
		actorLineColor: v("--hv-border"),
		signalColor: v("--hv-fg"),
		signalTextColor: v("--hv-fg"),
		labelBoxBkgColor: v("--hv-elevated"),
		labelBoxBorderColor: v("--hv-muted"),
		labelTextColor: v("--hv-heading"),
		loopTextColor: v("--hv-fg"),
		activationBkgColor: v("--hv-accent-soft"),
		activationBorderColor: v("--hv-accent"),
		sequenceNumberColor: v("--hv-accent-fg"),
	};
}

let drawing: Promise<void> = Promise.resolve();
let count = 0;

async function draw() {
	const nodes = [...document.querySelectorAll<HTMLElement>(SELECTOR)];
	if (!nodes.length) return;
	const { default: mermaid } = await import("mermaid");
	mermaid.initialize({
		startOnLoad: false,
		theme: "base",
		themeVariables: themeVariables(),
		securityLevel: "strict",
		// labels break where the source says (<br/>), not at Mermaid's 200 px
		flowchart: { wrappingWidth: 400 },
	});
	for (const el of nodes) {
		const source = el.dataset.source ?? el.textContent ?? "";
		try {
			const { svg } = await mermaid.render(`hv-mermaid-${count++}`, source);
			el.innerHTML = svg;
			el.dataset.drawn = "";
			el.removeAttribute("data-error");
		} catch (error) {
			// keep the source text visible and say why it was not drawn
			el.textContent = source;
			el.dataset.error = error instanceof Error ? error.message : String(error);
		}
	}
}

export function drawDiagrams() {
	const again = () => (drawing = drawing.then(draw, draw));
	again();
	new MutationObserver(again).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
