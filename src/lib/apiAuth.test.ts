import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// apiAuth reads VITE_API_AUTH_TOKEN once at module load, so each test stubs the
// env and re-imports the module in isolation.
async function loadApiAuth(token?: string) {
  vi.resetModules();
  if (token === undefined) {
    vi.stubEnv('VITE_API_AUTH_TOKEN', '');
  } else {
    vi.stubEnv('VITE_API_AUTH_TOKEN', token);
  }
  return import('./apiAuth');
}

describe('apiAuth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('without a token configured', () => {
    it('hasApiAuthToken is false', async () => {
      const { hasApiAuthToken } = await loadApiAuth('');
      expect(hasApiAuthToken()).toBe(false);
    });

    it('buildApiHeaders returns the extra headers unchanged', async () => {
      const { buildApiHeaders } = await loadApiAuth('');
      const extra = { 'Content-Type': 'application/json' };
      expect(buildApiHeaders(extra)).toBe(extra);
    });

    it('treats whitespace-only tokens as unset', async () => {
      const { hasApiAuthToken } = await loadApiAuth('   ');
      expect(hasApiAuthToken()).toBe(false);
    });
  });

  describe('with a token configured', () => {
    it('hasApiAuthToken is true', async () => {
      const { hasApiAuthToken } = await loadApiAuth('secret-token');
      expect(hasApiAuthToken()).toBe(true);
    });

    it('adds auth headers to a plain object', async () => {
      const { buildApiHeaders } = await loadApiAuth('secret-token');
      const result = buildApiHeaders({ 'Content-Type': 'application/json' }) as Record<string, string>;
      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-token',
        'x-api-key': 'secret-token',
      });
    });

    it('merges auth headers into a Headers instance', async () => {
      const { buildApiHeaders } = await loadApiAuth('secret-token');
      const extra = new Headers({ Accept: 'application/json' });
      const result = buildApiHeaders(extra) as Headers;
      expect(result).toBeInstanceOf(Headers);
      expect(result.get('accept')).toBe('application/json');
      expect(result.get('authorization')).toBe('Bearer secret-token');
      expect(result.get('x-api-key')).toBe('secret-token');
    });

    it('appends auth header entries to a header tuple array', async () => {
      const { buildApiHeaders } = await loadApiAuth('secret-token');
      const extra: [string, string][] = [['Accept', 'application/json']];
      const result = buildApiHeaders(extra) as [string, string][];
      expect(result).toEqual([
        ['Accept', 'application/json'],
        ['Authorization', 'Bearer secret-token'],
        ['x-api-key', 'secret-token'],
      ]);
    });

    it('trims surrounding whitespace from the token', async () => {
      const { buildApiHeaders } = await loadApiAuth('  padded  ');
      const result = buildApiHeaders() as Record<string, string>;
      expect(result.Authorization).toBe('Bearer padded');
    });
  });
});
