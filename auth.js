import {
  getApp,
  getApps,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { BANIK_FOUNDER_ADMIN_EMAIL, firebaseConfig } from "./firebase-config.js";

const LETTERHEAD_MAX_BYTES = 4 * 1024 * 1024;
const LETTERHEAD_CHUNK_SIZE = 500000;
const LETTERHEAD_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
]);
const ESIGN_MAX_BYTES = 512 * 1024;
const ESIGN_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const ESIGN_REQUIRED_WIDTH = 300;
const ESIGN_REQUIRED_HEIGHT = 100;

const BANIK_MODULES = Object.freeze([
  { key: "journal-entry", label: "Journal Entry", pages: ["journal-entry.html"] },
  { key: "chart-of-accounts", label: "Chart of Accounts", pages: ["chart-of-accounts.html"] },
  { key: "necessary-tools", label: "Necessary Tools", pages: ["necessary-tools.html"] },
  { key: "cheque-printer", label: "Cheque Printer", pages: ["cheque-printer.html", "Imon-Cheque.html"] },
  { key: "challan-management", label: "Challan Management", pages: ["challan-management.html"] },
  {
    key: "payroll-tax-calculator",
    label: "Payroll Tax Calculator",
    pages: ["payroll-tax-calculator.html"],
  },
  {
    key: "vat-tax-calculator",
    label: "Withholding VAT/Tax Calculator",
    pages: ["withholding-vat-tax-calculator.html"],
  },
  {
    key: "tax-vat-customs-rates",
    label: "Tax, VAT & Customs Rates",
    pages: ["tax-vat-customs-rates.html"],
  },
  {
    key: "emi-calculator",
    label: "EMI Calculator",
    pages: ["emi-calculator.html"],
  },
  {
    key: "invoice-generator",
    label: "Invoice Generator",
    pages: ["invoice-generator.html"],
  },
  {
    key: "reports",
    label: "Reports",
    pages: [
      "reports.html",
      "general-ledger.html",
      "trial-balance.html",
      "statement-of-financial-position.html",
      "statement-of-profit-loss-and-oci.html",
      "statement-of-changes-in-equity.html",
      "statement-of-cash-flows.html",
      "notes-to-the-accounts.html",
    ],
  },
]);

const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) =>
  String(value || "").startsWith("PASTE_")
);
const normalizedFounderEmail = normalizeAuthEmail(BANIK_FOUNDER_ADMIN_EMAIL);
const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

let cachedCurrentUser = null;
let authReadyPromise = Promise.resolve(null);

if (auth) {
  authReadyPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        cachedCurrentUser = null;
        resolve(null);
        return;
      }

      if (!firebaseUser.emailVerified) {
        cachedCurrentUser = null;
        resolve(null);
        return;
      }

      cachedCurrentUser = await ensureUserProfile(firebaseUser);
      resolve(cachedCurrentUser);
    });
  });
}

function normalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createPermissionMap(defaultValue = false) {
  return BANIK_MODULES.reduce((permissions, module) => {
    permissions[module.key] = defaultValue;
    return permissions;
  }, {});
}

function isFounderEmail(email) {
  return normalizeAuthEmail(email) === normalizedFounderEmail;
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured) {
    return {
      ok: false,
      message: "Firebase config missing. Paste your Firebase web config into firebase-config.js first.",
    };
  }

  return { ok: true };
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

function normalizeUserDoc(id, data) {
  const email = data.email || "";
  const role = isFounderEmail(email) && data.role === "admin" ? "admin" : "user";
  const profileCompleted = Boolean(data.profileCompleted);

  return {
    id,
    email,
    companyName: data.companyName || "",
    fullName: data.fullName || "",
    mobileNumber: data.mobileNumber || "",
    businessType: data.businessType || "",
    currency: data.currency || "BDT - Bangladeshi Taka",
    companyAddress: data.companyAddress || "",
    fiscalYearStart: data.fiscalYearStart || "",
    preferredPlan: data.preferredPlan || "Start Free",
    role,
    profileCompleted,
    permissions: {
      ...createPermissionMap(role === "admin"),
      ...(data.permissions || {}),
    },
    emailVerified: Boolean(data.emailVerified),
    createdAt: normalizeTimestamp(data.createdAt),
    lastLoginAt: normalizeTimestamp(data.lastLoginAt),
    letterheadMeta: data.letterheadMeta || null,
    eSignMeta: data.eSignMeta || null,
  };
}

function getLetterheadRefs(userId) {
  const metaRef = doc(db, "userData", userId, "profile", "letterhead");
  const chunksRef = collection(db, "userData", userId, "profile", "letterhead", "chunks");
  return { metaRef, chunksRef };
}

function getESignRefs(userId) {
  const metaRef = doc(db, "userData", userId, "profile", "eSign");
  const chunksRef = collection(db, "userData", userId, "profile", "eSign", "chunks");
  return { metaRef, chunksRef };
}

function getLetterheadExtension(type) {
  if (type === "application/pdf") {
    return "pdf";
  }

  if (type === "image/png") {
    return "png";
  }

  return "jpg";
}

function normalizeLetterheadPayload(payload) {
  const name = String(payload && payload.name ? payload.name : "organization-letterhead").trim();
  const rawType = String(payload && payload.type ? payload.type : "").trim().toLowerCase();
  const type = rawType === "image/jpg" ? "image/jpeg" : rawType;
  const size = Number(payload && payload.size ? payload.size : 0);
  const dataUrl = String(payload && payload.dataUrl ? payload.dataUrl : "");

  if (!LETTERHEAD_ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      message: "Upload PNG, JPG, or PDF format only.",
    };
  }

  if (!size || size > LETTERHEAD_MAX_BYTES) {
    return {
      ok: false,
      message: "Letterhead file must be 4 MB or smaller.",
    };
  }

  const dataUrlTypeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const dataUrlType = dataUrlTypeMatch
    ? (dataUrlTypeMatch[1] === "image/jpg" ? "image/jpeg" : dataUrlTypeMatch[1])
    : "";

  if (dataUrlType !== type) {
    return {
      ok: false,
      message: "Could not read the selected letterhead file.",
    };
  }

  return {
    ok: true,
    letterhead: {
      name,
      type,
      size,
      extension: getLetterheadExtension(type),
      dataUrl,
    },
  };
}

function normalizeESignPayload(payload) {
  const name = String(payload && payload.name ? payload.name : "e-signature").trim();
  const rawType = String(payload && payload.type ? payload.type : "").trim().toLowerCase();
  const type = rawType === "image/jpg" ? "image/jpeg" : rawType;
  const size = Number(payload && payload.size ? payload.size : 0);
  const width = Number(payload && payload.width ? payload.width : 0);
  const height = Number(payload && payload.height ? payload.height : 0);
  const dataUrl = String(payload && payload.dataUrl ? payload.dataUrl : "");

  if (!ESIGN_ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      message: "Upload PNG or JPG e-sign only.",
    };
  }

  if (!size || size > ESIGN_MAX_BYTES) {
    return {
      ok: false,
      message: "E-sign file must be 512 KB or smaller.",
    };
  }

  if (width !== ESIGN_REQUIRED_WIDTH || height !== ESIGN_REQUIRED_HEIGHT) {
    return {
      ok: false,
      message: "E-sign must be exactly 300x100 pixels.",
    };
  }

  const dataUrlTypeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const dataUrlType = dataUrlTypeMatch
    ? (dataUrlTypeMatch[1] === "image/jpg" ? "image/jpeg" : dataUrlTypeMatch[1])
    : "";

  if (dataUrlType !== type) {
    return {
      ok: false,
      message: "Could not read the selected e-sign file.",
    };
  }

  return {
    ok: true,
    eSign: {
      name,
      type,
      size,
      width,
      height,
      extension: getLetterheadExtension(type),
      dataUrl,
    },
  };
}

async function ensureUserProfile(firebaseUser, profile = {}) {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnapshot = await getDoc(userRef);
  const role = isFounderEmail(firebaseUser.email) ? "admin" : "user";
  const fallbackName = normalizeAuthEmail(firebaseUser.email).split("@")[0] || "BANIK Books User";

  if (!userSnapshot.exists()) {
    await setDoc(userRef, {
      email: normalizeAuthEmail(firebaseUser.email),
      companyName: profile.companyName || (role === "admin" ? "BANIK Books" : fallbackName),
      fullName: profile.fullName || firebaseUser.displayName || fallbackName,
      role,
      emailVerified: firebaseUser.emailVerified,
      profileCompleted: false,
      permissions: createPermissionMap(role === "admin"),
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      email: normalizeAuthEmail(firebaseUser.email),
      emailVerified: firebaseUser.emailVerified,
      lastLoginAt: serverTimestamp(),
    });
  }

  const refreshedSnapshot = await getDoc(userRef);
  return normalizeUserDoc(firebaseUser.uid, refreshedSnapshot.data() || {});
}

async function getCurrentBanikUser() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return null;
  }

  if (cachedCurrentUser) {
    return cachedCurrentUser;
  }

  await authReadyPromise;
  return cachedCurrentUser;
}

function getFriendlyAuthMessage(error) {
  const code = error && error.code;
  const messages = {
    "auth/email-already-in-use":
      "This email already has an account. Click 'Already have an account?' and sign in to resend verification.",
    "auth/invalid-email": "Use a valid email address.",
    "auth/invalid-credential": "Email or password did not match.",
    "auth/missing-password": "Password is required.",
    "auth/network-request-failed": "Network problem. Check internet connection and try again.",
    "auth/operation-not-allowed": "Email/password login is not enabled in Firebase Authentication.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes, then try again.",
    "auth/unauthorized-continue-uri":
      "Verification link domain is not authorized in Firebase. Use localhost or add the domain in Firebase Authentication settings.",
    "auth/weak-password": "Password must be at least 6 characters.",
  };
  return messages[code] || "Authentication failed. Please try again.";
}

async function sendBanikVerificationEmail(firebaseUser) {
  await sendEmailVerification(firebaseUser);
}

async function registerBanikUser({ email, password, companyName, fullName = "" }) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  try {
    const normalizedEmail = normalizeAuthEmail(email);
    const fallbackName = normalizedEmail.split("@")[0] || "BANIK Books User";
    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      String(password || "")
    );
    await updateProfile(credential.user, {
      displayName: String(fullName || fallbackName).trim(),
    });
    await sendBanikVerificationEmail(credential.user);
    await signOut(auth);
    cachedCurrentUser = null;
    return {
      ok: true,
      requiresVerification: true,
      message: "Verification email sent. Open your inbox, verify your email, then log in.",
    };
  } catch (error) {
    return { ok: false, message: getFriendlyAuthMessage(error) };
  }
}

async function loginBanikUser(email, password) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      normalizeAuthEmail(email),
      String(password || "")
    );

    await credential.user.reload();

    if (!credential.user.emailVerified) {
      await sendBanikVerificationEmail(credential.user);
      await signOut(auth);
      cachedCurrentUser = null;
      return {
        ok: false,
        requiresVerification: true,
        message: "Email is not verified yet. A fresh verification email has been sent.",
      };
    }

    cachedCurrentUser = await ensureUserProfile(credential.user);
    return { ok: true, user: cachedCurrentUser };
  } catch (error) {
    return { ok: false, message: getFriendlyAuthMessage(error) };
  }
}

async function logoutBanikUser() {
  if (auth) {
    await signOut(auth);
  }

  cachedCurrentUser = null;
  window.location.href = "./index.html";
}

async function getAuthUsers() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return [];
  }

  const user = await getCurrentBanikUser();

  if (!user || user.role !== "admin") {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs
      .map((userDoc) => normalizeUserDoc(userDoc.id, userDoc.data()))
      .sort((leftUser, rightUser) => leftUser.email.localeCompare(rightUser.email));
  } catch {
    return [];
  }
}

async function updateUserPermission(userId, moduleKey, enabled) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user || user.role !== "admin") {
    return { ok: false, message: "Admin access required." };
  }

  if (!BANIK_MODULES.some((module) => module.key === moduleKey)) {
    return { ok: false, message: "Unknown module." };
  }

  try {
    await updateDoc(doc(db, "users", userId), {
      [`permissions.${moduleKey}`]: Boolean(enabled),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not update permission. Check Firestore rules." };
  }
}

async function updateCurrentUserProfile(profile) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  const profileData = {
    fullName: String(profile.fullName || "").trim(),
    mobileNumber: String(profile.mobileNumber || "").trim(),
    businessType: String(profile.businessType || "").trim(),
    currency: String(profile.currency || "BDT - Bangladeshi Taka").trim(),
    companyAddress: String(profile.companyAddress || "").trim(),
    fiscalYearStart: String(profile.fiscalYearStart || "").trim(),
    preferredPlan: String(profile.preferredPlan || "Start Free").trim(),
  };

  if (!profileData.fullName) {
    return { ok: false, message: "Full name is required." };
  }

  if (!profileData.mobileNumber) {
    return { ok: false, message: "Mobile number is required." };
  }

  if (!profileData.companyAddress) {
    return { ok: false, message: "Company address is required." };
  }

  const companyName = profileData.fullName;

  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: profileData.fullName,
      });
    }

    await updateDoc(doc(db, "users", user.id), {
      ...profileData,
      companyName,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    });

    cachedCurrentUser = {
      ...user,
      ...profileData,
      companyName,
      profileCompleted: true,
    };

    return { ok: true, user: cachedCurrentUser };
  } catch {
    return { ok: false, message: "Could not save profile. Check Firestore rules and try again." };
  }
}

async function saveCurrentUserLetterhead(payload) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  const normalized = normalizeLetterheadPayload(payload);

  if (!normalized.ok) {
    return normalized;
  }

  const { metaRef, chunksRef } = getLetterheadRefs(user.id);
  const existingChunks = await getDocs(chunksRef);
  const uploadedAtIso = new Date().toISOString();
  const chunks = [];

  for (let index = 0; index < normalized.letterhead.dataUrl.length; index += LETTERHEAD_CHUNK_SIZE) {
    chunks.push(normalized.letterhead.dataUrl.slice(index, index + LETTERHEAD_CHUNK_SIZE));
  }

  const letterheadMeta = {
    name: normalized.letterhead.name,
    type: normalized.letterhead.type,
    size: normalized.letterhead.size,
    extension: normalized.letterhead.extension,
    chunkCount: chunks.length,
    dataLength: normalized.letterhead.dataUrl.length,
    pageSize: "A4",
    uploadedAtIso,
  };

  try {
    const batch = writeBatch(db);

    existingChunks.docs.forEach((chunkDoc) => {
      batch.delete(chunkDoc.ref);
    });

    batch.set(metaRef, {
      ...letterheadMeta,
      uploadedAt: serverTimestamp(),
    });

    chunks.forEach((chunk, index) => {
      batch.set(doc(chunksRef, String(index).padStart(4, "0")), {
        order: index,
        data: chunk,
      });
    });

    await batch.commit();
    await updateDoc(doc(db, "users", user.id), {
      letterheadMeta,
      updatedAt: serverTimestamp(),
    });

    cachedCurrentUser = {
      ...user,
      letterheadMeta,
    };

    return {
      ok: true,
      letterhead: {
        ...letterheadMeta,
        dataUrl: normalized.letterhead.dataUrl,
      },
      user: cachedCurrentUser,
    };
  } catch {
    return { ok: false, message: "Could not save letterhead. Check Firestore rules and try again." };
  }
}

async function getCurrentUserLetterhead() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  try {
    const { metaRef, chunksRef } = getLetterheadRefs(user.id);
    const metaSnapshot = await getDoc(metaRef);

    if (!metaSnapshot.exists()) {
      return { ok: true, letterhead: null };
    }

    const meta = metaSnapshot.data() || {};
    const chunkSnapshot = await getDocs(chunksRef);
    const dataUrl = chunkSnapshot.docs
      .map((chunkDoc) => chunkDoc.data() || {})
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      .map((chunk) => String(chunk.data || ""))
      .join("");

    return {
      ok: true,
      letterhead: {
        name: meta.name || "organization-letterhead",
        type: meta.type || "",
        size: Number(meta.size || 0),
        extension: meta.extension || "",
        chunkCount: Number(meta.chunkCount || chunkSnapshot.docs.length),
        dataLength: Number(meta.dataLength || dataUrl.length),
        pageSize: meta.pageSize || "A4",
        uploadedAt: normalizeTimestamp(meta.uploadedAt) || meta.uploadedAtIso || "",
        uploadedAtIso: meta.uploadedAtIso || "",
        dataUrl,
      },
    };
  } catch {
    return { ok: false, message: "Could not load letterhead." };
  }
}

async function removeCurrentUserLetterhead() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  try {
    const { metaRef, chunksRef } = getLetterheadRefs(user.id);
    const chunkSnapshot = await getDocs(chunksRef);
    const batch = writeBatch(db);

    chunkSnapshot.docs.forEach((chunkDoc) => {
      batch.delete(chunkDoc.ref);
    });
    batch.delete(metaRef);

    await batch.commit();
    await updateDoc(doc(db, "users", user.id), {
      letterheadMeta: null,
      updatedAt: serverTimestamp(),
    });

    cachedCurrentUser = {
      ...user,
      letterheadMeta: null,
    };

    return { ok: true, user: cachedCurrentUser };
  } catch {
    return { ok: false, message: "Could not remove letterhead. Check Firestore rules and try again." };
  }
}

async function saveCurrentUserESign(payload) {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  const normalized = normalizeESignPayload(payload);

  if (!normalized.ok) {
    return normalized;
  }

  const { metaRef, chunksRef } = getESignRefs(user.id);
  const existingChunks = await getDocs(chunksRef);
  const uploadedAtIso = new Date().toISOString();
  const chunks = [];

  for (let index = 0; index < normalized.eSign.dataUrl.length; index += LETTERHEAD_CHUNK_SIZE) {
    chunks.push(normalized.eSign.dataUrl.slice(index, index + LETTERHEAD_CHUNK_SIZE));
  }

  const eSignMeta = {
    name: normalized.eSign.name,
    type: normalized.eSign.type,
    size: normalized.eSign.size,
    width: normalized.eSign.width,
    height: normalized.eSign.height,
    extension: normalized.eSign.extension,
    chunkCount: chunks.length,
    dataLength: normalized.eSign.dataUrl.length,
    uploadedAtIso,
  };

  try {
    const batch = writeBatch(db);

    existingChunks.docs.forEach((chunkDoc) => {
      batch.delete(chunkDoc.ref);
    });

    batch.set(metaRef, {
      ...eSignMeta,
      uploadedAt: serverTimestamp(),
    });

    chunks.forEach((chunk, index) => {
      batch.set(doc(chunksRef, String(index).padStart(4, "0")), {
        order: index,
        data: chunk,
      });
    });

    await batch.commit();
    await updateDoc(doc(db, "users", user.id), {
      eSignMeta,
      updatedAt: serverTimestamp(),
    });

    cachedCurrentUser = {
      ...user,
      eSignMeta,
    };

    return {
      ok: true,
      eSign: {
        ...eSignMeta,
        dataUrl: normalized.eSign.dataUrl,
      },
      user: cachedCurrentUser,
    };
  } catch {
    return { ok: false, message: "Could not save e-sign. Check Firestore rules and try again." };
  }
}

async function getCurrentUserESign() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  try {
    const { metaRef, chunksRef } = getESignRefs(user.id);
    const metaSnapshot = await getDoc(metaRef);

    if (!metaSnapshot.exists()) {
      return { ok: true, eSign: null };
    }

    const meta = metaSnapshot.data() || {};
    const chunkSnapshot = await getDocs(chunksRef);
    const dataUrl = chunkSnapshot.docs
      .map((chunkDoc) => chunkDoc.data() || {})
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      .map((chunk) => String(chunk.data || ""))
      .join("");

    return {
      ok: true,
      eSign: {
        name: meta.name || "e-signature",
        type: meta.type || "",
        size: Number(meta.size || 0),
        width: Number(meta.width || 0),
        height: Number(meta.height || 0),
        extension: meta.extension || "",
        chunkCount: Number(meta.chunkCount || chunkSnapshot.docs.length),
        dataLength: Number(meta.dataLength || dataUrl.length),
        uploadedAt: normalizeTimestamp(meta.uploadedAt) || meta.uploadedAtIso || "",
        uploadedAtIso: meta.uploadedAtIso || "",
        dataUrl,
      },
    };
  } catch {
    return { ok: false, message: "Could not load e-sign." };
  }
}

async function removeCurrentUserESign() {
  const configStatus = assertFirebaseConfigured();

  if (!configStatus.ok) {
    return configStatus;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    return { ok: false, message: "Please log in first." };
  }

  try {
    const { metaRef, chunksRef } = getESignRefs(user.id);
    const chunkSnapshot = await getDocs(chunksRef);
    const batch = writeBatch(db);

    chunkSnapshot.docs.forEach((chunkDoc) => {
      batch.delete(chunkDoc.ref);
    });
    batch.delete(metaRef);

    await batch.commit();
    await updateDoc(doc(db, "users", user.id), {
      eSignMeta: null,
      updatedAt: serverTimestamp(),
    });

    cachedCurrentUser = {
      ...user,
      eSignMeta: null,
    };

    return { ok: true, user: cachedCurrentUser };
  } catch {
    return { ok: false, message: "Could not remove e-sign. Check Firestore rules and try again." };
  }
}

function getCurrentPageName() {
  const pageName = window.location.pathname.split("/").pop();
  return pageName || "index.html";
}

function getModuleForPage(pageName) {
  return BANIK_MODULES.find((module) => module.pages.includes(pageName));
}

function canUserAccessPage(user, pageName) {
  if (pageName === "index.html") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (pageName === "signup.html") {
    return true;
  }

  if (!user.profileCompleted) {
    return false;
  }

  if (user.role === "admin" || pageName === "workspace.html") {
    return true;
  }

  if (pageName === "admin.html") {
    return false;
  }

  const module = getModuleForPage(pageName);
  return module ? Boolean(user.permissions && user.permissions[module.key]) : true;
}

function renderSetupMissing() {
  document.body.innerHTML = `
    <div class="page-shell detail-page">
      <header class="topbar">
        <a class="brand" href="./index.html">
          <span class="brand-mark" aria-hidden="true"><img src="./assets/banik-logo.svg" alt="" /></span>
          <span class="brand-copy">
            <span class="brand-copy__title">BANIK Books</span>
            <span class="brand-copy__tag">Firebase setup</span>
          </span>
        </a>
      </header>
      <main class="detail-card access-denied-card">
        <p class="sheet-header__eyebrow">Setup needed</p>
        <h1>Firebase config is missing</h1>
        <p class="lead">Paste your Firebase web app config into firebase-config.js to enable signup, login, and cloud data.</p>
      </main>
    </div>
  `;
}

function renderAccessDenied(pageName) {
  document.body.innerHTML = `
    <div class="page-shell detail-page">
      <header class="topbar">
        <a class="brand" href="./workspace.html">
          <span class="brand-mark" aria-hidden="true"><img src="./assets/banik-logo.svg" alt="" /></span>
          <span class="brand-copy">
            <span class="brand-copy__title">BANIK Books</span>
            <span class="brand-copy__tag">Access control</span>
          </span>
        </a>
      </header>
      <main class="detail-card access-denied-card">
        <p class="sheet-header__eyebrow">Access denied</p>
        <h1>This page is not enabled for your account</h1>
        <p class="lead">Ask the BANIK Books admin to enable access for ${pageName}.</p>
        <a class="secondary-button" href="./workspace.html">Back to workspace</a>
      </main>
    </div>
  `;
}

async function protectBanikPage() {
  const pageName = getCurrentPageName();

  if (!isFirebaseConfigured && pageName !== "index.html") {
    renderSetupMissing();
    return null;
  }

  if (pageName === "index.html") {
    return null;
  }

  const user = await getCurrentBanikUser();

  if (!user) {
    window.location.href = "./index.html";
    return null;
  }

  if (!user.profileCompleted && pageName !== "signup.html") {
    window.location.href = "./signup.html";
    return null;
  }

  if (!canUserAccessPage(user, pageName)) {
    renderAccessDenied(pageName);
    return null;
  }

  return user;
}

function renderAuthControls(user) {
  const targets = document.querySelectorAll("[data-auth-controls]");

  targets.forEach((target) => {
    if (!user) {
      target.innerHTML = "";
      return;
    }

    target.innerHTML = `
      <span class="auth-user-chip">${user.role === "admin" ? "Admin" : user.companyName}</span>
      ${user.role === "admin" ? '<a class="auth-link" href="./admin.html">Admin Panel</a>' : ""}
      <button class="auth-logout-button" type="button" data-auth-logout>Sign Out</button>
    `;
  });
}

function applyWorkspacePermissions(user) {
  if (!user || user.role === "admin") {
    return;
  }

  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const pageName = href.replace("./", "").split("#")[0].split("?")[0];
    const module = getModuleForPage(pageName);

    if (!module || canUserAccessPage(user, pageName)) {
      return;
    }

    link.classList.add("is-access-disabled");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.alert("This page is not enabled for your account yet.");
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await protectBanikPage();
  renderAuthControls(user || cachedCurrentUser);
  applyWorkspacePermissions(user || cachedCurrentUser);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-auth-logout]")) {
      logoutBanikUser();
    }
  });
});

window.BanikAuth = {
  modules: BANIK_MODULES,
  getUsers: getAuthUsers,
  getCurrentUser: getCurrentBanikUser,
  register: registerBanikUser,
  login: loginBanikUser,
  logout: logoutBanikUser,
  updateUserPermission,
  updateProfile: updateCurrentUserProfile,
  saveLetterhead: saveCurrentUserLetterhead,
  getLetterhead: getCurrentUserLetterhead,
  removeLetterhead: removeCurrentUserLetterhead,
  saveESign: saveCurrentUserESign,
  getESign: getCurrentUserESign,
  removeESign: removeCurrentUserESign,
  createPermissionMap,
  isConfigured: isFirebaseConfigured,
};
