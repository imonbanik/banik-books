const crypto = require("node:crypto");
const { getFirebaseAdminFirestore } = require("./firebase-admin-client");
const { getTeamDocument, queryTeamDocuments, runTeamTransaction } = require("./team-store");
const {
  MODULE_KEYS, PERMISSION_KEYS, PERMISSION_MODULE, PERMISSION_LABELS, MEMBER_ROLES, companyError,
  allPermissions, getRolePermissions, normalizeMemberRole, normalizePermissions,
  applyModuleCeiling, assertCompanyPermission, assertDelegablePermissions,
} = require("./company-permissions");

const INVITE_LIFETIME_MS = 72 * 60 * 60 * 1000;
const BUSINESS_PROFILE_FIELDS = Object.freeze([
  "companyName", "companyAddress", "businessType", "currency", "fiscalYearStart",
  "tinNumber", "binNumber", "dateFormat", "numberFormat", "preferredPlan", "companyLogoMeta", "letterheadMeta",
]);

function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function isLocal(authContext) { return String(authContext && authContext.source || "").startsWith("local-dev"); }
function membershipId(companyId, userId) { return Buffer.from(`${companyId}::${userId}`).toString("base64url"); }
function timestamp() { return new Date().toISOString(); }
function requireIdentity(authContext) {
  if (!authContext || !authContext.userId) throw companyError(401, "Please sign in first.");
  if (authContext.emailVerified === false || (!isLocal(authContext) && authContext.emailVerified !== true)) throw companyError(403, "Verify your email before accessing a company.");
}

async function getUserProfile(userId, authContext) {
  if (isLocal(authContext)) return userId === authContext.userId ? (authContext.profile || {}) : null;
  const snapshot = await getFirebaseAdminFirestore().collection("users").doc(userId).get();
  return snapshot.exists ? snapshot.data() || {} : null;
}

function businessProfile(profile, company) {
  const result = {};
  for (const key of BUSINESS_PROFILE_FIELDS) {
    if (profile && profile[key] !== undefined) result[key] = profile[key];
  }
  result.companyName = result.companyName || company.name;
  return result;
}

function getCompanyModules(profile, authContext) {
  const founderProfile = profile && profile.role === "admin";
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, Boolean(isLocal(authContext) || founderProfile || (profile && profile.permissions && profile.permissions[key] === true))]));
}

function recordTeamEvent(transaction, authContext, action, targetId, before = null, after = null) {
  const event = {
    id: crypto.randomUUID(), companyId: authContext.companyId, action,
    actorId: authContext.userId, actorName: authContext.fullName || authContext.name || authContext.email || authContext.userId,
    actorEmail: authContext.email || "", targetId, entityId: targetId, entityType: "team", collection: "team", timestamp: timestamp(), before, after,
  };
  transaction.set("events", event.id, event);
}

async function ensureLegacyCompany(authContext) {
  requireIdentity(authContext);
  const memberships = await queryTeamDocuments("memberships", { userId: authContext.userId });
  if (memberships.length) return;
  const profile = await getUserProfile(authContext.userId, authContext);
  if (!isLocal(authContext) && !profile) throw companyError(409, "Complete your account profile before opening a company.");
  if (profile && profile.disabled) throw companyError(403, "This account is disabled.");
  if (profile && profile.accountType === "invited") return;
  if (!isLocal(authContext) && !(profile && profile.profileCompleted)) {
    const invitations = await queryTeamDocuments("invitations", { email: normalizeEmail(authContext.email) });
    if (invitations.some((invitation) => invitation.status === "pending")) return;
    // Company setup remains available before profile completion for existing signup.
  }
  const storageWorkspaceId = String(authContext.workspaceId || "default");
  const companyId = `company_${crypto.createHash("sha256").update(`${authContext.userId}::${storageWorkspaceId}`).digest("hex").slice(0, 32)}`;
  const company = {
    id: companyId, name: String(profile && profile.companyName || "My company"),
    ownerUserId: authContext.userId, storageUserId: authContext.userId, storageWorkspaceId,
    status: "active", createdAt: timestamp(), legacyProfile: businessProfile(profile || {}, { name: "My company" }),
  };
  await runTeamTransaction(async (transaction) => {
    const existingMemberships = await transaction.query("memberships", { userId: authContext.userId });
    const existingCompany = await transaction.get("companies", companyId);
    if (existingMemberships.length) return;
    const owner = {
      id: membershipId(companyId, authContext.userId), companyId, userId: authContext.userId,
      email: normalizeEmail(authContext.email), fullName: String(profile && profile.fullName || authContext.fullName || authContext.name || ""),
      role: "owner", status: "active", permissions: allPermissions(true), joinedAt: timestamp(), updatedAt: timestamp(),
    };
    transaction.set("companies", companyId, existingCompany || company);
    transaction.set("memberships", owner.id, owner);
    recordTeamEvent(transaction, { ...authContext, companyId }, "company.created", companyId, null, { name: company.name });
  });
}

async function buildCompanyContext(authContext, company, member) {
  if (!company || company.status !== "active" || !member || member.status !== "active") throw companyError(403, "Your access to this company is inactive or unavailable.");
  const ownerProfile = await getUserProfile(company.ownerUserId, authContext);
  if (!isLocal(authContext) && !ownerProfile) throw companyError(403, "The company owner's profile is unavailable.");
  if (ownerProfile && ownerProfile.disabled) throw companyError(403, "This company is currently unavailable.");
  const companyModules = getCompanyModules(ownerProfile, authContext);
  const companyProfile = businessProfile(ownerProfile || company.legacyProfile || {}, company);
  return {
    ...authContext,
    companyId: company.id, companyRole: member.role, companyName: companyProfile.companyName,
    companyOwnerUserId: company.ownerUserId, companyModules, companyProfile,
    permissions: applyModuleCeiling(member.role === "owner" ? allPermissions(true) : member.permissions || {}, companyModules, member.role, authContext.role),
    storageUserId: company.storageUserId, storageWorkspaceId: company.storageWorkspaceId,
    fullName: authContext.fullName || authContext.name || member.fullName || "",
  };
}

async function listCompanies(authContext) {
  await ensureLegacyCompany(authContext);
  const memberships = await queryTeamDocuments("memberships", { userId: authContext.userId });
  const companies = [];
  for (const member of memberships) {
    if (member.status !== "active") continue;
    const company = await getTeamDocument("companies", member.companyId);
    if (!company || company.status !== "active") continue;
    try {
      const context = await buildCompanyContext(authContext, company, member);
      companies.push({ id: context.companyId, name: context.companyName, role: context.companyRole, permissions: context.permissions, modules: context.companyModules });
    } catch (error) {
      if (error.statusCode !== 403) throw error;
      // Suspending one company's owner must not block another active membership.
    }
  }
  return companies.sort((left, right) => (left.role === "owner" ? 0 : 1) - (right.role === "owner" ? 0 : 1) || left.name.localeCompare(right.name));
}

async function resolveCompanyContext(authContext, request = { headers: {} }) {
  requireIdentity(authContext);
  const requestedCompanyId = String(request.headers && request.headers["x-banik-company-id"] || "").trim();
  if (requestedCompanyId && !/^company_[a-f0-9]{32}$/.test(requestedCompanyId)) throw companyError(400, "Company id is invalid.");
  if (!requestedCompanyId) await ensureLegacyCompany(authContext);
  let member;
  if (requestedCompanyId) {
    member = await getTeamDocument("memberships", membershipId(requestedCompanyId, authContext.userId));
  } else {
    const memberships = await queryTeamDocuments("memberships", { userId: authContext.userId });
    member = memberships.filter((entry) => entry.status === "active").sort((left, right) => (left.role === "owner" ? 0 : 1) - (right.role === "owner" ? 0 : 1))[0];
  }
  if (!member) throw companyError(403, "You do not have active access to this company. Accept your invitation or contact the company owner.");
  return buildCompanyContext(authContext, await getTeamDocument("companies", member.companyId), member);
}

async function assertCurrentManager(transaction, authContext) {
  const company = await transaction.get("companies", authContext.companyId);
  const member = await transaction.get("memberships", membershipId(authContext.companyId, authContext.userId));
  if (!company || company.status !== "active" || !member || member.status !== "active") throw companyError(403, "Your company access is no longer active.");
  const current = {
    ...authContext, companyRole: member.role,
    permissions: applyModuleCeiling(member.role === "owner" ? allPermissions(true) : member.permissions || {}, authContext.companyModules, member.role, authContext.role),
  };
  assertCompanyPermission(current, "team.manage");
  return current;
}

function invitationStatus(invitation) {
  return invitation.status === "pending" && Date.parse(invitation.expiresAt) <= Date.now() ? "expired" : invitation.status;
}

function publicInvitation(invitation) {
  const { tokenHash, ...result } = invitation;
  return { ...result, status: invitationStatus(invitation) };
}

function cleanPermissionsForRole(authContext, role, override) {
  const base = applyModuleCeiling(getRolePermissions(role), authContext.companyModules, role, "user");
  return normalizePermissions(override, base);
}

async function getTeam(authContext) {
  assertCompanyPermission(authContext, "team.manage");
  const members = await queryTeamDocuments("memberships", { companyId: authContext.companyId });
  const invitations = await queryTeamDocuments("invitations", { companyId: authContext.companyId });
  return {
    company: { id: authContext.companyId, name: authContext.companyName, role: authContext.companyRole, permissions: authContext.permissions, modules: authContext.companyModules },
    members: members.map((member) => ({ ...member, permissions: applyModuleCeiling(member.role === "owner" ? allPermissions(true) : member.permissions || {}, authContext.companyModules, member.role, "user") })),
    invitations: invitations.map(publicInvitation).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    permissionCatalog: PERMISSION_KEYS.map((key) => ({ key, label: PERMISSION_LABELS[key] || key, module: PERMISSION_MODULE[key] })),
    roleDefaults: Object.fromEntries(MEMBER_ROLES.map((role) => [role, cleanPermissionsForRole(authContext, role)])),
  };
}

function createInviteSecret(id) {
  const token = `${id}.${crypto.randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: crypto.createHash("sha256").update(token).digest("hex") };
}

function buildInviteUrl(token) {
  const pathname = `/accept-invite.html?token=${encodeURIComponent(token)}`;
  const publicUrl = String(process.env.BANIK_PUBLIC_URL || process.env.BANIK_APP_URL || "").trim();
  if (!publicUrl) return pathname;
  const base = new URL(publicUrl);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw companyError(500, "The public application URL is invalid.");
  return new URL(pathname, base.origin).href;
}

async function deliverInvitation(invitation, inviteUrl) {
  const endpoint = String(process.env.BANIK_INVITE_EMAIL_API_URL || "").trim();
  if (!endpoint) return { emailSent: false, mailStatus: "not_configured" };
  if (!inviteUrl.startsWith("https://")) return { emailSent: false, mailStatus: "configuration_required" };
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return { emailSent: false, mailStatus: "configuration_required" };
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", ...(process.env.BANIK_INVITE_EMAIL_API_KEY ? { Authorization: `Bearer ${process.env.BANIK_INVITE_EMAIL_API_KEY}` } : {}) },
      body: JSON.stringify({
        ...(process.env.BANIK_INVITE_EMAIL_FROM ? { from: process.env.BANIK_INVITE_EMAIL_FROM } : {}),
        to: invitation.email,
        subject: `Invitation to ${invitation.companyName} on BANIK Books`,
        text: `You have been invited to ${invitation.companyName} as ${invitation.role}. Sign in using ${invitation.email} and accept this invitation: ${inviteUrl}\nThis invitation expires at ${invitation.expiresAt}.`,
      }),
    });
    return { emailSent: response.ok, mailStatus: response.ok ? "sent" : "failed" };
  } catch {
    return { emailSent: false, mailStatus: "failed" };
  }
}

async function createInvitation(authContext, payload) {
  assertCompanyPermission(authContext, "team.manage");
  const email = normalizeEmail(payload.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw companyError(400, "Enter a valid email address.");
  if (email === normalizeEmail(authContext.email)) throw companyError(400, "You already belong to this company.");
  const role = normalizeMemberRole(payload.role);
  const permissions = cleanPermissionsForRole(authContext, role, payload.permissions);
  const id = crypto.randomUUID();
  const { token, tokenHash } = createInviteSecret(id);
  const invitation = {
    id, companyId: authContext.companyId, companyName: authContext.companyName, email,
    fullName: String(payload.fullName || payload.name || "").trim().slice(0, 160), role, permissions,
    status: "pending", tokenHash, createdBy: authContext.userId, createdAt: timestamp(),
    updatedAt: timestamp(), expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS).toISOString(),
  };
  const inviteUrl = buildInviteUrl(token);
  await runTeamTransaction(async (transaction) => {
    const current = await assertCurrentManager(transaction, authContext);
    const members = await transaction.query("memberships", { companyId: authContext.companyId });
    const invites = await transaction.query("invitations", { companyId: authContext.companyId });
    assertDelegablePermissions(current, permissions);
    if (members.some((member) => normalizeEmail(member.email) === email && member.status === "active")) throw companyError(409, "This person is already an active company member.");
    if (invites.some((entry) => entry.email === email && invitationStatus(entry) === "pending")) throw companyError(409, "An invitation is already pending for this email. Resend or revoke it first.");
    transaction.set("invitations", id, invitation);
    recordTeamEvent(transaction, authContext, "team.invited", id, null, { email, role, permissions });
  });
  return { invitation: publicInvitation(invitation), inviteUrl, ...(await deliverInvitation(invitation, inviteUrl)) };
}

async function resendInvitation(authContext, invitationId) {
  assertCompanyPermission(authContext, "team.manage");
  const { token, tokenHash } = createInviteSecret(invitationId);
  const inviteUrl = buildInviteUrl(token);
  const invitation = await runTeamTransaction(async (transaction) => {
    const current = await assertCurrentManager(transaction, authContext);
    const previous = await transaction.get("invitations", invitationId);
    if (!previous || previous.companyId !== authContext.companyId) throw companyError(404, "Invitation not found.");
    if (previous.status !== "pending") throw companyError(409, "This invitation can no longer be resent.");
    const permissions = applyModuleCeiling(previous.permissions, current.companyModules, previous.role, "user");
    assertDelegablePermissions(current, permissions);
    const next = { ...previous, permissions, tokenHash, expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS).toISOString(), updatedAt: timestamp() };
    transaction.set("invitations", invitationId, next);
    recordTeamEvent(transaction, authContext, "team.invitation_resent", invitationId, null, { email: next.email });
    return next;
  });
  return { invitation: publicInvitation(invitation), inviteUrl, ...(await deliverInvitation(invitation, inviteUrl)) };
}

async function revokeInvitation(authContext, invitationId) {
  assertCompanyPermission(authContext, "team.manage");
  return runTeamTransaction(async (transaction) => {
    await assertCurrentManager(transaction, authContext);
    const invitation = await transaction.get("invitations", invitationId);
    if (!invitation || invitation.companyId !== authContext.companyId) throw companyError(404, "Invitation not found.");
    if (invitation.status !== "pending") throw companyError(409, "This invitation is no longer pending.");
    const next = { ...invitation, status: "revoked", tokenHash: "", updatedAt: timestamp(), revokedBy: authContext.userId };
    transaction.set("invitations", invitationId, next);
    recordTeamEvent(transaction, authContext, "team.invitation_revoked", invitationId, { email: invitation.email }, null);
    return publicInvitation(next);
  });
}

function parseToken(token) {
  const value = String(token || "");
  if (!/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(value)) throw companyError(404, "This invitation link is invalid or unavailable.");
  return { id: value.split(".")[0], hash: crypto.createHash("sha256").update(value).digest("hex") };
}

function verifyInvitation(invitation, hash) {
  const stored = Buffer.from(invitation && invitation.tokenHash || "", "hex");
  const presented = Buffer.from(hash, "hex");
  if (!invitation || stored.length !== presented.length || !crypto.timingSafeEqual(stored, presented)) throw companyError(404, "This invitation link is invalid or unavailable.");
  if (invitation.status !== "pending" || invitationStatus(invitation) === "expired") throw companyError(410, "This invitation has expired or is no longer available. Ask the company owner for a new link.");
}

async function previewInvitation(token) {
  const { id, hash } = parseToken(token);
  const invitation = await getTeamDocument("invitations", id);
  verifyInvitation(invitation, hash);
  const company = await getTeamDocument("companies", invitation.companyId);
  if (!company || company.status !== "active") throw companyError(410, "This company invitation is no longer available.");
  return { companyName: invitation.companyName, invitedEmail: invitation.email, email: invitation.email, role: invitation.role, fullName: invitation.fullName, status: "pending", expiresAt: invitation.expiresAt };
}

async function acceptInvitation(authContext, token) {
  requireIdentity(authContext);
  const { id, hash } = parseToken(token);
  const pendingInvitation = await getTeamDocument("invitations", id);
  verifyInvitation(pendingInvitation, hash);
  if (normalizeEmail(authContext.email) !== pendingInvitation.email) throw companyError(403, "Sign in with the email address this invitation was sent to.");
  const pendingCompany = await getTeamDocument("companies", pendingInvitation.companyId);
  if (!pendingCompany || pendingCompany.status !== "active") throw companyError(410, "This company invitation is no longer available.");
  const ownerProfile = await getUserProfile(pendingCompany.ownerUserId, authContext);
  if (!isLocal(authContext) && (!ownerProfile || ownerProfile.disabled)) throw companyError(403, "This company is currently unavailable.");
  const companyModules = getCompanyModules(ownerProfile, authContext);
  // Preserve an existing owner's original company when they accept a second company's invitation.
  const profile = await getUserProfile(authContext.userId, authContext);
  if (profile && profile.disabled) throw companyError(403, "This account is disabled.");
  if (profile && profile.profileCompleted && profile.accountType !== "invited") await ensureLegacyCompany(authContext);
  const result = await runTeamTransaction(async (transaction) => {
    const invitation = await transaction.get("invitations", id);
    verifyInvitation(invitation, hash);
    if (normalizeEmail(authContext.email) !== invitation.email) throw companyError(403, "Sign in with the email address this invitation was sent to.");
    const company = await transaction.get("companies", invitation.companyId);
    const memberId = membershipId(invitation.companyId, authContext.userId);
    const existing = await transaction.get("memberships", memberId);
    const inviter = await transaction.get("memberships", membershipId(invitation.companyId, invitation.createdBy));
    if (!company || company.status !== "active" || !inviter || inviter.status !== "active" || (inviter.role !== "owner" && !inviter.permissions["team.manage"])) throw companyError(410, "This invitation is no longer authorized. Ask the owner for a new invitation.");
    if (existing && existing.status === "active") throw companyError(409, "You already belong to this company.");
    if (existing && existing.role === "owner") throw companyError(409, "Owner membership cannot be replaced by an invitation.");
    const permissions = applyModuleCeiling(invitation.permissions, companyModules, invitation.role, "user");
    assertDelegablePermissions({ companyRole: inviter.role, companyModules, permissions: applyModuleCeiling(inviter.permissions, companyModules, inviter.role, "user") }, permissions);
    const member = {
      id: memberId, companyId: company.id, userId: authContext.userId, email: normalizeEmail(authContext.email),
      fullName: String(profile && profile.fullName || authContext.fullName || authContext.name || invitation.fullName || ""),
      role: invitation.role, status: "active", permissions,
      joinedAt: existing && existing.joinedAt || timestamp(), updatedAt: timestamp(), invitedBy: invitation.createdBy,
    };
    transaction.set("memberships", memberId, member);
    transaction.set("invitations", id, { ...invitation, status: "accepted", tokenHash: "", acceptedBy: authContext.userId, acceptedAt: timestamp(), updatedAt: timestamp() });
    recordTeamEvent(transaction, { ...authContext, companyId: company.id }, "team.invitation_accepted", authContext.userId, null, { email: member.email, role: member.role });
    return { company, member };
  });
  return { companyId: result.company.id, companyName: result.company.name, member: result.member };
}

async function updateMember(authContext, userId, payload) {
  assertCompanyPermission(authContext, "team.manage");
  if (!userId || userId.length > 128) throw companyError(400, "Member id is invalid.");
  if (!payload || !["status", "role", "permissions"].some((key) => Object.hasOwn(payload, key))) throw companyError(400, "Choose a membership status, role or permissions to update.");
  return runTeamTransaction(async (transaction) => {
    const current = await assertCurrentManager(transaction, authContext);
    const id = membershipId(authContext.companyId, userId);
    const member = await transaction.get("memberships", id);
    if (!member) throw companyError(404, "Company member not found.");
    if (member.role === "owner") throw companyError(403, "The company owner cannot be changed or removed here.");
    if (userId === authContext.userId) throw companyError(403, "You cannot change your own company access.");
    const role = payload.role === undefined ? member.role : normalizeMemberRole(payload.role);
    const status = payload.status === undefined ? member.status : (payload.status === "inactive" ? "suspended" : payload.status);
    if (!["active", "suspended", "removed"].includes(status)) throw companyError(400, "Membership status is invalid.");
    const base = payload.role === undefined ? member.permissions : cleanPermissionsForRole(current, role);
    const permissions = normalizePermissions(payload.permissions, base);
    if (payload.role !== undefined || payload.permissions !== undefined || status === "active") assertDelegablePermissions(current, permissions);
    const outstandingInvitations = status === "active" ? [] : await transaction.query("invitations", { companyId: authContext.companyId });
    const next = { ...member, role, status, permissions, updatedAt: timestamp(), updatedBy: authContext.userId };
    transaction.set("memberships", id, next);
    for (const invitation of outstandingInvitations) {
      if (invitation.createdBy !== userId || invitation.status !== "pending") continue;
      transaction.set("invitations", invitation.id, { ...invitation, status: "revoked", tokenHash: "", revokedBy: authContext.userId, updatedAt: timestamp() });
      recordTeamEvent(transaction, authContext, "team.invitation_revoked", invitation.id, { email: invitation.email }, null);
    }
    recordTeamEvent(transaction, authContext, status !== member.status ? `team.member_${status}` : "team.permissions_changed", userId, { role: member.role, status: member.status, permissions: member.permissions }, { role, status, permissions });
    return next;
  });
}

async function listTeamActivity(authContext) {
  assertCompanyPermission(authContext, "activity.view");
  const events = await queryTeamDocuments("events", { companyId: authContext.companyId });
  return events.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

async function assertUserAccountCanBeDeleted(userId) {
  const companies = await queryTeamDocuments("companies", { ownerUserId: userId });
  const memberships = await queryTeamDocuments("memberships", { userId });
  if (companies.length || memberships.length) throw companyError(409, "This account has company membership or ownership history. Suspend company access instead; accounting records and staff attribution must be preserved.");
}

async function getCompanyAsset(authContext, assetKey) {
  if (!["companyLogo", "letterhead"].includes(assetKey)) throw companyError(404, "Company asset not found.");
  // Only branding is shared; personal signatures never cross company memberships.
  if (isLocal(authContext)) return null;
  const reference = getFirebaseAdminFirestore().collection("userData").doc(authContext.storageUserId).collection("profile").doc(assetKey);
  const metadata = await reference.get();
  if (!metadata.exists) return null;
  const meta = metadata.data() || {};
  const chunks = await reference.collection("chunks").get();
  const dataUrl = chunks.docs.map((document) => document.data()).sort((left, right) => Number(left.order || 0) - Number(right.order || 0)).map((chunk) => chunk.data || "").join("");
  return { ...meta, dataUrl };
}

module.exports = {
  resolveCompanyContext, listCompanies, getTeam, createInvitation, resendInvitation, revokeInvitation,
  previewInvitation, acceptInvitation, updateMember, listTeamActivity, assertUserAccountCanBeDeleted,
  getCompanyAsset, membershipId,
};
