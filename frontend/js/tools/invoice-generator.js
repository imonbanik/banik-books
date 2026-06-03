document.addEventListener("DOMContentLoaded", async () => {
  if (window.BanikAccounting) await window.BanikAccounting.ready();
  const form = document.getElementById("invoiceForm");
  const itemsBody = document.getElementById("invoiceItemsBody");
  const addItemButton = document.getElementById("addInvoiceItem");
  const previewButton = document.getElementById("refreshInvoicePreview");
  const invoiceDocument = document.getElementById("invoiceDocument");
  const documentContent = document.getElementById("invoiceDocumentContent");
  const letterheadLayer = document.getElementById("invoiceLetterheadLayer");
  const assetStatus = document.getElementById("invoiceAssetStatus");
  const totalSummary = document.getElementById("invoiceTotalSummary");
  const printWithLetterhead = document.getElementById("printWithLetterhead");
  const printWithoutLetterhead = document.getElementById("printWithoutLetterhead");
  let letterhead = null;
  let letterheadImageDataUrl = "";
  let letterheadRenderError = "";
  let eSign = null;

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  setInvoiceThemeColor();

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br />");
  }

  function getValue(id) {
    return document.getElementById(id).value.trim();
  }

  function parseAmount(value) {
    return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
  }

  function formatAmount(value) {
    return window.BanikAccounting
      ? window.BanikAccounting.formatNumber(value)
      : Number(value || 0).toFixed(2);
  }

  function formatInputAmount(input) {
    input.value = formatAmount(parseAmount(input.value));
  }

  function formatDate(value) {
    return window.BanikAccounting ? window.BanikAccounting.formatDate(value) : value;
  }

  const wordsBelowTwenty = [
    "",
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
  const tensWords = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function chunkToWords(number) {
    const parts = [];
    const hundred = Math.floor(number / 100);
    const rest = number % 100;

    if (hundred) {
      parts.push(`${wordsBelowTwenty[hundred]} Hundred`);
    }

    if (rest < 20) {
      if (rest) {
        parts.push(wordsBelowTwenty[rest]);
      }
    } else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      parts.push(one ? `${tensWords[ten]} ${wordsBelowTwenty[one]}` : tensWords[ten]);
    }

    return parts.join(" ");
  }

  function amountToWords(value, currency) {
    let number = Math.round(Number(value) || 0);

    if (!number) {
      return `${currency} Zero Only.`;
    }

    const scales = ["", "Thousand", "Million", "Billion"];
    const parts = [];
    let scaleIndex = 0;

    while (number > 0) {
      const chunk = number % 1000;

      if (chunk) {
        const scale = scales[scaleIndex];
        parts.unshift(`${chunkToWords(chunk)}${scale ? ` ${scale}` : ""}`);
      }

      number = Math.floor(number / 1000);
      scaleIndex += 1;
    }

    return `${currency} ${parts.join(" ")} Only.`;
  }

  function addInvoiceItem(description = "", amount = "") {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <textarea class="invoice-item-description">${escapeHtml(description)}</textarea>
      </td>
      <td>
        <input class="invoice-item-amount" type="text" inputmode="decimal" value="${escapeHtml(amount)}" />
      </td>
      <td>
        <button class="invoice-item-remove" type="button">Remove</button>
      </td>
    `;
    itemsBody.appendChild(row);

    row.querySelector(".invoice-item-amount").addEventListener("blur", (event) => {
      formatInputAmount(event.target);
      renderInvoice();
    });
    row.querySelector(".invoice-item-remove").addEventListener("click", () => {
      row.remove();
      if (!itemsBody.children.length) {
        addInvoiceItem();
      }
      renderInvoice();
    });
  }

  function getInvoiceItems() {
    return Array.from(itemsBody.querySelectorAll("tr")).map((row) => ({
      description: row.querySelector(".invoice-item-description").value.trim(),
      amount: parseAmount(row.querySelector(".invoice-item-amount").value),
    })).filter((item) => item.description || item.amount);
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function rgbToHsl(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    let saturation = 0;
    const lightness = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      if (max === r) {
        hue = (g - b) / delta + (g < b ? 6 : 0);
      } else if (max === g) {
        hue = (b - r) / delta + 2;
      } else {
        hue = (r - g) / delta + 4;
      }

      hue /= 6;
    }

    return { hue, saturation, lightness };
  }

  function rgbToHex(red, green, blue) {
    return `#${[red, green, blue]
      .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function colorWithAlpha(hex, alpha) {
    const cleanHex = String(hex || "").replace("#", "");
    const red = parseInt(cleanHex.slice(0, 2), 16);
    const green = parseInt(cleanHex.slice(2, 4), 16);
    const blue = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function setInvoiceThemeColor(color = "#9a1b1b") {
    invoiceDocument.style.setProperty("--invoice-theme-color", color);
    invoiceDocument.style.setProperty("--invoice-theme-border", colorWithAlpha(color, 0.28));
    invoiceDocument.style.setProperty("--invoice-theme-soft", colorWithAlpha(color, 0.1));
  }

  function getImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read letterhead theme color."));
      image.src = dataUrl;
    });
  }

  async function extractThemeColorFromImage(dataUrl) {
    if (!dataUrl) {
      return "";
    }

    const image = await getImageElement(dataUrl);
    const canvas = document.createElement("canvas");
    const width = 140;
    const height = Math.max(80, Math.round((image.naturalHeight / image.naturalWidth) * width));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const buckets = new Map();

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const sampleBands = [
      context.getImageData(0, 0, width, Math.ceil(height * 0.42)).data,
      context.getImageData(0, Math.floor(height * 0.78), width, Math.max(1, Math.floor(height * 0.22))).data,
    ];

    sampleBands.forEach((pixels) => {
      for (let index = 0; index < pixels.length; index += 16) {
        const alpha = pixels[index + 3];

        if (alpha < 180) {
          continue;
        }

        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const { saturation, lightness } = rgbToHsl(red, green, blue);

        if (saturation < 0.18 || lightness > 0.92 || lightness < 0.12) {
          continue;
        }

        const quantizedRed = Math.round(red / 16) * 16;
        const quantizedGreen = Math.round(green / 16) * 16;
        const quantizedBlue = Math.round(blue / 16) * 16;
        const key = `${quantizedRed},${quantizedGreen},${quantizedBlue}`;
        const score = saturation * (1 - Math.abs(lightness - 0.5)) + 0.2;
        const bucket = buckets.get(key) || {
          red: quantizedRed,
          green: quantizedGreen,
          blue: quantizedBlue,
          score: 0,
        };

        bucket.score += score;
        buckets.set(key, bucket);
      }
    });

    const bestBucket = Array.from(buckets.values()).sort((left, right) => right.score - left.score)[0];
    return bestBucket ? rgbToHex(bestBucket.red, bestBucket.green, bestBucket.blue) : "";
  }

  async function applyLetterheadThemeColor() {
    const themeSource = letterhead
      ? letterhead.type === "application/pdf"
        ? letterheadImageDataUrl
        : letterhead.dataUrl
      : "";

    try {
      const color = await extractThemeColorFromImage(themeSource);
      setInvoiceThemeColor(color || "#9a1b1b");
    } catch {
      setInvoiceThemeColor("#9a1b1b");
    }
  }

  async function renderPdfLetterheadToImage() {
    if (!letterhead || letterhead.type !== "application/pdf" || letterheadImageDataUrl) {
      return;
    }

    if (!window.pdfjsLib) {
      letterheadRenderError = "PDF preview engine could not load. Use PNG/JPG letterhead or check internet.";
      return;
    }

    try {
      const pdf = await window.pdfjsLib.getDocument({ data: dataUrlToUint8Array(letterhead.dataUrl) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      letterheadImageDataUrl = canvas.toDataURL("image/png", 0.95);
      letterheadRenderError = "";
    } catch {
      letterheadRenderError = "Could not render PDF letterhead. Use PNG/JPG letterhead for this invoice.";
    }
  }

  function renderLetterheadLayer(showLetterhead) {
    if (!showLetterhead || !letterhead || !letterhead.dataUrl) {
      letterheadLayer.hidden = true;
      letterheadLayer.innerHTML = "";
      return;
    }

    const isPdf = letterhead.type === "application/pdf";
    const source = isPdf ? letterheadImageDataUrl : letterhead.dataUrl;

    if (!source) {
      letterheadLayer.hidden = true;
      letterheadLayer.innerHTML = "";
      return;
    }

    letterheadLayer.innerHTML = `<img src="${source}" alt="" />`;
    letterheadLayer.hidden = false;
  }

  function renderInvoice() {
    const currency = getValue("invoiceCurrency") || "BDT";
    const items = getInvoiceItems();
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const vatRate = parseAmount(getValue("vatRate"));
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    const useESign = document.getElementById("useESign").checked && eSign && eSign.dataUrl;
    const amountWords = amountToWords(total, currency);
    const itemRows = items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${textToHtml(item.description)}</td>
        <td>${formatAmount(item.amount)}</td>
      </tr>
    `).join("");
    const bankRows = [
      ["Account Name:", getValue("bankAccountName")],
      ["Account Number:", getValue("bankAccountNumber")],
      ["Account Currency:", getValue("bankCurrency")],
      ["Name of the Bank:", getValue("bankName")],
      ["Branch Name:", getValue("bankBranch")],
      ["Bank Address:", getValue("bankAddress")],
      ["SWIFT Code:", getValue("swiftCode")],
      ["Routing Number:", getValue("routingNumber")],
    ].map(([label, value]) => `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(value)}</td>
      </tr>
    `).join("");

    totalSummary.textContent = `${currency} ${formatAmount(total)}`;
    renderLetterheadLayer(Boolean(letterhead));

    documentContent.innerHTML = `
      <div class="invoice-paper-body">
        <header class="invoice-paper-head">
          <h2>Invoice</h2>
          <div class="invoice-title-rule"></div>
        </header>

        <section class="invoice-paper-top">
          <div class="invoice-bill-to">
            <span>To,</span>
            <strong>${escapeHtml(getValue("clientName"))}</strong>
            <p>${textToHtml(getValue("clientAddress"))}</p>
          </div>
          <table class="invoice-meta-table">
            <tbody>
              <tr>
                <th>Invoice No.:</th>
                <td>${escapeHtml(getValue("invoiceNo"))}</td>
              </tr>
              <tr>
                <th>Issue Date:</th>
                <td>${escapeHtml(formatDate(getValue("issueDate")))}</td>
              </tr>
              <tr>
                <th>Due Date:</th>
                <td>${escapeHtml(formatDate(getValue("dueDate")))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="invoice-project-block">
          <p><strong>Project Name:</strong> ${textToHtml(getValue("projectName"))}</p>
          <p><strong>Contract Reference:</strong> ${escapeHtml(getValue("contractReference"))}</p>
        </section>

        <table class="invoice-service-table">
          <thead>
            <tr>
              <th>SL</th>
              <th>Description of Services</th>
              <th>Amount (${escapeHtml(currency)})</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || `<tr><td colspan="3">No service item entered.</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Add: VAT @ ${formatAmount(vatRate).replace(".00", "")}%</td>
              <td>${formatAmount(vatAmount)}</td>
            </tr>
            <tr>
              <td colspan="2">Total Amount:</td>
              <td>${formatAmount(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p class="invoice-amount-words"><strong>Amount in Words:</strong> ${escapeHtml(amountWords)}</p>

        <section class="invoice-bank-block">
          <h3>Bank Account Details:</h3>
          <table>
            <tbody>${bankRows}</tbody>
          </table>
        </section>

        <section class="invoice-signature-block">
          <p>Submitted by,</p>
          <div class="invoice-signature-space">
            ${useESign ? `<img src="${eSign.dataUrl}" alt="E-signature" />` : ""}
          </div>
          <strong>${escapeHtml(getValue("submittedName"))}</strong>
          <span>${escapeHtml(getValue("submittedDesignation"))}</span>
          <span>${escapeHtml(getValue("submittedOrganization"))}</span>
        </section>
      </div>
    `;
  }

  async function loadProfileAssets() {
    const [letterheadResult, eSignResult] = await Promise.all([
      window.BanikAuth.getLetterhead ? window.BanikAuth.getLetterhead() : Promise.resolve({ ok: true, letterhead: null }),
      window.BanikAuth.getESign ? window.BanikAuth.getESign() : Promise.resolve({ ok: true, eSign: null }),
    ]);

    if (letterheadResult.ok) {
      letterhead = letterheadResult.letterhead;
    }

    if (eSignResult.ok) {
      eSign = eSignResult.eSign;
    }

    await renderPdfLetterheadToImage();
    await applyLetterheadThemeColor();

    const statusParts = [
      letterheadRenderError || (letterhead ? "Letterhead loaded" : "No letterhead uploaded"),
      eSign ? "E-signature loaded" : "No e-signature uploaded",
    ];
    assetStatus.textContent = statusParts.join(" | ");
  }

  async function printInvoice(mode) {
    await renderPdfLetterheadToImage();
    renderInvoice();

    if (mode === "with-letterhead" && !letterhead) {
      window.alert("No letterhead uploaded in your profile yet.");
      return;
    }

    if (mode === "with-letterhead" && letterheadRenderError) {
      window.alert(letterheadRenderError);
      return;
    }

    document.body.dataset.invoicePrintMode = mode;
    renderLetterheadLayer(mode === "with-letterhead");
    window.setTimeout(() => window.print(), 80);
  }

  addInvoiceItem(
    "3rd Payment - 40% of Total Contract Value\n(Upon completion of 100% of the activities)",
    "1,391,304.35"
  );

  addItemButton.addEventListener("click", () => {
    addInvoiceItem();
    renderInvoice();
  });

  previewButton.addEventListener("click", renderInvoice);
  printWithLetterhead.addEventListener("click", () => printInvoice("with-letterhead"));
  printWithoutLetterhead.addEventListener("click", () => printInvoice("without-letterhead"));
  window.addEventListener("afterprint", () => {
    delete document.body.dataset.invoicePrintMode;
    renderLetterheadLayer(Boolean(letterhead));
  });

  form.addEventListener("input", renderInvoice);
  form.addEventListener("change", renderInvoice);
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("blur", (event) => {
    if (event.target.matches("#vatRate, .invoice-item-amount")) {
      formatInputAmount(event.target);
      renderInvoice();
    }
  }, true);

  await loadProfileAssets();
  if (window.BanikAccounting) {
    const currency = window.BanikAccounting.getPreferences().currency;
    document.getElementById("invoiceCurrency").value = currency;
    document.getElementById("bankCurrency").value = currency;
  }
  renderInvoice();
});
