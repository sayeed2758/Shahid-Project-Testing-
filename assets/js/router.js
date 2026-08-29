const ROUTES = new Set(["home", "classes", "search", "recent", "profile"]);

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!raw) return { name: "home", params: {} };
  const [name, value] = raw.split("/");
  if (name === "class" && value && /^([6-9]|10)$/.test(value)) {
    return { name: "class", params: { classId: value } };
  }
  return ROUTES.has(name) ? { name, params: {} } : { name: "home", params: {} };
}

export function getRoute() { return parseHash(); }

export function navigate(name, params = {}, { replace = false } = {}) {
  let hash = `#${name}`;
  if (name === "class" && params.classId) hash += `/${encodeURIComponent(params.classId)}`;
  const method = replace ? "replaceState" : "pushState";
  history[method]({ name, params }, "", hash);
  window.dispatchEvent(new Event("app:navigate"));
}

export function startRouter(onRoute) {
  const render = () => onRoute(parseHash());
  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  window.addEventListener("app:navigate", render);
  render();
  return () => {
    window.removeEventListener("popstate", render);
    window.removeEventListener("hashchange", render);
    window.removeEventListener("app:navigate", render);
  };
}
