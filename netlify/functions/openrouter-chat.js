import { requireApiAuth, authError } from './_auth.js';
import { sendOpenRouterMessage } from './_openrouter.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = requireApiAuth(event);
  if (!auth.ok) return authError();

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const message = typeof body.message === 'string' ? body.message : '';
    const result = await sendOpenRouterMessage({
      message,
      history: Array.isArray(body.history) ? body.history : [],
      sensorContext: body.sensorContext ?? null,
      origin: event.headers?.origin,
    });
    return json(200, result);
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
    });
  }
}
