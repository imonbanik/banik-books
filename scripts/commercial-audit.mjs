import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const REQUIRED_PATHS = [
  ".env.example",
  ".env.production.example",
  ".env.staging.example",
  "vercel.json",
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
  "frontend/assets/banik-logo.svg",
  "frontend/js/services/api-client.js",
  "frontend/js/services/report-data.js",
  "frontend/pages/accounting/journal-entry.html",
  "frontend/pages/accounting/chart-of-accounts.html",
  "frontend/pages/admin/admin.html",
  "frontend/styles.css",
  "scripts/migrate-file-to-adapter.mjs",
  "scripts/check-production-config.mjs",
  "docs/RELEASE_NOTES.md",
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
const REMOVED_EMPTY_DIRS = [
  "frontend/css/layout",
  "frontend/css/components",
  "frontend/css/base",
];
const ROOT_FRONTEND_SOURCE_PATHS = ["assets", "css", "js", "pages", "styles.css"];
const SOURCE_NOISE_DIRS = [
  ".",
  "backend",
  "docs",
  "frontend",
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

async function assertNoRootFrontendSource() {
  const rootSourcePaths = [];

  for (const sourcePath of ROOT_FRONTEND_SOURCE_PATHS) {
    if (await exists(sourcePath)) {
      rootSourcePaths.push(sourcePath);
    }
  }

  if (rootSourcePaths.length) {
    throw new Error(`Root frontend source paths remain: ${rootSourcePaths.join(", ")}`);
  }

  console.log("ok frontend source lives under frontend/");
}

async function assertNoNoiseFiles() {
  const noiseGroups = await Promise.all(
    SOURCE_NOISE_DIRS.map(async (dir) => {
      if (!(await exists(dir))) {
        return [];
      }

      if (dir === ".") {
        const entries = await fs.readdir(ROOT_DIR, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile() && entry.name === ".DS_Store")
          .map((entry) => entry.name);
      }

      const entries = await listFiles(dir, (file) => path.basename(file) === ".DS_Store");
      return entries;
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
    ["backend", "docs", "frontend", "scripts"].map((dir) =>
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
  const pageFiles = await listFiles("frontend/pages", (file) => file.endsWith(".html"));

  if (pageFiles.length < 20) {
    throw new Error(`Unexpectedly low active page count: ${pageFiles.length}`);
  }

  console.log(`ok active page inventory (${pageFiles.length} pages)`);
}

async function assertBackendBackedStorageClean() {
  const sourceFiles = [
    ...(await listFiles("frontend/js", (file) => file.endsWith(".js"))),
    ...(await listFiles("frontend/pages", (file) => file.endsWith(".html"))),
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

async function assertReleaseMetadataSynced() {
  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT_DIR, "package.json"), "utf8"));
  const appConfig = await fs.readFile(
    path.join(ROOT_DIR, "frontend/js/config/app-config.js"),
    "utf8"
  );
  const indexPage = await fs.readFile(
    path.join(ROOT_DIR, "frontend/pages/auth/index.html"),
    "utf8"
  );
  const releaseNotes = await fs.readFile(
    path.join(ROOT_DIR, "docs/RELEASE_NOTES.md"),
    "utf8"
  );
  const versionMatch = appConfig.match(/version:\s*"([^"]+)"/);
  const releaseMonthMatch = appConfig.match(/releaseMonthYear:\s*"([^"]+)"/);
  const appVersion = versionMatch ? versionMatch[1] : "";
  const releaseMonthYear = releaseMonthMatch ? releaseMonthMatch[1] : "";

  if (!appVersion || !releaseMonthYear) {
    throw new Error("Release metadata missing from frontend/js/config/app-config.js");
  }

  if (packageJson.version !== appVersion) {
    throw new Error(
      `Package version ${packageJson.version} does not match app release version ${appVersion}`
    );
  }

  if (
    !indexPage.includes("data-release-month-year") ||
    !indexPage.includes("data-release-version")
  ) {
    throw new Error("Landing page release metadata placeholders are missing.");
  }

  if (!releaseNotes.includes(`## Version ${appVersion} - ${releaseMonthYear}`)) {
    throw new Error(`Release notes missing Version ${appVersion} - ${releaseMonthYear}`);
  }

  console.log(`ok release metadata synced (${appVersion}, ${releaseMonthYear})`);
}

async function run() {
  await assertNoRootHtml();
  await assertNoCompatRoutes();
  await assertNoRootFrontendSource();
  await assertNoNoiseFiles();
  await assertNoRedundantGitkeep();
  await assertRemovedEmptyDirsStayRemoved();
  await assertRequiredPaths();
  await assertActivePageInventory();
  await assertBackendBackedStorageClean();
  await assertReleaseMetadataSynced();
  console.log("Commercial architecture audit passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
