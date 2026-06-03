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
    cachedAppModule.initializeApp(cachedAppModule.applicationDefault());
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
