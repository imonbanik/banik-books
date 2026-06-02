import http from "node:http";
import https from "node:https";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4103";
const ROUTES = [
  "/journal-entry.html",
  "/pages/accounting/journal-entry.html",
  "/workspace.html",
  "/pages/workspace/workspace.html",
  "/journal-register.html",
  "/pages/reports/journal-register.html",
  "/general-ledger.html",
  "/pages/reports/general-ledger.html",
  "/party-wise-transaction.html",
  "/pages/reports/party-wise-transaction.html",
  "/trial-balance.html",
  "/pages/reports/trial-balance.html",
  "/statement-of-financial-position.html",
  "/pages/reports/statement-of-financial-position.html",
  "/statement-of-profit-loss-and-oci.html",
  "/pages/reports/statement-of-profit-loss-and-oci.html",
  "/statement-of-changes-in-equity.html",
  "/pages/reports/statement-of-changes-in-equity.html",
  "/statement-of-cash-flows.html",
  "/pages/reports/statement-of-cash-flows.html",
  "/party-management.html",
  "/pages/workspace/party-management.html",
  "/invoice-generator.html",
  "/pages/tools/invoice-generator.html",
  "/styles.css",
  "/css/pages/journal-entry.css",
  "/css/responsive/base-responsive.css",
  "/js/pages/journal-entry.js",
  "/js/pages/journal-register.js",
  "/js/pages/general-ledger.js",
  "/js/pages/party-wise-transaction.js",
  "/js/pages/trial-balance.js",
  "/js/pages/statement-of-financial-position.js",
  "/js/pages/statement-of-profit-loss-and-oci.js",
  "/js/pages/statement-of-changes-in-equity.js",
  "/js/pages/statement-of-cash-flows.js",
  "/js/pages/party-management.js",
  "/assets/banik-logo.svg",
];

function requestHead(pathname) {
  const url = new URL(pathname, BASE_URL);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const request = transport.request(url, { method: "HEAD" }, (response) => {
      response.resume();
      resolve({
        pathname,
        statusCode: response.statusCode || 0,
        contentType: response.headers["content-type"] || "",
      });
    });

    request.on("error", (error) => {
      resolve({
        pathname,
        statusCode: 0,
        contentType: "",
        error: error.message,
      });
    });

    request.end();
  });
}

const results = await Promise.all(ROUTES.map(requestHead));
let failed = false;

for (const result of results) {
  const ok = result.statusCode >= 200 && result.statusCode < 400;
  const detail = result.error
    ? `${result.statusCode} ${result.error}`
    : `${result.statusCode} ${result.contentType}`;

  console.log(`${ok ? "ok" : "fail"} ${result.pathname} ${detail}`);

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  console.error(`Smoke check failed against ${BASE_URL}. Start the local server and try again.`);
  process.exit(1);
}

console.log(`Smoke checked ${results.length} routes against ${BASE_URL}.`);
