/**
 * Halcyon Council — local API layer.
 *
 * One connect-style middleware used by both the Vite dev server (vite.config.js)
 * and the production server (server.js). The browser never talks to a model
 * directly: it POSTs a {system, prompt, schema} bundle to /api/generate and this
 * module routes it to either
 *   - Ollama (default; local GPU, http://127.0.0.1:11434), or
 *   - Claude via the official Anthropic SDK (credentials resolved server-side:
 *     ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile, or a
 *     key the player pasted into Settings, which is forwarded per request only).
 * Both providers are asked for schema-constrained JSON so the game engine can
 * read speech / inner thought / stance / trust deltas without fragile parsing.
 *
 * If the client disconnects (the engine aborts a stale prefetch), the upstream
 * request is aborted too, so the GPU doesn't keep generating dead turns.
 */
import Anthropic from '@anthropic-ai/sdk';

const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');

// Preference order when the player hasn't picked a local model yet.
// qwen3.5:9b benchmarked at ~3s per council turn on an RTX 4060 Ti; gemma4 is richer but slower.
const OLLAMA_PREFERENCE = ['qwen3.5:9b', 'gemma4:12b', 'qwen3.5:4b', 'llama3.2:3b'];

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (default)', fallbacks: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster)', fallbacks: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest)', fallbacks: false },
];

let ollamaCache = { at: 0, data: null };

async function listOllama() {
  if (ollamaCache.data && Date.now() - ollamaCache.at < 15000) return ollamaCache.data;
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const models = (j.models || [])
      .filter((m) => !(m.details?.family || '').includes('bert') && !(m.capabilities || []).includes('embedding'))
      .map((m) => ({
        name: m.name,
        params: m.details?.parameter_size || '',
        sizeGB: m.size ? +(m.size / 1e9).toFixed(1) : null,
        thinking: (m.capabilities || []).includes('thinking'),
      }));
    const names = models.map((m) => m.name);
    const recommended = OLLAMA_PREFERENCE.find((n) => names.includes(n)) || names[0] || null;
    ollamaCache = { at: Date.now(), data: { ok: true, host: OLLAMA_HOST, models, recommended } };
  } catch (e) {
    ollamaCache = { at: Date.now(), data: { ok: false, host: OLLAMA_HOST, models: [], recommended: null, error: e.message } };
  }
  return ollamaCache.data;
}

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  if (res.writableEnded || res.destroyed) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

/** Tolerant JSON extraction: models occasionally wrap JSON in prose or code fences. */
export function extractJson(text) {
  if (!text) throw new Error('Empty model response');
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  throw new Error('Model did not return valid JSON');
}

async function generateOllama({ model, system, prompt, schema, maxTokens, temperature }, signal) {
  const catalog = await listOllama();
  if (!catalog.ok) throw Object.assign(new Error(`Ollama is not reachable at ${OLLAMA_HOST}`), { status: 503 });
  const chosen = model || catalog.recommended;
  if (!chosen) throw Object.assign(new Error('No local Ollama models installed'), { status: 503 });
  const info = catalog.models.find((m) => m.name === chosen);
  const payload = {
    model: chosen,
    stream: false,
    format: schema,
    keep_alive: '30m',
    options: { temperature: temperature ?? 0.85, num_ctx: 8192, num_predict: Math.min(maxTokens || 700, 1500) },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
  // Thinking-capable local models (qwen3.5, gemma4) are much faster with thinking off,
  // and the council needs quick conversational turns, not long chains of reasoning.
  if (info?.thinking) payload.think = false;
  const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw Object.assign(new Error(`Ollama error ${r.status}: ${detail.slice(0, 300)}`), { status: 502 });
  }
  const j = await r.json();
  return { json: extractJson(j.message?.content || ''), model: chosen, usage: { out: j.eval_count, in: j.prompt_eval_count } };
}

async function generateClaude({ model, system, prompt, schema, maxTokens, effort, apiKey }, signal) {
  const chosen = model || CLAUDE_MODELS[0].id;
  let client;
  try {
    client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  } catch (e) {
    throw Object.assign(new Error('No Claude credentials found. Set ANTHROPIC_API_KEY before starting the server, run `ant auth login`, or paste a key in Settings.'), { status: 401 });
  }
  const params = {
    model: chosen,
    // Thinking is always on for current Claude models and counts toward this cap,
    // so leave generous headroom above the short JSON the game actually needs.
    max_tokens: Math.max(maxTokens || 0, 8000),
    // The persona/scenario system prompt is stable across an agent's turns: cache it.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      effort: effort || 'low', // short in-character turns: low effort keeps the debate snappy
      format: { type: 'json_schema', schema },
    },
  };
  const spec = CLAUDE_MODELS.find((m) => m.id === chosen);
  let resp;
  if (spec?.fallbacks) {
    // Server-side refusal fallback: if a safety classifier declines a turn (dark
    // dilemmas can trip false positives), Anthropic re-runs it on its recommended
    // fallback model inside the same call instead of failing the debate.
    resp = await client.beta.messages.create(
      { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },
      { signal },
    );
  } else {
    resp = await client.messages.create(params, { signal });
  }
  if (resp.stop_reason === 'refusal') {
    throw Object.assign(new Error(`Claude declined this turn (${resp.stop_details?.category || 'policy'})`), { status: 422 });
  }
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    json: extractJson(text),
    model: resp.model,
    usage: { in: resp.usage?.input_tokens, out: resp.usage?.output_tokens, cacheRead: resp.usage?.cache_read_input_tokens },
  };
}

function classifyClaudeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return { status: 401, message: 'Claude rejected the credentials (check the API key).' };
  if (e instanceof Anthropic.PermissionDeniedError) return { status: 403, message: 'This Claude key cannot use that model.' };
  if (e instanceof Anthropic.NotFoundError) return { status: 404, message: 'Claude model not found for this key.' };
  if (e instanceof Anthropic.RateLimitError) return { status: 429, message: 'Claude rate limit hit; slow down or switch model.' };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, message: `Claude rejected the request: ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { status: 503, message: 'Could not reach the Claude API.' };
  if (e instanceof Anthropic.APIError) return { status: e.status || 502, message: `Claude API error: ${e.message}` };
  return null;
}

export function createApiMiddleware() {
  return async function halcyonApi(req, res, next) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/')) return next();
    try {
      if (req.method === 'GET' && path === '/api/health') {
        const ollama = await listOllama();
        return send(res, 200, {
          ollama,
          claude: {
            envCredentials: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
            models: CLAUDE_MODELS,
          },
        });
      }
      if (req.method === 'POST' && path === '/api/generate') {
        const body = await readJson(req);
        if (!body.system || !body.prompt || !body.schema) return send(res, 400, { error: 'system, prompt and schema are required' });
        const ac = new AbortController();
        res.on('close', () => { if (!res.writableFinished) ac.abort(); });
        const t0 = Date.now();
        try {
          const out = body.provider === 'claude'
            ? await generateClaude(body, ac.signal)
            : await generateOllama(body, ac.signal);
          return send(res, 200, { ...out, ms: Date.now() - t0 });
        } catch (e) {
          if (ac.signal.aborted) return; // client went away; nothing to answer
          const c = classifyClaudeError(e);
          return send(res, c?.status || e.status || 500, { error: c?.message || e.message });
        }
      }
      return send(res, 404, { error: 'Not found' });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  };
}
