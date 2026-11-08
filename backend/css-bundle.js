const fs = require("node:fs");
const path = require("node:path");

const IMPORT_RULE = /@import\s+["']([^"']+)["']\s*;/g;
const URL_VALUE = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

function stripComments(css) {
  let output = "";
  let quote = "";

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];

    if (quote) {
      output += character;
      if (character === "\\") {
        index += 1;
        output += css[index] || "";
      } else if (character === quote) {
        quote = "";
      }
    } else if (character === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 1;
    } else {
      if (character === '"' || character === "'") quote = character;
      output += character;
    }
  }

  return output;
}

function inlineImports(filePath, ancestors = []) {
  if (ancestors.includes(filePath)) {
    throw new Error(`CSS import loop at ${filePath}`);
  }

  return stripComments(fs.readFileSync(filePath, "utf8")).replace(IMPORT_RULE, (_rule, target) =>
    inlineImports(path.resolve(path.dirname(filePath), target), [...ancestors, filePath])
  );
}

function buildCssBundle(entryPath, { version = "" } = {}) {
  const css = inlineImports(entryPath)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (css.includes("@import")) {
    throw new Error('Only plain @import "./file.css"; rules can be combined.');
  }

  // The bundle is served from a different folder than its sources, so relative paths would break.
  return css.replace(URL_VALUE, (match, target) => {
    if (target.startsWith("data:")) return match;
    if (!target.startsWith("/assets/")) throw new Error(`CSS url() must start with /assets/: ${target}`);
    return `url("${target}${version ? `?v=${version}` : ""}")`;
  });
}

module.exports = { buildCssBundle };
