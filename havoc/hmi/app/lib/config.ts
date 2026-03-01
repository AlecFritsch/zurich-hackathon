/**
 * HMI config — uses env vars for production.
 * NEXT_PUBLIC_HAVOC_URL: Backend API base URL (e.g. https://api.example.com)
 */
const API_BASE = process.env.NEXT_PUBLIC_HAVOC_URL || "http://localhost:8000";

export const API_URL = API_BASE.replace(/\/$/, "");
export const WS_URL = API_BASE.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
