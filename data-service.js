import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) =>
  String(value || "").startsWith("PASTE_")
);

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now()) + Math.random().toString(36).slice(2);
}

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((cleanValue, [key, item]) => {
      if (item !== undefined) {
        cleanValue[key] = sanitizeObject(item);
      }

      return cleanValue;
    }, {});
  }

  return value;
}

function normalizeTimestamp(value) {
  if (!value) {
    return "";
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return String(value);
}

function assertConfigured() {
  if (!db || !auth) {
    throw new Error("Firebase config missing.");
  }
}

function waitForFirebaseUser() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        unsubscribe();
        resolve(firebaseUser);
      },
      () => {
        unsubscribe();
        resolve(null);
      }
    );
  });
}

async function getCurrentUser() {
  assertConfigured();

  const firebaseUser = await waitForFirebaseUser();

  if (!firebaseUser || !firebaseUser.uid || !firebaseUser.emailVerified) {
    throw new Error("Please sign in first.");
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || "",
  };
}

async function getUserCollection(collectionName) {
  const user = await getCurrentUser();
  return collection(db, "userData", user.id, collectionName);
}

function normalizeChallanDoc(id, data) {
  return {
    id,
    withheldFy: data.withheldFy || "",
    monthRaw: data.monthRaw || "",
    monthLabel: data.monthLabel || data.monthRaw || "",
    taxCategory: data.taxCategory || "",
    taxNature: data.taxNature || "",
    challanNumber: data.challanNumber || "",
    challanDate: data.challanDate || "",
    organizationName: data.organizationName || "",
    individualAmount: Number(data.individualAmount || 0),
    totalAmount: Number(data.totalAmount || 0),
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

async function listChallans() {
  const challanCollection = await getUserCollection("challans");
  const snapshot = await getDocs(challanCollection);

  return snapshot.docs
    .map((challanDoc) => normalizeChallanDoc(challanDoc.id, challanDoc.data() || {}))
    .sort((leftEntry, rightEntry) =>
      String(rightEntry.createdAt || "").localeCompare(String(leftEntry.createdAt || ""))
    );
}

async function saveChallan(entry) {
  const user = await getCurrentUser();
  const now = new Date().toISOString();
  const entryId = entry.id || createId();
  const payload = sanitizeObject({
    ...entry,
    id: entryId,
    ownerUserId: user.id,
    ownerEmail: user.email,
    createdAt: entry.createdAt || now,
    updatedAt: now,
  });

  await setDoc(doc(db, "userData", user.id, "challans", entryId), payload, { merge: true });
  return normalizeChallanDoc(entryId, payload);
}

async function deleteChallan(entryId) {
  const user = await getCurrentUser();
  await deleteDoc(doc(db, "userData", user.id, "challans", entryId));
}

window.BanikData = {
  getCurrentUser,
  listChallans,
  saveChallan,
  deleteChallan,
};
