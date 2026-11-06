# 2026-11-05: Mechanism checks explaining the study results

## Changed
- **New `study/runs/main/checks/`:**
  - `mechanisms.cjs` reads the protocol-2 debates and reports four things:
    - lean share by round (blind round 1 vs later rounds);
    - how often the round-1 lean persists;
    - how often vote reasons echo each round's speeches (shared 4-gram);
    - number-word density by style.
  - `prior-plan.mjs` asks qwen3.5:9b, as a listener with no debate, which plan it backs (5 samples per scenario, fixed seeds).
  - Output from each script sits next to it in a `*.out.txt` file.

## Why
The user asked which technical and AI-fundamental factors explain the results, for a presentation. These checks turn the explanations into measured facts:
- **No position bias in blind openings.** In round 1 the second speaker gets 50% of decided leans. That rises to 58% in round 2 and 56% in round 3, so the last-word effect comes from rebuttal structure, not prompt order.
- **Round-1 leans stick.** A decided round-1 lean becomes the final vote 83% of the time.
- **Vote reasons echo the closings.** They share a 4-gram with the voted side's closing 15% of the time, against 5% for its opening.
- **Technocrats are denser in numbers.** Number-words per 100 words: TEC 4.6, HYB 3.2, POP 2.5, at equal length (~120 words).
- **The model's own prior matches the favoured plan in only some scenarios.** With no debate, it backs the favoured plan 5/5 in river and salient. Board is split. In dam it backs "do nothing / evacuate", which no debater argued.

## Not changed
No study code, data or reports were touched. FINDINGS.md was not edited; these checks are exploratory.

## Surprises for the next agent
- The model is qwen3.5:9b, which is 9.7B parameters at Q4_K_M.
- Ollama's defaults (top_k 20, top_p 0.95, presence_penalty 1.5) applied on top of the study's temperature of 0.8. The study set only temperature, so these defaults shape output diversity.
- `prior-plan.mjs` is deterministic with fixed seeds; a rerun gave identical output.
- The 4-gram echo test and the number-word count are crude lexical proxies.

## How to verify
From `study/runs/main/`:
- `node checks/mechanisms.cjs "$PWD/debates"`
- `node checks/prior-plan.mjs` (needs Ollama to be running)

Compare the output of each with the matching `*.out.txt` file.
