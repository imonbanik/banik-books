import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

function browser() {
  const values = new Map();
  const nodes = new Map();
  const node = () => ({
    value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, children: [], dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, setAttribute() {}, setCustomValidity() {}, reportValidity() { return true; }, focus() {}, append() {}, prepend() {},
    querySelector() { return node(); }, querySelectorAll() { return []; },
  });
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  const document = {
    body: node(), addEventListener() {}, createElement: node,
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector);
    },
  };
  const permissions = new Set(["journals.create", "journals.editOwn", "journals.submit"]);
  const window = { location: { pathname: "/pages/reports/general-ledger.html" }, addEventListener() {}, setTimeout, clearTimeout, BanikApi: { can: (permission) => permissions.has(permission) } };
  const context = vm.createContext({ window, document, localStorage, console, URLSearchParams, Intl, crypto: { randomUUID }, structuredClone });
  return { context, window, document, localStorage, nodes, permissions };
}

const source = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const sampleJournals = [
  { id: "posted", status: "posted", number: "FY/26-27/0001", journalDate: "2026-10-05" },
  { id: "draft", status: "draft", number: "FY/26-27/0002", journalDate: "2026-10-05" },
  { id: "submitted", status: "submitted", number: "FY/26-27/0003", journalDate: "2026-10-05" },
  { id: "returned", status: "returned", number: "FY/26-27/0004", journalDate: "2026-10-05" },
  { id: "archived", status: "archived", number: "FY/26-27/0005", journalDate: "2026-10-05" },
  { id: "legacy", number: "FY/26-27/0006", journalDate: "2026-10-05" },
];

{
  const { context, window, localStorage } = browser();
  localStorage.setItem("banikBooksPostedJournals", JSON.stringify([{ id: "previous-company" }]));
  vm.runInContext(source("frontend/js/services/report-data.js"), context);
  assert.equal(localStorage.getItem("banikBooksPostedJournals"), null, "a report must not initially expose a previous page's cached journals");
  const requests = [];
  window.BanikApi.request = async (url) => { requests.push(url); return { items: sampleJournals }; };
  const posted = await window.BanikReportData.hydrate("journals", "banikBooksPostedJournals");
  assert.deepEqual(Array.from(posted, (journal) => journal.id), ["posted", "legacy"]);
  assert.deepEqual(requests, ["/api/journals?purpose=reports&report=general-ledger"]);
  window.BanikApi.request = async () => ({ items: [] });
  await window.BanikReportData.hydrate("journals", "banikBooksPostedJournals");
  assert.equal(localStorage.getItem("banikBooksPostedJournals"), "[]", "empty remote data stays empty");
  localStorage.setItem("banikBooksPostedJournals", JSON.stringify(sampleJournals));
  window.BanikApi.request = async () => { throw new Error("Permission removed"); };
  await assert.rejects(window.BanikReportData.hydrate("journals", "banikBooksPostedJournals"), /Permission removed/);
  assert.equal(localStorage.getItem("banikBooksPostedJournals"), null, "denied reads must clear stale report data");
}

for (const name of ["general-ledger", "trial-balance", "statement-of-financial-position", "statement-of-cash-flows", "statement-of-profit-loss-and-oci", "statement-of-changes-in-equity", "party-wise-transaction"]) {
  const { context, localStorage } = browser();
  // Even if a browser cache is polluted, every financial report excludes drafts.
  localStorage.setItem("banikBooksPostedJournals", JSON.stringify(sampleJournals));
  localStorage.setItem("banikBooksJournals", JSON.stringify([{ id: "wrong-cache" }]));
  vm.runInContext(source(`frontend/js/pages/${name}.js`), context);
  const ids = vm.runInContext("getSortedJournals().map((journal) => journal.id)", context);
  assert.deepEqual(Array.from(ids), ["posted", "legacy"], `${name} must use only posted company journals`);
}

{
  const { context, window, nodes, localStorage } = browser();
  vm.runInContext(source("frontend/js/pages/journal-entry.js"), context);
  vm.runInContext(`
    workspaceContext = { userId: "junior" };
    getFilledLines = () => [{ account: "Cash", debit: "50", credit: "0" }, { account: "Sales", debit: "0", credit: "50" }];
    loadJournalIntoForm = (journal) => { currentJournal = journal; };
    showSaveToast = (message) => { window.lastToast = message; };
    showJournalAlert = (message) => { window.lastAlert = message; };
    journalDateInput.value = "2026-10-05";
  `, context);
  let complete;
  const requests = [];
  window.BanikApi.request = (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve) => { complete = resolve; });
  };
  const pending = vm.runInContext("persistJournal()", context);
  assert.equal(localStorage.getItem("banikBooksJournals"), null, "an unconfirmed save must not enter the local journal cache");
  assert.equal(window.lastToast, undefined, "an unconfirmed save must not show success");
  assert.equal(nodes.get("#save-btn").disabled, true, "the form prevents duplicate saves while pending");
  const saved = { ...sampleJournals[1], id: "new-draft", createdBy: "junior", version: 1 };
  complete({ item: saved });
  await pending;
  assert.equal(requests[0].url, "/api/journals");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.body.item.number, undefined, "the server allocates company journal numbers");
  assert.equal(JSON.parse(localStorage.getItem("banikBooksJournals"))[0].id, "new-draft");
  assert.match(window.lastToast, /saved/);

  const cacheBeforeConflict = localStorage.getItem("banikBooksJournals");
  window.BanikApi.request = async (url, options) => { requests.push({ url, options }); throw new Error("Journal changed. Reload the latest version."); };
  window.lastToast = "";
  await vm.runInContext("persistJournal()", context);
  assert.equal(requests.at(-1).options.method, "PATCH");
  assert.equal(requests.at(-1).options.body.expectedVersion, 1);
  assert.equal(localStorage.getItem("banikBooksJournals"), cacheBeforeConflict, "a conflict must preserve the last confirmed cache");
  assert.equal(window.lastToast, "");
  assert.match(window.lastAlert, /latest version/);

  vm.runInContext('currentJournal = { id: "posted", status: "posted", createdBy: "junior", version: 2 }; applyWorkflowState();', context);
  assert.equal(nodes.get("#save-btn").hidden, true);
  assert.equal(nodes.get("#delete-journal-btn").hidden, true, "posted entries cannot be deleted from the journal form");
  const requestCount = requests.length;
  await vm.runInContext("persistJournal()", context);
  assert.equal(requests.length, requestCount, "a posted record cannot be edited through the form");

  vm.runInContext('currentJournal = { id: "legacy", number: "FY/26-27/0001", status: "posted", version: 0 };', context);
  window.BanikApi.request = async (url, options) => {
    requests.push({ url, options });
    return { item: { id: "legacy", number: "FY/26-27/0001", status: "posted", version: 1, reversalJournalId: "opposite" } };
  };
  await vm.runInContext('performJournalAction("reverse", "Correct a legacy entry")', context);
  assert.equal(requests.at(-1).options.body.expectedVersion, 0, "legacy journals must retain version zero for server concurrency checks");
  const details = vm.runInContext('describeHistoryChanges(null, { journalDate: "2026-10-05", creationRequestId: "private-request", lines: [{ account: "<Cash>", debit: 50, credit: 0 }] })', context);
  assert.match(details, /Total debit 50/);
  assert.match(details, /&lt;Cash&gt;/);
  assert.equal(details.includes("private-request"), false, "user-facing history omits internal request identifiers");
}

console.log("Journal client checks passed: confirmed writes, conflicts, posted protection, and seven financial reports.");
