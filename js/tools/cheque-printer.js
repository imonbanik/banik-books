const PAYEE_STORAGE_KEY = "banikBooksChequePayees";
const PAYEE_DELETED_STORAGE_KEY = "banikBooksChequeDeletedPayees";
const printOrientationInput = document.getElementById("printOrientation");
const chequeDateInput = document.getElementById("chequeDate");
const payeeNameInput = document.getElementById("payeeName");
const payeeAddField = document.getElementById("payeeAddField");
const payeeAddInput = document.getElementById("payeeAddInput");
const payeeAddButton = document.getElementById("payeeAddButton");
const payeeDeletePanel = document.getElementById("payeeDeletePanel");
const payeeDeleteList = document.getElementById("payeeDeleteList");
const payeeHelp = document.getElementById("payeeHelp");
const chequeAmountInput = document.getElementById("chequeAmount");
const chequeTypeInput = document.getElementById("chequeType");
const printChequeButton = document.getElementById("printCheque");
const printArea = document.getElementById("printArea");
const previewOrientationLabel = document.getElementById("previewOrientationLabel");
const orientationHelp = document.getElementById("orientationHelp");
const dateDigitsContainer = document.getElementById("dateDigits");
const payeePreview = document.getElementById("payeePreview");
const amountPreview = document.getElementById("amountPreview");
const amountWordsLine1 = document.getElementById("amountWordsLine1");
const amountWordsLine2 = document.getElementById("amountWordsLine2");
const amountMeasure = document.getElementById("amountMeasure");
const accountPayeeStamp = document.getElementById("accountPayeeStamp");
let deletedPayeeKeys = loadDeletedPayeeKeys();
let payeeNames = loadPayeeNames();

function padDateDigits(value) {
  return String(value).padStart(2, "0");
}

function normalizePayeeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getPayeeKey(value) {
  return normalizePayeeName(value).toLowerCase();
}

function readStorageArray(storageKey) {
  try {
    const parsedItems = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsedItems) ? parsedItems : [];
  } catch {
    return [];
  }
}

function loadDeletedPayeeKeys() {
  return readStorageArray(PAYEE_DELETED_STORAGE_KEY);
}

function persistDeletedPayeeKeys() {
  localStorage.setItem(PAYEE_DELETED_STORAGE_KEY, JSON.stringify(deletedPayeeKeys));
}

function loadPayeeNames() {
  return Array.from(
    new Map(
      readStorageArray(PAYEE_STORAGE_KEY)
        .map(normalizePayeeName)
        .filter(Boolean)
        .filter((name) => !deletedPayeeKeys.includes(getPayeeKey(name)))
        .map((name) => [getPayeeKey(name), name])
    ).values()
  ).sort((leftName, rightName) => leftName.localeCompare(rightName));
}

function persistPayeeNames() {
  localStorage.setItem(PAYEE_STORAGE_KEY, JSON.stringify(payeeNames));
}

function findPayeeName(name) {
  const targetKey = getPayeeKey(name);
  return payeeNames.find((existingName) => getPayeeKey(existingName) === targetKey);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function trashIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2m-1 4v8M9 10v8M6 6l1 15h10l1-15" />
    </svg>
  `;
}

function setPayeeHelp(message, isError) {
  payeeHelp.textContent = message || "";
  payeeHelp.classList.toggle("payee-help--error", Boolean(isError));
}

function renderPayeeOptions(selectedValue) {
  payeeNameInput.innerHTML = "";

  const placeholderOption = new Option("Select payee", "");
  placeholderOption.disabled = true;
  placeholderOption.hidden = true;
  payeeNameInput.append(placeholderOption);

  payeeNames.forEach((name) => {
    payeeNameInput.append(new Option(name, name));
  });

  payeeNameInput.append(new Option("Add", "__add__"));
  payeeNameInput.append(new Option("Delete", "__delete__"));
  payeeNameInput.value = selectedValue || "";
}

function addPayeeName(rawName) {
  const payeeName = normalizePayeeName(rawName);

  if (!payeeName) {
    return "";
  }

  const existingName = findPayeeName(payeeName);
  if (existingName) {
    return existingName;
  }

  deletedPayeeKeys = deletedPayeeKeys.filter(
    (deletedKey) => deletedKey !== getPayeeKey(payeeName)
  );
  payeeNames = [...payeeNames, payeeName].sort((leftName, rightName) =>
    leftName.localeCompare(rightName)
  );
  persistDeletedPayeeKeys();
  persistPayeeNames();
  renderPayeeOptions(payeeName);
  return payeeName;
}

function commitPayeeName() {
  const payeeName = normalizePayeeName(payeeAddInput.value);

  if (!payeeName) {
    setPayeeHelp("Write payee name before clicking plus.", true);
    payeeAddInput.focus();
    return false;
  }

  const existingName = findPayeeName(payeeName);
  if (existingName) {
    setPayeeHelp("This payee already exists. Select it from the dropdown.", true);
    payeeAddInput.focus();
    return false;
  }

  addPayeeName(payeeName);
  setPayeeHelp("Payee added to the dropdown.", false);
  togglePayeeManagedState();
  renderPayee();
  return true;
}

function renderPayeeDeleteList() {
  if (payeeNames.length === 0) {
    payeeDeleteList.innerHTML =
      '<p class="organization-delete-empty">No saved payees to delete.</p>';
    return;
  }

  payeeDeleteList.innerHTML = payeeNames
    .map(
      (name) => `
        <div class="organization-delete-row">
          <span>${escapeHtml(name)}</span>
          <button
            class="icon-action-button icon-action-button--danger"
            type="button"
            data-delete-payee="${escapeHtml(name)}"
            title="Delete payee"
            aria-label="Delete ${escapeHtml(name)}"
          >
            ${trashIcon()}
          </button>
        </div>
      `
    )
    .join("");
}

function deletePayeeName(rawName) {
  const payeeName = normalizePayeeName(rawName);
  const payeeKey = getPayeeKey(payeeName);

  payeeNames = payeeNames.filter((name) => getPayeeKey(name) !== payeeKey);
  deletedPayeeKeys = Array.from(new Set([...deletedPayeeKeys, payeeKey]));

  persistPayeeNames();
  persistDeletedPayeeKeys();
  renderPayeeOptions("__delete__");
  togglePayeeManagedState();
  renderPayee();
  setPayeeHelp("Payee removed from dropdown.", false);
}

function togglePayeeManagedState() {
  const isAdding = payeeNameInput.value === "__add__";
  const isDeleting = payeeNameInput.value === "__delete__";

  payeeAddField.hidden = !isAdding;
  payeeAddInput.required = isAdding;
  payeeDeletePanel.hidden = !isDeleting;

  if (!isAdding) {
    payeeAddInput.value = "";
  }

  if (isDeleting) {
    renderPayeeDeleteList();
  }
}

function getSelectedPayeeName() {
  const payeeValue = payeeNameInput.value;

  if (payeeValue === "__add__" || payeeValue === "__delete__") {
    return "";
  }

  return normalizePayeeName(payeeValue);
}

function sanitizeAmount(rawValue) {
  const cleaned = String(rawValue || "").replace(/[^0-9.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, firstDotIndex + 1);
  const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");
  return integerPart + decimalPart;
}

function formatAmount(rawValue) {
  const sanitized = sanitizeAmount(rawValue);

  if (!sanitized) {
    return "";
  }

  const numericValue = Number.parseFloat(sanitized);

  if (Number.isNaN(numericValue)) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function getCaretPositionFromDigitCount(formattedValue, digitCount) {
  if (!formattedValue || digitCount <= 0) {
    return 0;
  }

  let seenDigits = 0;

  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) {
      seenDigits += 1;

      if (seenDigits >= digitCount) {
        return index + 1;
      }
    }
  }

  const decimalIndex = formattedValue.indexOf(".");
  return decimalIndex === -1 ? formattedValue.length : decimalIndex;
}

function handleAmountInput() {
  const rawValue = chequeAmountInput.value;
  const selectionStart = chequeAmountInput.selectionStart ?? rawValue.length;
  const digitsBeforeCaret = rawValue.slice(0, selectionStart).replace(/\D/g, "").length;
  const formattedAmount = formatAmount(rawValue);

  chequeAmountInput.value = formattedAmount;

  if (document.activeElement === chequeAmountInput) {
    const caretPosition = getCaretPositionFromDigitCount(
      formattedAmount,
      digitsBeforeCaret
    );
    chequeAmountInput.setSelectionRange(caretPosition, caretPosition);
  }

  renderAmount();
}

function normalizeAmountInputField() {
  chequeAmountInput.value = formatAmount(chequeAmountInput.value);
  renderAmount();
}

function convertBelowHundred(number) {
  const ones = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  if (number < 20) {
    return ones[number];
  }

  const tenValue = Math.floor(number / 10);
  const remainder = number % 10;
  return remainder ? `${tens[tenValue]} ${ones[remainder]}` : tens[tenValue];
}

function convertBelowThousand(number) {
  if (number < 100) {
    return convertBelowHundred(number);
  }

  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  const hundredLabel = `${convertBelowHundred(hundreds)} Hundred`;
  return remainder ? `${hundredLabel} ${convertBelowHundred(remainder)}` : hundredLabel;
}

function numberToWords(number) {
  if (number === 0) {
    return "Zero";
  }

  const segments = [
    { value: 10000000, label: "Crore" },
    { value: 100000, label: "Lakh" },
    { value: 1000, label: "Thousand" },
  ];

  let remaining = number;
  const words = [];

  segments.forEach((segment) => {
    if (remaining >= segment.value) {
      const segmentValue = Math.floor(remaining / segment.value);
      words.push(`${convertBelowThousand(segmentValue)} ${segment.label}`);
      remaining %= segment.value;
    }
  });

  if (remaining > 0) {
    words.push(convertBelowThousand(remaining));
  }

  return words.join(" ");
}

function amountToWords(rawValue) {
  const sanitized = sanitizeAmount(rawValue);

  if (!sanitized) {
    return "";
  }

  const numericValue = Number.parseFloat(sanitized);

  if (Number.isNaN(numericValue)) {
    return "";
  }

  const taka = Math.floor(numericValue);
  const paisa = Math.round((numericValue - taka) * 100);
  let words = numberToWords(taka);

  if (paisa > 0) {
    words += ` and ${numberToWords(paisa)} Paisa`;
  }

  return `${words} Only`;
}

function renderOrientation() {
  const selectedOrientation = printOrientationInput.value;
  const orientation = selectedOrientation || "landscape";
  const orientationLabels = {
    landscape: "Landscape",
    "amount-up": "Amount Upside",
    "amount-down": "Amount Downside",
  };
  const orientationHelpText = {
    landscape: "It keeps the cheque normal.",
    "amount-up": "It rotates the amount-box side to the top.",
    "amount-down": "It rotates the amount-box side to the bottom.",
  };

  printArea.dataset.orientation = orientation;
  previewOrientationLabel.textContent = `Orientation: ${
    orientationLabels[orientation] || "Landscape"
  }`;
  orientationHelp.textContent = orientationHelpText[selectedOrientation] || "";
  window.requestAnimationFrame(renderAmount);
}

function renderDateDigits(value) {
  const digits = Array.from(dateDigitsContainer.querySelectorAll(".date-cell"));
  let sourceDigits = ["", "", "", "", "", "", "", ""];

  if (value) {
    const [year, month, day] = value.split("-");

    if (year && month && day) {
      sourceDigits = [
        ...padDateDigits(day),
        ...padDateDigits(month),
        ...String(year).slice(-4),
      ];
    }
  }

  digits.forEach((digit, index) => {
    digit.textContent = sourceDigits[index] || "";
  });
}

function renderPayee() {
  const payeeText = getSelectedPayeeName();

  if (payeeText) {
    payeePreview.textContent = payeeText;
    payeePreview.classList.remove("placeholder");
    return;
  }

  payeePreview.textContent = "";
  payeePreview.classList.remove("placeholder");
}

function splitAmountWords(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return ["", ""];
  }

  const firstLineWidth = amountWordsLine1.offsetWidth;
  const secondLineWidth = amountWordsLine2.offsetWidth;

  if (!firstLineWidth || !secondLineWidth) {
    return [text, ""];
  }

  let firstLine = "";
  let splitIndex = 0;

  for (let index = 0; index < words.length; index += 1) {
    const candidate = firstLine ? `${firstLine} ${words[index]}` : words[index];
    amountMeasure.textContent = candidate;

    if (amountMeasure.getBoundingClientRect().width <= firstLineWidth || !firstLine) {
      firstLine = candidate;
      splitIndex = index + 1;
      continue;
    }

    break;
  }

  const secondLine = words.slice(splitIndex).join(" ");
  return [firstLine, secondLine];
}

function renderAmount() {
  const formattedAmount = formatAmount(chequeAmountInput.value);
  const amountInWords = amountToWords(chequeAmountInput.value);

  if (formattedAmount) {
    amountPreview.textContent = formattedAmount;
    amountPreview.classList.remove("placeholder");
  } else {
    amountPreview.textContent = "";
    amountPreview.classList.remove("placeholder");
  }

  if (amountInWords) {
    const [firstLine, secondLine] = splitAmountWords(amountInWords);
    amountWordsLine1.textContent = firstLine;
    amountWordsLine2.textContent = secondLine;
    amountWordsLine1.classList.remove("placeholder");
    amountWordsLine2.classList.remove("placeholder");
  } else {
    amountWordsLine1.textContent = "";
    amountWordsLine2.textContent = "";
    amountWordsLine2.classList.remove("placeholder");
    amountWordsLine1.classList.remove("placeholder");
  }
}

function renderChequeType() {
  accountPayeeStamp.hidden = chequeTypeInput.value !== "account-payee";
  renderPayee();
}

function renderAll() {
  renderOrientation();
  renderDateDigits(chequeDateInput.value);
  renderChequeType();
  renderAmount();
}

printOrientationInput.value = "";
chequeDateInput.value = "";
chequeTypeInput.value = "";
renderPayeeOptions("");
togglePayeeManagedState();

printOrientationInput.addEventListener("change", renderOrientation);
chequeDateInput.addEventListener("input", renderAll);
payeeNameInput.addEventListener("change", () => {
  setPayeeHelp("");
  togglePayeeManagedState();

  if (payeeNameInput.value === "__add__") {
    window.setTimeout(() => payeeAddInput.focus(), 0);
  }

  renderPayee();
});
payeeAddInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  setPayeeHelp("Click the green plus button to add payee.", true);
});
payeeAddButton.addEventListener("click", (event) => {
  event.preventDefault();
  commitPayeeName();
});
payeeDeleteList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-payee]");

  if (!deleteButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  deletePayeeName(deleteButton.dataset.deletePayee);
});
chequeAmountInput.addEventListener("input", handleAmountInput);
chequeAmountInput.addEventListener("change", normalizeAmountInputField);
chequeAmountInput.addEventListener("blur", normalizeAmountInputField);
chequeTypeInput.addEventListener("change", renderChequeType);
window.addEventListener("resize", renderAmount);

printChequeButton.addEventListener("click", () => {
  renderAll();
  window.print();
});

renderAll();
normalizeAmountInputField();
