import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  {
    name: "@bnomei/emdash-actions",
    dir: resolve(root, "../emdash-actions"),
    required: ["dist/index.mjs", "dist/admin.mjs"],
  },
  {
    name: "@bnomei/emdash-mika",
    dir: resolve(root, "../emdash-mika"),
    required: ["dist/index.mjs", "dist/server.mjs", "dist/admin.mjs", "dist/types/index.mjs"],
  },
];

if (process.env.EMDASH_MIKA_TEMPLATE_SKIP_LOCAL_BUILD === "1") {
  console.log("Skipping local package builds.");
  process.exit(0);
}

for (const localPackage of packages) {
  if (!existsSync(localPackage.dir)) {
    throw new Error("Local package directory not found: " + localPackage.dir);
  }

  ensureInstall(localPackage);
  buildPackage(localPackage);
  for (const file of localPackage.required) {
    const requiredPath = join(localPackage.dir, file);
    if (!existsSync(requiredPath)) {
      throw new Error(localPackage.name + " build did not create " + file);
    }
  }
}

function ensureInstall(localPackage) {
  if (existsSync(join(localPackage.dir, "node_modules", ".bin", "vp"))) return;
  runNpm(localPackage, ["install"]);
}

function buildPackage(localPackage) {
  runNpm(localPackage, ["run", "build"]);
}

function runNpm(localPackage, args) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : "npm";
  const npmArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(command, npmArgs, {
    cwd: localPackage.dir,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(localPackage.name + " failed: npm " + args.join(" "));
  }
}
