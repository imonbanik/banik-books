const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4104);
const ROOT_DIR = __dirname;

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
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": getContentType(filePath) });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  sendStatic(request, response);
});

server.listen(PORT, HOST, () => {
  console.log(`BANIK Books Firebase app running at http://${HOST}:${PORT}`);
});
