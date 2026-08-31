import { database } from "./firebase-init.js";
import { get, push, ref, set } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

function withTimeout(promise, ms = 12000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms))]);
}

function normaliseClass(value) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isInteger(number) && number >= 6 && number <= 10 ? number : null;
}

function cleanText(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function normaliseAnswers(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(values.map((item) => cleanText(item, 200).toLowerCase()).filter(Boolean))];
}

function normaliseQuestion(raw = {}, id = "q") {
  const type = ["mcq", "true-false", "fill-blank"].includes(raw.type) ? raw.type : "mcq";
  const options = Array.isArray(raw.options) ? raw.options.map((x) => cleanText(x, 300)).slice(0, 4) : [];
  const correctIndex = Number.isInteger(Number(raw.correctIndex)) ? Number(raw.correctIndex) : 0;
  const answers = normaliseAnswers(raw.answers || raw.answer);
  return {
    id: String(raw.id || id),
    type,
    question: cleanText(raw.question, 1200),
    points: Math.max(1, Math.min(20, Number(raw.points) || 1)),
    options: type === "mcq" ? options : type === "true-false" ? ["True", "False"] : [],
    correctIndex: type === "fill-blank" ? 0 : Math.max(0, Math.min(type === "true-false" ? 1 : 3, correctIndex)),
    answers: type === "fill-blank" ? answers : [],
  };
}

function normaliseQuiz(raw = {}, id = "") {
  const questionsRaw = raw.questions && typeof raw.questions === "object" ? raw.questions : {};
  const questions = Object.entries(questionsRaw).map(([qid, item]) => normaliseQuestion(item, qid)).filter((q) => q.question);
  return {
    id: String(raw.id || id),
    title: cleanText(raw.title, 160),
    class: normaliseClass(raw.class),
    subject: cleanText(raw.subject, 40).toLowerCase(),
    durationSeconds: Math.max(60, Math.min(3 * 60 * 60, Number(raw.durationSeconds) || 15 * 60)),
    active: raw.active === true,
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
    questions,
  };
}

export async function loadPracticeSets(classNumber, subjectId, { force = false } = {}) {
  const cls = normaliseClass(classNumber);
  const subject = cleanText(subjectId, 40).toLowerCase();
  if (!cls || !subject) throw new Error("INVALID_PRACTICE_SCOPE");
  const snap = await withTimeout(get(ref(database, `publishedPractice/class-${cls}/${subject}`)));
  const root = snap.val() || {};
  return Object.entries(root)
    .map(([id, raw]) => normaliseQuiz(raw, id))
    .filter((quiz) => quiz.active && quiz.class === cls && quiz.subject === subject && quiz.questions.length)
    .sort((a, b) => (b.updatedAt - a.updatedAt) || a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export async function getPracticeSet(classNumber, subjectId, quizId) {
  const cls = normaliseClass(classNumber);
  const subject = cleanText(subjectId, 40).toLowerCase();
  if (!cls || !subject || !quizId) return null;
  const snap = await withTimeout(get(ref(database, `publishedPractice/class-${cls}/${subject}/${quizId}`)));
  if (!snap.exists()) return null;
  const quiz = normaliseQuiz(snap.val(), quizId);
  return quiz.active && quiz.class === cls && quiz.subject === subject && quiz.questions.length ? quiz : null;
}

export async function savePracticeAttempt({ uid, classNumber, subjectId, quizId, score, totalPoints, percentage, correct, incorrect, unanswered, timeTakenSeconds }) {
  if (!uid || !quizId) throw new Error("AUTH_REQUIRED");
  const attemptRef = push(ref(database, `practiceAttempts/${uid}/${quizId}`));
  const record = {
    quizId: String(quizId),
    class: normaliseClass(classNumber),
    subject: cleanText(subjectId, 40).toLowerCase(),
    score: Number(score) || 0,
    totalPoints: Number(totalPoints) || 0,
    percentage: Math.max(0, Math.min(100, Number(percentage) || 0)),
    correct: Number(correct) || 0,
    incorrect: Number(incorrect) || 0,
    unanswered: Number(unanswered) || 0,
    timeTakenSeconds: Math.max(0, Number(timeTakenSeconds) || 0),
    completedAt: Date.now(),
  };
  await withTimeout(set(attemptRef, record), 12000);
  return record;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function normaliseAnswer(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
