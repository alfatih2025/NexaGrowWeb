import supabase from '../_supabase.js';
import { requireApiAuth } from '../_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const { id } = req.body || {};

      if (id) {
        const { data, error } = await supabase
          .from('alerts')
          .update({ read: true })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      const { data, error } = await supabase
        .from('alerts')
        .update({ read: true })
        .eq('read', false)
        .select();
      if (error) throw error;
      return res.status(200).json({ markedAsRead: data?.length || 0 });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Alert read error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
