import http from 'node:http';
import { URL } from 'node:url';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REPOSITORY = new RegExp(`^[a-f0-9]{64}_${UUID}$`, 'i');
const forbidden = new Set(['.htpasswd', '.receiver-vault', '.env', 'api.env']);

function reject(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error: message }));
}

function safePath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const parts = decoded.split('/').filter(Boolean);
  if (!parts.length || !REPOSITORY.test(parts[0])) return null;
  if (parts.some(part => part === '.' || part === '..' || forbidden.has(part.toLowerCase()) || part.includes('\\') || /[\x00-\x1f]/.test(part))) return null;
  return `/${parts.map(part => encodeURIComponent(part)).join('/')}`;
}

export function createReceiverProxy({ host = '127.0.0.1', port = 8000 } = {}) {
  return (req, res, next) => {
    if (req.url?.startsWith('/api/')) return next();
    const parsed = new URL(req.url || '/', 'http://receiver.local');
    const path = safePath(parsed.pathname);
    if (!path) return next();
    if (req.headers.origin && !/^https:\/\/(www\.)?jcevnzl\.space$/.test(req.headers.origin)) return reject(res, 403, 'Origen no autorizado.');
    if (!req.headers.authorization || !/^Basic\s+[A-Za-z0-9+/=]+$/.test(req.headers.authorization)) return reject(res, 401, 'Autenticación del repositorio requerida.');
    const proxy = http.request({ host, port, method: req.method, path: `${path}${parsed.search}`, headers: {
      authorization: req.headers.authorization,
      'content-type': req.headers['content-type'] || 'application/octet-stream',
      ...(req.headers['content-length'] ? {'content-length': req.headers['content-length']} : {}),
      'user-agent': 'JCEnterprise-receiver-proxy/1',
    }}, upstream => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    });
    proxy.on('error', error => { if (!res.headersSent) reject(res, 503, 'Receptor de respaldos no disponible.'); else res.destroy(error); });
    req.pipe(proxy);
  };
}
