import supabase from './_supabase.js';
import { requireApiAuth, authError } from './_auth.js';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  const stringValue = String(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!supabase) return json(500, { error: 'Supabase belum dikonfigurasi' });

  try {
    if (event.httpMethod === 'GET') {
      if (!requireApiAuth(event)) return authError();

      const type = event.queryStringParameters?.type || 'sensor';
      const format = event.queryStringParameters?.format || 'csv';
      const start = event.queryStringParameters?.start;
      const end = event.queryStringParameters?.end;

      let data = [];
      let error = null;

      if (type === 'sensor') {
        let query = supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false });

        if (start) query = query.gte('created_at', start);
        if (end) query = query.lte('created_at', end);

        const result = await query.limit(1000);
        data = result.data || [];
        error = result.error;
      } else if (type === 'logs') {
        const result = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        data = result.data || [];
        error = result.error;
      } else if (type === 'control') {
        const result = await supabase
          .from('control_logs')
          .select('*')
          .order('executed_at', { ascending: false })
          .limit(1000);
        data = result.data || [];
        error = result.error;
      }

      if (error) throw error;

      if (format === 'csv') {
        const headers = Object.keys(data[0] || {});
        const rows = data.map((row) => headers.map((key) => csvEscape(row[key])).join(','));
        const csv = [headers.join(','), ...rows].join('\n');

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Cache-Control': 'no-store',
          },
          body: csv,
        };
      }

      return json(200, data);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Export error' });
  }
}
