import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const emdashRoot = join(process.cwd(), "node_modules", "emdash");
const packageFile = join(emdashRoot, "package.json");
const distDir = join(emdashRoot, "dist");
const emdashVersion = readEmDashVersion();

patchSingleFlightCache();
patchObjectCacheImportMetaEnvGuard();

function patchSingleFlightCache() {
  const sourceFile = join(emdashRoot, "src", "utils", "single-flight-cache.ts");
  const anchor = "cache.lock.ownerStartedAt = null;";
  const replacement = "cache.lock ??= createInitLock();\n\tcache.lock.ownerStartedAt = null;";
  const files = collectFiles(sourceFile, "single-flight-cache-");

  for (const file of files) {
    patchTextFile({
      file,
      alreadyPatched: "cache.lock ??= createInitLock();",
      anchor,
      replacement,
      skippedMessage:
        "EmDash dev bypass patch skipped: expected single-flight cache anchor not found in ",
      patchedMessage: "Patched EmDash single-flight cache invalidation for dev bypass: ",
    });
  }
}

function patchObjectCacheImportMetaEnvGuard() {
  if (emdashVersion !== "0.22.0") return;

  const sourceFile = join(emdashRoot, "src", "object-cache", "index.ts");
  const files = collectFiles(sourceFile, "object-cache-");

  for (const file of files) {
    patchTextFile({
      file,
      alreadyPatched: "import.meta.env?.DEV",
      anchor: "import.meta.env.DEV",
      replacement: "import.meta.env?.DEV",
      skippedMessage:
        "EmDash object-cache CLI guard patch skipped: expected import.meta.env anchor not found in ",
      patchedMessage: "Patched EmDash object-cache CLI guard for seed/apply: ",
    });
  }
}

function collectFiles(sourceFile, distPrefix) {
  const files = [sourceFile];
  if (existsSync(distDir)) {
    for (const file of readdirSync(distDir)) {
      if (file.startsWith(distPrefix) && file.endsWith(".mjs")) {
        files.push(join(distDir, file));
      }
    }
  }
  return files;
}

function patchTextFile({
  file,
  alreadyPatched,
  anchor,
  replacement,
  skippedMessage,
  patchedMessage,
}) {
  if (!existsSync(file)) return;

  const source = readFileSync(file, "utf8");
  if (source.includes(alreadyPatched)) return;

  if (!source.includes(anchor)) {
    console.warn(skippedMessage + file);
    return;
  }

  writeFileSync(file, source.replaceAll(anchor, replacement));
  console.log(patchedMessage + file);
}

function readEmDashVersion() {
  if (!existsSync(packageFile)) return "";
  return JSON.parse(readFileSync(packageFile, "utf8")).version ?? "";
}
