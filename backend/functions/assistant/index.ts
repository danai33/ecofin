// @ts-nocheck  (plain JavaScript: the editor need not type-check it)
// EcoFin — asistentul AI (Supabase Edge Function)
// Keeps the Claude API key on the server, answers signed-in people only, picks the model by task,
// limits requests and cost per person per day (and for the whole site), and streams Claude's answer
// back unchanged (SSE).
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   required — the Claude API key (best created for one workspace, expiration "Never")
//   ANTHROPIC_WORKSPACE_ID optional — only for a key that works in several workspaces (wrkspc_…)
//   AI_DAILY_LIMIT      optional — requests per person per day (default 60; a question that uses a
//                       calculation takes 2 requests)
//   AI_USER_DAILY_USD   optional — the most one person can spend per day, in US dollars (default 0.5;
//                       0 = no cost limit per person)
//   AI_SITE_DAILY_USD   optional — the most the whole site can spend per day (default 3; 0 = no limit)
//   AI_MODEL_CHAT       optional — default claude-haiku-5-5
//   AI_MODEL_CONTRACT   optional — default claude-sonnet-5-5 (contracts and photographed pages)
//   ALLOWED_ORIGINS     optional — comma-separated site addresses allowed to call (default: any)
// Supabase provides SUPABASE_URL and the project keys: the new ones (SUPABASE_PUBLISHABLE_KEYS,
// SUPABASE_SECRET_KEYS) or the legacy ones (SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
// Written in plain JavaScript syntax so the same code runs under Deno (Supabase) and in local tests.

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const PURPOSES = { chat: 2000, contract: 3000, transcribe: 4000 }; // max output tokens per task
const MAX_BODY = 12 * 1024 * 1024;
const MAX_CHARS = 250000;  // all the text of one request: instructions, conversation, tool results
const MAX_IMAGES = 4;
const IMG_TOKENS = 3000;   // the most one picture (≤ 1600 px, as the page sends them) counts as input
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// US dollars per million tokens [input, output] (platform.claude.com/docs/en/about-claude/pricing).
// A model missing here is priced high on purpose, so the budgets stay on the safe side.
const PRICES = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20] };
const PRICE_UNKNOWN = [10, 50];

export function price(model, inTok) {
  if (model === 'claude-haiku-5-5' && inTok > 100000) return [0.5, 2.5]; // Haiku 5.5: long prompts cost more
  return PRICES[model] || PRICE_UNKNOWN;
}
// cost in millionths of a dollar: tokens × dollars per million tokens
export function costMicros(model, inTok, outTok) {
  const [pi, po] = price(model, inTok);
  return Math.ceil(Math.max(0, inTok) * pi + Math.max(0, outTok) * po);
}

// a project key: the new kind (JSON by name, "default" first) or else the legacy JWT key
export function projectKey(env, names, legacy) {
  const raw = env(names) || '';
  try { const j = JSON.parse(raw); if (j && typeof j === 'object') { const v = j.default || Object.values(j).find((x) => typeof x === 'string' && x); if (v) return String(v); } }
  catch (e) { if (/^sb_/.test(raw)) return raw; }
  return env(legacy) || '';
}
// server-to-server calls: the key goes in "apikey"; only a legacy JWT key may also be a Bearer token
export const keyHeaders = (k) => (/^eyJ/.test(k) ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k });

export function settings(env) {
  const usd = (k, d) => { const v = parseFloat(env(k) ?? ''); return Math.round((Number.isFinite(v) && v >= 0 ? v : d) * 1e6); };
  return {
    key: (env('ANTHROPIC_API_KEY') || '').trim(),
    workspace: (env('ANTHROPIC_WORKSPACE_ID') || '').trim(),
    daily: Math.max(1, parseInt(env('AI_DAILY_LIMIT') || '60', 10) || 60),
    userBudget: usd('AI_USER_DAILY_USD', 0.5),
    siteBudget: usd('AI_SITE_DAILY_USD', 3),
    models: {
      chat: env('AI_MODEL_CHAT') || 'claude-haiku-5-5',
      contract: env('AI_MODEL_CONTRACT') || 'claude-sonnet-5-5',
      transcribe: env('AI_MODEL_CONTRACT') || 'claude-sonnet-5-5',
    },
    origins: (env('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean),
    url: (env('SUPABASE_URL') || '').replace(/\/$/, ''),
    anon: projectKey(env, 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
    service: projectKey(env, 'SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

function cors(req, cfg) {
  const origin = req.headers.get('origin') || '';
  const allow = !cfg.origins.length ? '*' : cfg.origins.includes(origin) ? origin : cfg.origins[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function fail(status, code, extra, headers) {
  return new Response(JSON.stringify({ error: { code, ...(extra || {}) } }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// who is asking: the session token is checked by Supabase Auth itself
async function whoIs(req, cfg, fetchFn) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === cfg.anon || /^sb_/.test(token)) return null;
  const r = await fetchFn(`${cfg.url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: cfg.anon } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}

async function rpc(cfg, fetchFn, name, args) {
  const r = await fetchFn(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...keyHeaders(cfg.service), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${name} ${r.status}`);
  return r.json().catch(() => null);
}

// checks the request so nobody can use the key for anything else than EcoFin's assistant,
// and measures it (characters and pictures) to reserve its largest possible cost
export function validate(body) {
  if (!body || typeof body !== 'object') return 'invalid_request';
  const purpose = body.purpose in PURPOSES ? body.purpose : 'chat';
  if (body.system != null && (typeof body.system !== 'string' || body.system.length > 80000)) return 'invalid_request';
  let chars = body.system ? body.system.length : 0, images = 0;
  const msgs = body.messages;
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > 60) return 'invalid_request';
  for (const m of msgs) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'invalid_request';
    if (typeof m.content === 'string') { chars += m.content.length; continue; }
    if (!Array.isArray(m.content) || !m.content.length || m.content.length > 40) return 'invalid_request';
    for (const b of m.content) {
      if (!b || typeof b !== 'object') return 'invalid_request';
      if (b.type === 'text') { if (typeof b.text !== 'string') return 'invalid_request'; chars += b.text.length; continue; }
      if (b.type === 'image') {
        images++;
        const s = b.source || {};
        if (s.type !== 'base64' || !IMG_TYPES.includes(s.media_type) || typeof s.data !== 'string' || s.data.length > 7000000) return 'image_rejected';
        continue;
      }
      if (b.type === 'tool_use') {
        if (typeof b.id !== 'string' || b.id.length > 200 || !/^[a-zA-Z0-9_-]{1,64}$/.test(b.name || '') || !b.input || typeof b.input !== 'object') return 'invalid_request';
        chars += JSON.stringify(b.input).length;
        continue;
      }
      if (b.type === 'tool_result') {
        if (typeof b.tool_use_id !== 'string' || b.tool_use_id.length > 200) return 'invalid_request';
        if (typeof b.content === 'string') { chars += b.content.length; continue; }
        if (!Array.isArray(b.content) || b.content.length > 20) return 'invalid_request';
        for (const c of b.content) { if (!c || c.type !== 'text' || typeof c.text !== 'string') return 'invalid_request'; chars += c.text.length; }
        continue;
      }
      return 'invalid_request';
    }
  }
  if (images > MAX_IMAGES) return 'image_rejected';
  if (body.tools != null) {
    if (!Array.isArray(body.tools) || body.tools.length > 12) return 'invalid_request';
    for (const t of body.tools) {
      if (!t || !/^[a-zA-Z0-9_-]{1,64}$/.test(t.name || '') || typeof (t.description || '') !== 'string' || (t.description || '').length > 4000) return 'invalid_request';
      if (!t.input_schema || typeof t.input_schema !== 'object') return 'invalid_request';
      const schema = JSON.stringify(t.input_schema).length;
      if (schema > 8000) return 'invalid_request';
      chars += (t.description || '').length + schema;
    }
  }
  if (chars > MAX_CHARS) return 'prompt_too_large';
  return { purpose, chars, images };
}

function upstreamCode(status, message, detail) {
  // the Claude account's own spend limit (set in the Console) or its tier's monthly cap was reached
  if (/usage limits|spend limit/i.test(message || '') || detail === 'enforced_spend_limit_reached') return 'site_limit';
  if (status === 400 && /anthropic-workspace-id/i.test(message || '')) return 'not_configured'; // key needs a workspace
  if (status === 400) return /too long|too many tokens|maximum context/i.test(message || '') ? 'prompt_too_large' : 'invalid_request';
  if (status === 401 || status === 403 || status === 404) return 'not_configured';
  if (status === 413) return 'prompt_too_large';
  if (status === 429) return 'rate_limited';
  return 'upstream_error';
}

// passes Claude's stream through unchanged and notes the tokens it reports. done(in, out, complete)
// runs once: complete is false when the reader stopped early (the person pressed Stop or left).
function relay(body, done) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '', inTok = 0, outTok = 0, over = false;
  const scan = (line) => {
    if (!line.startsWith('data:')) return;
    try {
      const ev = JSON.parse(line.slice(5));
      if (ev.type === 'message_start') { inTok = ev.message?.usage?.input_tokens || inTok; outTok = ev.message?.usage?.output_tokens || outTok; }
      if (ev.type === 'message_delta' && ev.usage) { outTok = ev.usage.output_tokens || outTok; inTok = ev.usage.input_tokens || inTok; }
    } catch (e) { /* not JSON: ignore */ }
  };
  const end = (complete) => { if (over) return; over = true; done(inTok, outTok, complete); };
  return new ReadableStream({
    async pull(ctl) {
      let r;
      try { r = await reader.read(); } catch (e) { end(false); ctl.error(e); return; }
      if (r.done) { if (buf) scan(buf); end(true); ctl.close(); return; }
      ctl.enqueue(r.value);
      buf += dec.decode(r.value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() || '';
      lines.forEach(scan);
    },
    cancel(reason) { end(false); return reader.cancel(reason).catch(() => {}); },
  });
}

export async function handle(req, env, opts) {
  const fetchFn = (opts && opts.fetch) || fetch;
  const waitUntil = (opts && opts.waitUntil) || ((p) => p);
  const cfg = settings(env);
  const h = cors(req, cfg);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return fail(405, 'invalid_request', null, h);

  const user = await whoIs(req, cfg, fetchFn).catch(() => null);
  if (!user) return fail(401, 'signed_out', null, h);
  if (!cfg.key) return fail(503, 'not_configured', null, h);

  const len = parseInt(req.headers.get('content-length') || '0', 10);
  if (len > MAX_BODY) return fail(413, 'prompt_too_large', null, h);
  let body;
  try { const text = await req.text(); if (text.length > MAX_BODY) return fail(413, 'prompt_too_large', null, h); body = JSON.parse(text); }
  catch (e) { return fail(400, 'invalid_request', null, h); }
  const v = validate(body);
  if (typeof v === 'string') return fail(v === 'prompt_too_large' ? 413 : 400, v, null, h);

  // reserve the most this request can cost; the real cost replaces it when the answer ends
  const model = cfg.models[v.purpose], maxOut = PURPOSES[v.purpose];
  const estIn = Math.ceil(v.chars / 2.5) + v.images * IMG_TOKENS + 600;
  const reserve = costMicros(model, estIn, maxOut);
  let take;
  try { take = await rpc(cfg, fetchFn, 'ai_take', { p_user: user.id, p_max: cfg.daily, p_reserve: reserve, p_user_budget: cfg.userBudget, p_site_budget: cfg.siteBudget }); }
  catch (e) { console.warn('ai_take', String(e)); return fail(500, 'upstream_error', null, h); }
  if (!take || take.ok !== true) {
    if (take && take.code === 'site_limit') return fail(429, 'site_limit', null, h);
    return fail(429, 'daily_limit', take && take.reason === 'requests' ? { limit: cfg.daily } : null, h);
  }
  const settle = (inTok, outTok, cost, refund) => waitUntil(
    rpc(cfg, fetchFn, 'ai_settle', { p_user: user.id, p_day: take.day, p_in: inTok, p_out: outTok, p_cost: cost, p_reserved: reserve, p_refund: !!refund })
      .catch((e) => console.warn('ai_settle', String(e))),
  );

  const payload = { model, max_tokens: maxOut, messages: body.messages, stream: true };
  if (body.system) payload.system = body.system;
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools.map((t) => ({ name: t.name, description: t.description || '', input_schema: t.input_schema }));

  const apiHeaders = { Authorization: `Bearer ${cfg.key}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (cfg.workspace) apiHeaders['anthropic-workspace-id'] = cfg.workspace;
  let up;
  try {
    up = await fetchFn(ANTHROPIC, { method: 'POST', headers: apiHeaders, body: JSON.stringify(payload) });
  } catch (e) { settle(0, 0, 0, true); return fail(502, 'upstream_error', null, h); }
  if (!up.ok || !up.body) {
    let msg = '', detail = '';
    try { const j = await up.json(); msg = j?.error?.message || ''; detail = j?.error?.details?.error_code || ''; } catch (e) { /* ignore */ }
    console.warn('claude api', up.status, msg.slice(0, 300));
    settle(0, 0, 0, true); // Claude did not answer: nothing was billed, the request is given back
    const code = upstreamCode(up.status, msg, detail);
    return fail(up.status === 429 || code === 'site_limit' ? 429 : 502, code, null, h);
  }
  const stream = relay(up.body, (inTok, outTok, complete) => {
    // stopped early: the output so far is unknown, so count the most it could have been
    const cost = complete ? costMicros(model, inTok, outTok) : costMicros(model, inTok || estIn, Math.max(outTok, maxOut));
    settle(inTok, outTok, cost, false);
  });
  return new Response(stream, {
    headers: { ...h, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Daily-Used': String(take.used ?? ''), 'X-Daily-Limit': String(cfg.daily), 'Access-Control-Expose-Headers': 'X-Daily-Used, X-Daily-Limit' },
  });
}

// (the local tests import this file without starting a server)
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !Deno.env.get('ECOFIN_TEST')) {
  const rt = globalThis.EdgeRuntime;
  Deno.serve((req) => handle(req, (k) => Deno.env.get(k), { waitUntil: (p) => (rt && rt.waitUntil ? rt.waitUntil(p) : p) }));
}
