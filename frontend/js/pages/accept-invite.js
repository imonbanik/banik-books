document.addEventListener("DOMContentLoaded", async () => {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const form = document.getElementById("invite-auth-form");
  const actions = document.getElementById("invite-auth-actions");
  const accept = document.getElementById("invite-accept");
  const signout = document.getElementById("invite-signout");
  const email = document.getElementById("invite-email");
  const name = document.getElementById("invite-name");
  const password = document.getElementById("invite-password");
  const submit = document.getElementById("invite-submit");
  const modeButton = document.getElementById("invite-mode");
  let invitation;
  let mode = "login";
  const auth = window.BanikAuth;
  const api = window.BanikApi;
  function message(value, error = false) {
    const status = document.getElementById("invite-status"); status.textContent = value;
    status.className = `auth-form-status ${error ? "auth-form-status--error" : "auth-form-status--success"}`;
  }
  function setMode(value) {
    mode = value;
    document.getElementById("invite-name-label").hidden = mode !== "signup";
    name.required = mode === "signup";
    password.autocomplete = mode === "signup" ? "new-password" : "current-password";
    submit.textContent = mode === "signup" ? "Create login & send verification" : "Sign in & join";
    modeButton.textContent = mode === "signup" ? "I already have an account" : "Create your login";
  }
  async function join() {
    accept.disabled = true; submit.disabled = true;
    try {
      const result = await api.request(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const companyId = result.companyId || result.company && result.company.id || invitation.companyId;
      if (companyId) await api.selectCompany(companyId, { reload: false });
      await auth.refreshCompany();
      message("You have joined the company. Opening your workspace…");
      window.location.replace("/workspace.html");
    } catch (error) { message(error.message, true); accept.disabled = false; submit.disabled = false; }
  }
  modeButton.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
  document.getElementById("invite-reset").addEventListener("click", async () => {
    const result = await auth.resetPassword(email.value); message(result.message, !result.ok);
  });
  signout.addEventListener("click", async () => {
    // Keep the invitation URL while Firebase clears the current login.
    await auth.logout({ redirect: false });
    window.location.reload();
  });
  accept.addEventListener("click", join);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); submit.disabled = true; message("Please wait…");
    try {
      const result = mode === "signup"
        ? await auth.register({ email: invitation.invitedEmail || invitation.email, password: password.value, fullName: name.value, invitationToken: token })
        : await auth.login(invitation.invitedEmail || invitation.email, password.value);
      if (result.requiresVerification) {
        setMode("login"); password.value = "";
        message("Verification email sent. Verify your email, then return to this invitation and sign in to join.");
      } else if (!result.ok) message(result.message, true);
      else await join();
    } catch (error) { message(error.message, true); }
    finally { submit.disabled = false; }
  });
  try {
    if (!token) throw new Error("This invitation link is incomplete. Ask your company owner for a new link.");
    const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, { cache: "no-store", referrerPolicy: "no-referrer" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || payload.message || "This invitation is unavailable.");
    invitation = payload.invitation || payload;
    if (invitation.status && invitation.status !== "pending") throw new Error(`This invitation is ${invitation.status}. Ask your company owner for a new invitation if needed.`);
    if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) throw new Error("This invitation has expired. Ask your company owner to resend it.");
    email.value = invitation.invitedEmail || invitation.email || "";
    name.value = invitation.name || invitation.fullName || "";
    document.getElementById("invite-title").textContent = `Join ${invitation.companyName || "your company"}`;
    document.getElementById("invite-summary").textContent = `You have been invited as ${invitation.role || "a team member"}. Use your own login to work in this company.`;
    const user = await auth.getCurrentUser();
    if (user && user.email.toLowerCase() === email.value.toLowerCase()) {
      accept.hidden = false; message(`Signed in as ${user.email}.`);
    } else if (user) {
      signout.hidden = false; message(`This invitation is for ${email.value}. You are currently signed in as ${user.email}.`, true);
    } else { form.hidden = false; actions.hidden = false; }
  } catch (error) { document.getElementById("invite-summary").textContent = "Invitation unavailable"; message(error.message, true); }
});
