// The only way the web talks to VERA data: REST calls to apps/api with the Supabase access token.
// Responses are { data } (lists: { data, meta }); errors are { error: { code, message, details? } } (TRD §4).
import { supabase } from "./supabase";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body, { raw = false } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach VERA right now. Check your connection and try again.");
  }

  if (raw && response.ok) return response; // a file (download): the caller reads the body
  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error ?? {};
    // Expired or unknown session: sign out so the guards send the user to /login.
    if (response.status === 401) await supabase.auth.signOut();
    throw new ApiError(
      response.status,
      error.code ?? "INTERNAL",
      error.message ?? "Something went wrong. Please try again.",
      error.details,
    );
  }
  return payload;
}

export const api = {
  /** GET → data */
  get: async (path) => (await request("GET", path))?.data,
  /** GET a paginated list → { data, meta } */
  list: (path) => request("GET", path),
  post: async (path, body) => (await request("POST", path, body))?.data,
  put: async (path, body) => (await request("PUT", path, body))?.data,
  patch: async (path, body) => (await request("PATCH", path, body))?.data,
  delete: async (path) => (await request("DELETE", path))?.data,
  /** GET a file → { blob, filename } (filename from Content-Disposition; errors like every other call). */
  download: async (path) => {
    const response = await request("GET", path, undefined, { raw: true });
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "download";
    return { blob: await response.blob(), filename };
  },
};

/** Saves a downloaded file through a temporary object URL (the browser's normal download). */
export function saveFile({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
