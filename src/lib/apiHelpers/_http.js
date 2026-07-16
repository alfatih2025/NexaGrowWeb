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

export function getErrorMessage(err, fallback = 'Unknown error') {
  return err instanceof Error ? err.message : fallback;
}
