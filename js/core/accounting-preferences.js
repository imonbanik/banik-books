(function setupAccountingPreferences() {
  const STORAGE_KEY = "banikBooksAccountingPreferences";
  const defaults = {
    currency: "BDT",
    fiscalYearStart: "",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "1,23,456.78",
  };

  function readStoredPreferences() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function getCurrencyCode(value) {
    return String(value || defaults.currency).trim().split(/\s+-\s+/)[0] || defaults.currency;
  }

  function normalizePreferences(source = {}) {
    return {
      currency: getCurrencyCode(source.currency),
      fiscalYearStart: String(source.fiscalYearStart || "").trim(),
      dateFormat: ["DD/MM/YYYY", "DD-MM-YYYY", "DD-MMM-YYYY"].includes(source.dateFormat)
        ? source.dateFormat
        : defaults.dateFormat,
      numberFormat: source.numberFormat === "123,456.78" ? "123,456.78" : defaults.numberFormat,
    };
  }

  let preferences = normalizePreferences({ ...defaults, ...readStoredPreferences() });
  let readyPromise = null;
  let didHydrateFromBackend = false;

  function setPreferences(source = {}, notify = true) {
    preferences = normalizePreferences({ ...preferences, ...source });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    savePreferencesToBackend();

    if (notify) {
      window.dispatchEvent(new CustomEvent("banik:accounting-preferences-ready", { detail: getPreferences() }));
    }

    return getPreferences();
  }

  function getPreferences() {
    return { ...preferences };
  }

  function waitForAuth() {
    if (window.BanikAuth && typeof window.BanikAuth.getCurrentUser === "function") {
      return Promise.resolve(window.BanikAuth);
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.BanikAuth && typeof window.BanikAuth.getCurrentUser === "function") {
          window.clearInterval(timer);
          resolve(window.BanikAuth);
        } else if (attempts >= 80) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 25);
    });
  }

  function waitForApi() {
    if (window.BanikApi && typeof window.BanikApi.getSetting === "function") {
      return Promise.resolve(window.BanikApi);
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.BanikApi && typeof window.BanikApi.getSetting === "function") {
          window.clearInterval(timer);
          resolve(window.BanikApi);
        } else if (attempts >= 80) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 25);
    });
  }

  async function hydratePreferencesFromBackend() {
    const api = await waitForApi();

    if (!api || typeof api.getSetting !== "function") {
      return null;
    }

    try {
      const remotePreferences = await api.getSetting("accountingPreferences");

      if (remotePreferences) {
        didHydrateFromBackend = true;
        return setPreferences(remotePreferences, false);
      }
    } catch {
      return null;
    }

    return null;
  }

  async function savePreferencesToBackend() {
    if (!didHydrateFromBackend && !window.BanikApi) {
      return;
    }

    const api = await waitForApi();

    if (!api || typeof api.saveSetting !== "function") {
      return;
    }

    try {
      await api.saveSetting("accountingPreferences", getPreferences());
    } catch {
      // Local preferences remain available if backend sync is unavailable.
    }
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = waitForAuth()
        .then((auth) => auth ? auth.getCurrentUser() : null)
        .then(async (user) => {
          const remotePreferences = await hydratePreferencesFromBackend();
          return setPreferences(remotePreferences || user || {}, true);
        })
        .catch(() => getPreferences());
    }

    return readyPromise;
  }

  function parseDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function formatDate(value) {
    const date = parseDateValue(value);
    if (!date) return String(value || "");

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());

    if (preferences.dateFormat === "DD-MM-YYYY") return `${day}-${month}-${year}`;
    if (preferences.dateFormat === "DD-MMM-YYYY") {
      const shortMonth = date.toLocaleString("en-GB", { month: "short" });
      return `${day}-${shortMonth}-${year}`;
    }

    return `${day}/${month}/${year}`;
  }

  function formatNumber(value, options = {}) {
    const amount = Number(value || 0);
    const digits = Number.isFinite(options.digits) ? options.digits : 2;
    const locale = preferences.numberFormat === "123,456.78" ? "en-US" : "en-IN";
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Math.abs(amount));

    if (options.negativeBrackets && amount < 0) return `(${formatted})`;
    return amount < 0 && !options.absolute ? `-${formatted}` : formatted;
  }

  function formatMoney(value, options = {}) {
    return `${preferences.currency} ${formatNumber(value, options)}`;
  }

  function formatDateForInput(date) {
    const value = parseDateValue(date);
    if (!value) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getFiscalPeriod(value) {
    const date = parseDateValue(value) || parseDateValue(new Date());
    const configuredStart = parseDateValue(preferences.fiscalYearStart);
    const startMonth = configuredStart ? configuredStart.getMonth() : 6;
    const startDay = configuredStart ? configuredStart.getDate() : 1;
    const currentBoundary = new Date(date.getFullYear(), startMonth, startDay);
    const startYear = date >= currentBoundary ? date.getFullYear() : date.getFullYear() - 1;
    const startDate = new Date(startYear, startMonth, startDay);
    const nextStartDate = new Date(startYear + 1, startMonth, startDay);
    const endDate = new Date(nextStartDate);
    endDate.setDate(endDate.getDate() - 1);
    const isCalendarYear = startMonth === 0 && startDay === 1;
    const prefix = isCalendarYear
      ? `CY/${startYear}`
      : `FY/${String(startYear).slice(-2)}-${String(endDate.getFullYear()).slice(-2)}`;

    return {
      prefix,
      startDate: formatDateForInput(startDate),
      endDate: formatDateForInput(endDate),
      startYear,
      endYear: endDate.getFullYear(),
      isCalendarYear,
    };
  }

  window.BanikAccounting = {
    ready,
    getPreferences,
    setPreferences,
    getCurrencyCode,
    formatDate,
    formatNumber,
    formatMoney,
    formatDateForInput,
    getFiscalPeriod,
  };
})();
