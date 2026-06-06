let cachedFirebaseVerifier = null;
const { getFirebaseAdminAuth } = require("./firebase-admin-client");

function getAuthProvider() {
  return String(process.env.BANIK_API_AUTH_PROVIDER || "").trim().toLowerCase();
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getFirebaseVerifier() {
  if (cachedFirebaseVerifier) {
    return cachedFirebaseVerifier;
  }

  cachedFirebaseVerifier = getFirebaseAdminAuth();
  return cachedFirebaseVerifier;
}

async function verifyFirebaseToken(token) {
  const auth = getFirebaseVerifier();
  const decodedToken = await auth.verifyIdToken(token, true);
  const userId = decodedToken.uid || decodedToken.user_id || decodedToken.sub;

  if (!userId) {
    throw createError(401, "Verified token does not contain a user id.");
  }

  return {
    userId: String(userId),
    email: decodedToken.email || "",
    source: "firebase-admin",
    token,
  };
}

async function verifyAuthToken(token) {
  const provider = getAuthProvider();

  if (!provider) {
    return null;
  }

  if (provider === "firebase") {
    return verifyFirebaseToken(token);
  }

  throw createError(501, `Unsupported API auth provider: ${provider}`);
}

module.exports = {
  verifyAuthToken,
};
