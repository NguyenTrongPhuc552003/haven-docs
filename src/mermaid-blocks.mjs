// Markdown plugin: a ```mermaid code block becomes <div class="hv-mermaid">
// holding the diagram's source, before Expressive Code turns code blocks
// into highlighted ones. src/mermaid.ts draws the diagram in the browser in
// the site's colours. Without JavaScript the source text stays readable.
//
// The repositories keep their diagrams as ```mermaid blocks too, so GitHub
// draws the same diagrams from the same text.

function codeBlock(pre) {
	const [code, ...rest] = pre.children ?? [];
	if (rest.length || !code || code.type !== "element" || code.tagName !== "code") return undefined;
	const classes = Array.isArray(code.properties?.className) ? code.properties.className : [];
	const lang = code.data?.lang ?? classes.find((c) => String(c).startsWith("language-"))?.slice(9);
	if (lang !== "mermaid") return undefined;
	return (code.children ?? []).map((c) => c.value ?? "").join("");
}

export const mermaidBlocks = {
	name: "hv-mermaid-blocks",
	element: {
		filter: ["pre"],
		visit(node, ctx) {
			const source = codeBlock(node);
			if (source === undefined) return;
			ctx.replaceNode(node, {
				type: "element",
				tagName: "div",
				properties: { className: ["hv-mermaid", "not-content"], dataSource: source.replace(/\n$/, "") },
				children: [{ type: "text", value: source }],
			});
		},
	},
};
