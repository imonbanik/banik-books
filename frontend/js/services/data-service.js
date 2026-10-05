import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig } from "../config/firebase-config.js";

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

function normalizeChartNodes(nodes) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .map((node) => {
      const nodeType = node && node.type === "ledger" ? "ledger" : "group";
      const normalizedNode = {
        id: String(node.id || createId()),
        type: nodeType,
        name: String(node.name || "").trim(),
        code: String(node.code || "").trim(),
        classification: String(node.classification || "").trim(),
      };

      if (nodeType === "group") {
        normalizedNode.children = normalizeChartNodes(node.children || []);
      } else {
        normalizedNode.openingBalance = Number(node.openingBalance || 0) || 0;
        normalizedNode.openingBalanceDate = String(node.openingBalanceDate || "").trim();
        normalizedNode.openingBalanceSide =
          String(node.openingBalanceSide || "").toLowerCase() === "credit" ? "credit" : "debit";
      }

      return normalizedNode;
    })
    .filter((node) => node.name);
}

function companyApi() {
  if (!window.BanikApi) throw new Error("Company data is unavailable. Please refresh.");
  return window.BanikApi;
}
async function listChallans() {
  return companyApi().list("challans");
}
async function saveChallan(entry) {
  const id = entry.id || createId();
  return companyApi().upsert("challans", id, { ...entry, id });
}
async function deleteChallan(entryId) {
  return companyApi().remove("challans", entryId);
}
async function getChartOfAccounts() {
  return normalizeChartNodes(await companyApi().list("chartOfAccounts"));
}

async function getDefaultChartOfAccounts() {
  await getCurrentUser();
  const snapshot = await getDoc(doc(db, "publicSettings", "chartOfAccountsTemplate"));

  if (!snapshot.exists()) {
    return [];
  }

  return normalizeChartNodes((snapshot.data() || {}).items || []);
}

async function saveChartOfAccounts(items) {
  return companyApi().replace("chartOfAccounts", normalizeChartNodes(items));
}

async function saveDefaultChartOfAccounts(items) {
  const user = await getCurrentUser();
  const normalizedItems = normalizeChartNodes(items);

  await setDoc(
    doc(db, "publicSettings", "chartOfAccountsTemplate"),
    sanitizeObject({
      items: normalizedItems,
      ownerUserId: user.id,
      ownerEmail: user.email,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );

  return normalizedItems;
}

window.BanikData = {
  getCurrentUser,
  listChallans,
  saveChallan,
  deleteChallan,
  getChartOfAccounts,
  getDefaultChartOfAccounts,
  saveChartOfAccounts,
  saveDefaultChartOfAccounts,
};
