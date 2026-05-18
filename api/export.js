import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { type = 'sensor', format = 'csv', start, end } = req.query;
      
      let data, error;
      
      if (type === 'sensor') {
        const query = supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (start) query.gte('created_at', start);
        if (end) query.lte('created_at', end);
        
        const result = await query.limit(1000);
        data = result.data;
        error = result.error;
      } else if (type === 'logs') {
        const result = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        data = result.data;
        error = result.error;
      } else if (type === 'control') {
        const result = await supabase
          .from('control_logs')
          .select('*')
          .order('executed_at', { ascending: false })
          .limit(1000);
        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      
      if (format === 'csv') {
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map(row => 
          Object.values(row).map(val => 
            typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
          ).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }
      
      return res.status(200).json(data);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Export API error:', err);
    res.status(500).json({ error: err.message });
  }
}