const PARTY_TYPES = new Set(["Customer", "Supplier", "Both", "Employee"]);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateJournal(item) {
  if (!isPlainObject(item) || !String(item.number || "").trim()) {
    throw validationError("Journal number is required.");
  }

  if (item.lines !== undefined && !Array.isArray(item.lines)) {
    throw validationError("Journal lines must be an array.");
  }
}

function validateParty(item) {
  if (!isPlainObject(item) || !String(item.id || "").trim()) {
    throw validationError("Party id is required.");
  }

  if (!PARTY_TYPES.has(item.type)) {
    throw validationError("Party type is invalid.");
  }

  if (item.fields !== undefined && !isPlainObject(item.fields)) {
    throw validationError("Party fields must be an object.");
  }

  if (item.bank !== undefined && !isPlainObject(item.bank)) {
    throw validationError("Party bank details must be an object.");
  }
}

function validateChartNode(node) {
  if (!isPlainObject(node) || !String(node.name || "").trim()) {
    throw validationError("Chart node name is required.");
  }

  if (node.type !== "group" && node.type !== "ledger") {
    throw validationError("Chart node type is invalid.");
  }

  if (node.type === "group" && node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      throw validationError("Chart group children must be an array.");
    }

    node.children.forEach(validateChartNode);
  }
}

function validateSetting(item) {
  if (!isPlainObject(item) || !String(item.id || "").trim()) {
    throw validationError("Setting id is required.");
  }

  if (item.value !== undefined && !isPlainObject(item.value)) {
    throw validationError("Setting value must be an object.");
  }
}

function validateChallan(item) {
  if (!isPlainObject(item) || !String(item.id || "").trim()) {
    throw validationError("Challan id is required.");
  }

  if (!String(item.challanNumber || "").trim()) {
    throw validationError("Challan number is required.");
  }

  ["individualAmount", "totalAmount"].forEach((amountKey) => {
    if (item[amountKey] !== undefined && !Number.isFinite(Number(item[amountKey]))) {
      throw validationError("Challan amount is invalid.");
    }
  });
}

function validateItem(collectionName, item) {
  if (collectionName === "journals") {
    validateJournal(item);
    return;
  }

  if (collectionName === "parties") {
    validateParty(item);
    return;
  }

  if (collectionName === "chartOfAccounts") {
    validateChartNode(item);
    return;
  }

  if (collectionName === "challans") {
    validateChallan(item);
    return;
  }

  if (collectionName === "settings") {
    validateSetting(item);
  }
}

function validateCollection(collectionName, items) {
  if (!Array.isArray(items)) {
    throw validationError("Collection payload must be an array.");
  }

  items.forEach((item) => validateItem(collectionName, item));
}

module.exports = {
  validateCollection,
  validateItem,
};
