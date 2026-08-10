/**
 * Drops the local SQLite fixture (including WAL/SHM) and re-applies
 * `seed/mika-actions.seed.json` via `npm run seed:apply`.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = resolve(
  process.env.EMDASH_MIKA_TEMPLATE_DB ??
    join(process.env.EMDASH_DATA_DIR ?? ".emdash", "mika-template.sqlite"),
);
const paths = [
  databasePath,
  databasePath + "-shm",
  databasePath + "-wal",
];

for (const file of paths) {
  if (existsSync(file)) rmSync(file, { force: true });
}

const result = spawnSync("npm", ["run", "seed:apply"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
