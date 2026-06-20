import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const paths = [
  ".emdash/mika-template.sqlite",
  ".emdash/mika-template.sqlite-shm",
  ".emdash/mika-template.sqlite-wal",
];

for (const file of paths) {
  if (existsSync(file)) rmSync(file, { force: true });
}

const result = spawnSync("npm", ["run", "seed:apply"], { stdio: "inherit" });
process.exit(result.status ?? 1);
