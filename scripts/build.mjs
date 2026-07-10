import { execFileSync } from "node:child_process";

function readGitSha() {
  // Try multiple sources
  // 1. Already set env var
  if (process.env.NEXT_PUBLIC_BUILD_SHA) return process.env.NEXT_PUBLIC_BUILD_SHA;
  // 2. Vercel provides this during builds
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  // 3. Local git
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {}
  // 4. CI env
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA.slice(0, 7);
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  return "unknown";
}

const sha = readGitSha();
const buildTime = new Date().toISOString();

process.env.NEXT_PUBLIC_BUILD_SHA = sha;
process.env.NEXT_PUBLIC_BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? buildTime;

console.log(`[build.mjs] SHA: ${sha}`);
console.log(`[build.mjs] Time: ${process.env.NEXT_PUBLIC_BUILD_TIME}`);

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "build"],
  { stdio: "inherit", env: process.env }
);
