import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SOURCE_DIRS = ["js", "pages"];
const BUSINESS_DATA_KEYS = [
  "banikBooksJournalEntries",
  "banikBooksParties",
  "banikBooksChartOfAccounts",
  "banikBooksLedgers",
  "banikBooksAccountingPreferences",
  "banikBooksChequePrinterPayees",
  "banikBooksChallanRegisterEntries",
];

async function listFiles(dir) {
  const entries = await fs.readdir(path.join(ROOT_DIR, dir), { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listFiles(entryPath);
      }

      return /\.(html|js)$/i.test(entry.name) ? [entryPath] : [];
    })
  );

  return files.flat();
}

function classifyLine(line) {
  if (!line.includes("localStorage")) {
    return "";
  }

  const isBusinessKey = BUSINESS_DATA_KEYS.some((key) => line.includes(key));

  if (isBusinessKey) {
    return "backend-backed-cache";
  }

  return "ui-local-state";
}

async function run() {
  const files = (await Promise.all(SOURCE_DIRS.map(listFiles))).flat().sort();
  const findings = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(ROOT_DIR, file), "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      const classification = classifyLine(line);

      if (classification) {
        findings.push({
          file,
          line: index + 1,
          classification,
          text: line.trim(),
        });
      }
    });
  }

  const businessCacheCount = findings.filter(
    (finding) => finding.classification === "backend-backed-cache"
  ).length;
  const uiStateCount = findings.length - businessCacheCount;

  console.log(
    `localStorage audit: ${businessCacheCount} backend-backed cache lines, ${uiStateCount} UI-local state lines.`
  );

  findings
    .filter((finding) => finding.classification === "backend-backed-cache")
    .forEach((finding) => {
      console.log(`${finding.classification} ${finding.file}:${finding.line} ${finding.text}`);
    });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
