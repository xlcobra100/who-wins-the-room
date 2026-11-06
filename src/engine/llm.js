/**
 * Browser-side model client. Every call goes to the local /api/generate route
 * (server/api.js), which forwards to Ollama or Claude. `settings` is shared
 * and mutable: changing settings.engine at runtime switches providers.
 */
export class LLMClient {
  constructor(settings) {
    this.settings = settings; // { engine: 'ollama'|'claude'|'offline', ollamaModel, claudeModel, apiKey }
    this.stats = { calls: 0, totalMs: 0, lastMs: 0, lastModel: '' };
  }

  get online() { return this.settings.engine !== 'offline'; }

  async generate({ system, prompt, schema, maxTokens = 500, signal }) {
    const s = this.settings;
    if (s.engine === 'offline') throw new Error('offline engine selected');
    const body = {
      provider: s.engine,
      model: s.engine === 'claude' ? s.claudeModel : s.ollamaModel,
      system,
      prompt,
      schema,
      maxTokens,
    };
    if (s.engine === 'claude' && s.apiKey) body.apiKey = s.apiKey;
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    let j;
    try { j = await r.json(); } catch { j = { error: `HTTP ${r.status}` }; }
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status });
    this.stats.calls++;
    this.stats.lastMs = j.ms || 0;
    this.stats.totalMs += j.ms || 0;
    this.stats.lastModel = j.model || '';
    return j.json;
  }
}

export async function fetchHealth() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    return { ollama: { ok: false, models: [], error: e.message }, claude: { envCredentials: false, models: [] }, apiDown: true };
  }
}
