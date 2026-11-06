# 2026-11-04 Overnight persuasion study harness (study/)

## Changed
- New folder `study/`: a headless harness for a debate study. 12 debater archetypes (3 styles × 4 ideologies) debate four fictional scenarios (political, military, corporate, diplomatic) in front of 5 blank listeners. Each listener keeps its own memory stream, reflects every round and casts a forced-choice vote at the end. The design is in `study/METHOD.md`; each file explains itself in its header.
  - `archetypes.mjs`, `scenarios.mjs`: the treatment and the material.
  - `prompts.mjs`, `debate.mjs`: one debate.
  - `ollama.mjs`: seeded, schema-constrained calls.
  - `run.mjs`: the overnight runner (schedule, resume, live `control.json`, hard stop, GPU power and CPU logging).
  - `analyze.mjs`: Bradley-Terry ratings, the factorial logit, the dynamics, the energy figure, `report.md`.
- User environment variable `OLLAMA_NUM_PARALLEL=6` is set and Ollama was restarted. This has **no effect for qwen3.5**, but it helps any other model.
- The game itself (`src/`, `server/`) is untouched.

## Why
The user asked for an overnight study (planned for 00:00-06:00, starting early once the pilot passed) of which AI personality wins the most support in a debate. They asked for 5 listener agents who reflect each round and then vote, with no rating scale.
- The game's Debate Arena is tied to rendering. Its audience is the game's own personas, and its sway is rule-based. The study needed blank LLM listeners and new archetypes, so it runs as its own headless harness next to the game.
- The user's decisions:
  - no hidden agendas;
  - blank listeners, with an optional `listenerProfiles` hook left open;
  - one scenario per domain;
  - measure the power draw rather than price it;
  - stop at 06:00.

## Not changed
- There is no "personality RL" (adapting types from their results). It would change the treatment in the middle of the measurement. It is a follow-up study.
- No game integration. Transcripts could later be replayed in the 3D arena.

## Surprises for the next agent
- Ollama 0.40 refuses parallel requests for the qwen35 architecture (server.log: "model architecture does not currently support parallel requests"). Every call is sequential at about 39 tok/s, and a debate takes about 128 s (21 calls). The time budget follows from that.
- `run.mjs` re-reads `control.json` and `schedule.json` before every debate. Edit them live; don't restart. A restart resumes from `results.jsonl`.
- Hourly monitoring was scheduled with CronCreate inside the Claude Code session that built this. It dies if that session is closed.
- The 9B model sometimes misquotes the scenario figures in speeches. That is left in on purpose and noted as a limitation.

## How to verify
- `node study/pilot.mjs POP-REA TEC-IDE dam 3` runs one debate (about 2 min) and writes to `study/runs/pilot/`.
- `node study/analyze.mjs --run main` regenerates the report from the overnight data.
- `study/runs/main/monitor-log.md` holds every change made during the run.
