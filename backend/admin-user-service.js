const {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
} = require("./firebase-admin-client");

const COLLECTION_DELETE_BATCH_SIZE = 100;

function createAdminUserError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeUserId(value) {
  return String(value || "").trim();
}

function assertTargetUser(authContext, targetUserId) {
  const normalizedTargetUserId = normalizeUserId(targetUserId);

  if (!normalizedTargetUserId) {
    throw createAdminUserError(400, "User id is required.");
  }

  if (normalizedTargetUserId === normalizeUserId(authContext && authContext.userId)) {
    throw createAdminUserError(400, "You cannot modify your own admin account here.");
  }

  return normalizedTargetUserId;
}

function getRootCollectionName() {
  return String(process.env.BANIK_FIRESTORE_ROOT_COLLECTION || "").trim() || "banikWorkspaceData";
}

function decodeScopeId(scopeId) {
  try {
    return Buffer.from(String(scopeId || ""), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

async function deleteCollectionTree(collectionRef) {
  let snapshot = await collectionRef.limit(COLLECTION_DELETE_BATCH_SIZE).get();

  while (!snapshot.empty) {
    await Promise.all(snapshot.docs.map((docSnapshot) => deleteDocumentTree(docSnapshot.ref)));
    snapshot = await collectionRef.limit(COLLECTION_DELETE_BATCH_SIZE).get();
  }
}

async function deleteDocumentTree(documentRef) {
  const subcollections = await documentRef.listCollections();

  for (const subcollection of subcollections) {
    await deleteCollectionTree(subcollection);
  }

  await documentRef.delete();
}

async function deleteBackendScopeData(db, targetUserId) {
  const rootCollection = db.collection(getRootCollectionName());
  const refsByPath = new Map();

  const scopedSnapshot = await rootCollection.where("userId", "==", targetUserId).get();
  scopedSnapshot.docs.forEach((docSnapshot) => {
    refsByPath.set(docSnapshot.ref.path, docSnapshot.ref);
  });

  const rootSnapshot = await rootCollection.get();
  rootSnapshot.docs.forEach((docSnapshot) => {
    if (decodeScopeId(docSnapshot.id).startsWith(`${targetUserId}::`)) {
      refsByPath.set(docSnapshot.ref.path, docSnapshot.ref);
    }
  });

  for (const documentRef of refsByPath.values()) {
    await deleteDocumentTree(documentRef);
  }

  return refsByPath.size;
}

function isMissingAuthUser(error) {
  return (
    error &&
    (error.code === "auth/user-not-found" ||
      /no user record/i.test(String(error.message || "")))
  );
}

async function setUserDisabled(targetUserId, disabled, authContext) {
  const userId = assertTargetUser(authContext, targetUserId);
  const shouldDisable = Boolean(disabled);
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  const now = new Date().toISOString();

  try {
    await auth.updateUser(userId, { disabled: shouldDisable });

    if (shouldDisable) {
      await auth.revokeRefreshTokens(userId);
    }
  } catch (error) {
    if (isMissingAuthUser(error)) {
      throw createAdminUserError(404, "Firebase Auth user was not found.");
    }

    throw error;
  }

  await db.collection("users").doc(userId).set(
    {
      disabled: shouldDisable,
      disabledAt: shouldDisable ? now : null,
      enabledAt: shouldDisable ? null : now,
      updatedAt: now,
      updatedBy: authContext.userId,
    },
    { merge: true }
  );

  return {
    id: userId,
    disabled: shouldDisable,
  };
}

async function deleteUserAccount(targetUserId, authContext) {
  const userId = assertTargetUser(authContext, targetUserId);
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  let authDeleted = true;

  try {
    await auth.deleteUser(userId);
  } catch (error) {
    if (isMissingAuthUser(error)) {
      authDeleted = false;
    } else {
      throw error;
    }
  }

  await deleteDocumentTree(db.collection("users").doc(userId));
  await deleteDocumentTree(db.collection("userData").doc(userId));
  const backendScopesDeleted = await deleteBackendScopeData(db, userId);

  return {
    id: userId,
    authDeleted,
    firestoreDeleted: true,
    backendScopesDeleted,
  };
}

module.exports = {
  deleteUserAccount,
  setUserDisabled,
};
