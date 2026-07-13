import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore
import { getOpenRouterStatus, sendOpenRouterMessage } from './src/lib/apiHelpers/_openrouter.js';

async function readBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function openRouterDevPlugin() {
  return {
    name: 'openrouter-dev-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url) {
          next();
          return;
        }

        if (req.url.startsWith('/api/openrouter')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'GET') {
            const status = await getOpenRouterStatus(req.headers.origin);
            res.statusCode = status.ok ? 200 : 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(status));
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            const body = await readBody(req);
            const result = await sendOpenRouterMessage({
              message: body.message,
              history: Array.isArray(body.history) ? body.history : [],
              sensorContext: body.sensorContext ?? null,
              origin: req.headers.origin,
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
              }),
            );
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  const plugins = [react(), tailwindcss(), openRouterDevPlugin()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 5500,
      strictPort: false,
      allowedHosts: ['9c9h55dv-5500.asse.devtunnels.ms'],
    },
  };
});
