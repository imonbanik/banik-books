let cachedAppModule = null;
let cachedAuthModule = null;
let cachedFirestoreModule = null;
let cachedFirestore = null;

function createFirebaseAdminError() {
  const error = new Error(
    "Firebase Admin is not installed. Install firebase-admin and configure server credentials."
  );
  error.statusCode = 501;
  return error;
}

function createFirebaseCredentialError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function getFirebaseServiceAccount() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (!rawJson) {
    return null;
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(rawJson);
  } catch {
    throw createFirebaseCredentialError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const requiredFields = ["project_id", "client_email", "private_key"];
  const missingFields = requiredFields.filter((field) => !String(serviceAccount[field] || "").trim());

  if (missingFields.length) {
    throw createFirebaseCredentialError(
      `FIREBASE_SERVICE_ACCOUNT_JSON is missing: ${missingFields.join(", ")}.`
    );
  }

  serviceAccount.private_key = String(serviceAccount.private_key).replace(/\\n/g, "\n");
  return serviceAccount;
}

function initializeFirebaseAdminApp(appModule) {
  const serviceAccount = getFirebaseServiceAccount();

  if (serviceAccount) {
    appModule.initializeApp({
      credential: appModule.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    return;
  }

  appModule.initializeApp(appModule.applicationDefault());
}

function loadFirebaseAdmin() {
  if (cachedAppModule && cachedAuthModule && cachedFirestoreModule) {
    return {
      appModule: cachedAppModule,
      authModule: cachedAuthModule,
      firestoreModule: cachedFirestoreModule,
    };
  }

  try {
    cachedAppModule = require("firebase-admin/app");
    cachedAuthModule = require("firebase-admin/auth");
    cachedFirestoreModule = require("firebase-admin/firestore");
  } catch {
    throw createFirebaseAdminError();
  }

  if (!cachedAppModule.getApps().length) {
    initializeFirebaseAdminApp(cachedAppModule);
  }

  return {
    appModule: cachedAppModule,
    authModule: cachedAuthModule,
    firestoreModule: cachedFirestoreModule,
  };
}

function getFirebaseAdminAuth() {
  const { authModule } = loadFirebaseAdmin();
  return authModule.getAuth();
}

function getFirebaseAdminFirestore() {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  const { firestoreModule } = loadFirebaseAdmin();
  cachedFirestore = firestoreModule.getFirestore();
  return cachedFirestore;
}

module.exports = {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
};
