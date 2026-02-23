// src/pages/dishes/dishUtils.ts
export function getSlugFromPath() {
  const m = window.location.pathname.match(/\/admin\/r\/([^/]+)/);
  return m?.[1] ? String(m[1]) : "";
}

export function bytesToSize(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}
