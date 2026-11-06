# 2026-11-01 Initial build: Halcyon Council (Gville v2)

## Changed
- New project from an empty folder: a Vite + Three.js r187 browser game in which six AI council members debate dilemmas aboard an orbital habitat. See `README.md` for how to run and play it, and for the code map.
- `server/api.js`: `/api/health` and `/api/generate`, routing schema-constrained JSON generation to Ollama (default) or to Claude through `@anthropic-ai/sdk`. Mounted in the dev server by `vite.config.js` and in production by `server.js`.
- `src/engine/*`: DOM-free council engine. It covers the memory stream (episodic, thoughts, stance, trust, whispers), the speaker-selection director, prompts and schemas, the offline scripted cognition, the custom-scenario designer, and the turn pipeline with prefetch plus the gavel, crisis, whisper and vote interventions.
- `src/scene/*`: procedural chamber, gas-giant window, hologram, six avatars (breathing, head-tracking, blinking, gestures, vote poses, whisper motes, nameplates), camera director (overview / auto-focus with cuts / free) and affinity web.
- `src/ui/hud.js` and `src/main.js` contain the start screen, transcript, mind inspector, subtitles, lever popovers, vote panel and modals. `src/audio/*` holds the WebAudio SFX and per-persona TTS.
- `tests/engine.test.mjs` runs every scenario headless through debate, whisper, gavel, crisis and vote.

## Why
The user pasted a mission brief for a multi-agent 3D council game. `../Gville` (v1, Python/Flask + Ollama) already exists. This v2 is a fresh JS rebuild and does not touch v1. Ollama is the default engine because v1 and the user's RTX 4060 Ti setup are local-first. Claude is optional, and an offline engine keeps the game playable with no model.

## Not changed
- `../Gville` (v1) was read for context only. Its AGENTS.md limits edits to its own folder.
- No GLTF assets and no external textures: everything is procedural, so there is nothing to download.
- No streaming of model tokens. Each turn is a single JSON object, and latency is hidden by generating the next turn while the current one is performed.

## Surprises for the next agent
- The default local model is `qwen3.5:9b`, at about 3 s per turn. `gemma4:12b` measured about 13.5 s steady-state on the same prompt. `server/api.js` sends `think:false` only to models whose `/api/tags` capabilities include `thinking`.
- Claude requests must not send `temperature`: SDK 1.3 pins API version `2026-10-21`, which rejects sampling params. Opus 5.5 cannot disable thinking, so the game uses `output_config.effort: "low"` and `max_tokens >= 8000`.
- A closed partial `CylinderGeometry` (`openEnded: false` with a theta range) adds pie-slice caps that reach the room centre. One such cap once sliced through the council at chest height (`room.js`, window sill).
- Chrome throttles requestAnimationFrame in the automation tab to about 2-3 fps. Measure GPU frame time with `stage.frame()` + `gl.finish()` instead (about 2.6 ms, 384 draw calls).
- The auto-focus camera cuts between close shots, with a dip-to-black, rather than gliding. Glides between seats flew through heads.
- The custom-dilemma designer takes 30-60 s on qwen3.5:9b because it produces one large JSON object.

## How to verify
- `npm test` should print six `ok` scenario lines and "all engine tests passed".
- With `npm run dev` running: `node tests/engine.test.mjs --live` should report `live turn (llm)`.
- `npx vite build` should complete with no errors.
