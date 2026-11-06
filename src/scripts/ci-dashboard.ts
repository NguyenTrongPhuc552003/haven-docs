// CI dashboard (src/pages/ci.astro): overview tiles, latest-run flow, and
// per repository a run-history strip, a run-time line chart and the jobs of
// the latest run (runner wait and run time). Plain SVG and DOM, no library.
// Status always carries an icon and a label; charts have a hover layer and
// a table view.
import {
	REPOS,
	RateLimited,
	describe,
	fmtMin,
	jobMinutes,
	jobs as fetchJobs,
	median,
	queueMinutes,
	runMinutes,
	runs as fetchRuns,
	type Job,
	type Run,
} from "./ci-api";

const NS = "http://www.w3.org/2000/svg";
const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function svg(tag: string, attrs: Record<string, string | number> = {}, text?: string) {
	const e = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	if (text !== undefined) e.textContent = text;
	return e;
}
const chip = (status: string, conclusion: string | null) => {
	const d = describe(status, conclusion);
	return `<span class="chip st-${d.st}"><span class="dot" aria-hidden="true"></span><span aria-hidden="true">${d.icon}</span>${d.label}</span>`;
};
const when = (iso: string) => {
	const m = (Date.now() - new Date(iso).getTime()) / 60000;
	if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
	if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
	return `${Math.round(m / 1440)} days ago`;
};
const osOf = (j: Job) => {
	const l = (j.labels.join(" ") + " " + j.name).toLowerCase();
	if (l.includes("windows")) return "Windows";
	if (l.includes("macos")) return "macOS";
	if (l.includes("ubuntu") || l.includes("linux")) return "Linux";
	return j.labels[0] ?? "";
};

/* tooltip */
const tip = document.getElementById("ci-tip") as HTMLDivElement;
function showTip(html: string, x: number, y: number) {
	tip.innerHTML = html;
	tip.hidden = false;
	const r = tip.getBoundingClientRect();
	const left = Math.min(window.innerWidth - r.width - 8, x + 14);
	const top = y + r.height + 20 > window.innerHeight ? y - r.height - 12 : y + 14;
	tip.style.left = `${Math.max(8, left)}px`;
	tip.style.top = `${Math.max(8, top)}px`;
}
const hideTip = () => (tip.hidden = true);
const runTip = (r: Run) =>
	`<strong>Run #${r.run_number}${r.run_attempt > 1 ? ` (attempt ${r.run_attempt})` : ""}</strong> · ${describe(r.status, r.conclusion).label}<br>` +
	`${esc(r.display_title.slice(0, 80))}<br><span class="muted">${r.head_sha.slice(0, 7)} · ${new Date(r.created_at).toLocaleString()} · ${fmtMin(runMinutes(r))}</span>`;

/* overview tile */
function tile(repo: string, rs: Run[]) {
	const el = document.querySelector<HTMLElement>(`#ci-overview [data-repo="${repo}"]`)!;
	const last = rs[0];
	const decided = rs.filter((r) => r.conclusion === "success" || r.conclusion === "failure");
	const passed = decided.filter((r) => r.conclusion === "success").length;
	el.querySelector(".tile-state")!.innerHTML = last ? chip(last.status, last.conclusion) : "";
	el.querySelector(".s-rate")!.innerHTML = decided.length
		? `${Math.round((100 * passed) / decided.length)}% <small>${passed} of ${decided.length}</small>`
		: "–";
	el.querySelector(".s-med")!.textContent = fmtMin(
		median(rs.filter((r) => r.status === "completed").map(runMinutes)),
	);
	el.querySelector(".s-last")!.innerHTML = last ? `${when(last.created_at)}` : "–";
}

/* run history strip */
function history(host: HTMLElement, rs: Run[]) {
	host.innerHTML = "";
	for (const r of [...rs].reverse()) {
		const d = describe(r.status, r.conclusion);
		const a = document.createElement("a");
		a.href = r.html_url;
		a.className = `st-${d.st}`;
		a.setAttribute("aria-label", `Run ${r.run_number}: ${d.label}, ${r.head_sha.slice(0, 7)}`);
		a.addEventListener("pointermove", (e) => showTip(runTip(r), e.clientX, e.clientY));
		a.addEventListener("pointerleave", hideTip);
		a.addEventListener("focus", () => {
			const b = a.getBoundingClientRect();
			showTip(runTip(r), b.right, b.bottom);
		});
		a.addEventListener("blur", hideTip);
		host.appendChild(a);
	}
}

/* run time line chart (one series, so no legend: the title names it) */
function niceMax(v: number) {
	if (!(v > 0)) return 1;
	const p = 10 ** Math.floor(Math.log10(v));
	return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}
function durationChart(host: HTMLElement, rsNewestFirst: Run[]) {
	const rs = [...rsNewestFirst].reverse().filter((r) => r.status === "completed");
	host.innerHTML = "";
	if (rs.length < 2) {
		host.innerHTML = `<p class="muted small">Not enough finished runs yet.</p>`;
		return;
	}
	const W = 520, H = 210, L = 40, R = 14, T = 12, B = 28;
	const ys = rs.map(runMinutes);
	const ymax = niceMax(Math.max(...ys.filter(Number.isFinite)) * 1.05);
	const x = (i: number) => L + (i * (W - L - R)) / (rs.length - 1);
	const y = (v: number) => T + (H - T - B) * (1 - v / ymax);
	const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Run time of the last ${rs.length} finished runs, from ${fmtMin(Math.min(...ys))} to ${fmtMin(Math.max(...ys))}` });
	for (let k = 0; k <= 4; k++) {
		const v = (ymax * k) / 4;
		s.appendChild(svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: k === 0 ? "viz-axis" : "viz-grid" }));
		s.appendChild(svg("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", class: "viz-tick" }, `${+v.toFixed(1)}`));
	}
	const d = rs.map((_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(ys[i]).toFixed(1)}`).join(" ");
	s.appendChild(svg("path", { d, class: "viz-line" }));
	const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	s.appendChild(svg("text", { x: L, y: H - 8, class: "viz-tick" }, fmtDate(rs[0].created_at)));
	s.appendChild(svg("text", { x: W - R, y: H - 8, "text-anchor": "end", class: "viz-tick" }, fmtDate(rs[rs.length - 1].created_at)));
	const cross = svg("line", { y1: T, y2: H - B, class: "viz-cross", visibility: "hidden" });
	s.appendChild(cross);
	rs.forEach((r, i) => {
		if (Number.isFinite(ys[i])) s.appendChild(svg("circle", { cx: x(i), cy: y(ys[i]), r: 4, class: "viz-dot" }));
	});
	// hit targets wider than the marks: one column per run
	const colW = (W - L - R) / (rs.length - 1);
	rs.forEach((r, i) => {
		const hit = svg("rect", { x: x(i) - colW / 2, y: T, width: colW, height: H - T - B, class: "viz-hit" });
		hit.addEventListener("pointermove", (e) => {
			cross.setAttribute("x1", String(x(i)));
			cross.setAttribute("x2", String(x(i)));
			cross.setAttribute("visibility", "visible");
			showTip(runTip(r), (e as PointerEvent).clientX, (e as PointerEvent).clientY);
		});
		hit.addEventListener("pointerleave", () => {
			cross.setAttribute("visibility", "hidden");
			hideTip();
		});
		hit.addEventListener("click", () => window.open(r.html_url, "_blank", "noopener"));
		s.appendChild(hit);
	});
	host.appendChild(s);
}

/* jobs of the latest run: wait (series 2) then run (series 1), one scale */
function jobRows(host: HTMLElement, js: Job[]) {
	if (!js.length) {
		host.innerHTML = `<p class="muted small">No jobs.</p>`;
		return;
	}
	const total = Math.max(...js.map((j) => (queueMinutes(j) || 0) + (jobMinutes(j) || 0)), 0.1);
	host.innerHTML = js
		.map((j) => {
			const q = Math.max(0, queueMinutes(j) || 0);
			const r = j.started_at ? Math.max(0, jobMinutes(j) || 0) : 0;
			return `<div class="job-row">
				<a class="job-name" href="${j.html_url}" title="${esc(j.name)}">${esc(j.name)}</a>
				<span>${chip(j.status, j.conclusion)}</span>
				<span class="job-bar" role="img" aria-label="waited ${fmtMin(q)}, ran ${fmtMin(r)}">
					<span class="q" style="width:${(100 * q) / total}%" title="Waited ${fmtMin(q)}"></span>
					<span class="r" style="width:${(100 * r) / total}%" title="Ran ${fmtMin(r)}"></span>
				</span>
				<span class="job-time">${fmtMin(q)} + ${fmtMin(r)}</span>
			</div>`;
		})
		.join("");
}

/* data table */
function table(host: HTMLElement, rs: Run[]) {
	host.innerHTML = `<table><thead><tr><th>Run</th><th>Commit</th><th>Result</th><th>Started</th><th>Run time</th></tr></thead><tbody>${rs
		.map(
			(r) =>
				`<tr><td><a href="${r.html_url}">#${r.run_number}</a></td><td><code>${r.head_sha.slice(0, 7)}</code></td><td>${describe(r.status, r.conclusion).label}</td><td>${new Date(r.created_at).toLocaleString()}</td><td>${fmtMin(runMinutes(r))}</td></tr>`,
		)
		.join("")}</tbody></table>`;
}

/* flow: commit -> jobs -> result, one band per repository */
function flow(host: HTMLElement, latest: { repo: string; run?: Run; jobs: Job[] }[]) {
	const W = 860, rowH = 34, pad = 18, nodeH = 28;
	const bands = latest.map((l) => Math.max(1, l.jobs.length) * rowH + pad * 2);
	const H = bands.reduce((a, b) => a + b, 0);
	const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Latest run of each repository: commit, jobs and result" });
	let top = 0;
	latest.forEach((l, bi) => {
		const band = bands[bi];
		const cy = top + band / 2;
		if (bi) s.appendChild(svg("line", { x1: 0, x2: W, y1: top, y2: top, class: "viz-grid" }));
		// commit node
		const c = svg("g", { class: "flow-node" });
		c.appendChild(svg("rect", { x: 8, y: cy - 22, width: 170, height: 44, rx: 10 }));
		c.appendChild(svg("text", { x: 20, y: cy - 3, class: "flow-repo" }, l.repo));
		c.appendChild(svg("text", { x: 20, y: cy + 14, class: "sub" }, l.run ? `${l.run.head_sha.slice(0, 7)} · ${l.run.event}` : "no run"));
		s.appendChild(c);
		// result node
		const d = l.run ? describe(l.run.status, l.run.conclusion) : describe("completed", null);
		const res = svg("g", { class: "flow-node" });
		res.appendChild(svg("rect", { x: W - 168, y: cy - 22, width: 160, height: 44, rx: 10 }));
		res.appendChild(svg("rect", { x: W - 168, y: cy - 22, width: 6, height: 44, rx: 3, class: "bar", style: `fill:var(--st-${d.st})` }));
		res.appendChild(svg("text", { x: W - 152, y: cy - 3 }, `${d.icon} ${d.label}`));
		res.appendChild(svg("text", { x: W - 152, y: cy + 14, class: "sub" }, l.run ? fmtMin(runMinutes(l.run)) : ""));
		s.appendChild(res);
		// job nodes
		const jx = 260, jw = 360;
		l.jobs.forEach((j, i) => {
			const y = top + pad + i * rowH + rowH / 2;
			s.appendChild(svg("path", { d: `M178 ${cy} C 220 ${cy}, 220 ${y}, ${jx} ${y}`, class: "flow-link" }));
			s.appendChild(svg("path", { d: `M${jx + jw} ${y} C ${jx + jw + 40} ${y}, ${W - 210} ${cy}, ${W - 168} ${cy}`, class: "flow-link" }));
			const jd = describe(j.status, j.conclusion);
			const g = svg("g", { class: "flow-node" });
			g.appendChild(svg("rect", { x: jx, y: y - nodeH / 2, width: jw, height: nodeH, rx: 7 }));
			g.appendChild(svg("rect", { x: jx, y: y - nodeH / 2, width: 5, height: nodeH, rx: 2.5, class: "bar", style: `fill:var(--st-${jd.st})` }));
			const name = j.name.length > 40 ? `${j.name.slice(0, 39)}…` : j.name;
			g.appendChild(svg("text", { x: jx + 14, y: y + 4 }, `${jd.icon} ${name}`));
			g.appendChild(svg("text", { x: jx + jw - 10, y: y + 4, "text-anchor": "end", class: "sub" }, `${osOf(j)} · ${fmtMin(jobMinutes(j))}`));
			g.addEventListener("pointermove", (e) =>
				showTip(`<strong>${esc(j.name)}</strong><br>${jd.label} · ${osOf(j)}<br><span class="muted">waited ${fmtMin(queueMinutes(j))}, ran ${fmtMin(jobMinutes(j))}</span>`, (e as PointerEvent).clientX, (e as PointerEvent).clientY),
			);
			g.addEventListener("pointerleave", hideTip);
			s.appendChild(g);
		});
		top += band;
	});
	host.innerHTML = "";
	host.appendChild(s);
}

/* load everything */
const updated = document.getElementById("ci-updated")!;
const errorEl = document.getElementById("ci-error")!;
async function load(fresh = false) {
	updated.textContent = "Loading…";
	errorEl.hidden = true;
	const latest: { repo: string; run?: Run; jobs: Job[] }[] = [];
	let oldest = Date.now();
	for (const repo of REPOS) {
		const sec = document.querySelector<HTMLElement>(`.repo-section[data-repo="${repo}"]`)!;
		const part = (p: string) => sec.querySelector<HTMLElement>(`[data-part="${p}"]`)!;
		try {
			const { runs: rs, fetchedAt } = await fetchRuns(repo, fresh);
			oldest = Math.min(oldest, fetchedAt);
			tile(repo, rs);
			history(part("history"), rs);
			durationChart(part("duration"), rs);
			table(part("table"), rs);
			const js = rs[0] ? await fetchJobs(repo, rs[0].id, fresh) : [];
			jobRows(part("jobs"), js);
			latest.push({ repo, run: rs[0], jobs: js });
		} catch (e) {
			errorEl.hidden = false;
			errorEl.textContent =
				e instanceof RateLimited
					? "GitHub's API limit for your network is used up for now (60 requests an hour without a token). Try again later, or open the runs on GitHub."
					: `Could not read ${repo}: ${(e as Error).message}`;
			latest.push({ repo, jobs: [] });
		}
	}
	flow(document.getElementById("ci-flow")!, latest);
	updated.textContent = `Data from ${new Date(oldest).toLocaleTimeString()} (kept for 5 minutes)`;
}
document.getElementById("ci-refresh")!.addEventListener("click", () => load(true));
load();
