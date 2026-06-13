const ACHALLAN_HOME_URL = "https://www.achallan.gov.bd/acs/v2/general/home?ReturnUrl=%2Facs%2F";
const ACHALLAN_PAYMENT_URL = "https://www.achallan.gov.bd/acs/v2/general/challan-payment?id=2";

function automationError(message, details = {}) {
  const error = new Error(message);
  error.statusCode = details.statusCode || 502;
  error.details = details;
  return error;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeAmount(value) {
  const numericValue = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue.toFixed(2) : "";
}

function validatePayload(payload) {
  const challanType = normalizeText(payload.challanType);
  const withholdingArea = normalizeText(payload.withholdingArea);
  const assessmentYear = normalizeText(payload.assessmentYear);
  const deducteeTin = normalizeDigits(payload.deducteeTin);
  const deductorTin = normalizeDigits(payload.deductorTin);
  const phoneNumber = normalizeDigits(payload.phoneNumber);
  const amount = normalizeAmount(payload.amount);

  if (!["Tax", "VAT"].includes(challanType)) {
    throw automationError("Select a valid challan type.", { statusCode: 400 });
  }

  if (!withholdingArea) {
    throw automationError("Select withholding area.", { statusCode: 400 });
  }

  if (!/^\d{12}$/.test(deducteeTin)) {
    throw automationError("Deductee TIN must be exactly 12 digits.", { statusCode: 400 });
  }

  if (!/^\d{12}$/.test(deductorTin)) {
    throw automationError("Deductor TIN must be exactly 12 digits.", { statusCode: 400 });
  }

  if (!assessmentYear) {
    throw automationError("Select assessment year.", { statusCode: 400 });
  }

  if (!/^\d{11}$/.test(phoneNumber)) {
    throw automationError("Phone number must be exactly 11 digits.", { statusCode: 400 });
  }

  if (!amount) {
    throw automationError("Enter a valid amount.", { statusCode: 400 });
  }

  return {
    challanType,
    withholdingArea,
    assessmentYear,
    deducteeName: normalizeText(payload.deducteeName),
    deducteeTin,
    deductorName: normalizeText(payload.deductorName),
    deductorTin,
    phoneNumber,
    amount,
    comment: normalizeText(payload.comment),
  };
}

async function clickByText(page, text, options = {}) {
  const locator = page.getByText(text, { exact: Boolean(options.exact) }).first();
  await locator.waitFor({ state: "visible", timeout: options.timeout || 15000 });
  await locator.click();
}

async function fillInput(locator, value) {
  await locator.waitFor({ state: "visible", timeout: 15000 });
  await locator.fill("");
  await locator.fill(String(value || ""));
}

async function selectPrimeNgOption(page, inputLocator, optionText) {
  await inputLocator.waitFor({ state: "visible", timeout: 15000 });
  await inputLocator.click();
  const searchInput = page.locator(".p-dropdown-filter, input[role='combobox']").last();
  await searchInput.fill(String(optionText || ""));
  const option = page
    .locator(".p-dropdown-item, .ng-option, [role='option']")
    .filter({ hasText: String(optionText || "") })
    .first();
  await option.waitFor({ state: "visible", timeout: 15000 });
  await option.click();
}

async function selectComboboxByIndex(page, index, optionText) {
  const combobox = page.locator("input[role='combobox']").nth(index);
  await selectPrimeNgOption(page, combobox, optionText);
}

async function clickButton(page, text) {
  await page.getByRole("button", { name: new RegExp(text) }).first().click({ timeout: 15000 });
}

async function safeClickText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  if ((await locator.count()) > 0) {
    await locator.click({ timeout: 8000 });
    return true;
  }

  return false;
}

async function runAChallanAutomation(rawPayload) {
  let chromium;

  try {
    ({ chromium } = require("playwright"));
  } catch {
    throw automationError("Playwright is not installed. Run npm install playwright and npx playwright install chromium.");
  }

  const payload = validatePayload(rawPayload || {});
  const browser = await chromium.launch({
    headless: process.env.BANIK_ACHALLAN_HEADLESS !== "false",
  });
  const page = await browser.newPage({
    locale: "bn-BD",
    viewport: { width: 1366, height: 900 },
  });

  try {
    await page.goto(ACHALLAN_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await clickByText(page, "এনবিআর এর জমা", { exact: true });
    await page.waitForURL(/challan-payment/, { timeout: 45000 });
    await page.waitForLoadState("domcontentloaded");

    if (payload.challanType === "VAT") {
      await page.getByRole("tab", { name: /মূসক/ }).click({ timeout: 15000 });
      throw automationError("VAT automation path is prepared but not mapped yet. Tax path is available now.", {
        statusCode: 400,
      });
    }

    await page.getByRole("tab", { name: /আয়কর/ }).click({ timeout: 15000 });
    await fillInput(page.locator("#txPersonIdentityNo"), payload.deductorTin);
    await selectComboboxByIndex(page, 0, payload.assessmentYear);
    await selectComboboxByIndex(page, 1, "1112101");
    await selectComboboxByIndex(page, 2, "উৎসে কর");

    if (payload.withholdingArea === "Rent") {
      await selectComboboxByIndex(page, 3, "১০৯-গৃহ সম্পত্তির আয় হতে উৎসে কর্তন");
    } else {
      await selectComboboxByIndex(page, 3, "১০৯-গৃহ সম্পত্তির আয় হতে উৎসে কর্তন");
    }

    await fillInput(page.locator(".p-inputnumber-input").first(), payload.amount);
    await clickButton(page, "পরবর্তী ধাপ");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    await safeClickText(page, "ব্যক্তি");
    await safeClickText(page, "টিআইএন");
    await fillInput(page.locator("#txPersonIdentityNo, #txClientIdentityNo").first(), payload.deducteeTin);
    await clickButton(page, "চেক");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    await fillInput(page.locator("input").filter({ hasText: "" }).or(page.locator("input[placeholder*='মোবাইল']")).last(), payload.phoneNumber).catch(async () => {
      const mobileInput = page.locator("input").filter({ has: page.locator(":scope") }).nth(0);
      await fillInput(mobileInput, payload.phoneNumber);
    });
    await safeClickText(page, "Self Fill-up");
    await safeClickText(page, "OTC");

    if (payload.comment) {
      const commentBox = page.locator("textarea").last();
      if ((await commentBox.count()) > 0) {
        await fillInput(commentBox, payload.comment);
      }
    }

    await clickButton(page, "সংরক্ষণ");
    await page.waitForTimeout(600);
    await safeClickText(page, "হ্যাঁ");
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});

    const bodyText = await page.locator("body").innerText({ timeout: 15000 });
    const trackingMatch = bodyText.match(/(?:ট্র্যাকিং\s*নং|Tracking\s*No)[:：]?\s*([0-9-]+)/i);
    await safeClickText(page, "অর্থ জমা গ্রহণ স্লিপ");

    return {
      ok: true,
      message: trackingMatch ? "A-Challan prepared successfully." : "A-Challan flow reached the result step.",
      trackingNumber: trackingMatch ? trackingMatch[1] : "",
      finalUrl: page.url(),
      challanType: payload.challanType,
    };
  } catch (error) {
    throw automationError(error.message || "A-Challan automation failed.", {
      statusCode: error.statusCode || 502,
      url: page.url(),
    });
  } finally {
    if (process.env.BANIK_ACHALLAN_KEEP_BROWSER !== "true") {
      await browser.close();
    }
  }
}

module.exports = {
  runAChallanAutomation,
};
