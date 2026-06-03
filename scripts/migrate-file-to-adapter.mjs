import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT_DIR = process.cwd();
const DATA_FILE =
  process.env.BANIK_MIGRATION_DATA_FILE ||
  process.env.BANIK_DATA_FILE ||
  path.join(ROOT_DIR, "data", "app-data.json");
const COLLECTIONS = ["journals", "parties", "chartOfAccounts", "challans", "settings"];

const require = createRequire(import.meta.url);
const { importBackup } = require("../backend/backup-service.js");

function hasCollectionData(data) {
  return COLLECTIONS.some((collectionName) => Array.isArray(data[collectionName]));
}

function normalizeScopedData(data) {
  return COLLECTIONS.reduce((scopedData, collectionName) => {
    scopedData[collectionName] = Array.isArray(data[collectionName]) ? data[collectionName] : [];
    return scopedData;
  }, {});
}

function parseScopeKey(scopeKey) {
  const [userId, workspaceId] = String(scopeKey || "local-dev::default").split("::");
  return {
    userId: userId || "local-dev",
    workspaceId: workspaceId || "default",
    role: "admin",
    source: "migration",
  };
}

async function readSourceData() {
  const rawData = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const sourceData = rawData && typeof rawData === "object" ? rawData : {};
  const scopes = sourceData.scopes && typeof sourceData.scopes === "object" ? sourceData.scopes : {};
  const scopeEntries = Object.entries(scopes);

  if (!scopeEntries.length && hasCollectionData(sourceData)) {
    scopeEntries.push(["local-dev::default", sourceData]);
  }

  return scopeEntries.map(([scopeKey, scopedData]) => ({
    authContext: parseScopeKey(scopeKey),
    data: normalizeScopedData(scopedData && typeof scopedData === "object" ? scopedData : {}),
  }));
}

async function run() {
  const targetAdapter = String(process.env.BANIK_STORAGE_ADAPTER || "file").trim().toLowerCase();

  if (!targetAdapter || targetAdapter === "file") {
    throw new Error("Set BANIK_STORAGE_ADAPTER to a production adapter, for example firebase.");
  }

  const scopes = await readSourceData();

  if (!scopes.length) {
    console.log(`No scopes found in ${DATA_FILE}. Nothing to migrate.`);
    return;
  }

  for (const scope of scopes) {
    await importBackup({ data: scope.data }, scope.authContext);
    console.log(
      `migrated ${scope.authContext.userId}::${scope.authContext.workspaceId} to ${targetAdapter}`
    );
  }

  console.log(`Migration completed for ${scopes.length} scope(s).`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
