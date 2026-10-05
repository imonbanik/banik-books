const { randomUUID } = require("node:crypto");

function createActivity(context, collection, entityId, action, before, after, details = {}) {
  return {
    id: randomUUID(), companyId: context.companyId,
    collection, entityId, entityNumber: after?.number || before?.number || entityId,
    action, actorId: context.userId,
    actorName: context.name || context.fullName || context.email || context.userId,
    actorEmail: context.email || "", timestamp: new Date().toISOString(),
    before: before || null, after: after || null,
    ...details,
  };
}

module.exports = { createActivity };
