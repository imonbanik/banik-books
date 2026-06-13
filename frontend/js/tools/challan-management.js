document.addEventListener("DOMContentLoaded", async () => {
  const TIN_BIN_INFO_SETTING_KEY = "challanTinBinInfo";
  const WINDOW_QUERY_KEY = "challanWindow";
  const allowedSeparateWindows = new Set(["verification", "tin-bin", "prepare", "record", "register"]);
  const pageParams = new URLSearchParams(window.location.search);
  const separateWindowType = pageParams.get(WINDOW_QUERY_KEY) || "";
  const isSeparateWindow = allowedSeparateWindows.has(separateWindowType);
  const MANAGED_ENTRY_OPTION_CONFIGS = [
    {
      key: "withheldFy",
      label: "Fiscal Year",
      selectId: "entryWithheldFy",
      addFieldId: "entryWithheldFyAddField",
      addInputId: "entryWithheldFyAddInput",
      deletePanelId: "entryWithheldFyDeletePanel",
      deleteListId: "entryWithheldFyDeleteList",
      storageKey: "banikBooksChallanFiscalYears",
      deletedStorageKey: "banikBooksChallanDeletedFiscalYears",
      defaults: [],
      placeholder: "Write fiscal year",
    },
    {
      key: "month",
      label: "Month",
      selectId: "entryMonth",
      addFieldId: "entryMonthAddField",
      addInputId: "entryMonthAddInput",
      deletePanelId: "entryMonthDeletePanel",
      deleteListId: "entryMonthDeleteList",
      storageKey: "banikBooksChallanMonths",
      deletedStorageKey: "banikBooksChallanDeletedMonths",
      defaults: [],
      placeholder: "Example: Dec-25",
    },
    {
      key: "taxCategory",
      label: "Tax Category",
      selectId: "entryTaxCategory",
      addFieldId: "entryTaxCategoryAddField",
      addInputId: "entryTaxCategoryAddInput",
      deletePanelId: "entryTaxCategoryDeletePanel",
      deleteListId: "entryTaxCategoryDeleteList",
      storageKey: "banikBooksChallanTaxCategories",
      deletedStorageKey: "banikBooksChallanDeletedTaxCategories",
      defaults: [],
      placeholder: "Write tax category",
    },
    {
      key: "taxNature",
      label: "Tax Nature",
      selectId: "entryTaxNature",
      addFieldId: "entryTaxNatureAddField",
      addInputId: "entryTaxNatureAddInput",
      deletePanelId: "entryTaxNatureDeletePanel",
      deleteListId: "entryTaxNatureDeleteList",
      storageKey: "banikBooksChallanTaxNatures",
      deletedStorageKey: "banikBooksChallanDeletedTaxNatures",
      defaults: [],
      placeholder: "Write tax nature",
    },
  ];
  const challanPattern = /^(\d{4})-(\d{11})$/;

  const verificationButton = document.getElementById("showChallanVerification");
  const verificationModal = document.getElementById("challanVerificationModal");
  const quickForm = document.getElementById("challanRegisterForm");
  const quickInput = document.getElementById("challanNumber");
  const quickError = document.getElementById("challanNumberError");

  const entryButton = document.getElementById("openEntryChallanModal");
  const prepareAChallanButton = document.getElementById("openPrepareAChallanModal");
  const tinBinInfoButton = document.getElementById("openTinBinInfoModal");
  const registerButton = document.getElementById("showChallanRegister");
  const toast = document.getElementById("challanToast");

  const tinBinInfoModal = document.getElementById("tinBinInfoModal");
  const tinBinInfoForm = document.getElementById("tinBinInfoForm");
  const tinBinInfoError = document.getElementById("tinBinInfoError");
  const tinBinOrganizationInput = document.getElementById("tinBinOrganizationName");
  const tinBinTinInput = document.getElementById("tinBinTinNumber");
  const tinBinBinInput = document.getElementById("tinBinBinNumber");
  const tinBinInfoEmpty = document.getElementById("tinBinInfoEmpty");
  const tinBinInfoTableWrap = document.getElementById("tinBinInfoTableWrap");
  const tinBinInfoTableBody = document.getElementById("tinBinInfoTableBody");
  const prepareAChallanModal = document.getElementById("prepareAChallanModal");
  const prepareAChallanForm = document.getElementById("prepareAChallanForm");
  const prepareAChallanError = document.getElementById("prepareAChallanError");
  const prepareAChallanResult = document.getElementById("prepareAChallanResult");
  const prepareDeducteeParty = document.getElementById("prepareDeducteeParty");
  const prepareDeductorParty = document.getElementById("prepareDeductorParty");
  const prepareDeducteeTin = document.getElementById("prepareDeducteeTin");
  const prepareDeductorTin = document.getElementById("prepareDeductorTin");
  const prepareTinInputs = Array.from(
    document.querySelectorAll("#prepareDeducteeTin, #prepareDeductorTin")
  );
  const prepareAmountInput = document.getElementById("prepareAmount");
  const preparePhoneInput = document.getElementById("preparePhoneNumber");
  const prepareCommentInput = document.getElementById("prepareComment");
  const entryModal = document.getElementById("entryChallanModal");
  const registerModal = document.getElementById("registerChallanModal");
  const entryForm = document.getElementById("entryChallanForm");
  const entryError = document.getElementById("entryChallanError");
  const entryChallanInput = document.getElementById("entryChallanNumber");
  const entryDateInput = document.getElementById("entryChallanDate");
  const entryOrganizationSelect = document.getElementById("entryOrganizationName");
  const entryOrganizationNewField = document.getElementById("entryOrganizationNewField");
  const entryOrganizationNewInput = document.getElementById("entryOrganizationNewName");
  const entryOrganizationDeletePanel = document.getElementById("entryOrganizationDeletePanel");
  const entryOrganizationDeleteList = document.getElementById("entryOrganizationDeleteList");
  const amountInputs = Array.from(document.querySelectorAll("[data-amount-input]"));

  const registerSummary = document.getElementById("challanRegisterSummary");
  const registerEmpty = document.getElementById("challanRegisterEmpty");
  const registerTableWrap = document.getElementById("challanRegisterTableWrap");
  const registerTableBody = document.getElementById("challanRegisterTableBody");
  const registerIndividualTotal = document.getElementById("registerIndividualTotal");
  const registerExportRow = document.getElementById("challanRegisterExportRow");
  const exportRegisterExcelButton = document.getElementById("exportRegisterExcel");
  const sortButtons = Array.from(document.querySelectorAll(".register-sort-button"));
  const columnFilterControls = Array.from(
    document.querySelectorAll("[data-register-filter]")
  );

  let entries = [];
  let managedEntryDeletedKeys = {};
  let managedEntryOptions = {};
  let deletedOrganizationKeys = [];
  let organizationNames = [];
  let partyRecords = [];
  let tinBinInfoRecords = [];
  let registerFilters = {};
  let currentRegisterRows = [];
  let currentSort = {
    key: "challanDate",
    direction: "desc",
  };
  let toastTimer = null;
  let didHydrateToolSettingsFromBackend = false;

  if (isSeparateWindow) {
    document.body.classList.add("challan-window");
  }

  function initializeEmptyToolSettings() {
    managedEntryDeletedKeys = loadAllManagedEntryDeletedKeys();
    managedEntryOptions = loadAllManagedEntryOptions();
    deletedOrganizationKeys = loadDeletedOrganizationKeys();
    organizationNames = loadOrganizationNames();
  }

  async function hydrateToolSettingsFromBackend() {
    if (!window.BanikApi || typeof window.BanikApi.getSetting !== "function") {
      showToast("Backend data service is not ready. Challan settings were not loaded.", "error");
      return;
    }

    try {
      const settings = await window.BanikApi.getSetting("challanManagementOptions");

      if (!settings) {
        didHydrateToolSettingsFromBackend = true;
        await syncToolSettingsToBackend();
        return;
      }

      managedEntryOptions =
        settings.managedEntryOptions && typeof settings.managedEntryOptions === "object"
          ? settings.managedEntryOptions
          : managedEntryOptions;
      managedEntryDeletedKeys =
        settings.managedEntryDeletedKeys && typeof settings.managedEntryDeletedKeys === "object"
          ? settings.managedEntryDeletedKeys
          : managedEntryDeletedKeys;
      organizationNames = Array.isArray(settings.organizationNames)
        ? settings.organizationNames
        : organizationNames;
      deletedOrganizationKeys = Array.isArray(settings.deletedOrganizationKeys)
        ? settings.deletedOrganizationKeys
        : deletedOrganizationKeys;
      didHydrateToolSettingsFromBackend = true;
    } catch {
      showToast("Could not load challan settings from backend.", "error");
    }
  }

  async function syncToolSettingsToBackend() {
    if (!window.BanikApi || typeof window.BanikApi.saveSetting !== "function") {
      return;
    }

    if (!didHydrateToolSettingsFromBackend) {
      return;
    }

    try {
      await window.BanikApi.saveSetting("challanManagementOptions", {
        managedEntryOptions,
        managedEntryDeletedKeys,
        organizationNames,
        deletedOrganizationKeys,
      });
    } catch {
      showToast("Could not save challan settings to backend.", "error");
    }
  }

  function normalizeTinBinRecords(records) {
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .map((record) => ({
        id: String(record && record.id ? record.id : ""),
        organizationName: normalizeOrganizationName(record && record.organizationName),
        tinNumber: String((record && record.tinNumber) || "").replace(/\D/g, "").slice(0, 12),
        binNumber: String((record && record.binNumber) || "").replace(/\D/g, "").slice(0, 13),
        updatedAt: String((record && record.updatedAt) || ""),
      }))
      .filter((record) => record.id && record.organizationName)
      .sort((leftRecord, rightRecord) =>
        leftRecord.organizationName.localeCompare(rightRecord.organizationName)
      );
  }

  async function loadTinBinInfoFromBackend() {
    if (!window.BanikApi || typeof window.BanikApi.getSetting !== "function") {
      tinBinInfoRecords = [];
      return;
    }

    try {
      const settings = await window.BanikApi.getSetting(TIN_BIN_INFO_SETTING_KEY);
      tinBinInfoRecords = normalizeTinBinRecords(settings && settings.records);
    } catch {
      tinBinInfoRecords = [];
      showToast("Could not load TIN/BIN info from backend.", "error");
    }
  }

  function getPartyFields(party) {
    return party && party.fields && typeof party.fields === "object" ? party.fields : {};
  }

  function getPartyDisplayName(party) {
    const fields = getPartyFields(party);
    return normalizeOrganizationName(
      fields.customerName ||
        fields.supplierName ||
        fields.partyName ||
        fields.employeeName ||
        party?.name ||
        ""
    );
  }

  function getPartyDisplayLabel(party, partyList = partyRecords) {
    const name = getPartyDisplayName(party);
    if (!name) {
      return "";
    }

    const duplicateNameCount = partyList.filter(
      (item) => getOrganizationKey(getPartyDisplayName(item)) === getOrganizationKey(name)
    ).length;

    return duplicateNameCount > 1 ? `${name} (${party.type || "Party"})` : name;
  }

  function getPartyTinBinRecord(party) {
    const fields = getPartyFields(party);
    const organizationName = getPartyDisplayLabel(party);

    if (!party || !party.id || !organizationName) {
      return null;
    }

    return {
      id: `party:${party.id}`,
      organizationName,
      tinNumber: String(fields.tin || "").replace(/\D/g, "").slice(0, 12),
      binNumber: String(fields.bin || "").replace(/\D/g, "").slice(0, 13),
      source: "party",
    };
  }

  function getPartyTinBinRecords() {
    return partyRecords
      .map(getPartyTinBinRecord)
      .filter(Boolean)
      .sort((leftRecord, rightRecord) =>
        leftRecord.organizationName.localeCompare(rightRecord.organizationName)
      );
  }

  function getTinBinSourceRecords({ requireTin = false } = {}) {
    const sourceMap = new Map();

    getPartyTinBinRecords().forEach((record) => {
      if (!requireTin || /^\d{12}$/.test(record.tinNumber)) {
        sourceMap.set(getOrganizationKey(record.organizationName), record);
      }
    });

    tinBinInfoRecords.forEach((record) => {
      if (!requireTin || /^\d{12}$/.test(record.tinNumber)) {
        sourceMap.set(getOrganizationKey(record.organizationName), { ...record, source: "tinBinInfo" });
      }
    });

    return Array.from(sourceMap.values()).sort((leftRecord, rightRecord) =>
      leftRecord.organizationName.localeCompare(rightRecord.organizationName)
    );
  }

  async function loadPartyRecordsFromBackend() {
    if (!window.BanikApi || typeof window.BanikApi.list !== "function") {
      partyRecords = [];
      showToast("Backend party records are not ready.", "error");
      return;
    }

    try {
      const remoteParties = await window.BanikApi.list("parties");
      partyRecords = Array.isArray(remoteParties)
        ? remoteParties.filter((party) => party && party.id && getPartyDisplayName(party))
        : [];
    } catch {
      partyRecords = [];
      showToast("Could not load Party Management names from backend.", "error");
    }
  }

  function sortEntriesByCreatedAt(sourceEntries) {
    return [...sourceEntries].sort((leftEntry, rightEntry) =>
      String(rightEntry.createdAt || "").localeCompare(String(leftEntry.createdAt || ""))
    );
  }

  async function loadCloudEntries() {
    try {
      if (window.BanikApi && typeof window.BanikApi.list === "function") {
        entries = sortEntriesByCreatedAt(await window.BanikApi.list("challans"));
        return;
      }

      entries = [];
      showToast("Backend data service is not ready. Please refresh after signing in.", "error");
    } catch {
      entries = [];
      showToast("Could not load backend challans. Check sign-in and internet connection.", "error");
    }
  }

  async function saveCloudEntry(entry) {
    if (window.BanikApi && typeof window.BanikApi.upsert === "function") {
      return window.BanikApi.upsert("challans", entry.id, entry);
    }

    throw new Error("Backend data service is not ready.");
  }

  async function deleteCloudEntry(entryId) {
    if (window.BanikApi && typeof window.BanikApi.remove === "function") {
      await window.BanikApi.remove("challans", entryId);
      return;
    }

    throw new Error("Backend data service is not ready.");
  }

  function normalizeEntryOption(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function getEntryOptionKey(value) {
    return normalizeEntryOption(value).toLowerCase();
  }

  function readStorageArray(storageKey) {
    void storageKey;
    return [];
  }

  function loadAllManagedEntryDeletedKeys() {
    return MANAGED_ENTRY_OPTION_CONFIGS.reduce((deletedMap, config) => {
      deletedMap[config.key] = readStorageArray(config.deletedStorageKey);
      return deletedMap;
    }, {});
  }

  function loadManagedEntryOptions(config) {
    const deletedKeys = managedEntryDeletedKeys[config.key] || [];

    return Array.from(
      new Map(
        [
          ...config.defaults,
          ...readStorageArray(config.storageKey),
        ]
          .map(normalizeEntryOption)
          .filter(Boolean)
          .filter((option) => !deletedKeys.includes(getEntryOptionKey(option)))
          .map((option) => [getEntryOptionKey(option), option])
      ).values()
    ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));
  }

  function loadAllManagedEntryOptions() {
    return MANAGED_ENTRY_OPTION_CONFIGS.reduce((optionMap, config) => {
      optionMap[config.key] = loadManagedEntryOptions(config);
      return optionMap;
    }, {});
  }

  function persistManagedEntryOptions(config) {
    void config;
    syncToolSettingsToBackend();
  }

  function persistManagedEntryDeletedKeys(config) {
    void config;
    syncToolSettingsToBackend();
  }

  function getManagedEntryControl(config, suffix) {
    const idBySuffix = {
      select: config.selectId,
      addField: config.addFieldId,
      addInput: config.addInputId,
      deletePanel: config.deletePanelId,
      deleteList: config.deleteListId,
    };

    return document.getElementById(idBySuffix[suffix]);
  }

  function findManagedEntryOption(config, value) {
    const targetKey = getEntryOptionKey(value);
    return (managedEntryOptions[config.key] || []).find(
      (option) => getEntryOptionKey(option) === targetKey
    );
  }

  function renderManagedEntryOptions(config, selectedValue) {
    const select = getManagedEntryControl(config, "select");
    const placeholderOption = new Option("Select " + config.label.toLowerCase(), "");

    select.innerHTML = "";
    placeholderOption.disabled = true;
    placeholderOption.hidden = true;
    select.append(placeholderOption);
    (managedEntryOptions[config.key] || []).forEach((option) => {
      select.append(new Option(option, option));
    });
    select.append(new Option("Add", "__add__"));
    select.append(new Option("Delete", "__delete__"));
    select.value = selectedValue || "";
  }

  function renderAllManagedEntryOptions() {
    MANAGED_ENTRY_OPTION_CONFIGS.forEach((config) => {
      const select = getManagedEntryControl(config, "select");
      renderManagedEntryOptions(config, select.value);
      toggleManagedEntryOptionState(config);
    });
  }

  function addManagedEntryOption(config, rawValue) {
    const optionValue = normalizeEntryOption(rawValue);
    if (!optionValue) {
      return "";
    }

    const existingOption = findManagedEntryOption(config, optionValue);
    if (existingOption) {
      return existingOption;
    }

    managedEntryDeletedKeys[config.key] = (managedEntryDeletedKeys[config.key] || []).filter(
      (deletedKey) => deletedKey !== getEntryOptionKey(optionValue)
    );
    managedEntryOptions[config.key] = [...(managedEntryOptions[config.key] || []), optionValue].sort(
      (leftValue, rightValue) => leftValue.localeCompare(rightValue)
    );

    persistManagedEntryDeletedKeys(config);
    persistManagedEntryOptions(config);
    renderManagedEntryOptions(config, optionValue);
    return optionValue;
  }

  function commitManagedEntryOption(config) {
    const addInput = getManagedEntryControl(config, "addInput");
    const newValue = normalizeEntryOption(addInput.value);

    if (!newValue) {
      setEntryError("Write " + config.label.toLowerCase() + " before clicking plus.");
      addInput.focus();
      return false;
    }

    const existingOption = findManagedEntryOption(config, newValue);
    if (existingOption) {
      setEntryError(
        "This " + config.label.toLowerCase() + " already exists. Select it from the dropdown."
      );
      showToast("Same " + config.label.toLowerCase() + " already exists.", "error");
      addInput.focus();
      return false;
    }

    addManagedEntryOption(config, newValue);
    setEntryError("");
    toggleManagedEntryOptionState(config);
    showToast(config.label + " option added.", "success");
    return true;
  }

  function renderManagedEntryDeleteList(config) {
    const deleteList = getManagedEntryControl(config, "deleteList");
    const options = managedEntryOptions[config.key] || [];

    if (options.length === 0) {
      deleteList.innerHTML =
        '<p class="organization-delete-empty">No saved options to delete.</p>';
      return;
    }

    deleteList.innerHTML = options
      .map(
        (option) => `
          <div class="organization-delete-row">
            <span>${escapeHtml(option)}</span>
            <button
              class="icon-action-button icon-action-button--danger"
              type="button"
              data-delete-entry-option="${escapeHtml(config.key)}"
              data-delete-entry-option-value="${escapeHtml(option)}"
              title="Delete option"
              aria-label="Delete ${escapeHtml(option)}"
            >
              ${trashIcon()}
            </button>
          </div>
        `
      )
      .join("");
  }

  function deleteManagedEntryOption(config, rawValue) {
    const optionValue = normalizeEntryOption(rawValue);
    const optionKey = getEntryOptionKey(optionValue);

    managedEntryOptions[config.key] = (managedEntryOptions[config.key] || []).filter(
      (option) => getEntryOptionKey(option) !== optionKey
    );
    managedEntryDeletedKeys[config.key] = Array.from(
      new Set([...(managedEntryDeletedKeys[config.key] || []), optionKey])
    );

    persistManagedEntryOptions(config);
    persistManagedEntryDeletedKeys(config);
    renderManagedEntryOptions(config, "__delete__");
    toggleManagedEntryOptionState(config);
    showToast(config.label + " option removed.", "success");
  }

  function toggleManagedEntryOptionState(config) {
    const select = getManagedEntryControl(config, "select");
    const addField = getManagedEntryControl(config, "addField");
    const addInput = getManagedEntryControl(config, "addInput");
    const deletePanel = getManagedEntryControl(config, "deletePanel");
    const isAdding = select.value === "__add__";
    const isDeleting = select.value === "__delete__";

    addField.hidden = !isAdding;
    addInput.required = isAdding;
    deletePanel.hidden = !isDeleting;

    if (!isAdding) {
      addInput.value = "";
    }

    if (isDeleting) {
      renderManagedEntryDeleteList(config);
    }
  }

  function finalizeManagedEntryOption(config) {
    const select = getManagedEntryControl(config, "select");
    const addInput = getManagedEntryControl(config, "addInput");

    if (select.value === "__add__") {
      return {
        error: "Click the green plus button to add " + config.label.toLowerCase() + " first.",
        focus: addInput,
        value: "",
      };
    }

    if (select.value === "__delete__") {
      return {
        error: "Select or add " + config.label.toLowerCase() + ".",
        focus: select,
        value: "",
      };
    }

    const selectedValue = normalizeEntryOption(select.value);
    if (!selectedValue) {
      return {
        error: "Select or add " + config.label.toLowerCase() + ".",
        focus: select,
        value: "",
      };
    }

    return { error: "", focus: null, value: selectedValue };
  }

  function getManagedEntryConfig(key) {
    return MANAGED_ENTRY_OPTION_CONFIGS.find((config) => config.key === key);
  }

  function normalizeOrganizationName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function getOrganizationKey(value) {
    return normalizeOrganizationName(value).toLowerCase();
  }

  function loadDeletedOrganizationKeys() {
    return [];
  }

  function persistDeletedOrganizationKeys() {
    syncToolSettingsToBackend();
  }

  function loadOrganizationNames() {
    return Array.from(
      new Map(
        []
          .map(normalizeOrganizationName)
          .filter(Boolean)
          .filter((name) => !deletedOrganizationKeys.includes(getOrganizationKey(name)))
          .map((name) => [getOrganizationKey(name), name])
      ).values()
    ).sort((leftName, rightName) => leftName.localeCompare(rightName));
  }

  function persistOrganizationNames() {
    syncToolSettingsToBackend();
  }

  function findOrganizationName(name) {
    const targetKey = getOrganizationKey(name);
    return (
      getPartyTinBinRecords().find((record) => getOrganizationKey(record.organizationName) === targetKey)
        ?.organizationName ||
      organizationNames.find((existingName) => getOrganizationKey(existingName) === targetKey)
    );
  }

  function renderOrganizationOptions(selectedValue) {
    entryOrganizationSelect.innerHTML = "";
    const placeholderOption = new Option("Select organization/individual", "");
    const partyNames = getPartyTinBinRecords().map((record) => record.organizationName);
    const customNames = organizationNames.filter(
      (name) =>
        !deletedOrganizationKeys.includes(getOrganizationKey(name)) &&
        !partyNames.some((partyName) => getOrganizationKey(partyName) === getOrganizationKey(name))
    );

    placeholderOption.disabled = true;
    placeholderOption.hidden = true;
    entryOrganizationSelect.append(placeholderOption);
    partyNames.forEach((name) => {
      entryOrganizationSelect.append(new Option(name, name));
    });
    customNames.forEach((name) => {
      entryOrganizationSelect.append(new Option(name, name));
    });
    entryOrganizationSelect.append(new Option("Add", "__add_new__"));
    entryOrganizationSelect.append(new Option("Delete", "__delete_name__"));

    entryOrganizationSelect.value = selectedValue || "";
  }

  function addOrganizationName(name) {
    const normalizedName = normalizeOrganizationName(name);
    if (!normalizedName) {
      return "";
    }

    const existingName = findOrganizationName(normalizedName);
    if (existingName) {
      return existingName;
    }

    deletedOrganizationKeys = deletedOrganizationKeys.filter(
      (deletedKey) => deletedKey !== getOrganizationKey(normalizedName)
    );
    organizationNames = [...organizationNames, normalizedName].sort((leftName, rightName) =>
      leftName.localeCompare(rightName)
    );
    persistDeletedOrganizationKeys();
    persistOrganizationNames();
    renderOrganizationOptions(normalizedName);
    return normalizedName;
  }

  function commitOrganizationName() {
    const newName = normalizeOrganizationName(entryOrganizationNewInput.value);

    if (!newName) {
      setEntryError("Write organization/individual name before clicking plus.");
      entryOrganizationNewInput.focus();
      return false;
    }

    const existingName = findOrganizationName(newName);
    if (existingName) {
      setEntryError("This name already exists. Select it from the dropdown.");
      showToast("Same organization/individual name already exists.", "error");
      entryOrganizationNewInput.focus();
      return false;
    }

    addOrganizationName(newName);
    setEntryError("");
    toggleNewOrganizationField();
    showToast("Name added to the dropdown.", "success");
    return true;
  }

  function toggleNewOrganizationField() {
    const isAddingNew = entryOrganizationSelect.value === "__add_new__";
    const isDeletingName = entryOrganizationSelect.value === "__delete_name__";
    entryOrganizationNewField.hidden = !isAddingNew;
    entryOrganizationNewInput.required = isAddingNew;
    entryOrganizationDeletePanel.hidden = !isDeletingName;

    if (!isAddingNew) {
      entryOrganizationNewInput.value = "";
    }

    if (isDeletingName) {
      renderOrganizationDeleteList();
    }
  }

  function renderOrganizationDeleteList() {
    if (organizationNames.length === 0) {
      entryOrganizationDeleteList.innerHTML =
        '<p class="organization-delete-empty">No saved names to delete.</p>';
      return;
    }

    entryOrganizationDeleteList.innerHTML = organizationNames
      .map(
        (name) => `
          <div class="organization-delete-row">
            <span>${escapeHtml(name)}</span>
            <button
              class="icon-action-button icon-action-button--danger"
              type="button"
              data-delete-organization="${escapeHtml(name)}"
              title="Delete name"
              aria-label="Delete ${escapeHtml(name)}"
            >
              ${trashIcon()}
            </button>
          </div>
        `
      )
      .join("");
  }

  function deleteOrganizationName(name) {
    const normalizedName = normalizeOrganizationName(name);
    const organizationKey = getOrganizationKey(normalizedName);

    organizationNames = organizationNames.filter(
      (existingName) => getOrganizationKey(existingName) !== organizationKey
    );
    deletedOrganizationKeys = Array.from(new Set([...deletedOrganizationKeys, organizationKey]));

    persistOrganizationNames();
    persistDeletedOrganizationKeys();
    renderOrganizationOptions("__delete_name__");
    toggleNewOrganizationField();
    showToast("Name removed from dropdown.", "success");
  }

  function updateBodyModalState() {
    const hasVisibleModal =
      !verificationModal.hidden ||
      !tinBinInfoModal.hidden ||
      !prepareAChallanModal.hidden ||
      !entryModal.hidden ||
      !registerModal.hidden;
    document.body.classList.toggle("modal-open", hasVisibleModal);
  }

  function showToast(message, variant) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toast.textContent = message;
    toast.dataset.variant = variant || "info";
    toast.hidden = false;

    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function openSeparateWindow(type) {
    if (!allowedSeparateWindows.has(type)) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set(WINDOW_QUERY_KEY, type);
    window.open(
      url.toString(),
      `banik-challan-${type}`,
      "popup=yes,width=1080,height=760,left=120,top=80,resizable=yes,scrollbars=yes"
    );
  }

  function closeSeparateWindowIfNeeded() {
    if (!isSeparateWindow) {
      return false;
    }

    window.close();
    return true;
  }

  function formatChallanValue(rawValue) {
    const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 15);
    const yearPart = digitsOnly.slice(0, 4);
    const serialPart = digitsOnly.slice(4, 15);

    return digitsOnly.length <= 4 ? yearPart : yearPart + "-" + serialPart;
  }

  function formatMonthLabel(monthValue) {
    if (!monthValue) {
      return "";
    }

    if (!/^\d{4}-\d{2}$/.test(monthValue)) {
      return monthValue;
    }

    const [year, month] = monthValue.split("-");
    const monthDate = new Date(Number(year), Number(month) - 1, 1);
    const monthLabel = monthDate.toLocaleString("en-US", { month: "short" });
    return monthLabel + "-" + year.slice(-2);
  }

  function formatDateDisplay(dateValue) {
    if (!dateValue) {
      return "";
    }

    const [year, month, day] = dateValue.split("-");
    return day + "/" + month + "/" + year;
  }

  function parseDisplayDate(displayValue) {
    if (!displayValue) {
      return 0;
    }

    const parts = displayValue.split(/[/-]/).map(Number);
    if (String(displayValue).slice(0, 4).match(/^\d{4}$/)) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }

    return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
  }

  function parseEntryTimestamp(value) {
    if (!value) {
      return null;
    }

    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function formatEntryTimestamp(value) {
    const entryDate = parseEntryTimestamp(value);

    if (!entryDate) {
      return "-";
    }

    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const hour24 = entryDate.getHours();
    const hour12 = hour24 % 12 || 12;
    const meridiem = hour24 >= 12 ? "PM" : "AM";

    const formattedDate =
      padDatePart(entryDate.getDate()) +
      "-" +
      monthLabels[entryDate.getMonth()] +
      "-" +
      entryDate.getFullYear();
    const formattedTime =
      padDatePart(hour12) +
      ":" +
      padDatePart(entryDate.getMinutes()) +
      ":" +
      padDatePart(entryDate.getSeconds()) +
      " " +
      meridiem;

    return formattedDate + "\n" + formattedTime;
  }

  function normalizeAmount(value) {
    const cleanValue = sanitizeAmountInput(value);
    if (!cleanValue || cleanValue === ".") {
      return null;
    }

    const parsedValue = Number(cleanValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
  }

  function formatAmount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "";
    }

    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  function formatAChallanAmount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "";
    }

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  function unformatAmount(value) {
    return String(value).replace(/[^\d.]/g, "");
  }

  function sanitizeAmountInput(value) {
    const cleanValue = String(value || "").replace(/,/g, "").replace(/[^\d.]/g, "");
    const [wholePart, ...decimalParts] = cleanValue.split(".");

    if (decimalParts.length === 0) {
      return wholePart;
    }

    return wholePart + "." + decimalParts.join("").slice(0, 2);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function downloadIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />
      </svg>
    `;
  }

  function trashIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2m-1 4v8M9 10v8M6 6l1 15h10l1-15" />
      </svg>
    `;
  }

  function buildOfficialChallanUrl(challanNumber) {
    return (
      "https://www.achallan.gov.bd/acs/General/PrintChallanSlipDetailsHTML?challanNo=" +
      encodeURIComponent(challanNumber)
    );
  }

  function openChallanDownload(challanNumber) {
    window.open(buildOfficialChallanUrl(challanNumber), "_blank", "noopener");
  }

  function setQuickError(message) {
    quickError.textContent = message;
    quickError.hidden = !message;
    quickInput.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function setEntryError(message) {
    entryError.textContent = message;
    entryError.hidden = !message;
  }

  function setPrepareAChallanError(message) {
    prepareAChallanError.textContent = message;
    prepareAChallanError.hidden = !message;
  }

  function setTinBinInfoError(message) {
    tinBinInfoError.textContent = message;
    tinBinInfoError.hidden = !message;
  }

  function renderTinBinInfoTable() {
    const records = getPartyTinBinRecords();

    if (records.length === 0) {
      tinBinInfoEmpty.hidden = false;
      tinBinInfoTableWrap.hidden = true;
      tinBinInfoTableBody.innerHTML = "";
      return;
    }

    tinBinInfoEmpty.hidden = true;
    tinBinInfoTableWrap.hidden = false;
    tinBinInfoTableBody.innerHTML = records
      .map(
        (record) => `
          <tr class="tin-bin-table-row" data-select-tin-bin-party="${escapeHtml(record.id)}">
            <td>${escapeHtml(record.organizationName)}</td>
            <td>${escapeHtml(record.tinNumber || "-")}</td>
            <td>${escapeHtml(record.binNumber || "-")}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderPreparePartyOptions() {
    const options = getTinBinSourceRecords({ requireTin: true });

    [prepareDeducteeParty, prepareDeductorParty].forEach((select) => {
      const selectedValue = select.value;
      select.innerHTML = "";
      const placeholder = new Option("Select party", "");
      placeholder.disabled = true;
      placeholder.hidden = true;
      select.append(placeholder);
      options.forEach((record) => {
        const option = new Option(record.organizationName, record.id);
        option.dataset.tinNumber = record.tinNumber;
        select.append(option);
      });
      select.value = options.some((record) => record.id === selectedValue) ? selectedValue : "";
    });
  }

  function getTinBinRecordById(recordId) {
    return getTinBinSourceRecords().find((record) => record.id === recordId) || null;
  }

  function updatePrepareTinFromParty(select, tinInput) {
    const record = getTinBinRecordById(select.value);
    tinInput.value = record ? record.tinNumber : "";
    setPrepareAChallanError("");
  }

  function renderTinBinPartyOptions() {
    const options = getPartyTinBinRecords();
    const selectedValue = tinBinOrganizationInput.value;

    tinBinOrganizationInput.innerHTML = "";
    const placeholder = new Option("Select party", "");
    placeholder.disabled = true;
    placeholder.hidden = true;
    tinBinOrganizationInput.append(placeholder);
    options.forEach((record) => {
      const option = new Option(record.organizationName, record.id);
      option.dataset.tinNumber = record.tinNumber;
      option.dataset.binNumber = record.binNumber;
      tinBinOrganizationInput.append(option);
    });
    tinBinOrganizationInput.value = options.some((record) => record.id === selectedValue)
      ? selectedValue
      : "";
  }

  function updateTinBinFieldsFromParty() {
    const record = getPartyTinBinRecords().find((item) => item.id === tinBinOrganizationInput.value);
    tinBinTinInput.value = record ? record.tinNumber : "";
    tinBinBinInput.value = record ? record.binNumber : "";
    setTinBinInfoError("");
  }

  function setPrepareAChallanResult(result) {
    if (!result) {
      prepareAChallanResult.hidden = true;
      prepareAChallanResult.innerHTML = "";
      return;
    }

    const lines = [
      escapeHtml(result.message || "A-Challan automation completed."),
      result.trackingNumber ? "Tracking Number: " + escapeHtml(result.trackingNumber) : "",
      result.finalUrl
        ? `<a href="${escapeHtml(result.finalUrl)}" target="_blank" rel="noopener">Open govt result page</a>`
        : "",
    ].filter(Boolean);

    prepareAChallanResult.innerHTML = lines.join("<br />");
    prepareAChallanResult.hidden = false;
  }

  function compareValues(leftValue, rightValue) {
    if (leftValue < rightValue) {
      return -1;
    }

    if (leftValue > rightValue) {
      return 1;
    }

    return 0;
  }

  function getSortableValue(entry, key) {
    switch (key) {
      case "withheldFy":
        return entry.withheldFy || "";
      case "month":
        return entry.monthRaw || "";
      case "taxCategory":
        return entry.taxCategory || "";
      case "taxNature":
        return entry.taxNature || "";
      case "challanNumber":
        return entry.challanNumber || "";
      case "challanDate":
        return parseDisplayDate(entry.challanDate);
      case "createdAt":
        return parseEntryTimestamp(entry.createdAt)?.getTime() || 0;
      case "organizationName":
        return (entry.organizationName || "").toLowerCase();
      case "individualAmount":
        return Number(entry.individualAmount) || 0;
      case "totalAmount":
        return Number(entry.totalAmount) || 0;
      default:
        return "";
    }
  }

  function getRegisterCellValue(entry, key) {
    switch (key) {
      case "withheldFy":
        return entry.withheldFy || "";
      case "month":
        return entry.monthLabel || formatMonthLabel(entry.monthRaw);
      case "taxCategory":
        return entry.taxCategory || "";
      case "taxNature":
        return entry.taxNature || "";
      case "challanNumber":
        return entry.challanNumber || "";
      case "challanDate":
        return entry.challanDate || "";
      case "createdAt":
        return formatEntryTimestamp(entry.createdAt);
      case "organizationName":
        return entry.organizationName || "";
      case "individualAmount":
        return formatAmount(entry.individualAmount);
      case "totalAmount":
        return formatAmount(entry.totalAmount);
      default:
        return "";
    }
  }

  function populateColumnFilters() {
    columnFilterControls.forEach((control) => {
      const key = control.dataset.registerFilter;
      const selectedValue = registerFilters[key] || "";
      const values = Array.from(
        new Set(entries.map((entry) => getRegisterCellValue(entry, key)).filter(Boolean))
      ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));

      control.innerHTML = "";
      control.append(new Option("All", ""));
      values.forEach((value) => {
        control.append(new Option(value, value));
      });

      control.value = values.includes(selectedValue) ? selectedValue : "";
      registerFilters[key] = control.value;
    });
  }

  function getFilteredEntries(sourceEntries) {
    return sourceEntries.filter((entry) => {
      return Object.entries(registerFilters).every(([key, filterValue]) => {
        return !filterValue || getRegisterCellValue(entry, key) === filterValue;
      });
    });
  }

  function getSortedEntries() {
    const sortedEntries = getFilteredEntries([...entries]);

    sortedEntries.sort((leftEntry, rightEntry) => {
      const leftValue = getSortableValue(leftEntry, currentSort.key);
      const rightValue = getSortableValue(rightEntry, currentSort.key);
      const comparison = compareValues(leftValue, rightValue);

      return currentSort.direction === "asc" ? comparison : comparison * -1;
    });

    return sortedEntries;
  }

  function updateSortButtons() {
    sortButtons.forEach((button) => {
      const isActive = button.dataset.sort === currentSort.key;
      button.classList.toggle("is-active", isActive);
      button.dataset.direction = isActive ? currentSort.direction : "";
    });
  }

  function updateRegisterFooter(sortedEntries) {
    const individualTotal = sortedEntries.reduce(
      (total, entry) => total + (Number(entry.individualAmount) || 0),
      0
    );
    registerIndividualTotal.textContent = formatAmount(individualTotal);
  }

  function downloadVisibleRegisterAsExcel() {
    if (currentRegisterRows.length === 0) {
      showToast("No visible register data to export.", "error");
      return;
    }

    const headers = [
      "Fiscal Year",
      "Month",
      "Tax Category",
      "Tax Nature",
      "A-Challan Number",
      "A-Challan Date",
      "Organization / Individual",
      "Individual Amount",
      "Total Amount",
      "Time of Entry",
    ];
    const individualTotal = currentRegisterRows.reduce(
      (total, entry) => total + (Number(entry.individualAmount) || 0),
      0
    );
    const bodyRows = currentRegisterRows
      .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(entry.withheldFy)}</td>
            <td>${escapeHtml(entry.monthLabel || formatMonthLabel(entry.monthRaw))}</td>
            <td>${escapeHtml(entry.taxCategory)}</td>
            <td>${escapeHtml(entry.taxNature)}</td>
            <td style="mso-number-format:'\\@';">${escapeHtml(entry.challanNumber)}</td>
            <td>${escapeHtml(entry.challanDate)}</td>
            <td>${escapeHtml(entry.organizationName)}</td>
            <td>${escapeHtml(formatAmount(entry.individualAmount))}</td>
            <td>${escapeHtml(formatAmount(entry.totalAmount))}</td>
            <td style="white-space: pre-line;">${escapeHtml(formatEntryTimestamp(entry.createdAt))}</td>
          </tr>
        `
      )
      .join("");
    const excelHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${bodyRows}
              <tr>
                <td colspan="7"><strong>Total Individual Amount</strong></td>
                <td><strong>${escapeHtml(formatAmount(individualTotal))}</strong></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + excelHtml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = "challan-register-" + datePart + ".xls";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderRegister() {
    const entryCount = entries.length;
    populateColumnFilters();
    const sortedEntries = getSortedEntries();
    currentRegisterRows = sortedEntries;
    registerSummary.textContent =
      entryCount === 0
        ? "No entries saved yet"
        : sortedEntries.length + " showing / " + entryCount + " saved";

    if (entryCount === 0 || sortedEntries.length === 0) {
      registerEmpty.hidden = false;
      registerEmpty.textContent =
        entryCount === 0
          ? "No saved challan entries yet."
          : "No challan entries match the selected filters.";
      registerTableWrap.hidden = true;
      registerExportRow.hidden = true;
      exportRegisterExcelButton.disabled = true;
      registerTableBody.innerHTML = "";
      updateSortButtons();
      return;
    }

    registerEmpty.hidden = true;
    registerTableWrap.hidden = false;
    registerExportRow.hidden = false;
    exportRegisterExcelButton.disabled = false;
    registerTableBody.innerHTML = sortedEntries
      .map(
        (entry) => `
          <tr>
            <td class="cell-center">${escapeHtml(entry.withheldFy)}</td>
            <td class="cell-center">${escapeHtml(entry.monthLabel || formatMonthLabel(entry.monthRaw))}</td>
            <td class="cell-center">${escapeHtml(entry.taxCategory)}</td>
            <td class="cell-center">${escapeHtml(entry.taxNature)}</td>
            <td class="cell-left">${escapeHtml(entry.challanNumber)}</td>
            <td class="cell-center">${escapeHtml(entry.challanDate)}</td>
            <td class="cell-left">${escapeHtml(entry.organizationName)}</td>
            <td class="cell-amount">${escapeHtml(formatAmount(entry.individualAmount))}</td>
            <td class="cell-amount">${escapeHtml(formatAmount(entry.totalAmount))}</td>
            <td class="cell-center" style="white-space: pre-line;">${escapeHtml(formatEntryTimestamp(entry.createdAt))}</td>
            <td class="cell-center">
              <button
                class="icon-action-button"
                type="button"
                data-download-challan="${escapeHtml(entry.challanNumber)}"
                title="Download challan"
                aria-label="Download challan"
              >
                ${downloadIcon()}
              </button>
            </td>
            <td class="cell-center">
              <button
                class="icon-action-button icon-action-button--danger"
                type="button"
                data-delete-entry="${escapeHtml(entry.id)}"
                title="Delete entry"
                aria-label="Delete entry"
              >
                ${trashIcon()}
              </button>
            </td>
          </tr>
        `
      )
      .join("");
    updateRegisterFooter(sortedEntries);
    updateSortButtons();
  }

  async function openEntryModal() {
    entryModal.hidden = false;
    setEntryError("");
    await loadPartyRecordsFromBackend();
    renderAllManagedEntryOptions();
    renderOrganizationOptions(entryOrganizationSelect.value);
    toggleNewOrganizationField();
    updateBodyModalState();
    window.setTimeout(() => {
      document.getElementById("entryWithheldFy").focus();
    }, 0);
  }

  function closeEntryModal() {
    if (closeSeparateWindowIfNeeded()) {
      return;
    }

    entryModal.hidden = true;
    setEntryError("");
    updateBodyModalState();
  }

  function openRegisterModal() {
    renderRegister();
    registerModal.hidden = false;
    updateBodyModalState();
  }

  function closeRegisterModal() {
    if (closeSeparateWindowIfNeeded()) {
      return;
    }

    registerModal.hidden = true;
    updateBodyModalState();
  }

  function openVerificationModal() {
    verificationModal.hidden = false;
    setQuickError("");
    updateBodyModalState();
    window.setTimeout(() => {
      quickInput.focus();
    }, 0);
  }

  function closeVerificationModal() {
    if (closeSeparateWindowIfNeeded()) {
      return;
    }

    verificationModal.hidden = true;
    setQuickError("");
    updateBodyModalState();
  }

  async function openPrepareAChallanModal() {
    prepareAChallanModal.hidden = false;
    setPrepareAChallanError("");
    setPrepareAChallanResult(null);
    updateBodyModalState();
    await loadPartyRecordsFromBackend();
    await loadTinBinInfoFromBackend();
    renderPreparePartyOptions();
    window.setTimeout(() => {
      document.getElementById("prepareChallanType").focus();
    }, 0);
  }

  function closePrepareAChallanModal() {
    if (closeSeparateWindowIfNeeded()) {
      return;
    }

    prepareAChallanModal.hidden = true;
    setPrepareAChallanError("");
    setPrepareAChallanResult(null);
    updateBodyModalState();
  }

  async function openTinBinInfoModal() {
    tinBinInfoModal.hidden = false;
    setTinBinInfoError("");
    renderTinBinInfoTable();
    updateBodyModalState();
    await loadPartyRecordsFromBackend();
    renderTinBinPartyOptions();
    updateTinBinFieldsFromParty();
    renderTinBinInfoTable();
    window.setTimeout(() => {
      tinBinOrganizationInput.focus();
    }, 0);
  }

  function closeTinBinInfoModal() {
    if (closeSeparateWindowIfNeeded()) {
      return;
    }

    tinBinInfoModal.hidden = true;
    setTinBinInfoError("");
    updateBodyModalState();
  }

  function resetEntryForm() {
    entryForm.reset();
    entryChallanInput.value = "";
    renderAllManagedEntryOptions();
    renderOrganizationOptions("");
    toggleNewOrganizationField();
    amountInputs.forEach((input) => {
      input.value = "";
    });
    setEntryError("");
  }

  verificationButton.addEventListener("click", openVerificationModal);
  prepareAChallanButton.addEventListener("click", openPrepareAChallanModal);
  tinBinInfoButton.addEventListener("click", openTinBinInfoModal);

  quickInput.addEventListener("input", () => {
    quickInput.value = formatChallanValue(quickInput.value);
    setQuickError("");
  });

  quickForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formattedValue = formatChallanValue(quickInput.value.trim());
    quickInput.value = formattedValue;

    if (!challanPattern.test(formattedValue)) {
      setQuickError("Enter a valid A-Challan number.");
      quickInput.focus();
      return;
    }

    setQuickError("");
    openChallanDownload(formattedValue);
  });

  entryButton.addEventListener("click", openEntryModal);
  registerButton.addEventListener("click", openRegisterModal);

  document.addEventListener("click", (event) => {
    const separateWindowButton = event.target.closest("[data-open-separate-window]");
    if (separateWindowButton) {
      event.preventDefault();
      event.stopPropagation();
      openSeparateWindow(separateWindowButton.dataset.openSeparateWindow);
      return;
    }

    if (event.target.closest("[data-close-verification-modal]")) {
      closeVerificationModal();
      return;
    }

    if (event.target.closest("[data-close-prepare-modal]")) {
      closePrepareAChallanModal();
      return;
    }

    if (event.target.closest("[data-close-tin-bin-modal]")) {
      closeTinBinInfoModal();
      return;
    }

    if (event.target.closest("[data-close-entry-modal]")) {
      closeEntryModal();
      return;
    }

    if (event.target.closest("[data-close-register-modal]")) {
      closeRegisterModal();
    }
  });

  verificationModal.addEventListener("click", (event) => {
    if (!event.target.closest(".challan-modal__dialog")) {
      closeVerificationModal();
    }
  });

  prepareAChallanModal.addEventListener("click", (event) => {
    if (!event.target.closest(".challan-modal__dialog")) {
      closePrepareAChallanModal();
    }
  });

  tinBinInfoModal.addEventListener("click", (event) => {
    if (!event.target.closest(".challan-modal__dialog")) {
      closeTinBinInfoModal();
    }
  });

  entryModal.addEventListener("click", (event) => {
    if (!event.target.closest(".challan-modal__dialog")) {
      closeEntryModal();
    }
  });

  registerModal.addEventListener("click", (event) => {
    if (!event.target.closest(".challan-modal__dialog")) {
      closeRegisterModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!verificationModal.hidden) {
      closeVerificationModal();
    }

    if (!prepareAChallanModal.hidden) {
      closePrepareAChallanModal();
    }

    if (!tinBinInfoModal.hidden) {
      closeTinBinInfoModal();
    }

    if (!entryModal.hidden) {
      closeEntryModal();
    }

    if (!registerModal.hidden) {
      closeRegisterModal();
    }
  });

  prepareTinInputs.forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 12);
      setPrepareAChallanError("");
    });
  });

  prepareDeducteeParty.addEventListener("change", () => {
    updatePrepareTinFromParty(prepareDeducteeParty, prepareDeducteeTin);
  });

  prepareDeductorParty.addEventListener("change", () => {
    updatePrepareTinFromParty(prepareDeductorParty, prepareDeductorTin);
  });

  preparePhoneInput.addEventListener("input", () => {
    preparePhoneInput.value = preparePhoneInput.value.replace(/\D/g, "").slice(0, 11);
    setPrepareAChallanError("");
  });

  prepareAmountInput.addEventListener("input", () => {
    prepareAmountInput.value = sanitizeAmountInput(prepareAmountInput.value);
    setPrepareAChallanError("");
  });

  prepareAmountInput.addEventListener("focus", () => {
    prepareAmountInput.value = unformatAmount(prepareAmountInput.value);
  });

  prepareAmountInput.addEventListener("blur", () => {
    const amount = normalizeAmount(prepareAmountInput.value);
    prepareAmountInput.value = amount === null ? "" : formatAChallanAmount(amount);
  });

  prepareAChallanForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const requiredControl = Array.from(
      prepareAChallanForm.querySelectorAll("select[required], input[required]")
    ).find((control) => !String(control.value || "").trim());

    if (requiredControl) {
      setPrepareAChallanError("Fill all fields before generating A-Challan.");
      requiredControl.focus();
      return;
    }

    const invalidTinInput = prepareTinInputs.find((input) => !/^\d{12}$/.test(input.value));

    if (invalidTinInput) {
      setPrepareAChallanError("TIN number must be exactly 12 digits.");
      invalidTinInput.focus();
      return;
    }

    if (!/^\d{11}$/.test(preparePhoneInput.value)) {
      setPrepareAChallanError("Phone number must be exactly 11 digits.");
      preparePhoneInput.focus();
      return;
    }

    if (normalizeAmount(prepareAmountInput.value) === null) {
      setPrepareAChallanError("Enter a valid amount.");
      prepareAmountInput.focus();
      return;
    }

    if (!window.BanikApi || typeof window.BanikApi.prepareAChallan !== "function") {
      setPrepareAChallanError("Backend A-Challan automation is not ready.");
      return;
    }

    const submitButton = prepareAChallanForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    const deducteeRecord = getTinBinRecordById(prepareDeducteeParty.value);
    const deductorRecord = getTinBinRecordById(prepareDeductorParty.value);

    setPrepareAChallanError("");
    setPrepareAChallanResult(null);
    submitButton.disabled = true;
    submitButton.textContent = "Generating...";

    try {
      const result = await window.BanikApi.prepareAChallan({
        challanType: document.getElementById("prepareChallanType").value,
        withholdingArea: document.getElementById("prepareWithholdingArea").value,
        deducteeName: deducteeRecord ? deducteeRecord.organizationName : "",
        deducteeTin: prepareDeducteeTin.value,
        deductorName: deductorRecord ? deductorRecord.organizationName : "",
        deductorTin: prepareDeductorTin.value,
        assessmentYear: document.getElementById("prepareAssessmentYear").value,
        amount: prepareAmountInput.value,
        phoneNumber: preparePhoneInput.value,
        comment: prepareCommentInput.value,
      });

      setPrepareAChallanResult(result);
      showToast("A-Challan automation completed.", "success");
    } catch (error) {
      setPrepareAChallanError(
        String(error.message || "A-Challan automation failed.").replace(/^API request failed:\s*/, "")
      );
      showToast("A-Challan automation failed.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });

  tinBinOrganizationInput.addEventListener("change", updateTinBinFieldsFromParty);

  tinBinInfoForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  tinBinInfoTableBody.addEventListener("click", (event) => {
    const row = event.target.closest("[data-select-tin-bin-party]");
    if (!row) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    tinBinOrganizationInput.value = row.dataset.selectTinBinParty || "";
    updateTinBinFieldsFromParty();
  });

  MANAGED_ENTRY_OPTION_CONFIGS.forEach((config) => {
    const select = getManagedEntryControl(config, "select");
    const addInput = getManagedEntryControl(config, "addInput");
    const deleteList = getManagedEntryControl(config, "deleteList");
    const addButton = document.querySelector(
      '[data-add-entry-option="' + config.key + '"]'
    );

    select.addEventListener("change", () => {
      setEntryError("");
      toggleManagedEntryOptionState(config);

      if (select.value === "__add__") {
        window.setTimeout(() => addInput.focus(), 0);
      }
    });

    addInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      setEntryError("Click the green plus button to add " + config.label.toLowerCase() + ".");
    });

    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      commitManagedEntryOption(config);
    });

    deleteList.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-entry-option]");
      if (!deleteButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      deleteManagedEntryOption(
        config,
        deleteButton.dataset.deleteEntryOptionValue
      );
    });
  });

  entryChallanInput.addEventListener("input", () => {
    entryChallanInput.value = formatChallanValue(entryChallanInput.value);
    setEntryError("");
  });

  entryOrganizationSelect.addEventListener("change", () => {
    setEntryError("");
    toggleNewOrganizationField();

    if (entryOrganizationSelect.value === "__add_new__") {
      window.setTimeout(() => entryOrganizationNewInput.focus(), 0);
    }
  });

  entryOrganizationNewInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    setEntryError("Click the green plus button to add organization/individual name.");
  });

  document.querySelector("[data-add-organization]").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    commitOrganizationName();
  });

  entryOrganizationDeleteList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-organization]");
    if (!deleteButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    deleteOrganizationName(deleteButton.dataset.deleteOrganization);
  });

  amountInputs.forEach((input) => {
    input.addEventListener("input", () => {
      input.value = sanitizeAmountInput(input.value);
    });

    input.addEventListener("focus", () => {
      input.value = unformatAmount(input.value);
    });

    input.addEventListener("blur", () => {
      const amount = normalizeAmount(input.value);
      input.value = amount === null ? "" : formatAmount(amount);
    });
  });

  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const withheldFyResult = finalizeManagedEntryOption(getManagedEntryConfig("withheldFy"));
    const monthResult = finalizeManagedEntryOption(getManagedEntryConfig("month"));
    const taxCategoryResult = finalizeManagedEntryOption(getManagedEntryConfig("taxCategory"));
    const taxNatureResult = finalizeManagedEntryOption(getManagedEntryConfig("taxNature"));
    const withheldFy = withheldFyResult.value;
    const monthRaw = monthResult.value;
    const monthLabel = monthResult.value;
    const taxCategory = taxCategoryResult.value;
    const taxNature = taxNatureResult.value;
    const challanNumber = formatChallanValue(entryChallanInput.value.trim());
    const challanDate = formatDateDisplay(entryDateInput.value);
    const organizationSelection = entryOrganizationSelect.value;
    const organizationName =
      organizationSelection === "__add_new__"
        ? ""
        : organizationSelection === "__delete_name__"
        ? ""
        : normalizeOrganizationName(organizationSelection);
    const individualAmount = normalizeAmount(
      document.getElementById("entryIndividualAmount").value
    );
    const totalAmount = normalizeAmount(document.getElementById("entryTotalAmount").value);

    entryChallanInput.value = challanNumber;

    for (const result of [
      withheldFyResult,
      monthResult,
      taxCategoryResult,
      taxNatureResult,
    ]) {
      if (result.error) {
        setEntryError(result.error);
        if (result.focus) {
          result.focus.focus();
        }
        return;
      }
    }

    if (!challanPattern.test(challanNumber)) {
      setEntryError("Enter a valid A-Challan number.");
      entryChallanInput.focus();
      return;
    }

    if (!challanDate) {
      setEntryError("Select an A-Challan date.");
      return;
    }

    if (!organizationName) {
      setEntryError(
        organizationSelection === "__add_new__"
          ? "Click the green plus button to add organization/individual name first."
          : "Select or add the name of the withheld organization or individual."
      );
      if (organizationSelection === "__add_new__") {
        entryOrganizationNewInput.focus();
      } else {
        entryOrganizationSelect.focus();
      }
      return;
    }

    if (individualAmount === null) {
      setEntryError("Enter a valid individual amount of challan.");
      return;
    }

    if (totalAmount === null) {
      setEntryError("Enter a valid total amount of challan.");
      return;
    }

    const entryRecord = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(36).slice(2),
      withheldFy,
      monthRaw,
      monthLabel,
      taxCategory,
      taxNature,
      challanNumber,
      challanDate,
      organizationName,
      individualAmount,
      totalAmount,
    };

    let savedEntry;

    try {
      savedEntry = await saveCloudEntry(entryRecord);
    } catch {
      setEntryError("Could not save this challan to backend. Check internet and try again.");
      showToast("Challan entry was not saved.", "error");
      return;
    }

    entries = [savedEntry, ...entries.filter((entry) => entry.id !== savedEntry.id)];
    renderRegister();
    resetEntryForm();
    closeEntryModal();
    showToast("Challan entry saved successfully.", "success");
  });

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const requestedSortKey = button.dataset.sort;

      if (currentSort.key === requestedSortKey) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = requestedSortKey;
        currentSort.direction = "asc";
      }

      renderRegister();
    });
  });

  columnFilterControls.forEach((control) => {
    control.addEventListener("change", () => {
      registerFilters[control.dataset.registerFilter] = control.value;
      renderRegister();
    });
  });

  exportRegisterExcelButton.addEventListener("click", downloadVisibleRegisterAsExcel);

  registerTableBody.addEventListener("click", async (event) => {
    const downloadButton = event.target.closest("[data-download-challan]");
    if (downloadButton) {
      event.preventDefault();
      event.stopPropagation();
      openChallanDownload(downloadButton.dataset.downloadChallan);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-entry]");
    if (!deleteButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const entryId = deleteButton.dataset.deleteEntry;
    const entryToDelete = entries.find((entry) => entry.id === entryId);
    if (!entryToDelete) {
      return;
    }

    if (!window.confirm("Delete this challan entry?")) {
      return;
    }

    try {
      await deleteCloudEntry(entryId);
    } catch {
      showToast("Could not delete this challan from backend. Try again.", "error");
      return;
    }

    entries = entries.filter((entry) => entry.id !== entryId);
    renderRegister();
    showToast("Challan entry deleted.", "success");
  });

  initializeEmptyToolSettings();
  await hydrateToolSettingsFromBackend();
  await loadPartyRecordsFromBackend();
  await loadTinBinInfoFromBackend();
  renderTinBinPartyOptions();
  renderPreparePartyOptions();
  renderAllManagedEntryOptions();
  renderOrganizationOptions("");
  toggleNewOrganizationField();
  await loadCloudEntries();
  renderRegister();

  if (separateWindowType === "verification") {
    openVerificationModal();
  } else if (separateWindowType === "tin-bin") {
    await openTinBinInfoModal();
  } else if (separateWindowType === "prepare") {
    await openPrepareAChallanModal();
  } else if (separateWindowType === "record") {
    await openEntryModal();
  } else if (separateWindowType === "register") {
    openRegisterModal();
  }
});
