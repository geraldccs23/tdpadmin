const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const TOKEN_KEY = 'tdpadmin_auth_token';
const listeners: Array<(event: string, user: any) => void> = [];

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function notify(event: string, user: any) {
  listeners.forEach(cb => { try { cb(event, user); } catch {} });
}

async function apiRequest(path: string, options?: RequestInit) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    return await res.json();
  } catch {
    return null;
  }
}

async function login(email: string, password: string) {
  const json = await apiRequest('/api/tdp/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (json?.ok && json.token) {
    setToken(json.token);
    notify('SIGNED_IN', json.user);
    return { data: { user: json.user, token: json.token }, error: null };
  }
  return { data: null, error: new Error(json?.error || 'Error al iniciar sesión') };
}

async function register(email: string, password: string, fullName?: string, role?: string) {
  const json = await apiRequest('/api/tdp/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName, role }),
  });
  if (json?.ok && json.token) {
    setToken(json.token);
    notify('SIGNED_IN', json.user);
    return { data: { user: json.user, token: json.token }, error: null };
  }
  return { data: null, error: new Error(json?.error || 'Error al registrar') };
}

async function getMe() {
  const token = getToken();
  if (!token) return { data: null, error: null };
  const json = await apiRequest('/api/tdp/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (json?.ok) return { data: json.user, error: null };
  clearToken();
  return { data: null, error: null };
}

async function logout() {
  const token = getToken();
  clearToken();
  notify('SIGNED_OUT', null);
  if (token) {
    apiRequest('/api/tdp/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

function onAuthStateChange(cb: (event: string, user: any) => void) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export const tdpAuth = {
  login,
  register,
  getMe,
  logout,
  onAuthStateChange,
  getToken,
};
