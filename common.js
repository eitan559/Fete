/* ============================================================
   Fête — Shared client logic (vanilla JS)
   API client, token management, slug helpers, formatters
   ============================================================ */

const TOKEN_KEY = "party_admin_token";

const ACCENT_HEX = {
  rose: "#e11d48",
  amber: "#d97706",
  violet: "#7c3aed",
  emerald: "#059669",
  cyan: "#0891b2",
  fuchsia: "#c026d3",
  orange: "#ea580c",
};

const THEME_LABELS = {
  light: "בהיר",
  dark: "כהה",
  retro: "רטרו",
  elegant: "אלגנטי",
};

const THEME_DESC = {
  light: "נקי ומודרני",
  dark: "כהה ומלוטש",
  retro: "פרגמנט חם 70'",
  elegant: "זהב על שזיף",
};

const THEME_SWATCH = {
  light: ["#ffffff", "#f5f5f5", "#18181b"],
  dark: ["#252525", "#171717", "#fafafa"],
  retro: ["#f6efdc", "#c2701f", "#6f7d3a"],
  elegant: ["#171019", "#c9a24b", "#f3e7d1"],
};

const ACCENT_LABELS = {
  rose: "ורוד",
  amber: "ענבר",
  violet: "סגול",
  emerald: "ירוק",
  cyan: "טורקיז",
  fuchsia: "מג'נטה",
  orange: "כתום",
};

const ACCENT_COLORS = ["rose", "amber", "violet", "emerald", "cyan", "fuchsia", "orange"];

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(["api", "admin", "favicon.ico", "index.html", "event.html", "admin.html", "robots.txt", "logo.svg"]);

/* ---- Slug helpers ---- */
function isValidSlug(slug) {
  return typeof slug === "string" && slug.length >= 2 && slug.length <= 60 && SLUG_REGEX.test(slug);
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function guestUrl(slug) {
  return "/" + encodeURIComponent(slug);
}

/* ---- Token management ---- */
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
function hasToken() { return !!getToken(); }

function authHeaders() {
  const t = getToken();
  return t ? { "x-admin-token": t } : {};
}
function jsonHeaders() {
  return { "Content-Type": "application/json", ...authHeaders() };
}

/* ---- Fetch wrapper ---- */
async function apiRequest(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `הבקשה נכשלה (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ---- API: Events ---- */
async function fetchEvents() {
  return apiRequest("/api/events", { cache: "no-store" });
}
async function fetchEvent(key) {
  return apiRequest(`/api/events/${encodeURIComponent(key)}`, { cache: "no-store" });
}
async function createEvent(payload) {
  return apiRequest("/api/events", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
}
async function updateEvent(key, payload) {
  return apiRequest(`/api/events/${encodeURIComponent(key)}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) });
}
async function deleteEvent(key) {
  return apiRequest(`/api/events/${encodeURIComponent(key)}`, { method: "DELETE", headers: authHeaders() });
}

/* ---- API: Guests ---- */
async function fetchGuests(key) {
  return apiRequest(`/api/events/${encodeURIComponent(key)}/guests`, { cache: "no-store", headers: authHeaders() });
}
async function rsvp(key, firstName, lastName) {
  return apiRequest(`/api/events/${encodeURIComponent(key)}/guests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName }),
  });
}
async function exportGuestsCsv(key) {
  const res = await fetch(`/api/events/${encodeURIComponent(key)}/export`, { headers: authHeaders() });
  if (!res.ok) {
    let message = `הייצוא נכשל (${res.status})`;
    try { const d = await res.json(); if (d && d.error) message = d.error; } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const dispo = res.headers.get("content-disposition") || "";
  const match = dispo.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : "guest-list.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---- API: Auth ---- */
async function login(password) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (data && data.token) setToken(data.token);
}
async function logout() {
  clearToken();
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}
async function fetchSession() {
  return apiRequest("/api/auth/session", { cache: "no-store" });
}

/* ---- Formatters ---- */
function formatDate(iso) {
  if (!iso) return { weekday: "", full: "" };
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return { weekday: "", full: iso };
  return {
    weekday: d.toLocaleDateString("he-IL", { weekday: "long" }),
    full: d.toLocaleDateString("he-IL", { month: "long", day: "numeric", year: "numeric" }),
  };
}

const _rtf = new Intl.RelativeTimeFormat("he-IL", { numeric: "auto" });
function formatTimeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffSec = Math.floor((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return _rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return _rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return _rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return _rtf.format(Math.round(diffSec / 86400), "day");
  return d.toLocaleDateString("he-IL");
}
function formatFull(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL");
}

function accentHex(color) {
  return ACCENT_HEX[color] || "#e11d48";
}

/* ---- Toast notifications ---- */
function showToast(title, description, variant) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position:fixed;bottom:1rem;inset-inline-end:1rem;z-index:100;display:flex;flex-direction:column;gap:0.5rem;max-width:90vw;";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "card animate-fade-in-up";
  toast.style.cssText = "padding:0.875rem 1rem;min-width:280px;max-width:360px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.2);" +
    (variant === "destructive" ? "border-color:var(--destructive);" : "");
  toast.innerHTML =
    '<div style="font-weight:600;font-size:0.875rem;">' + escapeHtml(title) + "</div>" +
    (description ? '<div style="font-size:0.8125rem;color:var(--muted-foreground);margin-top:0.125rem;">' + escapeHtml(description) + "</div>" : "");
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---- Confetti ---- */
function fireConfetti(accent) {
  const colors = [accent, "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:50;overflow:hidden;";
  document.body.appendChild(container);
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.6 + "s";
    piece.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
    piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 3500);
}
