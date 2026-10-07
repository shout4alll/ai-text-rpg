/**
 * API 주소 — 웹(같은 서버)에서는 "/api/..." 그대로,
 * 📱 앱(Capacitor)에서는 화면이 앱 안에 들어 있으므로 서버 주소를 앞에 붙인다.
 * 앱 빌드 시 NEXT_PUBLIC_API_BASE=https://서버주소 (docs/MOBILE_APP.md)
 */
const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
