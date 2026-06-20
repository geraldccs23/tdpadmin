import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'restaurantdp_auth_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(path: string, options?: RequestInit) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    return await res.json();
  } catch {
    return null;
  }
}

async function login(email: string, password: string) {
  // Try new API first
  if (API_URL) {
    const json = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (json?.ok && json.token) {
      setToken(json.token);
      return {
        data: {
          user: json.user,
          session: { user: json.user, access_token: json.token },
        },
        error: null,
      };
    }
    if (json && !json.ok && json.error !== 'invalid credentials') {
      // Real API error (not just wrong password) — fall through to supabase
      return { data: null, error: new Error(json.error) };
    }
  }
  // Fallback to Supabase
  return supabase.auth.signInWithPassword({ email, password });
}

async function getSession() {
  // Try new API first
  if (API_URL) {
    const token = getToken();
    if (token) {
      const json = await apiRequest('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (json?.ok && json.user) {
        return {
          data: { session: { user: json.user, access_token: token } },
          error: null,
        };
      }
      // Token expired/invalid — clear it
      clearToken();
    }
  }
  // Fallback to Supabase
  const result = await supabase.auth.getSession();
  // If supabase has a session, use it
  if (result.data?.session) {
    return result;
  }
  return { data: { session: null }, error: null };
}

async function signOut() {
  const token = getToken();
  clearToken();
  // Try to call logout endpoint (fire-and-forget)
  if (API_URL && token) {
    apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  // Also sign out from Supabase
  await supabase.auth.signOut().catch(() => {});
  return { error: null };
}

function onAuthStateChange(cb: (event: string, session: any) => void) {
  // Listen for storage changes (token set/cleared from other tabs)
  const handler = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY) {
      if (e.newValue) {
        cb('SIGNED_IN', { user: null, access_token: e.newValue });
      } else {
        cb('SIGNED_OUT', null);
      }
    }
  };
  window.addEventListener('storage', handler);
  // Also subscribe to Supabase auth changes
  const sub = supabase.auth.onAuthStateChange(cb);
  return {
    data: {
      subscription: {
        unsubscribe: () => {
          window.removeEventListener('storage', handler);
          sub.data.subscription.unsubscribe();
        },
      },
    },
  };
}

export const auth = {
  login,
  getSession,
  signOut,
  onAuthStateChange,
};
