const {
  resolveCompanyContext, listCompanies, getTeam, createInvitation, resendInvitation,
  revokeInvitation, previewInvitation, acceptInvitation, updateMember, getCompanyAsset,
} = require("./company-service");
const { companyError } = require("./company-permissions");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 32768) throw companyError(413, "Team request is too large.");
  }
  try {
    const value = body.trim() ? JSON.parse(body) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
    return value;
  } catch {
    throw companyError(400, "Invalid JSON payload.");
  }
}

function isTeamRoute(pathParts) { return pathParts[0] === "api" && ["companies", "team", "invitations", "company-profile"].includes(pathParts[1]); }
function isPublicTeamRoute(pathParts, method) { return pathParts[0] === "api" && pathParts[1] === "invitations" && pathParts.length === 3 && method === "GET"; }

async function handleTeamApi(request, response, pathParts, authContext) {
  if (!isTeamRoute(pathParts)) return false;
  const route = pathParts[1];
  if (isPublicTeamRoute(pathParts, request.method)) {
    const invitation = await previewInvitation(decodeURIComponent(pathParts[2]));
    sendJson(response, 200, { invitation, ...invitation });
    return true;
  }
  if (!authContext || !authContext.userId) throw companyError(401, "Please sign in first.");
  if (route === "companies" && pathParts.length === 2 && request.method === "GET") {
    sendJson(response, 200, { companies: await listCompanies(authContext) });
    return true;
  }
  if (route === "invitations" && request.method === "POST" && (pathParts.length === 3 || (pathParts.length === 4 && pathParts[3] === "accept"))) {
    sendJson(response, 200, await acceptInvitation(authContext, decodeURIComponent(pathParts[2])));
    return true;
  }
  let company;
  try {
    company = await resolveCompanyContext(authContext, request);
  } catch (error) {
    if (error.statusCode === 403) error.code = "COMPANY_ACCESS_DENIED";
    throw error;
  }
  if (route === "company-profile" && pathParts.length === 4 && pathParts[2] === "assets" && request.method === "GET") {
    sendJson(response, 200, { asset: await getCompanyAsset(company, pathParts[3]) });
    return true;
  }
  if (route === "team") {
    if (pathParts.length === 2 && request.method === "GET") {
      sendJson(response, 200, await getTeam(company));
      return true;
    }
    if (pathParts[2] === "invitations") {
      if (pathParts.length === 3 && request.method === "POST") {
        sendJson(response, 201, await createInvitation(company, await readJsonBody(request)));
        return true;
      }
      if (pathParts.length === 5 && pathParts[4] === "resend" && request.method === "POST") {
        sendJson(response, 200, await resendInvitation(company, pathParts[3]));
        return true;
      }
      if (pathParts.length === 4 && request.method === "DELETE") {
        sendJson(response, 200, { invitation: await revokeInvitation(company, pathParts[3]) });
        return true;
      }
    }
    if (pathParts[2] === "members" && pathParts.length === 4 && request.method === "PATCH") {
      sendJson(response, 200, { member: await updateMember(company, decodeURIComponent(pathParts[3]), await readJsonBody(request)) });
      return true;
    }
  }
  throw companyError(405, "Method not allowed for this team endpoint.");
}

module.exports = { isTeamRoute, isPublicTeamRoute, handleTeamApi };
