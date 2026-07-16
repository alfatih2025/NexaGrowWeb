import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';
import { applyCors, getErrorMessage } from '../src/lib/apiHelpers/_http.js';

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'GET, OPTIONS' })) return;

  try {
    if (req.method === 'GET') {
      if (!requireApiAuth(req, res)) return;

      const { type, limit = 100 } = req.query;

      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit, 10) || 100);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Logs API error:', err);
    res.status(500).json({ error: getErrorMessage(err) });
  }
}
