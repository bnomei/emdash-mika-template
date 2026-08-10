/**
 * Applies the Mika demo seed to the configured SQLite database and upload
 * directory. Railway points both paths at its persistent /data volume.
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(process.env.EMDASH_DATA_DIR ?? join(root, ".emdash"));
const databasePath = resolve(
  process.env.EMDASH_MIKA_TEMPLATE_DB ?? join(dataDirectory, "mika-template.sqlite"),
);
const uploadsDirectory = resolve(
  process.env.EMDASH_STORAGE_DIRECTORY ?? join(dataDirectory, "uploads"),
);
const cli = join(root, "node_modules", "emdash", "dist", "cli", "index.mjs");

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(uploadsDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    cli,
    "seed",
    join(root, "seed", "mika-actions.seed.json"),
    "-d",
    databasePath,
    "--uploads-dir",
    uploadsDirectory,
    "--on-conflict",
    "update",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      EMDASH_DATABASE_URL: "file:" + databasePath,
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
