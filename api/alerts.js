import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { unread = 'false' } = req.query;
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (unread === 'true') {
        query = query.eq('read', false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }
    
    if (req.method === 'POST') {
      const { type, message, severity = 'info', read = false } = req.body;
      
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          type,
          message,
          severity,
          read,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return res.status(201).json(data);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Alerts API error:', err);
    res.status(500).json({ error: err.message });
  }
}