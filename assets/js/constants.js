// Shared application constants. Keep these values in one place so modules do not drift apart.
export const ADMIN_EMAIL = "creativesayeedd@gmail.com";
export const STUDENT_EMAIL_DOMAIN = "students.ezeevisionchampua.com";

export const CLASSES = [6, 7, 8, 9, 10];

export const SUBJECTS = [
  { id: "sst", label: "SST", icon: "🌍", description: "Social Studies" },
  { id: "science", label: "Science", icon: "🔬", description: "Science & discovery" },
  { id: "math", label: "Math", icon: "🧮", description: "Numbers & problem solving" },
  { id: "english", label: "English", icon: "📚", description: "Language & literature" },
];

export const SECTIONS = [
  { id: "detailed", label: "Detailed Notes", icon: "▤", tone: "notes", downloadable: false },
  { id: "short", label: "Short Notes", icon: "▥", tone: "notes", downloadable: false },
  { id: "pyq", label: "PYQ's", icon: "📝", tone: "notes", downloadable: false },
  { id: "worksheet", label: "Worksheet", icon: "⇩", tone: "worksheet", downloadable: true },
  { id: "exam-paper", label: "Exam Paper", icon: "📄", tone: "worksheet", downloadable: true },
];

export const CLASS_CARDS = CLASSES.map((number) => ({
  id: `class-${number}`,
  label: `Class ${number}`,
  number,
}));

export function studentEmailFromId(studentId) {
  return `${String(studentId).trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}
