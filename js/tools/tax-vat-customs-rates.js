(() => {
  const RATE_SOURCES = [
    {
      key: "tax",
      label: "Tax",
      url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=157320309&single=true&output=csv",
    },
    {
      key: "vat",
      label: "VAT",
      url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=1347947834&single=true&output=csv",
    },
    {
      key: "customs",
      label: "Customs",
      url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvytUuGCejzOfJMRKS4xqk9p8PwZhataapcgCDcR1M_N7PNyMDv-gwBUdYEFcbqZNACMBxHxpkmsy/pub?gid=568506434&single=true&output=csv",
    },
  ];

  const RATE_CONFIG = {
    tax: { label: "Tax", title: "TDS TCS Rates" },
    vat: { label: "VAT", title: "VAT VDS Rates" },
    customs: { label: "Customs", title: "Customs Rates" },
  };
  const RATE_ORDER = ["tax", "vat", "customs"];

  const state = {
    activeKey: "tax",
    datasets: {},
    errors: [],
    searchTerm: "",
    selectedRowId: "",
    sorts: {
      tax: { column: null, direction: "asc" },
      vat: { column: null, direction: "asc" },
      customs: { column: null, direction: "asc" },
    },
    filters: {
      tax: {},
      vat: {},
      customs: {},
    },
  };

  const elements = {
    tabs: document.getElementById("rateTabs"),
    search: document.getElementById("rateSearchInput"),
    status: document.getElementById("rateStatus"),
    refresh: document.getElementById("rateRefreshButton"),
    overview: document.getElementById("rateOverview"),
    table: document.getElementById("rateTable"),
    tableHead: document.getElementById("rateTableHead"),
    tableBody: document.getElementById("rateTableBody"),
    detail: document.getElementById("rateDetailCard"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseCsv(csvText) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const text = String(csvText || "").replace(/^\uFEFF/, "");

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (quoted) {
        if (char === '"' && nextChar === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(cell.trim());
        cell = "";
      } else if (char === "\n") {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      } else if (char !== "\r") {
        cell += char;
      }
    }

    if (cell || row.length) {
      row.push(cell.trim());
      rows.push(row);
    }

    return rows;
  }

  function headerScore(row) {
    const joined = row.join(" ").toLowerCase();
    let score = 0;

    [
      "tax section",
      "tax rule",
      "tax rate",
      "supply details",
      "vds applicability",
      "hs/service code",
      "hs code",
      "cd rate",
      "sd rate",
      "tti rate",
    ].forEach((token) => {
      if (joined.includes(token)) {
        score += 1;
      }
    });

    return score;
  }

  function dedupeHeaders(headers) {
    const seen = {};
    return headers.map((header, index) => {
      const cleanHeader = String(header || "").trim() || `Column ${index + 1}`;
      const key = cleanHeader.toLowerCase();
      seen[key] = (seen[key] || 0) + 1;
      return seen[key] === 1 ? cleanHeader : `${cleanHeader} ${seen[key]}`;
    });
  }

  function detectDatasetKey(headers, title, fallbackKey) {
    const joined = [...headers, title].join(" ").toLowerCase();

    if (joined.includes("hs code") && joined.includes("cd rate")) {
      return "customs";
    }

    if (joined.includes("vds applicability") || joined.includes("hs/service code")) {
      return "vat";
    }

    if (joined.includes("tax section") || joined.includes("tax rule")) {
      return "tax";
    }

    return fallbackKey;
  }

  function normalizeDataset(source, csvText) {
    const allRows = parseCsv(csvText)
      .map((row) => row.map((cell) => String(cell || "").trim()))
      .filter((row) => row.some(Boolean));
    const scoredRows = allRows.map((row, index) => ({ index, score: headerScore(row) }));
    const bestHeader = scoredRows.reduce(
      (best, item) => (item.score > best.score ? item : best),
      { index: 0, score: 0 }
    );
    const headerIndex = bestHeader.score > 0 ? bestHeader.index : 0;
    const titleRow = headerIndex > 0 ? allRows.slice(0, headerIndex).find((row) => row.some(Boolean)) : null;
    const headers = dedupeHeaders(allRows[headerIndex] || []);
    const key = detectDatasetKey(headers, titleRow ? titleRow.join(" ") : "", source.key);
    const rows = allRows
      .slice(headerIndex + 1)
      .filter((row) => row.some(Boolean))
      .map((row, index) => {
        const cells = headers.map((_, cellIndex) => row[cellIndex] || "");
        return {
          id: `${key}-${index}`,
          index,
          cells,
          searchText: cells.join(" ").toLowerCase(),
        };
      });

    return {
      key,
      label: RATE_CONFIG[key]?.label || source.label,
      title: titleRow ? titleRow.join(" ") : RATE_CONFIG[key]?.title || source.label,
      headers,
      rows,
      loadedAt: new Date(),
    };
  }

  async function fetchCsv(source) {
    const endpoints = [
      source.url,
      `./rate-finder-csv?source=${encodeURIComponent(source.key)}`,
    ];
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        if (!text.trim() || text.trim().startsWith("<")) {
          throw new Error("CSV response was empty or invalid");
        }

        return text;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Could not load CSV");
  }

  async function loadRateData() {
    elements.status.textContent = "Loading rates...";
    elements.refresh.disabled = true;
    elements.tableBody.innerHTML = '<tr><td class="rate-loading-cell">Loading...</td></tr>';
    elements.detail.innerHTML = '<div class="rate-detail-empty">No row selected</div>';
    state.errors = [];
    state.selectedRowId = "";

    const results = await Promise.allSettled(
      RATE_SOURCES.map(async (source) => normalizeDataset(source, await fetchCsv(source)))
    );
    state.datasets = {};

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        state.datasets[result.value.key] = result.value;
      } else {
        state.errors.push(`${RATE_SOURCES[index].label}: ${result.reason?.message || "Failed"}`);
      }
    });

    const availableKey = RATE_ORDER.find((key) => state.datasets[key]);
    state.activeKey = state.datasets[state.activeKey] ? state.activeKey : availableKey || "tax";
    elements.refresh.disabled = false;
    renderAll();
  }

  function getActiveDataset() {
    return state.datasets[state.activeKey] || null;
  }

  function parseComparable(value) {
    const text = String(value || "").trim();
    const numericText = text.replace(/[%৳$, ]/g, "");
    const numeric = Number(numericText);

    if (text && numericText && !Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(numericText)) {
      return { type: "number", value: numeric };
    }

    return { type: "text", value: text.toLowerCase() };
  }

  function compareCells(left, right, direction) {
    const leftValue = parseComparable(left);
    const rightValue = parseComparable(right);
    let result = 0;

    if (leftValue.type === "number" && rightValue.type === "number") {
      result = leftValue.value - rightValue.value;
    } else {
      result = String(leftValue.value).localeCompare(String(rightValue.value), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    return direction === "desc" ? result * -1 : result;
  }

  function getVisibleRows(dataset) {
    const search = state.searchTerm.trim().toLowerCase();
    const sort = state.sorts[dataset.key] || { column: null, direction: "asc" };
    const filters = state.filters[dataset.key] || {};
    const rows = search
      ? dataset.rows.filter((row) => row.searchText.includes(search))
      : [...dataset.rows];
    const filteredRows = rows.filter((row) =>
      Object.entries(filters).every(([column, value]) => {
        if (!value) {
          return true;
        }

        return row.cells[Number(column)] === value;
      })
    );

    if (sort.column !== null) {
      filteredRows.sort((left, right) =>
        compareCells(left.cells[sort.column], right.cells[sort.column], sort.direction)
      );
    }

    return filteredRows;
  }

  function getColumnFilterOptions(dataset, columnIndex) {
    const search = state.searchTerm.trim().toLowerCase();
    const values = new Set();

    dataset.rows.forEach((row) => {
      if (search && !row.searchText.includes(search)) {
        return;
      }

      const value = row.cells[columnIndex] || "";
      if (value) {
        values.add(value);
      }
    });

    return [...values].sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    );
  }

  function renderTabs() {
    RATE_ORDER.forEach((key) => {
      const button = elements.tabs.querySelector(`[data-rate-tab="${key}"]`);
      const dataset = state.datasets[key];
      if (!button) return;

      button.classList.toggle("is-active", key === state.activeKey);
      button.disabled = !dataset;
      button.querySelector("strong").textContent = dataset ? dataset.rows.length.toLocaleString("en-IN") : "0";
    });
  }

  function renderOverview(dataset, visibleRows) {
    if (!dataset) {
      elements.overview.innerHTML = "";
      return;
    }

    const rateFieldCount = dataset.headers.filter((header) =>
      header.toLowerCase().includes("rate")
    ).length;
    const selectedRow = dataset.rows.find((row) => row.id === state.selectedRowId);

    elements.overview.innerHTML = `
      <div class="rate-metric-card">
        <span>Records</span>
        <strong>${dataset.rows.length.toLocaleString("en-IN")}</strong>
      </div>
      <div class="rate-metric-card">
        <span>Visible</span>
        <strong>${visibleRows.length.toLocaleString("en-IN")}</strong>
      </div>
      <div class="rate-metric-card">
        <span>Rate fields</span>
        <strong>${rateFieldCount.toLocaleString("en-IN")}</strong>
      </div>
      <div class="rate-metric-card">
        <span>Selected</span>
        <strong>${selectedRow ? `#${selectedRow.index + 1}` : "None"}</strong>
      </div>
    `;
  }

  function renderStatus(dataset, visibleRows) {
    if (!dataset) {
      elements.status.textContent = state.errors.length
        ? "Could not load rates."
        : "No data available.";
      return;
    }

    const errorNote = state.errors.length ? ` | ${state.errors.length} source failed` : "";
    elements.status.textContent = `${dataset.label}: ${visibleRows.length.toLocaleString(
      "en-IN"
    )} of ${dataset.rows.length.toLocaleString("en-IN")} rows${errorNote}`;
  }

  function renderTable(dataset, visibleRows) {
    if (!dataset) {
      elements.tableHead.innerHTML = "";
      elements.tableBody.innerHTML =
        '<tr><td class="rate-loading-cell">No rate data loaded.</td></tr>';
      elements.table.classList.remove("has-selection");
      return;
    }

    const sort = state.sorts[dataset.key] || { column: null, direction: "asc" };
    const filters = state.filters[dataset.key] || {};
    elements.table.classList.toggle("has-selection", Boolean(state.selectedRowId));
    elements.tableHead.innerHTML = `
      <tr>
        ${dataset.headers
          .map((header, index) => {
            const active = sort.column === index;
            const direction = active ? sort.direction : "";
            const filterOptions = getColumnFilterOptions(dataset, index);
            const selectedFilter = filters[index] || "";
            return `
              <th>
                <div class="rate-column-head">
                  <button
                    class="rate-sort-button${active ? " is-active" : ""}"
                    type="button"
                    data-rate-sort="${index}"
                    data-direction="${direction}"
                  >
                    ${escapeHtml(header)}
                  </button>
                  <select
                    class="rate-column-filter"
                    data-rate-filter="${index}"
                    aria-label="Filter ${escapeHtml(header)}"
                  >
                    <option value="">All</option>
                    ${filterOptions
                      .map(
                        (value) => `
                          <option value="${escapeHtml(value)}" ${
                            value === selectedFilter ? "selected" : ""
                          }>${escapeHtml(value)}</option>
                        `
                      )
                      .join("")}
                  </select>
                </div>
              </th>
            `;
          })
          .join("")}
      </tr>
    `;

    if (!visibleRows.length) {
      elements.tableBody.innerHTML = `<tr><td class="rate-loading-cell" colspan="${dataset.headers.length}">No matching rows.</td></tr>`;
      return;
    }

    elements.tableBody.innerHTML = visibleRows
      .map(
        (row) => `
          <tr data-rate-row="${escapeHtml(row.id)}" class="${row.id === state.selectedRowId ? "is-selected" : ""}">
            ${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
          </tr>
        `
      )
      .join("");
  }

  function renderDetail(dataset) {
    const selectedRow = dataset?.rows.find((row) => row.id === state.selectedRowId);

    if (!dataset || !selectedRow) {
      elements.detail.innerHTML = '<div class="rate-detail-empty">No row selected</div>';
      return;
    }

    elements.detail.innerHTML = `
      <div class="rate-detail-head">
        <span>${escapeHtml(dataset.label)}</span>
        <strong>Row ${selectedRow.index + 1}</strong>
      </div>
      <div class="rate-detail-grid">
        ${dataset.headers
          .map(
            (header, index) => `
              <div class="rate-detail-item">
                <span>${escapeHtml(header)}</span>
                <strong>${escapeHtml(selectedRow.cells[index] || "-")}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <button class="rate-clear-button" type="button" data-clear-rate-selection>
        Clear selection
      </button>
    `;
  }

  function renderAll() {
    const dataset = getActiveDataset();
    const visibleRows = dataset ? getVisibleRows(dataset) : [];

    if (dataset && state.selectedRowId && !visibleRows.some((row) => row.id === state.selectedRowId)) {
      state.selectedRowId = "";
    }

    renderTabs();
    renderOverview(dataset, visibleRows);
    renderStatus(dataset, visibleRows);
    renderTable(dataset, visibleRows);
    renderDetail(dataset);
  }

  elements.tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rate-tab]");
    if (!button || button.disabled) return;

    state.activeKey = button.dataset.rateTab;
    state.selectedRowId = "";
    renderAll();
  });

  elements.search.addEventListener("input", () => {
    state.searchTerm = elements.search.value;
    renderAll();
  });

  elements.tableHead.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rate-sort]");
    const dataset = getActiveDataset();
    if (!button || !dataset) return;

    const column = Number(button.dataset.rateSort);
    const current = state.sorts[dataset.key] || { column: null, direction: "asc" };
    state.sorts[dataset.key] = {
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    };
    renderAll();
  });

  elements.tableHead.addEventListener("change", (event) => {
    const select = event.target.closest("[data-rate-filter]");
    const dataset = getActiveDataset();
    if (!select || !dataset) return;

    const column = select.dataset.rateFilter;
    state.filters[dataset.key] = {
      ...(state.filters[dataset.key] || {}),
      [column]: select.value,
    };
    state.selectedRowId = "";
    renderAll();
  });

  elements.tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("[data-rate-row]");
    if (!row) return;

    state.selectedRowId = row.dataset.rateRow;
    renderAll();
  });

  elements.detail.addEventListener("click", (event) => {
    if (!event.target.closest("[data-clear-rate-selection]")) return;
    state.selectedRowId = "";
    renderAll();
  });

  elements.refresh.addEventListener("click", loadRateData);

  loadRateData();
})();
