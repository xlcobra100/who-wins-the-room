// Quick single-debate smoke test: node pilot.mjs <typeA> <typeB> <scenario> [rounds]
import { writeFileSync } from 'node:fs';
import { runDebate, toMarkdown } from './debate.mjs';
const [typeA = 'POP-REA', typeB = 'TEC-IDE', scenarioId = 'dam', rounds = '3'] = process.argv.slice(2);
const cfg = { debaterModel: 'qwen3.5:9b', listenerModel: 'qwen3.5:9b', rounds: +rounds, listeners: 5, debaterTemperature: 0.8, listenerTemperature: 0.8 };
const id = `pilot-${typeA}-vs-${typeB}-${scenarioId}-${Date.now() % 100000}`;
const rec = await runDebate({ id, pass: 0, pairIndex: -1, scenarioId, typeA, typeB, seed: Date.now() % 100000 }, cfg, console.log);
writeFileSync(`runs/pilot/${id}.json`, JSON.stringify(rec, null, 2));
writeFileSync(`runs/pilot/${id}.md`, toMarkdown(rec));
const dc = rec.calls.filter(c => c.role === 'debater'), lc = rec.calls.filter(c => c.role === 'listener');
const avg = (xs, k) => Math.round(xs.reduce((a, c) => a + c[k], 0) / xs.length);
console.log(`DONE ${id} in ${rec.seconds}s winner=${rec.winner} votes=${JSON.stringify(rec.votes)}`);
console.log(`debater calls ${dc.length}: avg ${avg(dc,'ms')}ms in=${avg(dc,'tokensIn')} out=${avg(dc,'tokensOut')}`);
console.log(`listener calls ${lc.length}: avg ${avg(lc,'ms')}ms in=${avg(lc,'tokensIn')} out=${avg(lc,'tokensOut')} retries=${rec.tokens.retries}`);
