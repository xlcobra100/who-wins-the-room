# 2026-11-03 Debate mode, carrier dispatches, expressive body language & ping-pong breakout

## Changed
- `src/engine/director.js`: Added anti-ping-pong suppression (-4.2 score penalty for immediate repeat speakers), 2-cycle alternating lockout, decayed address bonus (+1.0 for recent speakers), and urgency boosts for quiet council members.
- `src/scene/character.js`: Added complete 3D body language matching all 8 emotions (angry, anxious, resolute, defiant, grieved, hopeful, wry, calm) across idle postures, arm folding/clenched fists/flat palms, breathing depths/rates, muscle tremors, darting saccades, and aggressive/deliberate/fluttering speech gestures.
- `src/scene/carrier.js`: New procedural 3D flying carrier drone with propulsion thrusters, rotating scanner ring, and downward holographic beam.
- `src/engine/council.js` & `src/main.js`: Added `carrierDispatch` lever (`P` key or dock button) that broadcasts public intelligence to all members simultaneously, shifting convictions.
- `src/data/personas.js`: Added 7th persona (Dr. Lyra Chen, Biosphere Director) and `rhetoricBias` mapping (logos, pathos, ethos, pragmatism).
- `src/ui/hud.js`, `index.html`, `src/style.css`: Added Debate Arena start screen selector (choose 2 debaters on stage, 5 audience members listening in jury) with live persuasion sway tracking.
- `tests/engine.test.mjs`: Added automated test suites for carrier dispatches and debate stage duel with audience rhetoric sway.

## Why
- User reported two characters were getting stuck debating back and forth indefinitely; the director's address bonus previously monopolized turns between two speakers.
- User requested body language matching emotions, a public carrier to insert testable intel that everyone sees, and a main menu Debate Mode with 2 debaters on stage and 5 audience listeners open to persuasion.

## Not changed
- Existing 4-option dilemma schemas and vote tally mechanisms remain compatible.
- Procedural Three.js rendering remains zero-asset and offline-capable.

## Surprises for the next agent
- In Debate Mode, `SEAT_ANGLES` switches so Debaters 1 & 2 occupy stage positions (θ = -30° and +30° facing inward/audience) while the 5 audience jury members occupy the audience arc.
- In `offlineTurn`, `rhetoric` is selected from the speaker's persona bias (`rhetoricBias`) and evaluated against each audience member's moral profile to trigger stance flips or backfires.

## How to verify
- Run `npm test` to verify all 6 dilemma scenarios, carrier dispatches, and debate stage sway pass cleanly.
- Run `npx vite build` to confirm client build compiles without errors.
- Open `npm run dev` and test selecting "Debate Arena" on the start screen.
