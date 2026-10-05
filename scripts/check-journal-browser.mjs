import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

// Dedicated synthetic companies: no Firebase accounts or production data are used.
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), "banik-journal-browser-"));
process.env.BANIK_STORAGE_ADAPTER = "file";
process.env.BANIK_DATA_FILE = path.join(artifacts, "fixture-data.json");
const require = createRequire(import.meta.url);
const service = require("../backend/journal-service");
const adapter = require("../backend/adapters/file-adapter");
const { getRolePermissions, PERMISSION_KEYS, MODULE_KEYS } = require("../backend/company-permissions");
const frontend = path.resolve("frontend");
const base = "http://127.0.0.1:4199";
const common = { companyId: "fixture-company", storageUserId: "fixture-owner", storageWorkspaceId: "default", workspaceId: "default", role: "user", companyModules: Object.fromEntries(MODULE_KEYS.map((key) => [key, true])) };
const junior = { ...common, userId: "fixture-junior", name: "Fixture Junior", email: "junior@example.test", companyRole: "junior", permissions: getRolePermissions("junior") };
const owner = { ...common, userId: "fixture-owner", name: "Fixture Owner", email: "owner@example.test", companyRole: "owner", permissions: getRolePermissions("owner") };
const chart = [{ id: "cash", type: "ledger", name: "Cash", classification: "Asset" }, { id: "sales", type: "ledger", name: "Sales", classification: "Income" }];
await adapter.replaceCollection("chartOfAccounts", chart, owner);
const errors = [];
const browser = await chromium.launch({ headless: true });

async function setupPage(actor, { anonymous = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1060 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (url.origin !== base) return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    try {
      if (pathname === "/js/core/auth.js") {
        const user = { id: actor.userId, email: actor.email, fullName: actor.name, companyName: "Fixture Company", companyId: actor.companyId, companyRole: actor.companyRole, companyPermissions: actor.permissions, permissions: actor.companyModules };
        return route.fulfill({ contentType: "text/javascript", body: `import "/js/services/api-client.js"; window.BanikAuth = { getIdToken: async () => "fixture-token", getCurrentUser: async () => { ${anonymous ? "return null;" : `if (!window.BanikApi.getContext()?.companyId) await window.BanikApi.getWorkspace(); return ${JSON.stringify(user)};`} } }; window.dispatchEvent(new Event("banik-auth-ready"));` });
      }
      if (pathname === "/js/services/data-service.js") return route.fulfill({ contentType: "text/javascript", body: "" });
      if (pathname.startsWith("/api/")) {
        const body = request.postDataJSON() || {};
        let payload;
        if (pathname === "/api/workspace") payload = actor;
        else if (pathname === "/api/companies") payload = { companies: [{ id: actor.companyId, name: "Fixture Company", role: actor.companyRole }] };
        else if (pathname === "/api/parties") payload = { items: [] };
        else if (pathname === "/api/chart-of-accounts") payload = { items: chart };
        else if (pathname.startsWith("/api/settings")) payload = { item: null, items: [] };
        else if (pathname === "/api/team") payload = {
          company: { name: "Fixture Company", modules: actor.companyModules },
          permissionCatalog: PERMISSION_KEYS.map((key) => ({ key, label: key, available: true })),
          roleDefaults: Object.fromEntries(["junior", "accountant", "viewer", "custom"].map((role) => [role, getRolePermissions(role)])),
          members: [owner, junior].map((member) => ({ userId: member.userId, name: member.name, email: member.email, role: member.companyRole, permissions: member.permissions, status: "active" })),
          invitations: [],
        };
        else if (pathname === "/api/invitations/fixture-token") payload = { invitation: { companyId: "fixture-company", companyName: "Fixture Company", email: "invitee@example.test", name: "Fixture Invitee", role: "junior", status: "pending", expiresAt: new Date(Date.now() + 72 * 3600000).toISOString() } };
        else if (pathname === "/api/activity") payload = { items: (await adapter.listCollection("activity", actor)).filter((entry) => !url.searchParams.get("entityId") || entry.entityId === url.searchParams.get("entityId")) };
        else if (pathname === "/api/journals") payload = request.method() === "POST"
          ? { item: await service.createJournal(actor, body) }
          : { items: await service.listJournals(actor, { reports: url.searchParams.get("purpose") === "reports", report: url.searchParams.get("report") || "" }) };
        else if (pathname.startsWith("/api/journals/")) {
          const actionRoute = pathname.endsWith("/actions");
          const id = decodeURIComponent(pathname.slice("/api/journals/".length, actionRoute ? -"/actions".length : undefined));
          if (actionRoute) payload = await service.actOnJournal(actor, id, body);
          else if (request.method() === "DELETE") payload = await service.actOnJournal(actor, id, { ...body, action: "archive" });
          else if (request.method() === "PATCH") payload = { item: await service.updateJournal(actor, id, body) };
          else payload = { item: await service.getJournal(actor, id) };
        } else throw new Error(`Unexpected fixture API ${pathname}`);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
      }
      const aliases = { "/journal-entry.html": "/pages/accounting/journal-entry.html", "/journal-register.html": "/pages/reports/journal-register.html", "/general-ledger.html": "/pages/reports/general-ledger.html", "/team.html": "/pages/workspace/team.html", "/accept-invite.html": "/pages/auth/accept-invite.html" };
      const file = path.join(frontend, aliases[pathname] || pathname);
      if (!file.startsWith(frontend + path.sep)) throw new Error("Invalid fixture path");
      const contentType = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" }[path.extname(file)] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch (error) {
      return route.fulfill({ status: error.statusCode || 500, contentType: "application/json", body: JSON.stringify({ error: error.message }) });
    }
  });
  return page;
}

try {
  const juniorPage = await setupPage(junior);
  await juniorPage.goto(`${base}/journal-entry.html`);
  await juniorPage.getByText("New draft · A number will be assigned when saved. Drafts do not affect reports.", { exact: true }).waitFor();
  const rowCount = await juniorPage.locator("#journal-lines .journal-row").count();
  assert.equal(rowCount, 4);
  await juniorPage.locator("#journal-date").fill("2026-10-05");
  await juniorPage.locator("#journal-lines .journal-row").nth(0).locator(".line-account").fill("Cash");
  await juniorPage.locator("#journal-lines .journal-row").nth(0).locator(".line-debit").fill("250");
  await juniorPage.locator("#journal-lines .journal-row").nth(1).locator(".line-account").fill("Sales");
  await juniorPage.locator("#journal-lines .journal-row").nth(1).locator(".line-credit").fill("250");
  await juniorPage.getByRole("button", { name: "Save draft", exact: true }).click();
  await juniorPage.locator(".journal-workflow-status").getByText("draft", { exact: true }).waitFor();
  assert.equal(await juniorPage.getByRole("button", { name: "Post journal", exact: true }).count(), 0);
  assert.equal((await service.listJournals(owner, { reports: true })).length, 0);
  await juniorPage.getByRole("button", { name: "Submit for approval", exact: true }).click();
  await juniorPage.locator(".journal-workflow-status").getByText("submitted", { exact: true }).waitFor();
  assert.equal(await juniorPage.locator("#save-btn").isVisible(), false);
  await juniorPage.screenshot({ path: path.join(artifacts, "junior-submitted.png"), fullPage: true });

  const submitted = (await service.listJournals(junior))[0];
  const ownerPage = await setupPage(owner);
  await ownerPage.goto(`${base}/journal-entry.html?journal=${submitted.id}`);
  await ownerPage.getByRole("button", { name: "Approve & post", exact: true }).waitFor();
  assert.equal(await ownerPage.locator("#journal-date").isDisabled(), true);
  await ownerPage.getByRole("button", { name: "Approve & post", exact: true }).click();
  await ownerPage.locator(".journal-workflow-status").getByText("posted", { exact: true }).waitFor();
  const summary = await ownerPage.locator("#journal-workflow-summary").innerText();
  assert.match(summary, /Created by Fixture Junior/);
  assert.match(summary, /Approved by Fixture Owner/);
  assert.equal(await ownerPage.locator("#delete-journal-btn").isVisible(), false);
  await ownerPage.getByRole("button", { name: "History", exact: true }).click();
  await ownerPage.locator("#journal-history-list").getByText("Journal posted · Fixture Owner", { exact: true }).waitFor();
  const createdEvent = ownerPage.locator(".journal-history-event").filter({ hasText: "Draft created · Fixture Junior" });
  assert.equal(await createdEvent.count(), 1);
  await createdEvent.getByText("View changes", { exact: true }).click();
  assert.match(await createdEvent.innerText(), /Total debit 250/);
  assert.equal((await createdEvent.innerText()).includes("creationRequestId"), false);
  await ownerPage.screenshot({ path: path.join(artifacts, "journal-history.png"), fullPage: true });
  await ownerPage.getByRole("button", { name: "Close history", exact: true }).click();
  await ownerPage.getByRole("button", { name: "Reverse journal", exact: true }).click();
  await ownerPage.locator("#journal-action-reason").fill("Fixture reversal validation");
  await ownerPage.locator("#journal-action-modal").getByRole("button", { name: "Confirm", exact: true }).click();
  await ownerPage.locator("#journal-action-modal").waitFor({ state: "hidden" });
  assert.equal(await ownerPage.locator("#reverse-journal-btn").isVisible(), false);
  const posted = await service.listJournals(owner, { reports: true });
  assert.equal(posted.length, 2);
  assert.equal(posted.flatMap((journal) => journal.lines).filter((line) => line.account === "Cash").reduce((sum, line) => sum + line.debit - line.credit, 0), 0);

  await service.createJournal(owner, { item: { journalDate: "2026-10-05", lines: [{ account: "Cash", debit: 999, credit: 0 }, { account: "Sales", debit: 0, credit: 999 }] } });
  await ownerPage.goto(`${base}/journal-register.html`);
  await ownerPage.getByText("Only posted entries contribute to the totals below. Activity times use Bangladesh time (UTC+6).", { exact: true }).waitFor();
  assert.match(await ownerPage.locator("#journal-register-total-debit").innerText(), /500/);
  await ownerPage.screenshot({ path: path.join(artifacts, "journal-register.png"), fullPage: true });
  await ownerPage.goto(`${base}/general-ledger.html`);
  await ownerPage.locator("#general-ledger-groups").getByText("Cash", { exact: true }).waitFor();
  assert.equal((await ownerPage.locator("#general-ledger-groups").innerText()).includes("999"), false);

  await ownerPage.goto(`${base}/team.html`);
  await ownerPage.getByRole("heading", { name: "Invite a colleague", exact: true }).waitFor();
  await ownerPage.getByText("Choose permissions", { exact: true }).click();
  await ownerPage.getByLabel("View Trial Balance", { exact: true }).waitFor();
  assert.equal(await ownerPage.getByLabel("Post entries directly", { exact: true }).isChecked(), false);
  const activityPosted = ownerPage.locator("#activity-items tr").filter({ hasText: "Journal posted" });
  assert.equal(await activityPosted.count(), 1);
  await activityPosted.getByText("View changes", { exact: true }).click();
  assert.equal((await activityPosted.innerText()).includes("creationRequestId"), false);
  assert.match(await activityPosted.innerText(), /Status/);
  await ownerPage.screenshot({ path: path.join(artifacts, "team-desktop.png"), fullPage: true });
  await ownerPage.setViewportSize({ width: 390, height: 844 });
  await ownerPage.screenshot({ path: path.join(artifacts, "team-mobile.png"), fullPage: true });
  assert.equal(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "team controls must fit a narrow screen");

  const invitePage = await setupPage(junior, { anonymous: true });
  await invitePage.goto(`${base}/accept-invite.html?token=fixture-token`);
  await invitePage.getByRole("heading", { name: "Join Fixture Company", exact: true }).waitFor();
  await invitePage.getByRole("button", { name: "Sign in & join", exact: true }).waitFor();
  assert.equal(await invitePage.getByLabel("Email address", { exact: true }).inputValue(), "invitee@example.test");
  await invitePage.screenshot({ path: path.join(artifacts, "invite-desktop.png"), fullPage: true });
  await invitePage.getByRole("button", { name: "Create your login", exact: true }).click();
  await invitePage.getByRole("button", { name: "Create login & send verification", exact: true }).waitFor();
  await invitePage.setViewportSize({ width: 390, height: 844 });
  await invitePage.screenshot({ path: path.join(artifacts, "invite-mobile.png"), fullPage: true });
  assert.equal(await invitePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "invitation controls must fit a narrow screen");
  assert.deepEqual(errors, [], "journal workflows and reports must not throw browser errors");
  console.log(`Journal browser workflow passed. Screenshots: ${artifacts}`);
} finally {
  await browser.close();
}
