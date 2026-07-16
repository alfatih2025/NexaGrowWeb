const DEFAULT_ALLOW_METHODS = 'GET, POST, OPTIONS';
const DEFAULT_ALLOW_HEADERS = 'Content-Type, Authorization, x-api-key';

/**
 * Applies the standard CORS headers shared by every serverless handler and
 * transparently answers preflight (OPTIONS) requests.
 *
 * @returns {boolean} true when the request was a handled OPTIONS preflight and
 *   the caller should return immediately.
 */
export function applyCors(req, res, { methods = DEFAULT_ALLOW_METHODS, headers = DEFAULT_ALLOW_HEADERS } = {}) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

/**
 * Extracts a human-readable message from a thrown value. Handles Error
 * instances as well as plain objects that carry a string `message` (e.g.
 * Supabase/PostgREST errors), falling back to `fallback` otherwise.
 */
export function getErrorMessage(err, fallback = 'Unknown error') {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}
