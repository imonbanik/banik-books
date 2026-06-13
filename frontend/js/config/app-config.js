const BANIK_BOOKS_DEFAULT_SETTINGS = Object.freeze({
  accountingBasis: "accrual",
  accountingBasisLabel: "Accrual basis accounting",
  accountingBasisDescription:
    "Income and expenses are recognized when earned or incurred, not only when cash is received or paid.",
});
const BANIK_BOOKS_RELEASE = Object.freeze({
  version: "1.1.8",
  releaseMonthYear: "June 2026",
});

function readStoredSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("banikBooksSettings") || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function initializeBanikBooksSettings() {
  const storedSettings = readStoredSettings();
  const mergedSettings = {
    ...BANIK_BOOKS_DEFAULT_SETTINGS,
    ...storedSettings,
    accountingBasis: "accrual",
    accountingBasisLabel: BANIK_BOOKS_DEFAULT_SETTINGS.accountingBasisLabel,
    accountingBasisDescription:
      BANIK_BOOKS_DEFAULT_SETTINGS.accountingBasisDescription,
  };

  localStorage.setItem("banikBooksSettings", JSON.stringify(mergedSettings));
  window.BANIK_BOOKS_RELEASE = BANIK_BOOKS_RELEASE;
  window.BANIK_BOOKS_DEFAULT_SETTINGS = BANIK_BOOKS_DEFAULT_SETTINGS;
  window.BANIK_BOOKS_SETTINGS = mergedSettings;
  document.documentElement.dataset.accountingBasis = mergedSettings.accountingBasis;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "light";

  return mergedSettings;
}

const activeBanikBooksSettings = initializeBanikBooksSettings();

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-accounting-basis-label]").forEach((element) => {
    element.textContent = activeBanikBooksSettings.accountingBasisLabel;
  });

  document
    .querySelectorAll("[data-accounting-basis-description]")
    .forEach((element) => {
      element.textContent = activeBanikBooksSettings.accountingBasisDescription;
    });

  document.querySelectorAll("[data-release-month-year]").forEach((element) => {
    element.textContent = BANIK_BOOKS_RELEASE.releaseMonthYear;
  });

  document.querySelectorAll("[data-release-version]").forEach((element) => {
    element.textContent = BANIK_BOOKS_RELEASE.version;
  });
});
