// GitHub Actions data for the CI pages, read live in the browser from the
// public GitHub REST API (no token: 60 requests per hour per visitor IP).
// Answers are cached in sessionStorage for five minutes, so moving between
// the landing page and the dashboard costs no extra requests.
export const OWNER = "NguyenTrongPhuc552003";
export const REPOS = ["haven", "elmos", "kdal"] as const;
export const WORKFLOW = "ci.yml"; // each repository's CI workflow file
const TTL_MS = 5 * 60 * 1000;

export interface Run {
	id: number;
	run_number: number;
	run_attempt: number;
	display_title: string;
	head_sha: string;
	event: string;
	status: string;
	conclusion: string | null;
	created_at: string;
	run_started_at: string;
	updated_at: string;
	html_url: string;
}
export interface Job {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	created_at: string;
	started_at: string | null;
	completed_at: string | null;
	html_url: string;
	labels: string[];
}

export class RateLimited extends Error {}

function cacheGet(key: string): { t: number; v: unknown } | null {
	try {
		const s = sessionStorage.getItem(key);
		return s ? JSON.parse(s) : null;
	} catch {
		return null;
	}
}
function cacheSet(key: string, v: unknown) {
	try {
		sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
	} catch {
		/* storage full or unavailable: no cache */
	}
}

export async function gh<T>(path: string, fresh = false): Promise<{ data: T; fetchedAt: number }> {
	const key = `hv-ci:${path}`;
	const hit = cacheGet(key);
	if (!fresh && hit && Date.now() - hit.t < TTL_MS) return { data: hit.v as T, fetchedAt: hit.t };
	const res = await fetch(`https://api.github.com${path}`, {
		// only CORS-safelisted headers, so the browser sends no preflight
		headers: { Accept: "application/vnd.github+json" },
	});
	if (res.status === 403 || res.status === 429) {
		if (hit) return { data: hit.v as T, fetchedAt: hit.t }; // stale but usable
		throw new RateLimited(res.headers.get("x-ratelimit-reset") ?? "");
	}
	if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
	const data = (await res.json()) as T;
	cacheSet(key, data);
	return { data, fetchedAt: Date.now() };
}

export async function runs(repo: string, fresh = false) {
	const r = await gh<{ workflow_runs: Run[] }>(
		`/repos/${OWNER}/${repo}/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=30`,
		fresh,
	);
	return { runs: r.data.workflow_runs, fetchedAt: r.fetchedAt };
}

export async function latestRun(repo: string): Promise<Run | undefined> {
	return (await runs(repo)).runs[0];
}

export async function jobs(repo: string, runId: number, fresh = false) {
	const r = await gh<{ jobs: Job[] }>(`/repos/${OWNER}/${repo}/actions/runs/${runId}/jobs?per_page=50`, fresh);
	return r.data.jobs;
}

export interface Desc {
	st: "good" | "warn" | "serious" | "critical" | "neutral";
	icon: string;
	label: string;
}
/** Status class, icon and label for a run or job (never colour alone). */
export function describe(status: string, conclusion: string | null): Desc {
	if (status !== "completed")
		return { st: "warn", icon: "◐", label: status === "queued" || status === "waiting" ? "Queued" : "Running" };
	switch (conclusion) {
		case "success":
			return { st: "good", icon: "✓", label: "Passed" };
		case "failure":
		case "timed_out":
		case "startup_failure":
			return { st: "critical", icon: "✕", label: conclusion === "timed_out" ? "Timed out" : "Failed" };
		case "action_required":
			return { st: "serious", icon: "!", label: "Needs action" };
		case "cancelled":
			return { st: "neutral", icon: "⊘", label: "Cancelled" };
		default:
			return { st: "neutral", icon: "–", label: "Skipped" };
	}
}

const ms = (a: string | null, b: string | null) => (a && b ? new Date(b).getTime() - new Date(a).getTime() : NaN);
/** Wall time of a run: start of its first attempt's execution to its last update. */
export const runMinutes = (r: Run) => ms(r.run_started_at, r.updated_at) / 60000;
/** Time a job waited for a runner, and the time it ran. */
export const queueMinutes = (j: Job) => ms(j.created_at, j.started_at) / 60000;
export const jobMinutes = (j: Job) => ms(j.started_at, j.completed_at ?? new Date().toISOString()) / 60000;

export function fmtMin(m: number): string {
	if (!Number.isFinite(m)) return "n/a";
	if (m < 1) return `${Math.round(m * 60)} s`;
	if (m < 60) return `${m.toFixed(m < 10 ? 1 : 0)} min`;
	return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
}
export function median(xs: number[]): number {
	const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
	if (!s.length) return NaN;
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
