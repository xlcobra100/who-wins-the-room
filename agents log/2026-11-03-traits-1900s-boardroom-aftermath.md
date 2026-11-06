# 2026-11-03: Character Traits, 1900s Grand Boardroom, and Vote Aftermath Reassembly

## Changed
- `src/data/personas.js`: Added psychological dials (`traits: { openness, persuadability, assertiveness, compromise }`) across all 7 council members.
- `src/engine/prompts.js`: Integrated numerical trait scores and behavioral directives into LLM system prompts.
- `src/engine/offline.js`: Scaled social pull, counter-argument resistance, and stance shifts with `openness` and `persuadability`.
- `src/engine/council.js`: Added `updateAgentTrait()` and `applyAftermath({ outcomeId, outcomeTitle, outcomeDesc, hoursLater })` which updates narrative clock, leaps tension (+35 on Total Failure), updates memories/thoughts, and logs chronicle dispatches.
- `src/scene/room.js`: Added `buildBoardroom1900` (English oak parquet, Persian rug, green banker lamps, antique globe centerpiece, grandfather clock, rosewood gavel) and 1900s river skyline with silver moon, warehouses, and gaslamps.
- `src/scene/character.js`: Added `dispose()` method cleaning up DOM label elements; added Edwardian tufted leather Chesterfield armchairs and period styling when `theme === 'boardroom1900'`.
- `src/scene/stage.js`: Added `setTheme(theme)` dynamic theme switching; fixed duplicate CSS2D nameplates by invoking `dispose()` and `replaceChildren()`; guarded `this.accents` and `this.sky` properties against theme transitions.
- `src/data/scenarios.js`: Added 3 in-depth 1900s historical scenarios (`titanic_1912`, `panic_1907`, `july_1914`) with 4-way dilemmas and crisis shocks.
- `src/ui/hud.js`: Added trait dials to Mind Inspector; added modal trait tuner on Start Screen cast cards; added `showReassembleBanner()`.
- `src/main.js`: Added post-vote aftermath directive picker (Total Failure, Pyrrhic Compromise, Fragile Order, Decisive Breakthrough) and 5-hours-later reassembly transition.
- `src/style.css`: Added styles for theme cards, trait dials, aftermath directive picker, and reassemble banner.

## Why
User requested customizable psychological dials (openness to challenge, persuadability), elimination of duplicate name plates, an authentic early 1900s conference room aesthetic with rich scenarios, post-vote consequence selection ("Total Failure"), and 5-hours-later crisis reassembly.

## Not changed
- Existing sci-fi orbital scenarios (`oxygen`, `signal`, `bloom`, etc.) and the core debate duel mode.
- Ollama local GPU pipeline (`qwen3.5:9b`) and prompt templating architecture.

## Surprises for the next agent
- Three.js `CSS2DRenderer` preserves DOM elements even after removing parent Object3Ds from the scene graph. Always invoke `.dispose()` on characters and `.replaceChildren()` on `labels.domElement` during cast/theme reconstruction.
- `Hologram`, `AffinityWeb`, and `CarrierDrone` hold their Three.js groups on `.group`, not `.root`.
- In `Stage.frame()`, `this.accents.strips` and `this.accents.seamMat` are specific to `scifi`; theme-dependent accents must check for `userData.baseColor` before lerping emissive intensity to prevent animation frame crashes.

## How to verify
- Run `npm test` (all 9 scenario runs and debate mode duel tests pass).
- Run `npx vite build` (builds cleanly with 0 errors).
- Inspect visual QA screenshots: `qa_traits_modal.png` (trait modal), `qa_boardroom_1900.png` (1900s room), `qa_mind_inspector.png` (mind dials), `qa_vote_aftermath.png` (aftermath selector), `qa_reassemble_5hrs.png` (5-hours-later crisis banner).
