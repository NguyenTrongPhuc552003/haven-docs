// Fetch the project repositories when they are not checked out next to this
// one (on Vercel, for example): shallow clones into .sources/. ELMOS's
// command reference needs Go; if `go` is missing, the Go version named in
// elmos/go.mod is downloaded from go.dev into .sources/go and ELMOS is
// built once, so scripts/sync.mjs finds .sources/elmos/build/elmos.
//
// Does nothing when ../haven exists (local workspace) unless
// FETCH_SOURCES=1.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEST = path.join(ROOT, ".sources");
const OWNER = "https://github.com/NguyenTrongPhuc552003";
const REPOS = ["haven", "elmos", "kdal"];

if (fs.existsSync(path.join(ROOT, "..", "haven")) && process.env.FETCH_SOURCES !== "1") {
  console.log("fetch-sources: sibling checkouts found, nothing to fetch");
  process.exit(0);
}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
for (const repo of REPOS) run("git", ["clone", "--quiet", "--depth", "1", `${OWNER}/${repo}.git`, path.join(DEST, repo)]);

function haveGo() {
  try {
    execFileSync("go", ["version"], { stdio: "ignore" });
    return "go";
  } catch {
    return null;
  }
}

let go = haveGo();
if (!go) {
  const ver = fs.readFileSync(path.join(DEST, "elmos", "go.mod"), "utf8").match(/^go\s+(\S+)/m)[1];
  const arch = { x64: "amd64", arm64: "arm64" }[process.arch];
  const tgz = path.join(DEST, "go.tgz");
  run("curl", ["-fsSL", "-o", tgz, `https://go.dev/dl/go${ver}.${process.platform}-${arch}.tar.gz`]);
  run("tar", ["-xzf", tgz, "-C", DEST]);
  go = path.join(DEST, "go", "bin", "go");
}
try {
  run(go, ["build", "-o", "build/elmos", "./cmd/elmos"], {
    cwd: path.join(DEST, "elmos"),
    env: { ...process.env, CGO_ENABLED: "0", GOFLAGS: "-mod=mod" },
  });
} catch (e) {
  console.warn(`fetch-sources: ELMOS not built, its command reference will be missing (${e.message})`);
}
console.log(`fetch-sources: ${REPOS.join(", ")} in ${DEST}`);
