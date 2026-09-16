export const apiUrl = path => path;
export async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { status: response.status });
  return data;
}
