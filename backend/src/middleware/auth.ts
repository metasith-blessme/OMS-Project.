import { Request, Response, NextFunction } from 'express';

/**
 * Static bearer token authentication.
 *
 * Reads the expected token from `process.env.API_TOKEN` and rejects any request
 * to `/api/*` whose `Authorization: Bearer <token>` header doesn't match.
 *
 * Exempt paths (allowlist):
 *   - GET  /api/health                       — needed for uptime checks + dev sanity
 *   - POST /api/integrations/line/webhook    — LINE servers don't send our bearer token; HMAC handles auth
 *
 * If `API_TOKEN` is unset, the middleware logs a loud warning and lets all requests
 * through. This is intentional so existing dev environments don't break, but
 * production must always set the variable.
 */
const EXEMPT_PATHS = new Set<string>([
  '/api/health',
  '/api/integrations/line/webhook',
]);

let warnedAboutMissingToken = false;

export function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    if (!warnedAboutMissingToken) {
      console.warn('⚠️  API_TOKEN is not set — auth middleware is allowing all requests. Set API_TOKEN in .env before deploying.');
      warnedAboutMissingToken = true;
    }
    return next();
  }

  if (EXEMPT_PATHS.has(req.path)) return next();
  // Anything outside /api/ (e.g. static assets) is also exempt
  if (!req.path.startsWith('/api/')) return next();

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice('Bearer '.length).trim();
  if (token !== expected) {
    return res.status(401).json({ error: 'Invalid API token' });
  }
  next();
}
