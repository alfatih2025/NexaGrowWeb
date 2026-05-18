import supabase from './_supabase.js';

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => escapeCsvValue(row[key])).join(','));
  }
  return lines.join('
');
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!supabase) return json(200, []);

  try {
    const type = event.queryStringParameters?.type || 'sensor';
    const format = event.queryStringParameters?.format || 'csv';
    const start = event.queryStringParameters?.start || null;
    const end = event.queryStringParameters?.end || null;

    let query;
    if (type === 'sensor') {
      query = supabase.from('sensor_data').select('*').order('created_at', { ascending: false }).limit(1000);
      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);
    } else if (type === 'logs') {
      query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000);
    } else if (type === 'control') {
      query = supabase.from('control_logs').select('*').order('executed_at', { ascending: false }).limit(1000);
    } else {
      query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];

    if (format === 'json') {
      return json(200, rows);
    }

    const csv = toCsv(rows);
    return json(
      200,
      csv,
      {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    );
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Export API error' });
  }
}
