import { SCENARIOS } from '../../../scenarios.mjs';
import { chat } from '../../../ollama.mjs';
const schema = { type: 'object', additionalProperties: false, required: ['plan'], properties: { plan: { type: 'string' } } };
for (const sc of SCENARIOS) {
  const system = `${sc.room}\nYou are ${sc.listenerRole}.\n\nWHAT EVERYONE IN THE ROOM KNOWS\n${sc.background.join('\n\n')}\n\nTHE QUESTION: ${sc.question}`;
  for (let i = 0; i < 5; i++) {
    const r = await chat({ model: 'qwen3.5:9b', system, prompt: 'Before any speaker has said a word: what plan would you back? Answer as JSON: plan, one sentence.', schema, temperature: 0.8, seed: 4242 + i });
    console.log(sc.id, i, '|', (r.json?.plan ?? JSON.stringify(r).slice(0, 200)));
  }
}
