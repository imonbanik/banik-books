import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const remotePort = 9224;
const reportId = "3eb142ce-553a-4a2d-9958-710f5dae2a67";
const pageId = process.argv[2] || "p_irjl2oar8c";
const requestedScrollTop = Number(process.argv[3]);
const url = `https://lookerstudio.google.com/embed/reporting/${reportId}/page/${pageId}`;

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

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-sync",
  `--remote-debugging-port=${remotePort}`,
  "--window-size=1600,2400",
  "--user-data-dir=/private/tmp/banik-looker-cdp-profile",
  "about:blank",
], {
  stdio: ["ignore", "ignore", "pipe"],
});

chrome.stderr.on("data", () => {});

try {
  await waitForJson(`http://127.0.0.1:${remotePort}/json/version`);
  let targetResponse = await fetch(`http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!targetResponse.ok) {
    targetResponse = await fetch(`http://127.0.0.1:${remotePort}/json/list`);
  }
  const targetPayload = await targetResponse.json();
  const target = Array.isArray(targetPayload) ? targetPayload[0] : targetPayload;
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  if (target.url === "about:blank") {
    await cdp.send("Page.navigate", { url });
  }
  await sleep(18000);

  const snapshot = await evaluate(cdp, `(() => {
    const table = document.querySelector("upgraded-table");
    const rows = [...document.querySelectorAll("upgraded-table .row")]
      .filter((row) => row.querySelectorAll(".cell").length > 1);
    const scrollers = [...document.querySelectorAll("*")]
      .filter((el) => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 100)
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        cls: el.className?.toString?.() || "",
        id: el.id || "",
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        text: el.innerText?.slice(0, 120) || ""
      }));
    return {
      title: document.title,
      pageText: document.body.innerText.slice(0, 2000),
      pageLabel: document.querySelector(".pageLabel")?.textContent?.trim() || "",
      rows: rows.length,
      firstRow: rows[0]?.innerText || "",
      lastRow: rows[rows.length - 1]?.innerText || "",
      headers: [...document.querySelectorAll("upgraded-table .headerCell, upgraded-table .header-cell, upgraded-table .dimensionHeaderCell, upgraded-table .metricHeaderCell")]
        .map((el) => el.textContent.trim())
        .filter(Boolean),
      scrollers,
      tableClass: table?.className?.toString?.() || "",
      tableText: table?.innerText?.slice(0, 5000) || ""
    };
  })()`);

  const scrollTargetExpression = Number.isFinite(requestedScrollTop)
    ? String(Math.max(0, Math.floor(requestedScrollTop)))
    : "Math.floor(scroller.scrollHeight - scroller.clientHeight)";
  const scrollCheck = await evaluate(cdp, `(async () => {
    const scrollers = [...document.querySelectorAll("*")]
      .filter((el) => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 100)
      .sort((a, b) => b.scrollHeight - a.scrollHeight);
    const reads = [];
    const readRows = () => {
      const rows = [...document.querySelectorAll("upgraded-table .row")]
        .filter((row) => row.querySelectorAll(".cell").length > 1);
      return {
        first: rows[0]?.innerText || "",
        last: rows[rows.length - 1]?.innerText || "",
        classes: rows.slice(0, 3).map((row) => row.className?.toString?.() || "")
      };
    };
    for (const scroller of scrollers.slice(0, 3)) {
      scroller.scrollTop = ${scrollTargetExpression};
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 400));
      reads.push({
        cls: scroller.className?.toString?.() || "",
        top: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        rows: readRows()
      });
    }
    return reads;
  })()`);

  snapshot.scrollCheck = scrollCheck;

  await fs.writeFile(`/private/tmp/looker-${pageId}-inspect.json`, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
  cdp.close();
} finally {
  chrome.kill("SIGTERM");
  await once(chrome, "exit").catch(() => {});
}
