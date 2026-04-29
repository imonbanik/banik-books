const BANIK_BOOKS_DEFAULT_SETTINGS = Object.freeze({
  accountingBasis: "accrual",
  accountingBasisLabel: "Accrual basis accounting",
  accountingBasisDescription:
    "Income and expenses are recognized when earned or incurred, not only when cash is received or paid.",
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
  window.BANIK_BOOKS_DEFAULT_SETTINGS = BANIK_BOOKS_DEFAULT_SETTINGS;
  window.BANIK_BOOKS_SETTINGS = mergedSettings;
  document.documentElement.dataset.accountingBasis = mergedSettings.accountingBasis;

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
});
