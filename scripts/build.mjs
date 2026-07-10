import { execFileSync } from "node:child_process";

function readGitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";
  }
}

process.env.NEXT_PUBLIC_BUILD_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  readGitSha();

process.env.NEXT_PUBLIC_BUILD_TIME =
  process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString();

console.log(`Build SHA: ${process.env.NEXT_PUBLIC_BUILD_SHA}`);
console.log(`Build Time: ${process.env.NEXT_PUBLIC_BUILD_TIME}`);

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "build"],
  { stdio: "inherit", env: process.env }
);
