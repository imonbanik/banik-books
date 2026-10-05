import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "banik-team-check-"));
process.env.BANIK_TEAM_STORAGE_ADAPTER = "file";
process.env.BANIK_TEAM_DATA_FILE = path.join(directory, "team.json");
process.env.BANIK_INVITE_EMAIL_API_URL = "";
delete process.env.BANIK_PUBLIC_URL;
delete process.env.BANIK_APP_URL;
const require = createRequire(import.meta.url);
const service = require("../backend/company-service.js");
const store = require("../backend/team-store.js");
const permissions = require("../backend/company-permissions.js");

const identity = (userId, email, profile = {}) => ({
  userId, email, emailVerified: true, fullName: userId,
  source: "local-dev-test", role: "user", workspaceId: "existing-workspace", profile,
});
const owner = identity("owner-one", "owner@example.com", { companyName: "Original Company", profileCompleted: true });
const junior = identity("junior-one", "junior@example.com", { accountType: "invited", fullName: "Junior Accountant" });
const otherOwner = identity("owner-two", "other@example.com", { companyName: "Other Company", profileCompleted: true });
const requestFor = (companyId) => ({ headers: { "x-banik-company-id": companyId } });
const tokenFrom = (invitation) => new URL(invitation.inviteUrl, "https://example.com").searchParams.get("token");

async function rejectsStatus(callback, statusCode) {
  await assert.rejects(callback, (error) => error.statusCode === statusCode);
}

try {
  const ownerContext = await service.resolveCompanyContext(owner);
  assert.equal(ownerContext.userId, owner.userId);
  assert.equal(ownerContext.storageUserId, owner.userId);
  assert.equal(ownerContext.storageWorkspaceId, owner.workspaceId);
  assert.equal(ownerContext.companyRole, "owner");
  assert.equal(ownerContext.permissions["team.manage"], true);
  assert.equal((await service.listCompanies(owner)).length, 1);
  assert.deepEqual(await service.listCompanies(junior), []);
  await rejectsStatus(() => service.resolveCompanyContext(junior), 403);
  const otherContext = await service.resolveCompanyContext(otherOwner);
  await rejectsStatus(() => service.resolveCompanyContext(owner, requestFor(otherContext.companyId)), 403);

  const invitation = await service.createInvitation(ownerContext, { email: junior.email, fullName: "Junior Accountant", role: "junior" });
  assert.equal(invitation.emailSent, false);
  assert.equal(invitation.mailStatus, "not_configured");
  assert.equal(invitation.invitation.permissions["journals.create"], true);
  assert.equal(invitation.invitation.permissions["journals.post"], false);
  assert.equal(invitation.invitation.permissions["parties.view"], false);
  assert.equal(invitation.invitation.tokenHash, undefined);
  const token = tokenFrom(invitation);
  assert.equal((await service.previewInvitation(token)).invitedEmail, junior.email);
  assert.ok(!(await fs.readFile(process.env.BANIK_TEAM_DATA_FILE, "utf8")).includes(token));
  await rejectsStatus(() => service.createInvitation(ownerContext, { email: junior.email }), 409);
  await rejectsStatus(() => service.acceptInvitation({ ...junior, emailVerified: false }, token), 403);
  await rejectsStatus(() => service.acceptInvitation(otherOwner, token), 403);

  // Competing accepts cannot both activate a membership or reuse the secret.
  const competingAccepts = await Promise.allSettled([
    service.acceptInvitation(junior, token), service.acceptInvitation(junior, token),
  ]);
  assert.equal(competingAccepts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(competingAccepts.filter((result) => result.status === "rejected").length, 1);
  await rejectsStatus(() => service.acceptInvitation(junior, token), 404);
  const juniorContext = await service.resolveCompanyContext(junior, requestFor(ownerContext.companyId));
  assert.equal(juniorContext.userId, junior.userId);
  assert.equal(juniorContext.storageUserId, owner.userId);
  assert.equal(juniorContext.storageWorkspaceId, owner.workspaceId);
  assert.equal(juniorContext.companyRole, "junior");
  assert.equal(juniorContext.permissions["journals.post"], false);
  assert.equal(juniorContext.permissions["team.manage"], false);
  assert.equal((await service.listCompanies(junior)).length, 1);
  await rejectsStatus(() => service.getTeam(juniorContext), 403);
  await rejectsStatus(() => service.createInvitation(juniorContext, { email: "attack@example.com", role: "owner" }), 403);
  await rejectsStatus(() => service.updateMember(ownerContext, owner.userId, { status: "removed" }), 403);
  await rejectsStatus(() => service.updateMember(otherContext, junior.userId, { status: "suspended" }), 404);

  await service.updateMember(ownerContext, junior.userId, { status: "suspended" });
  await rejectsStatus(() => service.resolveCompanyContext(junior, requestFor(ownerContext.companyId)), 403);
  assert.deepEqual(await service.listCompanies(junior), []);
  assert.equal((await store.queryTeamDocuments("companies", { ownerUserId: junior.userId })).length, 0);
  await service.updateMember(ownerContext, junior.userId, { status: "active" });
  assert.equal((await service.resolveCompanyContext(junior, requestFor(ownerContext.companyId))).permissions["journals.create"], true);

  const rotate = await service.createInvitation(ownerContext, { email: "rotate@example.com" });
  const rotated = await service.resendInvitation(ownerContext, rotate.invitation.id);
  await rejectsStatus(() => service.previewInvitation(tokenFrom(rotate)), 404);
  assert.equal((await service.previewInvitation(tokenFrom(rotated))).email, "rotate@example.com");
  await service.revokeInvitation(ownerContext, rotated.invitation.id);
  await rejectsStatus(() => service.previewInvitation(tokenFrom(rotated)), 404);
  await rejectsStatus(() => service.resendInvitation(otherContext, rotated.invitation.id), 404);

  const expiring = await service.createInvitation(ownerContext, { email: "expired@example.com" });
  await store.runTeamTransaction(async (transaction) => {
    const entry = await transaction.get("invitations", expiring.invitation.id);
    transaction.set("invitations", entry.id, { ...entry, expiresAt: "2000-01-01T00:00:00.000Z" });
  });
  await rejectsStatus(() => service.previewInvitation(tokenFrom(expiring)), 410);

  const dualMembership = await service.createInvitation(ownerContext, { email: otherOwner.email, role: "viewer" });
  await service.acceptInvitation(otherOwner, tokenFrom(dualMembership));
  assert.equal((await service.listCompanies(otherOwner)).length, 2);
  assert.equal((await service.resolveCompanyContext(otherOwner, requestFor(ownerContext.companyId))).storageUserId, owner.userId);
  assert.equal((await service.resolveCompanyContext(otherOwner, requestFor(otherContext.companyId))).storageUserId, otherOwner.userId);
  await service.updateMember(ownerContext, otherOwner.userId, { status: "removed" });
  assert.equal((await service.listCompanies(otherOwner)).length, 1);

  // Delegated managers cannot grant higher permissions, or keep managing after revocation.
  await service.updateMember(ownerContext, junior.userId, { permissions: { "team.manage": true } });
  const manager = await service.resolveCompanyContext(junior, requestFor(ownerContext.companyId));
  await rejectsStatus(() => service.createInvitation(manager, { email: "elevated@example.com", role: "accountant" }), 403);
  const delegated = await service.createInvitation(manager, { email: "delegated@example.com", role: "junior" });
  await service.updateMember(ownerContext, junior.userId, { status: "suspended" });
  await rejectsStatus(() => service.previewInvitation(tokenFrom(delegated)), 404);
  await rejectsStatus(() => service.createInvitation(manager, { email: "stale@example.com", role: "junior" }), 403);

  const noModules = Object.fromEntries(permissions.MODULE_KEYS.map((key) => [key, false]));
  const restricted = permissions.applyModuleCeiling(permissions.allPermissions(true), noModules, "owner", "user");
  assert.equal(restricted["team.manage"], true);
  assert.equal(restricted["journals.create"], false);
  assert.equal(restricted["reports.view"], false);
  assert.throws(() => permissions.assertDelegablePermissions({ companyRole: "owner", companyModules: noModules, permissions: restricted }, { "journals.create": true }), /does not have access/);
  assert.throws(() => permissions.normalizePermissions({ "global.admin": true }), /Invalid permission/);
  await rejectsStatus(() => service.assertUserAccountCanBeDeleted(owner.userId), 409);
  await rejectsStatus(() => service.assertUserAccountCanBeDeleted(junior.userId), 409);
  const activity = await service.listTeamActivity(ownerContext);
  assert.ok(activity.some((event) => event.action === "team.invitation_accepted" && event.actorId === junior.userId));
  assert.ok(activity.every((event) => event.companyId === ownerContext.companyId && !JSON.stringify(event).includes(token)));
  const team = await service.getTeam(ownerContext);
  assert.ok(team.permissionCatalog.some((entry) => entry.key === "journals.approve"));
  assert.equal(team.roleDefaults.junior["journals.post"], false);
  assert.equal(team.members.filter((member) => member.role === "owner").length, 1);
  console.log("Company/team checks passed: isolation, migration, invitations, concurrent acceptance, revocation, permissions and retained history.");
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
