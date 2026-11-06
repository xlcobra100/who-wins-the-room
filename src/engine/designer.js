/**
 * Custom dilemma designer: turns the player's free-text prompt into a full
 * playable scenario (four options, crises, whispers, opening stances). Uses the
 * active model when there is one; otherwise, or on any failure, falls back to
 * the generic template from makeCustomScenario so the session always starts.
 */
import { makeCustomScenario } from '../data/scenarios.js';
import { DESIGNER_SYSTEM, buildScenarioPrompt, scenarioSchema } from './prompts.js';
import { clamp } from './memory.js';

const IDS = ['A', 'B', 'C', 'D'];

export async function designScenario(text, personas, llm) {
  const base = makeCustomScenario(text);
  if (!llm || !llm.online) return { scenario: base, designed: false };
  try {
    const j = await llm.generate({
      system: DESIGNER_SYSTEM,
      prompt: buildScenarioPrompt(text, personas),
      schema: scenarioSchema(personas),
      maxTokens: 1600,
    });
    if (!Array.isArray(j?.options) || j.options.length < 4) throw new Error('designer returned too few options');
    const options = j.options.slice(0, 4).map((o, i) => ({ id: IDS[i], label: String(o.label || base.options[i].label).slice(0, 40), desc: String(o.desc || base.options[i].desc) }));
    const idOf = (n) => IDS[clamp(parseInt(n, 10) || 0, 0, 3)];
    const stances = { ...base.stances };
    for (const s of j.stances || []) {
      if (!personas.some((p) => p.id === s.id)) continue;
      stances[s.id] = { position: idOf(s.option), conviction: clamp(parseInt(s.conviction, 10) || 50, 10, 95), thought: String(s.thought || '') };
    }
    const crises = (j.crises || []).slice(0, 4).map((c, i) => ({ id: `gc${i}`, title: String(c.title || 'Alert').slice(0, 50), text: String(c.text || ''), severity: clamp(parseInt(c.severity, 10) || 2, 1, 3), shift: {} }));
    const whispers = (j.whispers || []).slice(0, 4).map((w) => ({ text: String(w.text || ''), favors: idOf(w.favors) })).filter((w) => w.text);
    const scenario = makeCustomScenario(text, {
      title: String(j.title || base.title).slice(0, 60),
      tagline: String(j.tagline || base.tagline),
      clock: String(j.clock || base.clock),
      brief: String(j.brief || base.brief),
      opener: personas.some((p) => p.id === j.opener) ? j.opener : base.opener,
      options,
      stances,
      crises: crises.length ? crises : base.crises,
      whispers: whispers.length ? whispers : base.whispers,
    });
    scenario.playerPrompt = text;
    return { scenario, designed: true };
  } catch (e) {
    console.warn('[halcyon] scenario designer failed, using template', e);
    return { scenario: base, designed: false, error: e.message };
  }
}
