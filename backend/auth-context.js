const DEFAULT_DEV_USER_ID = "local-dev";
const DEFAULT_WORKSPACE_ID = "default";
const { verifyAuthToken } = require("./auth-verifier");

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function createAuthError(statusCode, message) {
  return {
    statusCode,
    message,
  };
}

function normalizeWorkspaceId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function getAllowedWorkspaceIds() {
  return String(process.env.BANIK_ALLOWED_WORKSPACE_IDS || "")
    .split(",")
    .map(normalizeWorkspaceId)
    .filter(Boolean);
}

function getCsvValues(envName) {
  return String(process.env[envName] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getRequestedRole(request) {
  return String(request.headers["x-banik-role"] || "").trim().toLowerCase();
}

function resolveRole(authContext, request) {
  const requestedRole = getRequestedRole(request);

  if (
    authContext.source &&
    authContext.source.startsWith("local-dev") &&
    ["viewer", "user", "admin"].includes(requestedRole)
  ) {
    return requestedRole;
  }

  const email = String(authContext.email || "").trim().toLowerCase();
  const userId = String(authContext.userId || "").trim().toLowerCase();
  const adminPrincipals = getCsvValues("BANIK_ADMIN_EMAILS");
  const viewerPrincipals = getCsvValues("BANIK_VIEWER_EMAILS");

  if (
    adminPrincipals.includes(email) ||
    adminPrincipals.includes(userId) ||
    (authContext.source && authContext.source.startsWith("local-dev"))
  ) {
    return "admin";
  }

  if (viewerPrincipals.includes(email) || viewerPrincipals.includes(userId)) {
    return "viewer";
  }

  return "user";
}

function withRole(authContext, request) {
  return {
    ...authContext,
    role: resolveRole(authContext, request),
  };
}

function getWorkspaceId(request) {
  const workspaceId =
    normalizeWorkspaceId(request.headers["x-banik-workspace-id"]) ||
    normalizeWorkspaceId(process.env.BANIK_DEFAULT_WORKSPACE_ID) ||
    DEFAULT_WORKSPACE_ID;

  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(workspaceId)) {
    return {
      error: createAuthError(400, "Workspace id is invalid."),
    };
  }

  const allowedWorkspaceIds = getAllowedWorkspaceIds();

  if (allowedWorkspaceIds.length && !allowedWorkspaceIds.includes(workspaceId)) {
    return {
      error: createAuthError(403, "Workspace is not allowed on this server."),
    };
  }

  return {
    workspaceId,
  };
}

async function resolveAuthContext(request) {
  const requireAuth = String(process.env.BANIK_API_REQUIRE_AUTH || "").toLowerCase() === "true";
  const trustUnverifiedToken =
    String(process.env.BANIK_API_TRUST_UNVERIFIED_TOKEN || "").toLowerCase() === "true";
  const token = getBearerToken(request);
  const workspaceContext = getWorkspaceId(request);

  if (workspaceContext.error) {
    return {
      error: workspaceContext.error,
    };
  }

  if (!token) {
    if (requireAuth) {
      return {
        error: {
          statusCode: 401,
          message: "Authentication is required.",
        },
      };
    }

    return withRole({
      userId: DEFAULT_DEV_USER_ID,
      workspaceId: workspaceContext.workspaceId,
      source: "local-dev",
      token: "",
    }, request);
  }

  try {
    const verifiedContext = await verifyAuthToken(token);

    if (verifiedContext) {
      return withRole({
        ...verifiedContext,
        workspaceId: workspaceContext.workspaceId,
      }, request);
    }
  } catch (error) {
    if (requireAuth) {
      return {
        error: {
          statusCode: error.statusCode || 401,
          message: error.message || "Token verification failed.",
        },
      };
    }
  }

  const decodedPayload = decodeJwtPayload(token);
  const tokenUserId = decodedPayload && (decodedPayload.user_id || decodedPayload.sub || decodedPayload.uid);

  if (trustUnverifiedToken && tokenUserId) {
    return withRole({
      userId: String(tokenUserId),
      workspaceId: workspaceContext.workspaceId,
      email: decodedPayload.email || "",
      source: "unverified-token",
      token,
    }, request);
  }

  if (requireAuth) {
    return {
      error: {
        statusCode: 501,
        message: "Server-side token verification is not configured.",
      },
    };
  }

  return withRole({
    userId: DEFAULT_DEV_USER_ID,
    workspaceId: workspaceContext.workspaceId,
    source: "local-dev-token-present",
    token,
  }, request);
}

module.exports = {
  resolveAuthContext,
};
