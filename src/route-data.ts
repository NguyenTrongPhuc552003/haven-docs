// Starlight route middleware: concise browser-tab titles (src/tab-title.ts).
// The page's own heading is unchanged; only <title> is rewritten.
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { tabTitle } from "./tab-title";

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const id = route.id ?? "";
	const project = id.startsWith("elmos") ? "Elmos" : id.startsWith("kdal") ? "KDAL" : "Haven";
	const title = route.head.find((h) => h.tag === "title");
	if (title) title.content = tabTitle(route.entry.data.title, project);
});
