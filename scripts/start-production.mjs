/**
 * Initializes an empty persistent volume once, then starts Astro's standalone
 * Node server. Existing SQLite data is never overwritten on restart.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(
  process.env.EMDASH_DATA_DIR ?? process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(root, ".emdash"),
);
const databasePath = resolve(
  process.env.EMDASH_MIKA_TEMPLATE_DB ?? join(dataDirectory, "mika-template.sqlite"),
);
const uploadsDirectory = resolve(
  process.env.EMDASH_STORAGE_DIRECTORY ?? join(dataDirectory, "uploads"),
);
const sessionDirectory = resolve(
  process.env.EMDASH_SESSION_DIRECTORY ?? join(dataDirectory, "sessions"),
);

process.env.EMDASH_DATA_DIR = dataDirectory;
process.env.EMDASH_DATABASE_URL ??= "file:" + databasePath;
process.env.EMDASH_MIKA_TEMPLATE_DB = databasePath;
process.env.EMDASH_STORAGE_DIRECTORY = uploadsDirectory;
process.env.EMDASH_SESSION_DIRECTORY = sessionDirectory;
process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "4321";

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(uploadsDirectory, { recursive: true });
mkdirSync(sessionDirectory, { recursive: true });

if (!existsSync(databasePath)) {
  console.log("No Mika demo database found; applying the initial seed.");
  const seed = spawnSync(process.execPath, [join(root, "scripts", "seed-fixture.mjs")], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
} else {
  console.log("Using existing Mika demo database at " + databasePath);
}

const server = spawn(process.execPath, [join(root, "dist", "server", "entry.mjs")], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("error", (error) => {
  console.error("Failed to start the Astro server:", error);
  process.exit(1);
});

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
