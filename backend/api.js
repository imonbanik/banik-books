const {
  listItems,
  removeItem,
  replaceItems,
  saveItem,
} = require("./collection-service");
const { resolveAuthContext } = require("./auth-context");
const { exportBackup, importBackup } = require("./backup-service");
const { assertCollectionAccess, assertRole } = require("./permissions");
const { assertRateLimit } = require("./rate-limit");

const COLLECTIONS = Object.freeze({
  journals: "journals",
  parties: "parties",
  "chart-of-accounts": "chartOfAccounts",
  challans: "challans",
  settings: "settings",
});

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendJsonHead(response, statusCode) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 5 * 1024 * 1024) {
        const error = new Error("Payload too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Invalid JSON payload.");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

async function handleBackupApi(request, response, pathParts, authContext) {
  const backupAction = pathParts[2] || "";

  if (backupAction === "export" && request.method === "GET") {
    assertRole(authContext, "user");
    sendJson(response, 200, await exportBackup(authContext));
    return true;
  }

  if (backupAction === "import" && request.method === "PUT") {
    assertRole(authContext, "admin");
    const payload = await readJsonBody(request);
    sendJson(response, 200, await importBackup(payload, authContext));
    return true;
  }

  response.writeHead(405, {
    "Content-Type": "text/plain; charset=utf-8",
    Allow: "GET, PUT",
  });
  response.end("Method not allowed");
  return true;
}

function handleWorkspaceApi(request, response, authContext) {
  if (request.method === "GET" || request.method === "HEAD") {
    const payload = {
      userId: authContext.userId,
      workspaceId: authContext.workspaceId,
      role: authContext.role,
      source: authContext.source,
    };

    if (request.method === "HEAD") {
      sendJsonHead(response, 200);
    } else {
      sendJson(response, 200, payload);
    }
    return true;
  }

  response.writeHead(405, {
    "Content-Type": "text/plain; charset=utf-8",
    Allow: "GET, HEAD",
  });
  response.end("Method not allowed");
  return true;
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const isApiRequest = pathParts[0] === "api";
  const routeName = isApiRequest ? pathParts[1] : "";
  const collectionName = isApiRequest ? COLLECTIONS[routeName] : "";
  const itemId = pathParts.length > 2 ? decodeURIComponent(pathParts.slice(2).join("/")) : "";

  if (!isApiRequest) {
    return false;
  }

  try {
    const authContext = await resolveAuthContext(request);

    if (authContext.error) {
      sendJson(response, authContext.error.statusCode, { error: authContext.error.message });
      return true;
    }

    assertRateLimit(request, authContext);

    if (routeName === "backups") {
      return await handleBackupApi(request, response, pathParts, authContext);
    }

    if (routeName === "workspace") {
      return handleWorkspaceApi(request, response, authContext);
    }

    if (!collectionName) {
      sendJson(response, 404, { error: "Unknown API endpoint." });
      return true;
    }

    assertCollectionAccess(authContext, request.method);

    if (request.method === "HEAD") {
      sendJsonHead(response, 200);
      return true;
    }

    if (request.method === "GET") {
      sendJson(response, 200, { items: await listItems(collectionName, authContext) });
      return true;
    }

    if ((request.method === "POST" || request.method === "PATCH") && itemId) {
      const payload = await readJsonBody(request);
      const itemPayload = payload.item || payload;
      const item = await saveItem(collectionName, itemId, itemPayload, authContext);
      sendJson(response, 200, { item });
      return true;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody(request);
      if (itemId) {
        const itemPayload = payload.item || payload;
        const item = await saveItem(collectionName, itemId, itemPayload, authContext);
        sendJson(response, 200, { item });
      } else {
        const nextItems = normalizeItems(payload);
        const items = await replaceItems(collectionName, nextItems, authContext);
        sendJson(response, 200, { items });
      }
      return true;
    }

    if (request.method === "DELETE" && itemId) {
      const items = await removeItem(collectionName, itemId, authContext);
      sendJson(response, 200, { items });
      return true;
    }

    response.writeHead(405, {
      "Content-Type": "text/plain; charset=utf-8",
      Allow: "GET, HEAD, POST, PUT, PATCH, DELETE",
    });
    response.end("Method not allowed");
    return true;
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Backend API error.",
    });
    return true;
  }
}

module.exports = {
  handleApi,
};
