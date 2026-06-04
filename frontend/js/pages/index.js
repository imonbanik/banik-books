document.addEventListener("DOMContentLoaded", () => {
  const AUTH_READY_TIMEOUT_MS = 30000;
  const AUTH_ACTION_TIMEOUT_MS = 25000;
  const form = document.getElementById("home-auth-form");
  const emailInput = document.getElementById("home-auth-email");
  const passwordInput = document.getElementById("home-auth-password");
  const status = document.getElementById("home-auth-status");
  const submitButton = document.getElementById("home-auth-submit");
  const modeToggle = document.getElementById("home-auth-mode-toggle");
  const panelTitle = document.querySelector(".signup-panel h2");
  const panelText = document.querySelector(".signup-panel__text");
  let mode = "login";

  function setMode(nextMode) {
    mode = nextMode;
    const isLogin = mode === "login";
    status.textContent = "";
    status.className = "auth-form-status";
    submitButton.textContent = isLogin ? "Sign In" : "Sign up";
    modeToggle.textContent = isLogin ? "Create a new account" : "Already have an account?";
    panelTitle.textContent = isLogin ? "Sign In to your Account" : "Create your account";
    panelText.textContent = isLogin
      ? "Use your email and password to open your workspace."
      : "Sign up to explore a cleaner way to handle your company accounts.";
    document.querySelector(".signup-links span").hidden = !isLogin;
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.className = `auth-form-status ${isError ? "auth-form-status--error" : "auth-form-status--success"}`;
  }

  function waitForBanikAuth() {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      let pollId = 0;
      let timeoutId = 0;

      const cleanup = () => {
        window.clearTimeout(pollId);
        window.clearTimeout(timeoutId);
        window.removeEventListener("banik-auth-ready", checkAuthService);
      };

      const checkAuthService = () => {
        if (window.BanikAuth && typeof window.BanikAuth.login === "function") {
          cleanup();
          resolve(window.BanikAuth);
          return;
        }

        if (window.BANIK_AUTH_SCRIPT_ERROR) {
          cleanup();
          reject(new Error("Sign-in script could not load. Hard refresh the page and try again."));
          return;
        }

        if (Date.now() - startedAt >= AUTH_READY_TIMEOUT_MS) {
          cleanup();
          reject(new Error("Auth service is still loading. Check connection, hard refresh, then try again."));
          return;
        }

        pollId = window.setTimeout(checkAuthService, 100);
      };

      window.addEventListener("banik-auth-ready", checkAuthService);
      timeoutId = window.setTimeout(checkAuthService, AUTH_READY_TIMEOUT_MS);
      checkAuthService();
    });
  }

  function withTimeout(promise, timeoutMs) {
    let timeoutId = 0;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error("Authentication request timed out."));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timeoutId);
    });
  }

  modeToggle.addEventListener("click", (event) => {
    event.preventDefault();
    setMode(mode === "signup" ? "login" : "signup");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus("Please wait...", false);
    let result = null;

    try {
      const authService = await waitForBanikAuth();
      const authAction =
        mode === "login"
          ? authService.login(emailInput.value, passwordInput.value)
          : authService.register({
              email: emailInput.value,
              password: passwordInput.value,
            });

      result = await withTimeout(authAction, AUTH_ACTION_TIMEOUT_MS);
    } catch (error) {
      console.error("BANIK Books auth failed to complete.", error);
      setStatus(
        error && error.message
          ? error.message
          : "Sign-in could not complete. Check internet/Firebase domain settings, then try again.",
        true
      );
      submitButton.disabled = false;
      return;
    }

    if (!result.ok) {
      setStatus(result.message, !result.requiresVerification);
      submitButton.disabled = false;
      return;
    }

    if (result.requiresVerification) {
      submitButton.disabled = false;
      setMode("login");
      setStatus(result.message, false);
      return;
    }

    setStatus("Success. Opening your workspace...", false);
    if (!result.user.profileCompleted) {
      window.location.href = "./signup.html";
      return;
    }

    window.location.href = result.user.role === "admin" ? "./admin.html" : "./workspace.html";
  });

  setMode("login");
});
