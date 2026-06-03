const ROLE_ORDER = Object.freeze({
  viewer: 1,
  user: 2,
  admin: 3,
});

function createPermissionError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasRole(authContext, minimumRole) {
  const currentRank = ROLE_ORDER[authContext && authContext.role] || 0;
  const requiredRank = ROLE_ORDER[minimumRole] || 0;
  return currentRank >= requiredRank;
}

function assertRole(authContext, minimumRole) {
  if (!hasRole(authContext, minimumRole)) {
    throw createPermissionError(403, "You do not have permission to perform this action.");
  }
}

function assertCollectionAccess(authContext, method) {
  if (method === "GET" || method === "HEAD") {
    assertRole(authContext, "viewer");
    return;
  }

  assertRole(authContext, "user");
}

module.exports = {
  assertCollectionAccess,
  assertRole,
  hasRole,
};
