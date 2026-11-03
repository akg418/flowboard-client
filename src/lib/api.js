const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'flowboard.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (username, password) => request('/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),
  setPrivacy: (on, password) => request('/auth/privacy', { method: 'PUT', body: { on, password } }),
  list: () => request('/items'),
  create: (body) => request('/items', { method: 'POST', body }),
  update: (id, body) => request(`/items/${id}`, { method: 'PATCH', body }),
  remove: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  sync: (snapshot) => request('/items/sync', { method: 'PUT', body: snapshot }),
  reorder: (moves) => request('/items/reorder', { method: 'PUT', body: { moves } }),
  notes: () => request('/notes'),
  createNote: (body) => request('/notes', { method: 'POST', body }),
  updateNote: (id, body) => request(`/notes/${id}`, { method: 'PATCH', body }),
  removeNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  analysis: (password, since) => request('/analysis', { method: 'POST', body: { password, since } }),
  analysisUsers: (password, cursor) => request('/analysis/users', { method: 'POST', body: { password, cursor } }),
  analysisResetPassword: (password, id) => request(`/analysis/users/${id}/reset-password`, { method: 'POST', body: { password } }),
  logs: (before) => request(`/logs${before ? `?before=${encodeURIComponent(before)}` : ''}`),
};
