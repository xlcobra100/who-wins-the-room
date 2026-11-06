/**
 * Minimal Ollama client for the study: one schema-constrained JSON chat call,
 * with a per-call seed (so runs are reproducible on the same hardware), timing
 * and token accounting for the energy/throughput log, and retries.
 *
 * Talks to Ollama directly instead of going through server/api.js: the study is
 * headless and needs seeds and raw timings that the game's API layer doesn't expose.
 */
const HOST = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');

let tagsCache = null;
async function capabilities(model) {
  if (!tagsCache) {
    const r = await fetch(`${HOST}/api/tags`);
    tagsCache = (await r.json()).models || [];
  }
  return tagsCache.find((m) => m.name === model)?.capabilities || [];
}

export async function health() {
  const r = await fetch(`${HOST}/api/version`, { signal: AbortSignal.timeout(3000) });
  return r.ok ? (await r.json()).version : null;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error('no JSON in model output');
}

/**
 * @returns {Promise<{json, model, seed, tokensIn, tokensOut, ms, promptMs, evalMs, attempts}>}
 */
export async function chat({ model, system, prompt, schema, temperature = 0.8, seed = 0, numPredict = 500, numCtx = 8192, timeoutMs = 180000, validate = null }) {
  const caps = await capabilities(model);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const s = seed + (attempt - 1) * 7919; // a fresh seed on retry, deterministic
    const body = {
      model,
      stream: false,
      format: schema,
      keep_alive: '60m',
      options: { temperature, seed: s, num_ctx: numCtx, num_predict: numPredict },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    };
    // Thinking off: the schema's free-text fields carry the reasoning, and thinking
    // would multiply the time per call.
    if (caps.includes('thinking')) body.think = false;
    const t0 = Date.now();
    try {
      const r = await fetch(`${HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      const json = parseJson(j.message?.content || '');
      if (validate) {
        const problem = validate(json);
        if (problem) throw new Error(`invalid output: ${problem}`);
      }
      return {
        json, model, seed: s, attempts: attempt,
        tokensIn: j.prompt_eval_count || 0, tokensOut: j.eval_count || 0,
        ms: Date.now() - t0,
        promptMs: Math.round((j.prompt_eval_duration || 0) / 1e6),
        evalMs: Math.round((j.eval_duration || 0) / 1e6),
      };
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
  throw new Error(`model call failed after 4 attempts: ${lastErr?.message}`);
}
