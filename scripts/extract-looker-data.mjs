import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const remotePort = 9225 + Math.floor(Math.random() * 500);
const reportId = "3eb142ce-553a-4a2d-9958-710f5dae2a67";
const baseUrl = `https://lookerstudio.google.com/embed/reporting/${reportId}/page`;
const outputPath = process.argv[2] || "/private/tmp/ace-rate-finder-data.json";

const requestedKeys = new Set((process.env.LOOKER_PAGES || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean));

const pages = [
  { key: "Tax", sheetName: "TDS TCS Rates", pageId: "p_fw4duobr8c" },
  { key: "VAT", sheetName: "VAT VDS Rates", pageId: "p_irjl2oar8c" },
  { key: "Customs", sheetName: "Customs Rates", pageId: "p_ryhl7xnfud" },
].filter((page) => !requestedKeys.size || requestedKeys.has(page.key));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(urlToFetch, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(urlToFetch);
      if (response.ok) return response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${urlToFetch}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(JSON.stringify(payload.error)));
      else resolve(payload.result);
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        ws,
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", reject, { once: true });
  });
}

async function evaluate(cdp, expression, timeoutMs = 30000) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

function cleanHeader(header) {
  return String(header || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part && !/^[0-9]+$/.test(part) && !/^[▲▼↕]+$/.test(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+[0-9]+$/, "")
    .trim();
}

async function waitForTable(cdp) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const ready = await evaluate(cdp, `(() => {
      return Boolean(document.querySelector("upgraded-table .row .cell") && document.querySelector(".pageLabel"));
    })()`);
    if (ready) return;
    await sleep(500);
  }
  throw new Error("Timed out waiting for Looker Studio table");
}

async function extractCurrentRows(cdp) {
  return evaluate(cdp, `(() => {
    const table = document.querySelector("upgraded-table");
    const rows = [...(table?.querySelectorAll(".row") || [])]
      .filter((row) => row.querySelectorAll(".cell").length > 1);
    return rows.map((row) => {
      const className = String(row.className || "");
      const blockMatch = className.match(/\\bblock-(\\d+)\\b/);
      const indexMatch = className.match(/\\bindex-(\\d+)\\b/);
      const block = blockMatch ? Number(blockMatch[1]) : 0;
      const visualIndex = indexMatch ? Number(indexMatch[1]) : null;
      const index = Number.isInteger(visualIndex) ? (block * 60) + visualIndex : null;
      const cells = [...row.querySelectorAll(":scope > .cell")].map((cell) => {
        const title = cell.getAttribute("title");
        const text = cell.textContent || "";
        return (title ?? text).replace(/\\s+/g, " ").trim();
      });
      return { index, cells };
    });
  })()`);
}

async function getTableMeta(cdp) {
  return evaluate(cdp, `(() => {
    const table = document.querySelector("upgraded-table");
    const scroller = [...document.querySelectorAll("*")]
      .filter((el) => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 100)
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    const pageLabel = document.querySelector(".pageLabel")?.textContent?.trim() || "";
    const total = Number((pageLabel.match(/\\/\\s*([0-9,]+)/) || [])[1]?.replace(/,/g, "") || 0);
    const headers = [...(table?.querySelectorAll(".headerCell, .header-cell, .dimensionHeaderCell, .metricHeaderCell") || [])]
      .map((el) => el.getAttribute("title") || el.innerText || el.textContent || "")
      .filter(Boolean);
    return {
      title: document.title,
      pageLabel,
      total,
      headers,
      scrollHeight: scroller?.scrollHeight || 0,
      clientHeight: scroller?.clientHeight || 0,
      scrollerClass: scroller?.className?.toString?.() || ""
    };
  })()`);
}

async function scrollTo(cdp, position) {
  return evaluate(cdp, `(async () => {
    const scroller = [...document.querySelectorAll("*")]
      .filter((el) => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 100)
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    scroller.scrollTop = ${Math.max(0, Math.floor(position))};
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 650));
    return {
      top: scroller.scrollTop,
      className: scroller.className?.toString?.() || "",
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      text: scroller.innerText?.slice(0, 80) || ""
    };
  })()`);
}

async function extractPage(cdp, page) {
  const url = `${baseUrl}/${page.pageId}`;
  console.log(`Loading ${page.key}: ${url}`);
  await cdp.send("Page.navigate", { url });
  await waitForTable(cdp);
  await sleep(1500);

  const meta = await getTableMeta(cdp);
  meta.headers = meta.headers.map(cleanHeader);
  const total = meta.total;
  const rowsByIndex = new Map();
  const totalBlocks = total ? Math.ceil(total / 60) : 0;
  const processedPositionBuckets = new Set();
  let lastMaxScroll = -1;

  for (let pass = 0; pass < 8; pass += 1) {
    const passMeta = pass === 0 ? meta : await getTableMeta(cdp);
    const maxScroll = Math.max(0, passMeta.scrollHeight - passMeta.clientHeight);
    const rowHeight = total ? passMeta.scrollHeight / total : 30;
    const positions = new Set([0, maxScroll]);

    if (totalBlocks) {
      for (let block = 0; block < totalBlocks; block += 1) {
        positions.add(Math.floor(block * 60 * rowHeight));
      }
    } else {
      const step = Math.max(550, Math.floor(rowHeight * 34));
      for (let position = 0; position <= maxScroll; position += step) {
        positions.add(position);
      }
    }

    let newPositions = 0;
    for (const position of [...positions].sort((a, b) => a - b)) {
      const bucket = Math.round(position / 75);
      if (processedPositionBuckets.has(bucket)) continue;
      processedPositionBuckets.add(bucket);
      newPositions += 1;

      const actualTop = await scrollTo(cdp, position);
      const rows = await extractCurrentRows(cdp);
      if (process.env.DEBUG_LOOKER_SCROLL === "1" && position > maxScroll * 0.75) {
        console.log(`${page.key}: debug pass ${pass + 1} target ${Math.floor(position)} actual ${Math.floor(actualTop.top)} scroller ${actualTop.className} h ${actualTop.scrollHeight}/${actualTop.clientHeight} firstIndex ${rows[0]?.index} firstValue ${rows[0]?.cells?.[1] || ""}`);
      }
      for (const row of rows) {
        if (Number.isInteger(row.index) && row.cells.length) {
          rowsByIndex.set(row.index, row.cells);
        }
      }
      if (rowsByIndex.size && rowsByIndex.size % 1000 < 60) {
        console.log(`${page.key}: collected ${rowsByIndex.size}/${total}`);
      }
    }

    if (rowsByIndex.size >= total) break;
    if (newPositions === 0 && maxScroll <= lastMaxScroll + 75) break;
    lastMaxScroll = maxScroll;
  }

  const missing = [];
  for (let index = 0; index < total; index += 1) {
    if (!rowsByIndex.has(index)) missing.push(index);
  }

  const recoveryMeta = await getTableMeta(cdp);
  const recoveryRowHeight = total ? recoveryMeta.scrollHeight / total : 30;
  const recoveryMaxScroll = Math.max(0, recoveryMeta.scrollHeight - recoveryMeta.clientHeight);
  const missingBlocks = [...new Set(missing.map((index) => Math.floor(index / 60)))];
  for (const block of missingBlocks) {
    const blockTopIndex = block * 60;
    await scrollTo(cdp, Math.min(recoveryMaxScroll, Math.max(0, Math.floor(blockTopIndex * recoveryRowHeight))));
    const rows = await extractCurrentRows(cdp);
    for (const row of rows) {
      if (Number.isInteger(row.index) && row.cells.length) {
        rowsByIndex.set(row.index, row.cells);
      }
    }
  }

  for (let tailPass = 0; tailPass < 4; tailPass += 1) {
    const tailMeta = await getTableMeta(cdp);
    await scrollTo(cdp, Math.max(0, tailMeta.scrollHeight - tailMeta.clientHeight));
    const rows = await extractCurrentRows(cdp);
    for (const row of rows) {
      if (Number.isInteger(row.index) && row.cells.length) {
        rowsByIndex.set(row.index, row.cells);
      }
    }
  }

  const finalMissing = [];
  for (let index = 0; index < total; index += 1) {
    if (!rowsByIndex.has(index)) finalMissing.push(index);
  }

  const rows = [...rowsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, cells]) => ({ index, cells }));

  console.log(`${page.key}: final ${rows.length}/${total}, missing ${finalMissing.length}`);
  return {
    ...page,
    sourceUrl: url,
    extractedAt: new Date().toISOString(),
    meta,
    total,
    missing: finalMissing,
    rows,
  };
}

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-sync",
  `--remote-debugging-port=${remotePort}`,
  "--window-size=1600,2400",
  `--user-data-dir=/private/tmp/banik-looker-extract-profile-${Date.now()}`,
  "about:blank",
], {
  stdio: ["ignore", "ignore", "pipe"],
});

chrome.stderr.on("data", () => {});

try {
  await waitForJson(`http://127.0.0.1:${remotePort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${remotePort}/json/new?about%3Ablank`, {
    method: "PUT",
  });
  const target = await targetResponse.json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const datasets = [];
  for (const page of pages) {
    datasets.push(await extractPage(cdp, page));
  }

  const payload = {
    reportId,
    source: "ACE Advisory public Looker Studio Rate Finder",
    sourceUrl: `https://aceadvisory.biz/tools/rate-finder`,
    extractedAt: new Date().toISOString(),
    datasets,
  };

  await fs.mkdir(new URL(".", `file://${outputPath}`).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Saved ${outputPath}`);
  cdp.close();
} finally {
  if (chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome, "exit"), sleep(5000)]).catch(() => {});
  }
}
