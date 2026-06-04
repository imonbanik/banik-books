import { spawnSync } from "node:child_process";
import path from "node:path";

const ALLOWED_ENV_EXAMPLES = new Set([
  ".env.example",
  ".env.production.example",
  ".env.staging.example",
]);

const FORBIDDEN_BASENAME_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /service[-_]?account.*\.json$/i,
  /serviceaccount.*\.json$/i,
  /^serviceAccountKey\.json$/i,
  /firebase[-_]?service[-_]?account.*\.json$/i,
  /google[-_]?application[-_]?credentials.*\.json$/i,
  /\.(?:pem|key|p12)$/i,
];

function isForbiddenTrackedFile(filePath) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalizedPath);

  if (ALLOWED_ENV_EXAMPLES.has(normalizedPath)) {
    return false;
  }

  return FORBIDDEN_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
}

const result = spawnSync("git", ["ls-files"], {
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "Could not inspect tracked files.\n");
  process.exit(result.status || 1);
}

const violations = result.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(isForbiddenTrackedFile);

if (violations.length) {
  console.error("Secret-like files are tracked by git:");
  violations.forEach((filePath) => console.error(`- ${filePath}`));
  console.error("Remove them from git and rotate any exposed credentials.");
  process.exit(1);
}

console.log("ok no tracked env secrets or private credential files");
