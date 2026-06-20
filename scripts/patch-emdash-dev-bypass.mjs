import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const emdashRoot = join(process.cwd(), "node_modules", "emdash");
const sourceFile = join(emdashRoot, "src", "utils", "single-flight-cache.ts");
const distDir = join(emdashRoot, "dist");
const anchor = "cache.lock.ownerStartedAt = null;";
const replacement = "cache.lock ??= createInitLock();\n\tcache.lock.ownerStartedAt = null;";

const files = [sourceFile];
if (existsSync(distDir)) {
  for (const file of readdirSync(distDir)) {
    if (file.startsWith("single-flight-cache-") && file.endsWith(".mjs")) {
      files.push(join(distDir, file));
    }
  }
}

for (const file of files) {
  if (!existsSync(file)) continue;

  const source = readFileSync(file, "utf8");
  if (source.includes("cache.lock ??= createInitLock();")) {
    continue;
  }

  if (!source.includes(anchor)) {
    console.warn(
      "EmDash dev bypass patch skipped: expected single-flight cache anchor not found in " + file,
    );
    continue;
  }

  writeFileSync(file, source.replace(anchor, replacement));
  console.log("Patched EmDash single-flight cache invalidation for dev bypass: " + file);
}
