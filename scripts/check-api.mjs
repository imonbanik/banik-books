import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const testDataFile = path.join(os.tmpdir(), `banik-books-api-test-${process.pid}.json`);
process.env.BANIK_DATA_FILE = testDataFile;

const require = createRequire(import.meta.url);
const {
  listItems,
  removeItem,
  replaceItems,
  saveItem,
} = require("../backend/collection-service.js");
const { resolveAuthContext } = require("../backend/auth-context.js");
const { exportBackup, importBackup } = require("../backend/backup-service.js");
const { assertRole } = require("../backend/permissions.js");
const { getStorageAdapter } = require("../backend/storage-adapter.js");

function createRequest(headers = {}) {
  return {
    headers: Object.entries(headers).reduce((normalized, [key, value]) => {
      normalized[key.toLowerCase()] = value;
      return normalized;
    }, {}),
  };
}

async function assertRejectsWithMessage(fn, message) {
  await assert.rejects(fn, (error) => {
    assert.equal(error.message, message);
    return true;
  });
}

async function run() {
  const defaultContext = await resolveAuthContext(createRequest());
  assert.equal(defaultContext.userId, "local-dev");
  assert.equal(defaultContext.workspaceId, "default");
  assert.equal(defaultContext.role, "admin");

  const workspaceContext = await resolveAuthContext(
    createRequest({ "x-banik-workspace-id": "workspace-a" })
  );
  assert.equal(workspaceContext.workspaceId, "workspace-a");
  assert.equal(workspaceContext.role, "admin");

  const viewerContext = await resolveAuthContext(
    createRequest({ "x-banik-workspace-id": "workspace-a", "x-banik-role": "viewer" })
  );
  assert.equal(viewerContext.role, "viewer");
  assert.throws(() => assertRole(viewerContext, "user"), /permission/);

  const normalizedWorkspaceContext = await resolveAuthContext(
    createRequest({ "x-banik-workspace-id": " Client A " })
  );
  assert.equal(normalizedWorkspaceContext.workspaceId, "client-a");

  const badWorkspaceContext = await resolveAuthContext(
    createRequest({ "x-banik-workspace-id": "../bad" })
  );
  assert.equal(badWorkspaceContext.error.statusCode, 400);

  process.env.BANIK_ALLOWED_WORKSPACE_IDS = "default,workspace-a";
  const blockedWorkspaceContext = await resolveAuthContext(
    createRequest({ "x-banik-workspace-id": "workspace-b" })
  );
  assert.equal(blockedWorkspaceContext.error.statusCode, 403);
  delete process.env.BANIK_ALLOWED_WORKSPACE_IDS;

  await saveItem(
    "journals",
    "JV-001",
    {
      number: "JV-001",
      journalDate: "2026-06-03",
      lines: [{ account: "Cash", debit: 100, credit: 0 }],
    },
    workspaceContext
  );

  assert.equal((await listItems("journals", workspaceContext)).length, 1);
  assert.equal((await listItems("journals", defaultContext)).length, 0);

  await saveItem(
    "parties",
    "party-1",
    {
      id: "party-1",
      type: "Customer",
      fields: { customerName: "Test Customer" },
      bank: {},
    },
    workspaceContext
  );
  assert.equal((await listItems("parties", workspaceContext)).length, 1);

  await replaceItems(
    "settings",
    [{ id: "accountingPreferences", value: { currency: "BDT" } }],
    workspaceContext
  );
  assert.deepEqual(await listItems("settings", workspaceContext), [
    { id: "accountingPreferences", value: { currency: "BDT" } },
  ]);

  await saveItem(
    "challans",
    "challan-1",
    {
      id: "challan-1",
      challanNumber: "2324-00253078071",
      individualAmount: 1000,
      totalAmount: 1000,
    },
    workspaceContext
  );
  assert.equal((await listItems("challans", workspaceContext)).length, 1);

  const exportedBackup = await exportBackup(workspaceContext);
  assert.equal(exportedBackup.version, 1);
  assert.equal(exportedBackup.workspaceId, "workspace-a");
  assert.equal(exportedBackup.data.journals.length, 1);
  assert.equal(exportedBackup.data.parties.length, 1);
  assert.equal(exportedBackup.data.challans.length, 1);

  await importBackup(
    {
      data: {
        ...exportedBackup.data,
        journals: [
          {
            number: "JV-002",
            journalDate: "2026-06-04",
            lines: [{ account: "Bank", debit: 200, credit: 0 }],
          },
        ],
      },
    },
    workspaceContext
  );
  assert.deepEqual(
    (await listItems("journals", workspaceContext)).map((item) => item.number),
    ["JV-002"]
  );

  await assertRejectsWithMessage(
    () => saveItem("journals", "bad", { journalDate: "2026-06-03" }, workspaceContext),
    "Journal number is required."
  );
  await assertRejectsWithMessage(
    () => saveItem("parties", "bad", { id: "bad", type: "Invalid" }, workspaceContext),
    "Party type is invalid."
  );
  await assertRejectsWithMessage(
    () => replaceItems("settings", [{ id: "bad", value: [] }], workspaceContext),
    "Setting value must be an object."
  );
  await assertRejectsWithMessage(
    () => saveItem("challans", "bad", { id: "bad" }, workspaceContext),
    "Challan number is required."
  );
  await assertRejectsWithMessage(
    () =>
      importBackup(
        {
          data: {
            ...exportedBackup.data,
            parties: [{ id: "bad", type: "Invalid" }],
          },
        },
        workspaceContext
      ),
    "Party type is invalid."
  );

  await removeItem("journals", "JV-002", workspaceContext);
  await removeItem("parties", "party-1", workspaceContext);
  await removeItem("challans", "challan-1", workspaceContext);
  assert.equal((await listItems("journals", workspaceContext)).length, 0);
  assert.equal((await listItems("parties", workspaceContext)).length, 0);
  assert.equal((await listItems("challans", workspaceContext)).length, 0);

  process.env.BANIK_API_REQUIRE_AUTH = "true";
  const strictContext = await resolveAuthContext(createRequest());
  assert.equal(strictContext.error.statusCode, 401);
  assert.equal(strictContext.error.message, "Authentication is required.");
  delete process.env.BANIK_API_REQUIRE_AUTH;

  process.env.BANIK_STORAGE_ADAPTER = "missing";
  assert.throws(() => getStorageAdapter(), /Unsupported BANIK_STORAGE_ADAPTER/);
  delete process.env.BANIK_STORAGE_ADAPTER;

  await fs.rm(testDataFile, { force: true });
  console.log("API checks passed.");
}

run().catch(async (error) => {
  await fs.rm(testDataFile, { force: true });
  console.error(error);
  process.exitCode = 1;
});
