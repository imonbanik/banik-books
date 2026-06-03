import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const REQUIRED_PATHS = [
  ".env.example",
  ".env.production.example",
  ".env.staging.example",
  "backend/api.js",
  "backend/adapters/file-adapter.js",
  "backend/adapters/firebase-admin-adapter.js",
  "backend/adapters/README.md",
  "backend/auth-context.js",
  "backend/backup-service.js",
  "backend/collection-service.js",
  "backend/data-store.js",
  "backend/firebase-admin-client.js",
  "backend/page-routes.js",
  "backend/permissions.js",
  "backend/rate-limit.js",
  "backend/storage-adapter.js",
  "backend/validators.js",
  "js/services/api-client.js",
  "js/services/report-data.js",
  "pages/accounting/journal-entry.html",
  "pages/accounting/chart-of-accounts.html",
  "pages/admin/admin.html",
  "styles.css",
  "scripts/migrate-file-to-adapter.mjs",
  "scripts/check-production-config.mjs",
  "docs/REMAINING_EXTERNAL_STEPS.md",
  "docs/RELEASE_STATUS.md",
];

const BACKEND_BACKED_STORAGE_KEYS = [
  "banikBooksJournalEntries",
  "banikBooksParties",
  "banikBooksChartOfAccounts",
  "banikBooksLedgers",
  "banikBooksAccountingPreferences",
  "banikBooksChequePrinterPayees",
  "banikBooksChallanRegisterEntries",
];
const REMOVED_EMPTY_DIRS = ["css/layout", "css/components", "css/base"];
const SOURCE_NOISE_DIRS = [
  ".",
  "assets",
  "backend",
  "css",
  "docs",
  "js",
  "pages",
  "scripts",
];

async function exists(relativePath) {
  try {
    await fs.access(path.join(ROOT_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, matcher = () => true) {
  const absoluteDir = path.join(ROOT_DIR, dir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listFiles(relativePath, matcher);
      }

      return matcher(relativePath) ? [relativePath] : [];
    })
  );

  return files.flat().sort();
}

async function assertNoRootHtml() {
  const entries = await fs.readdir(ROOT_DIR, { withFileTypes: true });
  const rootHtmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name);

  if (rootHtmlFiles.length) {
    throw new Error(`Root HTML duplicates remain: ${rootHtmlFiles.join(", ")}`);
  }

  console.log("ok no root HTML duplicates");
}

async function assertNoCompatRoutes() {
  if (await exists("routes/compat")) {
    throw new Error("routes/compat still exists.");
  }

  console.log("ok no routes/compat duplicates");
}

async function assertNoNoiseFiles() {
  const noiseGroups = await Promise.all(
    SOURCE_NOISE_DIRS.map(async (dir) => {
      if (!(await exists(dir))) {
        return [];
      }

      const entries = await listFiles(dir, (file) => path.basename(file) === ".DS_Store");
      return dir === "." ? entries.filter((file) => !file.includes(path.sep)) : entries;
    })
  );
  const noiseFiles = noiseGroups.flat();

  if (noiseFiles.length) {
    throw new Error(`Noise files remain: ${noiseFiles.join(", ")}`);
  }

  console.log("ok no .DS_Store noise files");
}

async function assertNoRedundantGitkeep() {
  const sourceGitkeepGroups = await Promise.all(
    ["backend", "css", "docs", "js", "pages", "scripts"].map((dir) =>
      listFiles(dir, (file) => path.basename(file) === ".gitkeep")
    )
  );
  const sourceGitkeepFiles = sourceGitkeepGroups.flat();

  if (sourceGitkeepFiles.length) {
    throw new Error(`Redundant source .gitkeep files remain: ${sourceGitkeepFiles.join(", ")}`);
  }

  console.log("ok no redundant source .gitkeep files");
}

async function assertRemovedEmptyDirsStayRemoved() {
  const existingDirs = [];

  for (const dir of REMOVED_EMPTY_DIRS) {
    if (await exists(dir)) {
      existingDirs.push(dir);
    }
  }

  if (existingDirs.length) {
    throw new Error(`Removed empty folders came back: ${existingDirs.join(", ")}`);
  }

  console.log("ok removed empty CSS folders stay removed");
}

async function assertRequiredPaths() {
  const missingPaths = [];

  for (const relativePath of REQUIRED_PATHS) {
    if (!(await exists(relativePath))) {
      missingPaths.push(relativePath);
    }
  }

  if (missingPaths.length) {
    throw new Error(`Required architecture files missing: ${missingPaths.join(", ")}`);
  }

  console.log(`ok required architecture files present (${REQUIRED_PATHS.length})`);
}

async function assertActivePageInventory() {
  const pageFiles = await listFiles("pages", (file) => file.endsWith(".html"));

  if (pageFiles.length < 20) {
    throw new Error(`Unexpectedly low active page count: ${pageFiles.length}`);
  }

  console.log(`ok active page inventory (${pageFiles.length} pages)`);
}

async function assertBackendBackedStorageClean() {
  const sourceFiles = [
    ...(await listFiles("js", (file) => file.endsWith(".js"))),
    ...(await listFiles("pages", (file) => file.endsWith(".html"))),
  ];
  const violations = [];

  for (const file of sourceFiles) {
    const content = await fs.readFile(path.join(ROOT_DIR, file), "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (
        line.includes("localStorage.setItem") &&
        BACKEND_BACKED_STORAGE_KEYS.some((key) => line.includes(key))
      ) {
        violations.push(`${file}:${index + 1}`);
      }
    });
  }

  if (violations.length) {
    throw new Error(`Backend-backed data is still written directly to localStorage: ${violations.join(", ")}`);
  }

  console.log("ok no direct backend-backed localStorage writes");
}

async function run() {
  await assertNoRootHtml();
  await assertNoCompatRoutes();
  await assertNoNoiseFiles();
  await assertNoRedundantGitkeep();
  await assertRemovedEmptyDirsStayRemoved();
  await assertRequiredPaths();
  await assertActivePageInventory();
  await assertBackendBackedStorageClean();
  console.log("Commercial architecture audit passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
