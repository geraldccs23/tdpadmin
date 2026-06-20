import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const TOKEN_KEY = 'restaurantdp_auth_token';
const listeners: Array<(event: string, session: any) => void> = [];

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function notify(event: string, session: any) {
  listeners.forEach(cb => { try { cb(event, session); } catch {} });
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
  if (API_URL) {
    const json = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (json?.ok && json.token) {
      setToken(json.token);
      const session = { user: json.user, access_token: json.token };
      notify('SIGNED_IN', session);
      return { data: { user: json.user, session }, error: null };
    }
    if (json && !json.ok && json.error !== 'invalid credentials') {
      return { data: null, error: new Error(json.error) };
    }
  }
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.data?.session) notify('SIGNED_IN', result.data.session);
  return result;
}

async function getSession() {
  if (API_URL) {
    const token = getToken();
    if (token) {
      const json = await apiRequest('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (json?.ok && json.user) {
        return { data: { session: { user: json.user, access_token: token } }, error: null };
      }
      clearToken();
    }
  }
  const result = await supabase.auth.getSession();
  if (result.data?.session) return result;
  return { data: { session: null }, error: null };
}

async function signOut() {
  const token = getToken();
  clearToken();
  notify('SIGNED_OUT', null);
  if (API_URL && token) {
    apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await supabase.auth.signOut().catch(() => {});
  return { error: null };
}

function onAuthStateChange(cb: (event: string, session: any) => void) {
  listeners.push(cb);
  const handler = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY) {
      if (e.newValue) notify('SIGNED_IN', { user: null, access_token: e.newValue });
      else notify('SIGNED_OUT', null);
    }
  };
  window.addEventListener('storage', handler);
  const sub = supabase.auth.onAuthStateChange(cb);
  return {
    data: {
      subscription: {
        unsubscribe: () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
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
