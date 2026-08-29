const loading = document.querySelector("#auth-loading");
const authGate = document.querySelector("#auth-gate");
const app = document.querySelector("#app");

const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#login-email");
const passwordInput = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const googleButton = document.querySelector("#google-button");
const forgotButton = document.querySelector("#forgot-button");
const togglePassword = document.querySelector("#toggle-password");
const statusBox = document.querySelector("#auth-status");
const retrySession = document.querySelector("#retry-session");

let authApi = null;
let operationRunning = false;
let appLoadStarted = false;
let sessionWatchdog = null;

function showStatus(message = "", type = "") {
  statusBox.textContent = message;
  statusBox.className = `auth-status${type ? ` is-${type}` : ""}`;
}

function setOperationState(running, label = "") {
  operationRunning = running;
  loginButton.disabled = running;
  googleButton.disabled = running;
  forgotButton.disabled = running;
  togglePassword.disabled = running;
  loginButton.textContent = running ? label : "Login";
}

function showAuthenticatedApp() {
  clearTimeout(sessionWatchdog);
  retrySession.hidden = true;
  loading.hidden = true;
  authGate.hidden = true;
  app.hidden = false;
}

function showLogin(message = "", type = "") {
  clearTimeout(sessionWatchdog);
  loading.hidden = true;
  app.hidden = true;
  authGate.hidden = false;
  retrySession.hidden = true;
  if (message) showStatus(message, type);
}

function showSessionError(message = "We couldn't verify your session. Please retry.") {
  clearTimeout(sessionWatchdog);
  loading.hidden = true;
  app.hidden = true;
  authGate.hidden = true;
  retrySession.hidden = false;
  showStatus(message, "error");
  setOperationState(false);
}

function validateLoginInputs() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) throw new Error("Please enter your email address.");
  if (!emailInput.validity.valid) throw new Error("Please enter a valid email address.");
  if (!password) throw new Error("Please enter your password.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  return { email, password };
}

async function handleLogin(event) {
  event.preventDefault();
  if (operationRunning || !authApi) return;

  try {
    const { email, password } = validateLoginInputs();
    setOperationState(true, "PLEASE WAIT...");
    showStatus("");
    await authApi.loginWithEmail(email, password);
  } catch (error) {
    showStatus(authApi?.friendlyAuthError(error) || error?.message || "Something went wrong. Please try again.", "error");
    setOperationState(false);
  }
}

async function handleGoogleLogin() {
  if (operationRunning || !authApi) return;

  try {
    setOperationState(true, "PLEASE WAIT...");
    showStatus("");
    await authApi.loginWithGoogle();
  } catch (error) {
    showStatus(authApi.friendlyAuthError(error), "error");
    setOperationState(false);
  }
}

async function handleForgotPassword() {
  if (operationRunning || !authApi) return;

  const email = emailInput.value.trim();
  if (!email || !emailInput.validity.valid) {
    showStatus("Enter your email first, then tap Forgot Password.", "error");
    emailInput.focus();
    return;
  }

  try {
    setOperationState(true, "SENDING...");
    showStatus("");
    await authApi.resetPassword(email);
    showStatus("Password reset email sent. Check your inbox.", "success");
    setOperationState(false);
  } catch (error) {
    showStatus(authApi.friendlyAuthError(error), "error");
    setOperationState(false);
  }
}

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "Hide" : "Show";
});

loginForm.addEventListener("submit", handleLogin);
googleButton.addEventListener("click", handleGoogleLogin);
forgotButton.addEventListener("click", handleForgotPassword);
retrySession.addEventListener("click", () => window.location.reload());

document.addEventListener("click", async event => {
  const logoutButton = event.target.closest("[data-auth-action='logout']");
  if (!logoutButton || operationRunning || !authApi) return;

  try {
    await authApi.logout();
  } catch (error) {
    showStatus(authApi.friendlyAuthError(error), "error");
  }
});

function startSessionWatchdog() {
  clearTimeout(sessionWatchdog);
  sessionWatchdog = setTimeout(() => {
    showSessionError("Session check timed out. Please retry. If this keeps happening, verify Firebase Authentication and Authorized Domains.");
  }, 12000);
}

async function bootAuth() {
  startSessionWatchdog();

  try {
    // Dynamic import makes Firebase CDN/config failures recoverable instead of
    // leaving the user on an infinite loading screen.
    authApi = await import("./auth.js");

    authApi.startAuthObserver(user => {
      clearTimeout(sessionWatchdog);

      if (!user) {
        showLogin();
        setOperationState(false);
        return;
      }

      setOperationState(false);
      showStatus("");
      loadApplicationOnce();
    });

    // If Firebase never invokes the observer, the watchdog remains the recovery path.
    startSessionWatchdog();
  } catch (error) {
    console.error("Firebase authentication bootstrap failed:", error);
    showSessionError("Firebase could not be initialized. Please retry. Check the Firebase configuration and Authorized Domains.");
  }
}

function loadApplicationOnce() {
  if (appLoadStarted) return;
  appLoadStarted = true;

  import("./app.js")
    .then(() => showAuthenticatedApp())
    .catch(error => {
      console.error("Application load error:", error);
      appLoadStarted = false;
      showSessionError("The application could not be loaded. Please retry.");
    });
}

bootAuth();
