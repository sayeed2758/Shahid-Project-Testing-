import {
  friendlyAuthError,
  loginWithEmail,
  loginWithGoogle,
  logout,
  resetPassword,
  startAuthObserver
} from "./auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { firebaseApp } from "./firebase-config.js";

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

const database = getDatabase(firebaseApp);

let authReady = false;
let operationRunning = false;

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
  loading.hidden = true;
  authGate.hidden = true;
  app.hidden = false;
}

function showLogin() {
  loading.hidden = true;
  app.hidden = true;
  authGate.hidden = false;
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
  if (operationRunning) return;

  try {
    const { email, password } = validateLoginInputs();
    setOperationState(true, "PLEASE WAIT...");
    showStatus("");

    await loginWithEmail(email, password);

    // The single auth observer owns the application transition.
  } catch (error) {
    showStatus(error.message || friendlyAuthError(error), "error");
    setOperationState(false);
  }
}

async function handleGoogleLogin() {
  if (operationRunning) return;

  try {
    setOperationState(true, "PLEASE WAIT...");
    showStatus("");

    await loginWithGoogle();

    // The single auth observer owns the application transition.
  } catch (error) {
    showStatus(friendlyAuthError(error), "error");
    setOperationState(false);
  }
}

async function handleForgotPassword() {
  if (operationRunning) return;

  const email = emailInput.value.trim();
  if (!email || !emailInput.validity.valid) {
    showStatus("Enter your email first, then tap Forgot Password.", "error");
    emailInput.focus();
    return;
  }

  try {
    setOperationState(true, "SENDING...");
    showStatus("");

    await resetPassword(email);
    showStatus("Password reset email sent. Check your inbox.", "success");
    setOperationState(false);
  } catch (error) {
    showStatus(friendlyAuthError(error), "error");
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

document.addEventListener("click", async event => {
  const logoutButton = event.target.closest("[data-auth-action='logout']");
  if (!logoutButton || operationRunning) return;

  try {
    await logout();
  } catch (error) {
    showStatus(friendlyAuthError(error), "error");
  }
});

async function verifyStudentProfile(user) {
  const snapshot = await get(ref(database, `users/${user.uid}`));
  if (!snapshot.exists()) {
    await logout();
    throw new Error("This account is not authorized for the student portal. Please contact the institute administrator.");
  }

  const profile = snapshot.val() || {};
  if (!profile.email || profile.classId === undefined || profile.classId === null) {
    await logout();
    throw new Error("Your student profile is incomplete. Please contact the institute administrator.");
  }

  return profile;
}

startAuthObserver(async user => {
  authReady = true;

  if (!user) {
    showLogin();
    setOperationState(false);
    return;
  }

  try {
    setOperationState(false);
    showStatus("Checking your student access...");
    await verifyStudentProfile(user);

    showStatus("");
    showAuthenticatedApp();

    // The single auth observer owns the application transition.
    import("./app.js").catch(() => {
      showStatus("The application could not be loaded. Please refresh and try again.", "error");
      app.hidden = true;
      authGate.hidden = false;
    });
  } catch (error) {
    showLogin();
    showStatus(error.message || "Your account could not be verified.", "error");
    setOperationState(false);
  }
});
