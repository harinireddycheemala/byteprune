export const API_BASE = 'http://localhost:5001';

export async function api(path, body = {}, method = 'POST') {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
    if (res.status === 405 && method !== 'GET') res = await fetch(API_BASE + path);
  } catch {
    throw new Error('Could not reach backend. Is Flask running on ' + API_BASE + '?');
  }
  if (!res.ok) throw new Error(`Backend error ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

// try several possible key names, including one level of nesting
export function pick(obj, keys, fallback = 0) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v))
      for (const k of keys) if (v[k] !== undefined && v[k] !== null) return v[k];
  }
  return fallback;
}