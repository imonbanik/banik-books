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
const { handleApi } = require("../backend/api.js");

function startServer() {
  const server = http.createServer(async (request, response) => {
    if (await handleApi(request, response)) {
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not found" }));
  });

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

  try {
    const unknownEndpoint = await requestJson(server, "/api/not-real");
    assert.equal(unknownEndpoint.statusCode, 404);
    assert.equal(unknownEndpoint.body.error, "Unknown API endpoint.");

    const badMethod = await requestJson(server, "/api/journals", { method: "POST" });
    assert.equal(badMethod.statusCode, 405);

    const malformedJson = await requestJson(server, "/api/journals", {
      method: "PUT",
      body: "{",
    });
    assert.equal(malformedJson.statusCode, 400);
    assert.equal(malformedJson.body.error, "Invalid JSON payload.");

    const savedJournal = await requestJson(server, "/api/journals/JV-HTTP-001", {
      method: "PUT",
      body: JSON.stringify({
        item: {
          number: "JV-HTTP-001",
          journalDate: "2026-06-03",
          lines: [{ account: "Cash", debit: 100, credit: 0 }],
        },
      }),
    });
    assert.equal(savedJournal.statusCode, 200);
    assert.equal(savedJournal.body.item.number, "JV-HTTP-001");

    const fetchedJournal = await requestJson(server, "/api/journals/JV-HTTP-001");
    assert.equal(fetchedJournal.statusCode, 200);
    assert.equal(fetchedJournal.body.item.number, "JV-HTTP-001");

    const backup = await requestJson(server, "/api/backups/export");
    assert.equal(backup.statusCode, 200);
    assert.equal(backup.body.data.journals.length, 1);

    const viewerImport = await requestJson(server, "/api/backups/import", {
      method: "PUT",
      headers: { "X-Banik-Role": "viewer" },
      body: JSON.stringify(backup.body),
    });
    assert.equal(viewerImport.statusCode, 403);

    const adminImport = await requestJson(server, "/api/backups/import", {
      method: "PUT",
      body: JSON.stringify({
        data: {
          ...backup.body.data,
          journals: [],
        },
      }),
    });
    assert.equal(adminImport.statusCode, 200);
    assert.equal(adminImport.body.data.journals.length, 0);
  } finally {
    await closeServer(server);
    await fs.rm(testDataFile, { force: true });
    delete process.env.BANIK_DATA_FILE;
    delete process.env.BANIK_API_RATE_LIMIT_MAX;
  }

  console.log("HTTP API checks passed.");
}

run().catch(async (error) => {
  await fs.rm(testDataFile, { force: true });
  delete process.env.BANIK_DATA_FILE;
  delete process.env.BANIK_API_RATE_LIMIT_MAX;
  console.error(error);
  process.exitCode = 1;
});
