import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';
import { getOpenRouterStatus } from '../src/lib/apiHelpers/_openrouter.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!requireApiAuth(req, res)) return;

  const status = await getOpenRouterStatus(req.headers.origin);
  return res.status(status.ok ? 200 : 503).json(status);
}