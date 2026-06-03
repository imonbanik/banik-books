const buckets = new Map();

function getClientKey(request, authContext) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const remoteAddress = request.socket && request.socket.remoteAddress;
  return `${authContext.userId || "anonymous"}:${forwardedFor || remoteAddress || "local"}`;
}

function getWindowMs() {
  return Number(process.env.BANIK_API_RATE_LIMIT_WINDOW_MS || 60_000);
}

function getMaxRequests() {
  return Number(process.env.BANIK_API_RATE_LIMIT_MAX || 240);
}

function assertRateLimit(request, authContext) {
  const maxRequests = getMaxRequests();

  if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
    return;
  }

  const now = Date.now();
  const windowMs = Math.max(1000, getWindowMs());
  const clientKey = getClientKey(request, authContext);
  const bucket = buckets.get(clientKey);

  if (!bucket || now - bucket.startedAt > windowMs) {
    buckets.set(clientKey, {
      count: 1,
      startedAt: now,
    });
    return;
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    const error = new Error("Too many API requests. Please try again shortly.");
    error.statusCode = 429;
    throw error;
  }
}

module.exports = {
  assertRateLimit,
};
