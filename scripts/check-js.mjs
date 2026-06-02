import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_DIRS = ["js", "scripts"];
const ROOT_FILES = ["server.js"];
const EXTENSIONS = new Set([".js", ".mjs"]);

function collectJavaScriptFiles(directory) {
  const absoluteDirectory = path.join(ROOT_DIR, directory);
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    const absolutePath = path.join(ROOT_DIR, relativePath);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(relativePath));
      continue;
    }

    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function existingRootFiles() {
  return ROOT_FILES.filter((filePath) => {
    try {
      return statSync(path.join(ROOT_DIR, filePath)).isFile();
    } catch {
      return false;
    }
  });
}

const files = [...existingRootFiles(), ...CHECK_DIRS.flatMap(collectJavaScriptFiles)].sort();
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  } else {
    console.log(`ok ${file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} JavaScript files.`);
