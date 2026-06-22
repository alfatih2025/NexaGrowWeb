import { requireApiAuth, authError } from './_auth.js';
import { getOpenRouterStatus } from './_openrouter.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = requireApiAuth(event);
  if (!auth.ok) return authError();

  const status = await getOpenRouterStatus(event.headers?.origin);
  return json(status.ok ? 200 : 503, status);
}
