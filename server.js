const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4104);
const ROOT_DIR = __dirname;
const COMPAT_ROUTE_DIR = path.join(ROOT_DIR, "routes", "compat");
const RATE_CSV_SOURCES = Object.freeze({
  tax: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=157320309&single=true&output=csv",
  vat: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=1347947834&single=true&output=csv",
  customs: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=568506434&single=true&output=csv",
});

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
  };
  return contentTypes[extension] || "application/octet-stream";
}

function sendStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const pageName = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
  const safePath = path.normalize(pageName).replace(/^(\.\.[/\\])+/, "");
  const rootFilePath = path.join(ROOT_DIR, safePath);
  const compatFilePath = path.join(COMPAT_ROUTE_DIR, safePath);
  const isRootHtmlRequest = !safePath.includes(path.sep) && path.extname(safePath) === ".html";
  const filePath =
    isRootHtmlRequest && fs.existsSync(compatFilePath) ? compatFilePath : rootFilePath;

  if (
    !filePath.startsWith(ROOT_DIR) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": getContentType(filePath) });
  fs.createReadStream(filePath).pipe(response);
}

function sendRemoteCsv(sourceUrl, response, redirects = 0) {
  if (redirects > 5) {
    response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Too many redirects while loading rates.");
    return;
  }

  https
    .get(
      sourceUrl,
      {
        headers: {
          "User-Agent": "BANIK Books rate finder",
        },
      },
      (remoteResponse) => {
        const location = remoteResponse.headers.location;

        if (
          remoteResponse.statusCode >= 300 &&
          remoteResponse.statusCode < 400 &&
          location
        ) {
          const nextUrl = new URL(location, sourceUrl).toString();
          sendRemoteCsv(nextUrl, response, redirects + 1);
          return;
        }

        if (remoteResponse.statusCode < 200 || remoteResponse.statusCode >= 300) {
          response.writeHead(remoteResponse.statusCode || 502, {
            "Content-Type": "text/plain; charset=utf-8",
          });
          response.end("Could not load Google Sheet CSV.");
          return;
        }

        response.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        remoteResponse.pipe(response);
      }
    )
    .on("error", () => {
      response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Could not connect to Google Sheet CSV.");
    });
}

function sendRateCsv(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const sourceKey = String(url.searchParams.get("source") || "").toLowerCase();
  const sourceUrl = RATE_CSV_SOURCES[sourceKey];

  if (!sourceUrl) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unknown rate source.");
    return;
  }

  sendRemoteCsv(sourceUrl, response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/rate-finder-csv") {
    sendRateCsv(request, response);
    return;
  }

  sendStatic(request, response);
});

server.listen(PORT, HOST, () => {
  console.log(`BANIK Books Firebase app running at http://${HOST}:${PORT}`);
});
