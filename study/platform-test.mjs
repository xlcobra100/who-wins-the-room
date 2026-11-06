// Platform-diversity probe: one blind opening platform per type, per scenario. node platform-test.mjs dam salient
import { chat } from './ollama.mjs';
import { TYPES } from './archetypes.mjs';
import { scenarioById } from './scenarios.mjs';
import { debaterSystem, debaterTurnPrompt } from './prompts.mjs';
const schema = { type: 'object', additionalProperties: false, required: ['platform'], properties: { platform: { type: 'string' } } };
for (const id of process.argv.slice(2)) {
  const sc = scenarioById(id);
  console.log(`== ${id} v${sc.version || 1}`);
  for (const t of TYPES) {
    const r = await chat({ model: 'qwen3.5:9b', system: debaterSystem(sc, t, 'Jordan Hale', 'Sam Vidal'), prompt: debaterTurnPrompt({ round: 1, totalRounds: 3, me: 'Jordan Hale', opp: 'Sam Vidal', speaksFirst: true }), schema, seed: 4242 + TYPES.indexOf(t), numPredict: 500 });
    console.log(`${t.id}: ${r.json.platform}`);
  }
}
