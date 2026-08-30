export function searchMaterials(materials, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  return materials.filter((material) => {
    const haystack = [
      material.title,
      material.chapter,
      material.subject,
      `class ${material.class}`,
      material.section,
      material.fileName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function debounce(fn, delay = 220) {
  let timer = null;

  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
