const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase, ServerValue } = require("firebase-admin/database");
const { initializeApp } = require("firebase-admin/app");
const logger = require("firebase-functions/logger");

initializeApp();

const BOOTSTRAP_ADMIN_EMAIL = defineString("BOOTSTRAP_ADMIN_EMAIL", {
  default: "creativesayeedd@gmail.com",
  description: "The Firebase Auth email allowed to bootstrap the first admin claim.",
});

const REGION = "asia-southeast1";
const auth = getAuth();
const db = getDatabase();
const VALID_CLASSES = new Set([6, 7, 8, 9, 10]);
const VALID_SUBJECTS = new Set(["sst", "science", "math", "english"]);
const VALID_SECTIONS = new Set(["detailed", "short", "worksheet"]);

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  return request.auth;
}

function requireAdmin(request) {
  const authContext = requireAuth(request);
  if (authContext.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admin permission is required.");
  }
  return authContext;
}

function cleanString(value, max = 200) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new HttpsError("invalid-argument", "Invalid text value.");
  return text;
}

function validateClass(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || !VALID_CLASSES.has(number)) {
    throw new HttpsError("invalid-argument", "Class must be 6–10.");
  }
  return number;
}

function validateEmail(value) {
  const email = cleanString(value, 160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError("invalid-argument", "Invalid email address.");
  return email;
}

function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < 6 || password.length > 100) throw new HttpsError("invalid-argument", "Password must be 6–100 characters.");
  return password;
}

function studentClaims(classNumber, active = true) {
  return { admin: false, role: "student", class: String(classNumber), active: Boolean(active) };
}

exports.bootstrapAdmin = onCall({ region: REGION }, async (request) => {
  const authContext = requireAuth(request);
  const email = String(authContext.token.email || "").toLowerCase();
  const configured = BOOTSTRAP_ADMIN_EMAIL.value().toLowerCase();
  if (!email || email !== configured) throw new HttpsError("permission-denied", "This account cannot bootstrap admin access.");

  await auth.setCustomUserClaims(authContext.uid, { admin: true, role: "admin", active: true });
  await db.ref(`users/${authContext.uid}`).update({
    displayName: authContext.token.name || email,
    email,
    role: "admin",
    active: true,
    updatedAt: ServerValue.TIMESTAMP,
  });

  logger.info("Admin bootstrap completed", { uid: authContext.uid, email });
  return { success: true, message: "Admin access activated." };
});

exports.createStudent = onCall({ region: REGION }, async (request) => {
  const adminContext = requireAdmin(request);
  const displayName = cleanString(request.data?.displayName, 60);
  const email = validateEmail(request.data?.email);
  const password = validatePassword(request.data?.password);
  const classNumber = validateClass(request.data?.classNumber);

  if (email === BOOTSTRAP_ADMIN_EMAIL.value().toLowerCase()) {
    throw new HttpsError("invalid-argument", "The bootstrap admin email cannot be created as a student.");
  }

  let createdUser;
  try {
    createdUser = await auth.createUser({ email, password, displayName, disabled: false });
    await auth.setCustomUserClaims(createdUser.uid, studentClaims(classNumber, true));
    await db.ref(`users/${createdUser.uid}`).set({
      displayName,
      email,
      role: "student",
      class: classNumber,
      active: true,
      createdAt: ServerValue.TIMESTAMP,
      updatedAt: ServerValue.TIMESTAMP,
    });
  } catch (error) {
    if (createdUser?.uid) {
      try { await auth.deleteUser(createdUser.uid); } catch (cleanupError) { logger.error("Student cleanup failed", cleanupError); }
    }
    if (error?.code === "auth/email-already-exists") throw new HttpsError("already-exists", "That email is already registered.");
    logger.error("createStudent failed", error);
    throw new HttpsError("internal", "Student account could not be created.");
  }

  logger.info("Student created", { adminUid: adminContext.uid, studentUid: createdUser.uid });
  return { success: true, uid: createdUser.uid, email, classNumber };
});

exports.listStudents = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const pageToken = String(request.data?.pageToken || "");
  const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 200, 1), 500);
  const result = await auth.listUsers(pageSize, pageToken || undefined);
  const students = result.users
    .filter((user) => user.customClaims?.role === "student")
    .map((user) => ({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      class: Number(user.customClaims?.class) || null,
      active: user.customClaims?.active !== false && !user.disabled,
      disabled: user.disabled,
      createdAt: user.metadata.creationTime || null,
      lastSignInTime: user.metadata.lastSignInTime || null,
      provider: user.providerData?.map((p) => p.providerId) || [],
    }));

  return { students, pageToken: result.pageToken || "" };
});

exports.updateStudent = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const uid = cleanString(request.data?.uid, 128);
  const displayName = cleanString(request.data?.displayName, 60);
  const classNumber = validateClass(request.data?.classNumber);
  const user = await auth.getUser(uid);
  if (user.customClaims?.role !== "student") throw new HttpsError("invalid-argument", "Only student accounts can be edited here.");

  const active = user.disabled ? false : user.customClaims?.active !== false;
  await auth.updateUser(uid, { displayName });
  await auth.setCustomUserClaims(uid, studentClaims(classNumber, active));
  await db.ref(`users/${uid}`).update({ displayName, class: classNumber, role: "student", active, updatedAt: ServerValue.TIMESTAMP });
  return { success: true, uid, email: user.email || "", classNumber };
});

exports.setStudentActive = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const uid = cleanString(request.data?.uid, 128);
  const active = Boolean(request.data?.active);
  const user = await auth.getUser(uid);
  if (user.customClaims?.role !== "student") throw new HttpsError("invalid-argument", "Only student accounts can be disabled here.");
  const classNumber = validateClass(user.customClaims?.class);
  await auth.updateUser(uid, { disabled: !active });
  await auth.setCustomUserClaims(uid, studentClaims(classNumber, active));
  await db.ref(`users/${uid}`).update({ active, updatedAt: ServerValue.TIMESTAMP });
  return { success: true, active };
});

exports.setStudentPassword = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const uid = cleanString(request.data?.uid, 128);
  const password = validatePassword(request.data?.password);
  const user = await auth.getUser(uid);
  if (user.customClaims?.role !== "student") throw new HttpsError("invalid-argument", "Only student accounts can be changed here.");
  await auth.updateUser(uid, { password });
  await auth.revokeRefreshTokens(uid);
  return { success: true };
});
