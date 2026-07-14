import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!requireApiAuth(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image_base64 } = req.body || {};

    if (!image_base64) {
      return res.status(400).json({ error: 'image_base64 is required' });
    }

    const systemPrompt = `Kamu adalah AI Pakar Diagnosis Penyakit Tanaman. Kamu akan menerima gambar tanaman (misalnya dari ESP32-CAM).
Tentukan apakah tanaman tersebut sehat ("Sehat") atau tidak sehat ("Tidak Sehat").
Return your response STRICTLY as a JSON object with the following structure:
{
  "status": "Sehat" | "Tidak Sehat",
  "confidence": number,
  "notes": "string"
}`;

    let imageUrl = image_base64;
    // Format appropriately if not already a data URL
    if (!image_base64.startsWith('data:image')) {
      imageUrl = `data:image/jpeg;base64,${image_base64}`;
    }

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://nexagrow.vercel.app',
      },
      body: JSON.stringify({
        // model must support vision
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analisis kesehatan tanaman pada gambar ini.' },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      })
    });

    if (!openRouterRes.ok) {
      throw new Error(`OpenRouter error: ${await openRouterRes.text()}`);
    }

    const openRouterData = await openRouterRes.json();
    const content = openRouterData?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    return res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
