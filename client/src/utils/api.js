const BASE_URL = '/api';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || 'Ошибка');
  }

  return res.json();
}

export const api = {
  get: (path, token) => request('GET', path, null, token),
  post: (path, body, token) => request('POST', path, body, token),
  put: (path, body, token) => request('PUT', path, body, token),
  delete: (path, token) => request('DELETE', path, null, token),
};

export async function uploadFile(file, token) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!res.ok) throw new Error('Ошибка загрузки файла');
  return res.json();
}

export function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}
