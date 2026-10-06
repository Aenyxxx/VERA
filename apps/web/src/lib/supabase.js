// Supabase Auth in the browser (publishable key only; the browser never reads app tables).
// Remember me (FR-AUTH-03): checked → session in localStorage (survives a browser restart);
// unchecked → sessionStorage (ends when the browser closes). TRD §7.2.
import { createClient } from "@supabase/supabase-js";

const REMEMBER_KEY = "vera.remember";

function rememberMeEnabled() {
  return localStorage.getItem(REMEMBER_KEY) === "true";
}

export function setRememberMe(on) {
  localStorage.setItem(REMEMBER_KEY, String(on));
}

// PKCE code verifiers ("…-code-verifier") must survive into the NEW tab that an email link opens,
// so they always go to localStorage; sessionStorage is per tab. Only the session itself follows Remember me.
const storeFor = (key) => (key.endsWith("-code-verifier") || rememberMeEnabled() ? localStorage : sessionStorage);

export const rememberMeStorage = {
  getItem: (key) => storeFor(key).getItem(key),
  setItem: (key, value) => storeFor(key).setItem(key, value),
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in apps/web/.env (see .env.example).");
}

export const supabase = createClient(url, publishableKey, {
  auth: { storage: rememberMeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
