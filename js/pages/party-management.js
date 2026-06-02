const PARTY_STORAGE_KEY = "banikBooksParties";
const JOURNAL_STORAGE_KEY = "banikBooksJournals";
const PARTY_TYPES = Object.freeze(["Customer", "Supplier", "Both", "Employee"]);

const createButton = document.querySelector("#party-create-button");
const modal = document.querySelector("#party-modal");
const closeButton = document.querySelector("#party-close-button");
const cancelButton = document.querySelector("#party-cancel-button");
const form = document.querySelector("#party-form");
const typeSelect = document.querySelector("#party-type");
const modalTitle = document.querySelector("#party-modal-title");
const dynamicFields = document.querySelector("#party-dynamic-fields");
const saveButton = document.querySelector("#party-save-button");
const deleteModal = document.querySelector("#party-delete-modal");
const deleteYesButton = document.querySelector("#party-delete-yes");
const deleteNoButton = document.querySelector("#party-delete-no");
const registerButtons = Array.from(document.querySelectorAll("[data-open-party-register]"));
const registerModal = document.querySelector("#party-register-modal");
const registerTitle = document.querySelector("#party-register-title");
const registerSummary = document.querySelector("#party-register-summary");
const registerEmpty = document.querySelector("#party-register-empty");
const registerTableWrap = document.querySelector("#party-register-table-wrap");
const registerTableHead = document.querySelector("#party-register-table-head");
const registerTableBody = document.querySelector("#party-register-table-body");
const registerCloseButton = document.querySelector("#party-register-close-button");
const REGISTER_CONFIGS = Object.freeze({
  Customer: {
    title: "Customer Register",
    columns: [
      "Sl.",
      "Customer Name",
      "Address",
      "Mobile",
      "Email",
      "BIN",
      "TIN",
      "Bank",
      "Edit",
      "Delete",
    ],
  },
  Supplier: {
    title: "Supplier Register",
    columns: [
      "Sl.",
      "Supplier Name",
      "Type",
      "Contact Person",
      "Billing Address",
      "Shipping Address",
      "District",
      "Mobile",
      "Email",
      "BIN",
      "TIN",
      "Bank",
      "Edit",
      "Delete",
    ],
  },
  Both: {
    title: "Both Customer & Supplier Register",
    columns: [
      "Sl.",
      "Party Name",
      "Type",
      "Contact Person",
      "Address",
      "Billing Address",
      "Shipping Address",
      "District",
      "Mobile",
      "Email",
      "BIN",
      "TIN",
      "Bank",
      "Edit",
      "Delete",
    ],
  },
  Employee: {
    title: "Employee Register",
    columns: [
      "Sl.",
      "Employee Name",
      "Joining",
      "Release",
      "Designation",
      "NID",
      "Current Address",
      "Permanent Address",
      "Mobile",
      "Personal Email",
      "Official Email",
      "Real DOB",
      "Certificate DOB",
      "TIN",
      "Bank",
      "Edit",
      "Delete",
    ],
  },
});

let parties = loadParties();
let editingPartyId = "";
let pendingDeleteId = "";
let activeRegisterType = "Customer";

function loadParties() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARTY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((party) => PARTY_TYPES.includes(party.type)) : [];
  } catch (error) {
    console.warn("Could not load parties.", error);
    return [];
  }
}

function saveParties() {
  localStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify(parties));
}

function getPartyDisplayName(party) {
  const fields = (party && party.fields) || {};
  return (
    fields.customerName ||
    fields.supplierName ||
    fields.partyName ||
    fields.employeeName ||
    ""
  ).trim();
}

function getPartyDisplayLabel(party, partyList = parties) {
  const name = getPartyDisplayName(party);
  if (!name) return "";

  const duplicateNameCount = partyList.filter(
    (item) => normalizePartyText(getPartyDisplayName(item)) === normalizePartyText(name)
  ).length;

  return duplicateNameCount > 1 ? `${name} (${party.type})` : name;
}

function normalizePartyText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function updateJournalPartyNames(partyId, oldLabel, newLabel, oldName = "") {
  if (!partyId || !newLabel) return;

  let journals;
  try {
    const parsed = JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]");
    journals = Array.isArray(parsed) ? parsed : [];
  } catch {
    journals = [];
  }

  let didChange = false;
  const nextJournals = journals.map((journal) => {
    if (!Array.isArray(journal.lines)) return journal;

    const nextLines = journal.lines.map((line) => {
      const shouldUpdate =
        line &&
        ((line.partyId && line.partyId === partyId) ||
          (!line.partyId && oldLabel && line.name === oldLabel) ||
          (!line.partyId && oldName && line.name === oldName));

      if (!shouldUpdate) return line;
      didChange = true;
      return { ...line, name: newLabel, partyId };
    });

    return { ...journal, lines: nextLines };
  });

  if (didChange) {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(nextJournals));
  }
}

function syncJournalPartyLabels() {
  let journals;
  try {
    const parsed = JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]");
    journals = Array.isArray(parsed) ? parsed : [];
  } catch {
    journals = [];
  }

  const partyMap = new Map(parties.map((party) => [party.id, getPartyDisplayLabel(party, parties)]));
  let didChange = false;
  const nextJournals = journals.map((journal) => {
    if (!Array.isArray(journal.lines)) return journal;

    const nextLines = journal.lines.map((line) => {
      if (!line || !line.partyId || !partyMap.has(line.partyId)) return line;
      const nextName = partyMap.get(line.partyId);
      if (line.name === nextName) return line;
      didChange = true;
      return { ...line, name: nextName };
    });

    return { ...journal, lines: nextLines };
  });

  if (didChange) {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(nextJournals));
  }
}

function openModal(partyId = "") {
  const party = parties.find((item) => item.id === partyId);
  editingPartyId = party ? party.id : "";
  form.reset();
  typeSelect.value = party ? party.type : "Customer";
  renderDynamicFields(typeSelect.value);
  setBankValues(party && party.bank ? party.bank : {});

  if (party) {
    setFieldValues(party.fields || {});
    modalTitle.textContent = "Edit Party";
    saveButton.textContent = "Update Party";
  } else {
    modalTitle.textContent = "Create Party";
    saveButton.textContent = "Save Party";
  }

  modal.hidden = false;
  setTimeout(() => {
    const firstInput = modal.querySelector("input, select, textarea");
    if (firstInput) firstInput.focus();
  }, 0);
}

function closeModal() {
  modal.hidden = true;
  editingPartyId = "";
}

function renderDynamicFields(type, values = {}) {
  dynamicFields.innerHTML = getFieldsForType(type)
    .map((field) => renderField(field, values[field.name] || ""))
    .join("");
  wireDoFields();
}

function getFieldsForType(type) {
  if (type === "Customer") {
    return [
      textField("customerName", "Customer Name", true),
      textareaField("address", "Address", "wide"),
      textField("mobileNumber", "Mobile Number"),
      emailField("email", "Email"),
      textField("bin", "BIN"),
      textField("tin", "TIN"),
    ];
  }

  if (type === "Supplier") {
    return [
      textField("supplierName", "Supplier Name", true),
      selectField("businessNature", "Company/Individual", ["Company", "Individual"]),
      conditionalField(textField("contactPerson", "Name of Contact Person"), "businessNature", "Individual"),
      textareaField("billingAddress", "Billing Address", "wide"),
      doField("shippingSameAsBilling", "Do"),
      textareaField("shippingAddress", "Shipping Address", "wide"),
      textField("district", "District"),
      textField("mobileNumber", "Mobile Number"),
      emailField("email", "Email"),
      textField("bin", "BIN"),
      textField("tin", "TIN"),
    ];
  }

  if (type === "Both") {
    return [
      textField("partyName", "Party Name", true),
      selectField("businessNature", "Company/Individual", ["Company", "Individual"]),
      conditionalField(textField("contactPerson", "Name of Contact Person"), "businessNature", "Individual"),
      textareaField("address", "Address", "wide"),
      textareaField("billingAddress", "Billing Address", "wide"),
      doField("shippingSameAsBilling", "Do"),
      textareaField("shippingAddress", "Shipping Address", "wide"),
      textField("district", "District"),
      textField("mobileNumber", "Mobile Number"),
      emailField("email", "Email"),
      textField("bin", "BIN"),
      textField("tin", "TIN"),
    ];
  }

  return [
    textField("employeeName", "Employee Name", true),
    dateField("joiningDate", "Date of Joining"),
    dateField("releaseDate", "Date of Release"),
    textField("designation", "Designation"),
    textField("nid", "NID"),
    textareaField("currentAddress", "Current Address", "wide"),
    doField("permanentSameAsCurrent", "Do"),
    textareaField("permanentAddress", "Permanent Address", "wide"),
    textField("mobileNumber", "Mobile Number"),
    emailField("personalEmail", "Personal Email"),
    emailField("officialEmail", "Official Email"),
    dateField("realDob", "Real Date of Birth"),
    doField("certificateDobSameAsReal", "Do"),
    dateField("certificateDob", "Certificate Date of Birth"),
    textField("tin", "TIN"),
  ];
}

function textField(name, label, required = false) {
  return { kind: "input", type: "text", name, label, required };
}

function emailField(name, label) {
  return { kind: "input", type: "email", name, label };
}

function dateField(name, label) {
  return { kind: "input", type: "date", name, label };
}

function textareaField(name, label, span = "") {
  return { kind: "textarea", name, label, span };
}

function selectField(name, label, options) {
  return { kind: "select", name, label, options };
}

function doField(name, label) {
  return { kind: "checkbox", name, label };
}

function conditionalField(field, sourceName, sourceValue) {
  return { ...field, condition: { sourceName, sourceValue } };
}

function renderField(field, value) {
  const conditionAttrs = field.condition
    ? ` data-party-condition-source="${field.condition.sourceName}" data-party-condition-value="${field.condition.sourceValue}" hidden`
    : "";

  if (field.kind === "checkbox") {
    return `
      <label class="party-do-field"${conditionAttrs}>
        <input name="${field.name}" type="checkbox" ${value ? "checked" : ""} />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }

  const spanClass =
    field.span === "wide" ? " party-field--wide" : field.span === "full" ? " party-field--full" : "";
  const required = field.required ? " required" : "";

  if (field.kind === "textarea") {
    return `
      <label class="party-field${spanClass}"${conditionAttrs}>
        <span>${escapeHtml(field.label)}</span>
        <textarea name="${field.name}"${required}>${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  if (field.kind === "select") {
    return `
      <label class="party-field"${conditionAttrs}>
        <span>${escapeHtml(field.label)}</span>
        <select name="${field.name}"${required}>
          ${field.options
            .map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`)
            .join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="party-field"${conditionAttrs}>
      <span>${escapeHtml(field.label)}</span>
      <input name="${field.name}" type="${field.type}" value="${escapeHtml(value)}"${required} autocomplete="off" />
    </label>
  `;
}

function wireDoFields() {
  const shippingSame = form.elements.shippingSameAsBilling;
  const billingAddress = form.elements.billingAddress;
  const shippingAddress = form.elements.shippingAddress;
  const permanentSame = form.elements.permanentSameAsCurrent;
  const currentAddress = form.elements.currentAddress;
  const permanentAddress = form.elements.permanentAddress;
  const dobSame = form.elements.certificateDobSameAsReal;
  const realDob = form.elements.realDob;
  const certificateDob = form.elements.certificateDob;

  bindMirror(shippingSame, billingAddress, shippingAddress);
  bindMirror(permanentSame, currentAddress, permanentAddress);
  bindMirror(dobSame, realDob, certificateDob);
  wireConditionalFields();
}

function wireConditionalFields() {
  const conditionalLabels = Array.from(form.querySelectorAll("[data-party-condition-source]"));
  const syncAll = () => {
    conditionalLabels.forEach((label) => {
      const source = form.elements[label.dataset.partyConditionSource];
      const isHidden = !source || source.value !== label.dataset.partyConditionValue;
      const input = label.querySelector("input, select, textarea");
      label.hidden = isHidden;
      if (input) input.disabled = isHidden;
    });
  };

  conditionalLabels.forEach((label) => {
    const source = form.elements[label.dataset.partyConditionSource];
    if (source && !source.dataset.partyConditionWired) {
      source.addEventListener("change", syncAll);
      source.dataset.partyConditionWired = "true";
    }
  });

  syncAll();
}

function bindMirror(toggle, source, target) {
  if (!toggle || !source || !target) return;

  const sync = () => {
    if (toggle.checked) {
      target.value = source.value;
      target.disabled = true;
    } else {
      target.disabled = false;
    }
  };

  toggle.addEventListener("change", sync);
  source.addEventListener("input", sync);
  sync();
}

function setFieldValues(values) {
  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value || "";
    }
  });
  wireDoFields();
}

function setBankValues(bank) {
  form.elements.bankName.value = bank.bankName || "";
  form.elements.accountName.value = bank.accountName || "";
  form.elements.accountNumber.value = bank.accountNumber || "";
  form.elements.branchName.value = bank.branchName || "";
  form.elements.routingNumber.value = bank.routingNumber || "";
}

function collectFormData() {
  const type = typeSelect.value;
  const fields = {};

  getFieldsForType(type).forEach((field) => {
    const input = form.elements[field.name];
    if (!input) return;
    if (input.disabled) {
      fields[field.name] = "";
      return;
    }
    fields[field.name] = input.type === "checkbox" ? input.checked : input.value.trim();
  });

  return {
    type,
    fields,
    bank: {
      bankName: form.elements.bankName.value.trim(),
      accountName: form.elements.accountName.value.trim(),
      accountNumber: form.elements.accountNumber.value.trim(),
      branchName: form.elements.branchName.value.trim(),
      routingNumber: form.elements.routingNumber.value.trim(),
    },
  };
}

function handleSubmit(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const now = new Date().toISOString();
  const partyData = collectFormData();

  if (editingPartyId) {
    const oldParty = parties.find((party) => party.id === editingPartyId);
    const oldLabel = oldParty ? getPartyDisplayLabel(oldParty, parties) : "";
    const oldName = oldParty ? getPartyDisplayName(oldParty) : "";
    parties = parties.map((party) =>
      party.id === editingPartyId ? { ...party, ...partyData, updatedAt: now } : party
    );
    const updatedParty = parties.find((party) => party.id === editingPartyId);
    const newLabel = updatedParty ? getPartyDisplayLabel(updatedParty, parties) : "";
    updateJournalPartyNames(editingPartyId, oldLabel, newLabel, oldName);
    syncJournalPartyLabels();
  } else {
    parties.push({
      id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      ...partyData,
    });
  }

  saveParties();
  syncJournalPartyLabels();
  closeModal();
  renderActiveRegister();
}

function openRegister(type) {
  activeRegisterType = PARTY_TYPES.includes(type) ? type : "Customer";
  renderActiveRegister();
  registerModal.hidden = false;
}

function closeRegister() {
  registerModal.hidden = true;
}

function renderActiveRegister() {
  const config = REGISTER_CONFIGS[activeRegisterType];
  const typedParties = parties.filter((party) => party.type === activeRegisterType);

  registerTitle.textContent = config.title;
  registerSummary.textContent = `${typedParties.length} ${typedParties.length === 1 ? "party" : "parties"}`;
  registerTableHead.innerHTML = `
    <tr>
      ${config.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
    </tr>
  `;
  registerTableBody.innerHTML = "";

  if (!typedParties.length) {
    registerEmpty.hidden = false;
    registerTableWrap.hidden = true;
    return;
  }

  registerEmpty.hidden = true;
  registerTableWrap.hidden = false;
  registerTableBody.innerHTML = typedParties.map((party, index) => getRowHtml(activeRegisterType, party, index)).join("");
}

function getRowHtml(type, party, index) {
  const fields = party.fields || {};
  const bank = party.bank || {};
  const bankLabel = [bank.bankName, bank.accountNumber].filter(Boolean).join(" | ");
  const actions = `
    <td class="cell-center">
      <button class="icon-action-button party-action--edit" type="button" data-edit-party="${escapeHtml(party.id)}" title="Edit party" aria-label="Edit party">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
        </svg>
      </button>
    </td>
    <td class="cell-center">
      <button class="icon-action-button icon-action-button--danger" type="button" data-delete-party="${escapeHtml(party.id)}" title="Delete party" aria-label="Delete party">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2m-1 4v8M9 10v8M6 6l1 15h10l1-15"></path>
        </svg>
      </button>
    </td>
  `;

  if (type === "Customer") {
    return `
      <tr>
      <td class="cell-center">${index + 1}</td>
      <td class="cell-left">${escapeHtml(getPartyDisplayLabel(party))}</td>
      <td class="cell-left">${escapeHtml(fields.address)}</td>
      <td class="cell-center">${escapeHtml(fields.mobileNumber)}</td>
      <td class="cell-left">${escapeHtml(fields.email)}</td>
      <td class="cell-center">${escapeHtml(fields.bin)}</td>
      <td class="cell-center">${escapeHtml(fields.tin)}</td>
      <td class="cell-left">${escapeHtml(bankLabel)}</td>
      ${actions}
      </tr>
    `;
  }

  if (type === "Employee") {
    return `
      <tr>
      <td class="cell-center">${index + 1}</td>
      <td class="cell-left">${escapeHtml(getPartyDisplayLabel(party))}</td>
      <td class="cell-center">${escapeHtml(formatDate(fields.joiningDate))}</td>
      <td class="cell-center">${escapeHtml(formatDate(fields.releaseDate))}</td>
      <td class="cell-left">${escapeHtml(fields.designation)}</td>
      <td class="cell-center">${escapeHtml(fields.nid)}</td>
      <td class="cell-left">${escapeHtml(fields.currentAddress)}</td>
      <td class="cell-left">${escapeHtml(fields.permanentAddress)}</td>
      <td class="cell-center">${escapeHtml(fields.mobileNumber)}</td>
      <td class="cell-left">${escapeHtml(fields.personalEmail)}</td>
      <td class="cell-left">${escapeHtml(fields.officialEmail)}</td>
      <td class="cell-center">${escapeHtml(formatDate(fields.realDob))}</td>
      <td class="cell-center">${escapeHtml(formatDate(fields.certificateDob))}</td>
      <td class="cell-center">${escapeHtml(fields.tin)}</td>
      <td class="cell-left">${escapeHtml(bankLabel)}</td>
      ${actions}
      </tr>
    `;
  }

  const name = getPartyDisplayLabel(party);
  const commonCells =
    type === "Both"
      ? `
        <td class="cell-left">${escapeHtml(fields.address)}</td>
        <td class="cell-left">${escapeHtml(fields.billingAddress)}</td>
        <td class="cell-left">${escapeHtml(fields.shippingAddress)}</td>
      `
      : `
        <td class="cell-left">${escapeHtml(fields.billingAddress)}</td>
        <td class="cell-left">${escapeHtml(fields.shippingAddress)}</td>
      `;

  return `
    <tr>
    <td class="cell-center">${index + 1}</td>
    <td class="cell-left">${escapeHtml(name)}</td>
    <td class="cell-center">${escapeHtml(fields.businessNature)}</td>
    <td class="cell-left">${escapeHtml(fields.contactPerson)}</td>
    ${commonCells}
    <td class="cell-center">${escapeHtml(fields.district)}</td>
    <td class="cell-center">${escapeHtml(fields.mobileNumber)}</td>
    <td class="cell-left">${escapeHtml(fields.email)}</td>
    <td class="cell-center">${escapeHtml(fields.bin)}</td>
    <td class="cell-center">${escapeHtml(fields.tin)}</td>
    <td class="cell-left">${escapeHtml(bankLabel)}</td>
    ${actions}
    </tr>
  `;
}

function showDeleteConfirm(partyId) {
  pendingDeleteId = partyId;
  deleteModal.hidden = false;
}

function hideDeleteConfirm() {
  pendingDeleteId = "";
  deleteModal.hidden = true;
}

function deletePendingParty() {
  if (!pendingDeleteId) return;
  parties = parties.filter((party) => party.id !== pendingDeleteId);
  saveParties();
  hideDeleteConfirm();
  renderActiveRegister();
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

createButton.addEventListener("click", () => openModal());
closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
typeSelect.addEventListener("change", () => renderDynamicFields(typeSelect.value));
form.addEventListener("submit", handleSubmit);
deleteYesButton.addEventListener("click", deletePendingParty);
deleteNoButton.addEventListener("click", hideDeleteConfirm);
registerCloseButton.addEventListener("click", closeRegister);
registerButtons.forEach((button) => {
  button.addEventListener("click", () => openRegister(button.dataset.openPartyRegister));
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) hideDeleteConfirm();
});

registerModal.addEventListener("click", (event) => {
  if (event.target === registerModal) closeRegister();
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-party]");
  const deleteButton = event.target.closest("[data-delete-party]");

  if (editButton) {
    openModal(editButton.getAttribute("data-edit-party"));
  }

  if (deleteButton) {
    showDeleteConfirm(deleteButton.getAttribute("data-delete-party"));
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!deleteModal.hidden) {
    hideDeleteConfirm();
  } else if (!registerModal.hidden) {
    closeRegister();
  } else if (!modal.hidden) {
    closeModal();
  }
});

renderDynamicFields(typeSelect.value);
renderActiveRegister();
