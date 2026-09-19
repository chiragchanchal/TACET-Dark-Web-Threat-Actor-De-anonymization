const TOKEN_KEY = 'tacet_token';
const USER_KEY = 'tacet_user';

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, opts = {}) {
  const { body, method = 'GET', headers = {}, ...rest } = opts;
  const token = getToken();
  const resp = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });
  if (resp.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

export async function login(username, password) {
  const data = await api('/auth/login', { method: 'POST', body: { username, password } });
  setAuth(data.token, data.user);
  return data;
}
