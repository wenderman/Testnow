const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ошибка сервера (${res.status})`);
  }

  if (!res.ok) {
    // 401 outside of auth calls → token expired
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.reload();
    }
    throw new Error(data?.detail || `Ошибка сервера (${res.status})`);
  }
  return data;
}

export const api = {
  register: (username, password) =>
    request('POST', '/auth/register', { username, password }),

  login: (username, password) =>
    request('POST', '/auth/login', { username, password }),

  getHabits: () => request('GET', '/habits'),

  createHabit: (name, description) =>
    request('POST', '/habits', { name, description: description || null }),

  deleteHabit: (id) => request('DELETE', `/habits/${id}`),

  markCompletion: (habitId, date, utcOffsetMinutes) =>
    request('POST', `/habits/${habitId}/completions`, {
      date,
      utc_offset_minutes: utcOffsetMinutes,
    }),

  unmarkCompletion: (habitId, date) =>
    request('DELETE', `/habits/${habitId}/completions/${date}`),

  getCompletions: (from, to, habitId = null) => {
    const params = new URLSearchParams({ from, to });
    if (habitId !== null) params.set('habit_id', String(habitId));
    return request('GET', `/completions?${params}`);
  },

  // ── Push notifications ────────────────────────────────────────────────────
  getVapidKey: () => request('GET', '/push/vapid-public-key'),

  pushSubscribe: ({ endpoint, p256dh, auth }) =>
    request('POST', '/push/subscribe', { endpoint, p256dh, auth }),

  pushUnsubscribe: (endpoint) =>
    request('DELETE', '/push/subscribe', { endpoint }),

  pushTest: () => request('POST', '/push/test'),
};
