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

async function assertOptionalCredentialsFile() {
  const credentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();

  if (!credentialsPath) {
    console.log("warn GOOGLE_APPLICATION_CREDENTIALS is not set; relying on host ADC.");
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
  await assertOptionalCredentialsFile();
  console.log("Production config checks passed.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
