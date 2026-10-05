import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const testDataFile = path.join(os.tmpdir(), `banik-books-api-http-test-${process.pid}.json`);
process.env.BANIK_DATA_FILE = testDataFile;
process.env.BANIK_API_RATE_LIMIT_MAX = "0";

const require = createRequire(import.meta.url);
// Transport tests use deterministic verified identity fixtures. Production token
// verification stays in auth-verifier; this override exists only in this process.
const identities = {
  owner: { userId: "http-owner", email: "owner@example.com", profile: { companyName: "HTTP Company", profileCompleted: true } },
  junior: { userId: "http-junior", email: "junior@example.com", profile: { accountType: "invited" } },
  stranger: { userId: "http-stranger", email: "stranger@example.com", profile: { companyName: "Other company", profileCompleted: true } },
};
require("../backend/auth-context.js").resolveAuthContext = async (request) => {
  const fixture = identities[request.headers["x-test-identity"] || "owner"];
  return fixture ? { ...fixture, source: "local-dev-test", role: "user", emailVerified: true, workspaceId: "default" } : { error: { statusCode: 401, message: "Invalid token" } };
};
const { handleRequest } = require("../server.js");

function startServer() {
  const server = http.createServer(handleRequest);

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function requestJson(server, pathname, options = {}) {
  const address = server.address();
  const body = options.body === undefined ? "" : options.body;

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: pathname,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(options.headers || {}),
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let payload = null;

          try {
            payload = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            payload = responseBody;
          }

          resolve({
            body: payload,
            statusCode: response.statusCode || 0,
          });
        });
      }
    );

    request.on("error", reject);
    request.end(body);
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function run() {
  const server = await startServer();
  const request = (url, method = "GET", body, identity = "owner", companyId) => requestJson(server, url, {
    method, body: body === undefined ? "" : JSON.stringify(body),
    headers: { "X-Test-Identity": identity, ...(companyId ? { "X-Banik-Company-Id": companyId } : {}) },
  });
  try {
    for (const blocked of ["/data/app-data.json", "/data/company-team-data.json", "/.env", "/.git/config", "/backend/company-service.js", "/server.js", "/package.json", "/pages/%2e%2e/%2e%2e/backend/api.js"]) {
      assert.equal((await request(blocked)).statusCode, 404, `private file must not be served: ${blocked}`);
    }
    assert.equal((await request("/%FF")).statusCode, 400);
    assert.equal((await request("/api/%FF")).statusCode, 400);
    assert.equal((await request("/js/services/api-client.js")).statusCode, 200);
    assert.equal((await request("/api/not-real")).statusCode, 404);
    assert.equal((await request("/api/workspace", "GET", undefined, "unknown")).statusCode, 401);
    const ownerWorkspace = await request("/api/workspace");
    assert.equal(ownerWorkspace.statusCode, 200);
    const companyId = ownerWorkspace.body.companyId;
    assert.equal(ownerWorkspace.body.companyRole, "owner");
    assert.equal(ownerWorkspace.body.token, undefined);
    assert.equal((await request("/api/workspace", "GET", undefined, "stranger", companyId)).statusCode, 403);
    const team = await request("/api/team");
    assert.equal(team.body.members.length, 1);
    const invite = await request("/api/team/invitations", "POST", { email: identities.junior.email, role: "junior", name: "Junior" });
    assert.equal(invite.statusCode, 201);
    const token = new URL(invite.body.inviteUrl, "http://localhost").searchParams.get("token");
    assert.equal((await request(`/api/invitations/${token}`)).body.invitedEmail, identities.junior.email);
    assert.equal((await request(`/api/invitations/${token}/accept`, "POST", {}, "junior")).statusCode, 200);
    const memberWorkspace = await request("/api/workspace", "GET", undefined, "junior", companyId);
    assert.equal(memberWorkspace.body.permissions["journals.post"], false);
    assert.equal((await request("/api/team", "GET", undefined, "junior", companyId)).statusCode, 403);
    assert.equal((await request("/api/journals?purpose=reports", "GET", undefined, "junior", companyId)).statusCode, 403);
    const chart = await request("/api/chart-of-accounts");
    const savedChart = await request("/api/chart-of-accounts", "PUT", { expectedRevision: chart.body.revision, items: [{ id: "cash", name: "Cash", type: "ledger", openingBalance: 999999 }] });
    assert.equal(savedChart.statusCode, 200);
    assert.equal((await request("/api/chart-of-accounts", "PUT", { expectedRevision: chart.body.revision, items: [] })).statusCode, 409);
    const lookup = await request("/api/chart-of-accounts", "GET", undefined, "junior", companyId);
    assert.equal(lookup.body.items[0].name, "Cash");
    assert.equal(lookup.body.items[0].openingBalance, undefined);
    const lines = [{ account: "Cash", debit: 100, credit: 0 }, { account: "Capital", debit: 0, credit: 100 }];
    const create = await request("/api/journals", "POST", { item: { journalDate: "2026-10-05", lines, createdBy: "forged-owner", status: "draft" }, requestId: "http-create" }, "junior", companyId);
    assert.equal(create.statusCode, 201);
    assert.equal(create.body.item.createdBy, identities.junior.userId);
    const journalId = create.body.item.id;
    assert.equal((await request("/api/journals?purpose=reports")).body.items.length, 0);
    assert.equal((await request(`/api/journals/${journalId}/actions`, "POST", { action: "post", expectedVersion: 1 }, "junior", companyId)).statusCode, 403);
    const submit = await request(`/api/journals/${journalId}/actions`, "POST", { action: "submit", expectedVersion: 1 }, "junior", companyId);
    assert.equal(submit.body.item.status, "submitted");
    assert.equal((await request(`/api/journals/${journalId}`, "PATCH", { item: { description: "illegal" }, expectedVersion: 2 }, "junior", companyId)).statusCode, 409);
    const approve = await request(`/api/journals/${journalId}/actions`, "POST", { action: "post", expectedVersion: 2 });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.item.createdBy, identities.junior.userId);
    assert.equal(approve.body.item.approvedBy, identities.owner.userId);
    assert.equal((await request("/api/journals?purpose=reports")).body.items.length, 1);
    assert.equal((await request(`/api/journals/${journalId}`, "DELETE", { expectedVersion: 3 })).statusCode, 409);
    const reversal = await request(`/api/journals/${journalId}/actions`, "POST", { action: "reverse", expectedVersion: 3, reason: "Incorrect account", requestId: "reversal-http" });
    assert.equal(reversal.statusCode, 200);
    assert.equal(reversal.body.reversal.lines[0].credit, 100);
    assert.equal((await request("/api/journals?purpose=reports")).body.items.length, 2);
    const history = await request(`/api/activity?entityId=${journalId}`);
    assert.equal(history.statusCode, 200);
    assert.ok(history.body.items.some((event) => event.action === "journal.submitted" && event.actorId === identities.junior.userId));
    assert.equal((await request("/api/journals", "PUT", { items: [] })).statusCode, 405);
    assert.equal((await requestJson(server, "/api/journals", { method: "PUT", body: "{" })).statusCode, 400);
    const backup = await request("/api/backups/export");
    assert.equal(backup.statusCode, 200);
    assert.equal((await request("/api/backups/export", "GET", undefined, "junior", companyId)).statusCode, 403);
    assert.equal((await request("/api/backups/import", "PUT", { data: {} })).statusCode, 400);
    assert.equal((await request("/api/backups/import", "PUT", backup.body)).statusCode, 200);
    assert.ok((await request("/api/activity")).body.items.some((event) => event.action === "backup.restored"));
    assert.equal((await request(`/api/team/members/${identities.junior.userId}`, "PATCH", { status: "suspended" })).statusCode, 200);
    const revoked = await request("/api/journals", "GET", undefined, "junior", companyId);
    assert.equal(revoked.statusCode, 403);
    assert.equal(revoked.body.code, "COMPANY_ACCESS_DENIED");
    assert.equal((await request("/api/activity")).body.items.filter((event) => event.actorId === identities.junior.userId).length > 0, true);
  } finally {
    await closeServer(server);
    await fs.rm(testDataFile, { force: true });
    await fs.rm(`${testDataFile}.team.json`, { force: true });
  }
  console.log("HTTP API checks passed: company isolation, invitation/login, lookup privacy, permissions, review, reversal, audit, restore and revocation.");
}

run().catch(async (error) => {
  await fs.rm(testDataFile, { force: true });
  delete process.env.BANIK_DATA_FILE;
  delete process.env.BANIK_API_RATE_LIMIT_MAX;
  console.error(error);
  process.exitCode = 1;
});
