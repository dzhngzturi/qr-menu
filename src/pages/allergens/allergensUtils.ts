// src/pages/allergens/allergensUtils.ts
export function bytesToSize(bytes: number) {
  if (!bytes || bytes <= 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const val = bytes / Math.pow(1024, i);
  const fixed = i === 0 ? 0 : 1;
  return `${val.toFixed(fixed)} ${sizes[i]}`;
}

export function norm(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

export function safeString(x: any) {
  return String(x ?? "").trim();
}
