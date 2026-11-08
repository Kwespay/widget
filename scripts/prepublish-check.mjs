import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const problems = [];

for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
  if (/^(file|link|portal|workspace):/.test(spec)) {
    problems.push(`dependency ${name} uses a local spec (${spec})`);
    continue;
  }
  if (name.startsWith("@kwespay/")) {
    try {
      const found = execFileSync("npm", ["view", `${name}@${spec}`, "version", "--json"], { encoding: "utf8" }).trim();
      if (!found || found === "[]") problems.push(`${name}@${spec} is not published on npm`);
    } catch {
      problems.push(`${name}@${spec} is not published on npm`);
    }
  }
}

for (const [name, spec] of Object.entries(pkg.pnpm?.overrides ?? {})) {
  if (/^(file|link|portal|workspace):/.test(spec)) {
    problems.push(`pnpm override ${name} points at a local package (${spec}); remove it before publishing`);
  }
}

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const privateHost = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?/;
for (const file of walk(new URL("../dist", import.meta.url).pathname)) {
  if (!/\.(js|mjs|cjs)$/.test(file)) continue;
  const match = readFileSync(file, "utf8").match(privateHost);
  if (match) problems.push(`${file} contains a private endpoint (${match[0]})`);
}

if (problems.length) {
  console.error(`Refusing to publish:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("prepublish check passed");
