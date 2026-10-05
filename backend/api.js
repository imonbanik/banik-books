const { getItem, listItems, removeItem, replaceItems, saveItem, revisionOf } = require("./collection-service");
const { resolveAuthContext } = require("./auth-context");
const { deleteUserAccount, setUserDisabled } = require("./admin-user-service");
const { runAChallanAutomation } = require("./achallan-automation");
const { exportBackup, importBackup } = require("./backup-service");
const { assertRole } = require("./permissions");
const { assertRateLimit } = require("./rate-limit");
const { resolveCompanyContext, listTeamActivity } = require("./company-service");
const { handleTeamApi, isPublicTeamRoute, isTeamRoute } = require("./team-api");
const { hasCompanyPermission: can, assertCompanyPermission: requirePermission, companyError } = require("./company-permissions");
const { listJournals, getJournal, createJournal, updateJournal, actOnJournal, canRead } = require("./journal-service");

const COLLECTIONS = { parties: "parties", "chart-of-accounts": "chartOfAccounts", challans: "challans", settings: "settings" };
function sendJson(response, code, payload) {
  response.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 5 * 1024 * 1024) { reject(companyError(413, "Payload too large.")); request.destroy(); }
    });
    request.on("end", () => {
      try { const parsed = body.trim() ? JSON.parse(body) : {}; resolve(parsed); }
      catch { reject(companyError(400, "Invalid JSON payload.")); }
    });
    request.on("error", reject);
  });
}
function methodError() { throw companyError(405, "Method not allowed."); }
function workspacePayload(context) {
  return Object.fromEntries(["userId", "workspaceId", "role", "source", "companyId", "companyRole", "companyName", "companyProfile", "companyModules", "permissions"].map((key) => [key, context[key]]));
}
const anyReport = (ctx) => Object.entries(ctx.permissions || {}).some(([key, value]) => key.startsWith("reports.") && value);
const journalLookup = (ctx) => ["journals.create", "journals.editOwn", "journals.editAll", "journals.submit"].some((key) => can(ctx, key));
function assertDataAccess(context, name, method, id) {
  const read = ["GET", "HEAD"].includes(method);
  if (name === "settings") {
    if (read && id === "accountingPreferences") return;
    const permission = id === "chequePrinterPayees" ? "tools.cheque-printer" : ["challanManagementOptions", "tinBinInfo", "challanTinBinInfo"].includes(id) ? "challans.manage" : "company.settings";
    requirePermission(context, permission); return;
  }
  if (read && ["parties", "chartOfAccounts"].includes(name) && (journalLookup(context) || anyReport(context))) return;
  requirePermission(context, `${name}.${read ? "view" : "manage"}`);
}
function projectLookup(context, name, item) {
  if (!item || can(context, `${name}.view`) || can(context, `${name}.manage`) || anyReport(context)) return item;
  if (name === "parties") {
    const fields = item.fields || {};
    return { id: item.id, type: item.type, fields: Object.fromEntries(["customerName", "supplierName", "partyName", "employeeName"].map((key) => [key, fields[key] || ""])) };
  }
  if (name === "chartOfAccounts") {
    return { id: item.id, type: item.type, name: item.name, code: item.code, classification: item.classification,
      ...(item.children ? { children: item.children.map((child) => projectLookup(context, name, child)) } : {}) };
  }
  return item;
}
async function activity(context, url) {
  requirePermission(context, "activity.view");
  let items = await listItems("activity", context);
  const teamEvents = can(context, "team.manage") ? await listTeamActivity(context) : [];
  if (context.companyRole !== "owner") {
    items = items.filter((event) => {
      if (event.collection === "journals") return canRead(context, event.after || event.before || {});
      if (["parties", "chartOfAccounts", "challans"].includes(event.collection)) return can(context, `${event.collection}.view`) || can(context, `${event.collection}.manage`);
      return can(context, "company.settings");
    });
  }
  items.push(...teamEvents);
  const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const start = from && Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00+06:00` : from);
  const end = to && Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999+06:00` : to);
  for (const [key, field] of [["actorId", "actorId"], ["entityId", "entityId"], ["action", "action"]]) {
    const value = url.searchParams.get(key);
    if (value) items = items.filter((event) => event[field] === value || key === "entityId" && [event.entityNumber, event.targetId].includes(value));
  }
  items = items.filter((event) => (!start || Date.parse(event.timestamp) >= start) && (!end || Date.parse(event.timestamp) <= end));
  items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)) || String(b.id).localeCompare(String(a.id)));
  const cursor = url.searchParams.get("cursor");
  if (cursor) { const index = items.findIndex((item) => item.id === cursor); items = index < 0 ? [] : items.slice(index + 1); }
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  return { items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1].id : null };
}
async function handleApi(request, response) {
  let pathParts;
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    pathParts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (pathParts[0] !== "api") return false;
    if (isPublicTeamRoute(pathParts, request.method)) {
      assertRateLimit(request, { userId: "public-invitation" });
      return await handleTeamApi(request, response, pathParts, null);
    }
    let context = await resolveAuthContext(request);
    if (context.error) { sendJson(response, context.error.statusCode, { error: context.error.message }); return true; }
    assertRateLimit(request, context);
    const route = pathParts[1];
    const id = pathParts[2] || "";
    if (isTeamRoute(pathParts)) return await handleTeamApi(request, response, pathParts, context);
    if (route === "admin") {
      assertRole(context, "admin");
      const targetId = pathParts[3];
      if (pathParts[2] !== "users" || !targetId) throw companyError(404, "Unknown admin endpoint.");
      if (request.method === "PATCH") {
        const body = await readJsonBody(request);
        if (typeof body.disabled !== "boolean") throw companyError(400, "Disabled state is required.");
        sendJson(response, 200, { user: await setUserDisabled(targetId, body.disabled, context) });
      } else if (request.method === "DELETE") sendJson(response, 200, { user: await deleteUserAccount(targetId, context) });
      else methodError();
      return true;
    }
    if (!["workspace", "backups", "activity", "achallan", "journals", ...Object.keys(COLLECTIONS)].includes(route)) throw companyError(404, "Unknown API endpoint.");
    try { context = await resolveCompanyContext(context, request); }
    catch (error) { if (error.statusCode === 403) error.code = "COMPANY_ACCESS_DENIED"; throw error; }
    if (route === "workspace") {
      if (!["GET", "HEAD"].includes(request.method)) methodError();
      sendJson(response, 200, workspacePayload(context)); return true;
    }
    if (route === "backups") {
      if (context.companyRole !== "owner") throw companyError(403, "Only the company owner can back up or restore the entire company.");
      if (id === "export" && request.method === "GET") { requirePermission(context, "exports.download"); sendJson(response, 200, await exportBackup(context)); }
      else if (id === "import" && request.method === "PUT") { requirePermission(context, "company.settings"); sendJson(response, 200, await importBackup(await readJsonBody(request), context)); }
      else methodError();
      return true;
    }
    if (route === "activity") {
      if (request.method !== "GET") methodError();
      sendJson(response, 200, await activity(context, url)); return true;
    }
    if (route === "achallan") {
      requirePermission(context, "challans.manage");
      if (id !== "prepare" || request.method !== "POST") methodError();
      sendJson(response, 200, await runAChallanAutomation(await readJsonBody(request))); return true;
    }
    if (route === "journals") {
      if (request.method === "GET" || request.method === "HEAD") {
        sendJson(response, 200, id ? { item: await getJournal(context, id) } : { items: await listJournals(context, { reports: url.searchParams.get("purpose") === "reports", report: url.searchParams.get("report") || "" }) });
      } else if (request.method === "POST" && !id) {
        sendJson(response, 201, { item: await createJournal(context, await readJsonBody(request)) });
      } else if (request.method === "POST" && id && pathParts[3] === "actions") {
        sendJson(response, 200, await actOnJournal(context, id, await readJsonBody(request)));
      } else if (["PATCH", "PUT"].includes(request.method) && id && pathParts.length === 3) {
        sendJson(response, 200, { item: await updateJournal(context, id, await readJsonBody(request)) });
      } else if (request.method === "DELETE" && id) {
        const body = await readJsonBody(request);
        const result = await actOnJournal(context, id, { ...body, action: "archive" });
        sendJson(response, 200, { ...result, items: await listJournals(context) });
      } else {
        // Full journal replacement would bypass review, versions and immutable history.
        if (request.method === "PUT") await readJsonBody(request);
        methodError();
      }
      return true;
    }
    const name = COLLECTIONS[route];
    assertDataAccess(context, name, request.method, id);
    if (["GET", "HEAD"].includes(request.method)) {
      if (id) sendJson(response, 200, { item: projectLookup(context, name, await getItem(name, id, context)) });
      else { const items = await listItems(name, context); sendJson(response, 200, { items: items.map((item) => projectLookup(context, name, item)), revision: revisionOf(items) }); }
    } else if (["PUT", "POST", "PATCH"].includes(request.method) && id) {
      const body = await readJsonBody(request);
      sendJson(response, 200, { item: await saveItem(name, id, body.item || body, context) });
    } else if (request.method === "PUT" && !id) {
      const body = await readJsonBody(request);
      if (!Array.isArray(body.items)) throw companyError(400, "Collection items must be an array.");
      const items = await replaceItems(name, body.items, context, body.expectedRevision);
      sendJson(response, 200, { items, revision: revisionOf(items) });
    } else if (request.method === "DELETE" && id) {
      const body = await readJsonBody(request);
      sendJson(response, 200, { items: await removeItem(name, id, context, body.expectedVersion) });
    }
    else methodError();
    return true;
  } catch (error) {
    if (pathParts && pathParts[0] !== "api") return false;
    sendJson(response, error.statusCode || (error instanceof URIError ? 400 : 500), { error: error.message || "Backend API error.", ...(error.code ? { code: error.code } : {}) });
    return true;
  }
}
module.exports = { handleApi };
