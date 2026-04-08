/**
 * Tiny fetch wrapper that injects the bearer token from NEXT_PUBLIC_API_TOKEN
 * into every request to the backend. The token is non-secret in the sense that
 * it ships in the JS bundle — this is a defense-in-depth layer, not real auth.
 * For real auth, replace with session-based login.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || '';

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (API_TOKEN && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${API_TOKEN}`);
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export { API_URL };
