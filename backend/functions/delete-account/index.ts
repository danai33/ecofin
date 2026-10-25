// @ts-nocheck  (plain JavaScript: the editor need not type-check it)
// EcoFin — șterge contul (Supabase Edge Function)
// A signed-in person deletes their own account. The database removes all their documents and
// assistant counters with it (foreign keys "on delete cascade"). Nobody can delete someone else.
// Supabase provides SUPABASE_URL and the project keys: the new ones (SUPABASE_PUBLISHABLE_KEYS,
// SUPABASE_SECRET_KEYS) or the legacy ones (SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).

function cors(req, env) {
  const origins = (env('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': !origins.length ? '*' : origins.includes(origin) ? origin : origins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
function projectKey(env, names, legacy) {
  const raw = env(names) || '';
  try { const j = JSON.parse(raw); if (j && typeof j === 'object') { const v = j.default || Object.values(j).find((x) => typeof x === 'string' && x); if (v) return String(v); } }
  catch (e) { if (/^sb_/.test(raw)) return raw; }
  return env(legacy) || '';
}
const keyHeaders = (k) => (/^eyJ/.test(k) ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k });
const json = (status, obj, h) => new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } });

export async function handle(req, env, opts) {
  const fetchFn = (opts && opts.fetch) || fetch;
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { error: { code: 'invalid_request' } }, h);
  const url = (env('SUPABASE_URL') || '').replace(/\/$/, '');
  const anon = projectKey(env, 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), service = projectKey(env, 'SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === anon || /^sb_/.test(token)) return json(401, { error: { code: 'signed_out' } }, h);
  // the account to delete is always the one that owns the session — never an id from the request
  const who = await fetchFn(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } }).catch(() => null);
  const user = who && who.ok ? await who.json().catch(() => null) : null;
  if (!user || !user.id) return json(401, { error: { code: 'signed_out' } }, h);
  const del = await fetchFn(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: keyHeaders(service),
  }).catch(() => null);
  if (!del || !del.ok) { console.warn('delete user', del && del.status); return json(502, { error: { code: 'upstream_error' } }, h); }
  return json(200, { ok: true }, h);
}

// (the local tests import this file without starting a server)
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !Deno.env.get('ECOFIN_TEST')) {
  Deno.serve((req) => handle(req, (k) => Deno.env.get(k)));
}
