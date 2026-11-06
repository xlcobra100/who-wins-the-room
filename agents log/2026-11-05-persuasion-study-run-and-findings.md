# 2026-11-05 Persuasion study: the overnight run, protocol 2, and the findings

This follows `2026-11-04-overnight-persuasion-study.md`, which covers how the harness was built.

## Changed
- `study/scenarios.mjs`: dam and salient were rebalanced to v2 (`version: 2`); the v1 copy is in `study/runs/main/scenarios.v1.mjs`.
- `study/prompts.mjs` + `study/debate.mjs`: **protocol 2 contrast rule**. A seeded coin flip picks which side drafts its plan blind; the other side sees that one-sentence plan and must differ in its core choice. Records carry `protocol`, `scenarioVersion` and `draftFirst`.
- `study/run.mjs`: strips a UTF-8 BOM from `control.json`.
- `study/analyze.mjs`:
  - `--protocol N` filter;
  - `--out <name>`;
  - a draft-first line;
  - a weak Bradley-Terry prior;
  - energy per debate now divides by all debates.
- New `study/classify-plans.mjs`: post-hoc plan categories per platform, written to `runs/<run>/plans.json`.
- New `study/plan-analysis.mjs`: type effects with and without the plan.
- New `study/platform-test.mjs`: probes the diversity of blind platforms per scenario.
- `study/METHOD.md`: Amendments 1 (protocol 2) and 2 (plan analysis, exploratory).
- Data: `study/runs/main/` holds the complete run of 198 debates, plus `FINDINGS.md`, the `report-*.md` cuts and `monitor-log.md`.

## Why
- **Protocol 2.** With fully blind openings, both debaters picked the same plan in 11 of 11 dam debates and 9 of 9 salient debates, so votes followed speaking order. Protocol 2 fixed this: only 6 of 161 debates were same-plan afterwards.
- **Headline results** (full write-up in `study/runs/main/FINDINGS.md`; published page: https://claude.ai/artifact/UTU1hhvBnSeb4XViAStEiK):
  - Populist style −0.61 log-odds and Technocrat +0.47. Pragmatist +0.36 and Idealist −0.35.
  - Best type: HYB-PRA at 70% of votes.
  - The plan the model favours wins 78% of votes. Controlling for the plan, the Populist penalty survives and the Idealist penalty mostly vanishes.
- **Energy:** 0.80 kWh GPU, measured.

## Not changed
- The first 37 debates (protocol 1) stay in the data. The primary analysis is `--protocol 2`, and all debates together are the sensitivity check.
- The gemma4:12b listener comparison never fit before 06:00; slack was never more than about 4 debates. The next step is to re-judge the saved `debates/*.json` offline instead of running new debates.
- The game code (`src/`, `server/`) is untouched.

## Surprises for the next agent
- **Write `control.json` with node, not PowerShell `Set-Content`.** PowerShell 5.1 writes a BOM. The runner now strips it, but other tools may not.
- **Narrow kills only.** A broad `taskkill /IM node.exe` is denied by the auto-mode classifier. Kill only your own process, matched by its command line.
- **Interim energy per debate was inflated.** The interim check-ins reported 6.9 Wh per debate because the old code divided by the filtered n; the true figure is 4.0 Wh GPU.
- **Same-ideology pairs still produce near-identical plans sometimes.** The responder makes the smallest change that counts as different.
- **Logit non-collapsibility.** Adding plan effects *grows* the speaking-first effect (−0.34 → −0.80). Don't read that as a new finding.
- **CronCreate jobs die with the session.** The hourly check-ins fired 8-30 min late from jitter.

## How to verify
- `node study/analyze.mjs --run main --protocol 2 --out report-p2` reproduces the ranking (about 2 min; CPU-only bootstrap).
- `node study/plan-analysis.mjs --run main --protocol 2` reproduces the plan table. It needs `runs/main/plans.json`; regenerate that with `node study/classify-plans.mjs --run main` (needs Ollama with qwen3.5:9b).
- `wc -l study/runs/main/results.jsonl` should print 198.
