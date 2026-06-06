import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function assertEnv(name, expectedValue) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  if (expectedValue && value.toLowerCase() !== expectedValue) {
    throw new Error(`${name} must be ${expectedValue}. Current value: ${value}`);
  }

  return value;
}

function assertOptionalServiceAccountJson() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (!rawJson) {
    return false;
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(rawJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const requiredFields = ["project_id", "client_email", "private_key"];
  const missingFields = requiredFields.filter((field) => !String(serviceAccount[field] || "").trim());

  if (missingFields.length) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is missing: ${missingFields.join(", ")}.`);
  }

  console.log("ok FIREBASE_SERVICE_ACCOUNT_JSON is configured");
  return true;
}

async function assertOptionalCredentials() {
  if (assertOptionalServiceAccountJson()) {
    return;
  }

  const credentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();

  if (!credentialsPath) {
    console.log(
      "warn FIREBASE_SERVICE_ACCOUNT_JSON and GOOGLE_APPLICATION_CREDENTIALS are not set; relying on host ADC."
    );
    return;
  }

  await fs.access(credentialsPath);
  console.log("ok GOOGLE_APPLICATION_CREDENTIALS file is readable");
}

function assertFirebaseAdminInstalled() {
  require("firebase-admin/app");
  require("firebase-admin/auth");
  require("firebase-admin/firestore");
  console.log("ok firebase-admin package is installed");
}

async function run() {
  assertEnv("BANIK_API_REQUIRE_AUTH", "true");
  assertEnv("BANIK_API_AUTH_PROVIDER", "firebase");
  assertEnv("BANIK_STORAGE_ADAPTER", "firebase");
  assertEnv("BANIK_FIRESTORE_ROOT_COLLECTION");
  assertEnv("BANIK_ADMIN_EMAILS");

  const trustUnverifiedToken = String(process.env.BANIK_API_TRUST_UNVERIFIED_TOKEN || "")
    .trim()
    .toLowerCase();

  if (trustUnverifiedToken === "true") {
    throw new Error("BANIK_API_TRUST_UNVERIFIED_TOKEN must not be true in production.");
  }

  assertFirebaseAdminInstalled();
  await assertOptionalCredentials();
  console.log("Production config checks passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
