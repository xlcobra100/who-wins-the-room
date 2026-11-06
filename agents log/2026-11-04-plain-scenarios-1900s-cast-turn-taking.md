# 2026-11-04: Plain-language scenarios with back story, 1900s cast, turn-taking fix, beep removed

## Changed
- `src/data/scenarios.js`: rewrote every tagline, brief and option description in plain language. Every scenario now has `background` (paragraphs of lore) and `stakes` (one line per member on why it matters to them). Replaced the three 1900s scenarios with historically grounded ones: `titanic_1912` (White Star office, the morning after), `panic_1907` (Morgan library, 2 Nov 1907), `july_1914` (advisers near Whitehall, 29 Jul 1914). They keep their ids and add `year`, `place` and `world`. The previous file is not in git; a backup from this session sat in the session scratchpad only.
- `src/data/personas.js`: toned down the metaphor-heavy `style` lines (Chen, Novak, Rivet, Vance, Okafor). Added `ERA_1900` (period role, bio, agenda, values, wardrobe and offline lines per member), plus `castFor(era)`, `eraOf(scenario)` and `lookFor(persona, theme)`.
- `src/scene/character.js`: in the 1900s room every member wears period clothes, built by `buildPeriodOutfit` (tunic, frock coat, waistcoats, blouses, gown). Also added `updo` hair, a `flatcap`, a mustache and spectacles. Wardrobe follows the room theme; identity follows the scenario.
- `src/engine/prompts.js`: the system prompt uses `scenario.world` instead of Halcyon when set, and includes the background, the member's stake, a period-language rule (`year`) and plain-speech rules. Ordinary turns get a varied "move" from `reactMove()` instead of always "X just spoke, respond". Added `chronicleSystem(sc)`.
- `src/engine/director.js`: re-weighted `pickNextSpeaker`. Silence is now a gentle pull with a hard floor at 9 turns. It adds a hogging penalty, suppresses pairs that are locked in an exchange, rewards picking up older threads, and uses the trait-dial assertiveness. Crisis responders are less assertiveness-driven.
- `src/engine/council.js`: `echoOf()` plus one retry when the model nearly repeats its own line. `sanitizeSpeech` no longer splits on initials or titles ("U. S. Steel", "Mr.").
- `src/main.js`, `src/ui/hud.js`, `index.html`, `src/style.css`: the session seats `castFor(eraOf(scenario))`. The start screen has a scenario detail panel (`#scenarioDetail`). The Dilemma tab shows the setting, background and stakes. The inspector shows "What's at stake for them".
- `src/audio/sfx.js`: removed the 1244 Hz tone tremoloed at 5.2 Hz (the "fast beeping" above tension 55).
- `tests/engine.test.mjs`: added tests for initials, turn-taking balance and rotation, 1900s prompt leaks, and echo detection.

## Why
User feedback (2026-11-04): the scenarios "sound very AI" and need real back story; the 1900s characters need other skins; "Vance and Kestrel are just talking to each other"; a fast beeping sound in the background.
A live qwen3.5:9b run showed what was behind the ping-pong. The old director (0.55 per silent turn plus an urgency ramp) produced a fixed 7-seat loop where each member answered only the previous speaker, and Kestrel always spoke right before Vance. The same run showed that 1900s prompts still told the model it was on a 2291 space station, so speech filled with "hull/station/biosphere".

## Not changed
- Sci-fi pro/con lines, crises, whispers and outcomes (only their taglines, briefs and option text). Debate Arena still strictly alternates its two debaters; that is by design.
- The custom-dilemma designer still adapts everything to Halcyon, even if the 1900s room is selected.
- The carrier drone is still sci-fi in the 1900s room; only its prompt wording says "telegram".

## Surprises for the next agent
- Era identity follows the *scenario* (`eraOf`). Wardrobe follows the *room theme* (`lookFor`), so a sci-fi scenario in the 1900s room gets period clothes but Halcyon identities.
- `castFor('1900')` shallow-copies personas on purpose. `traits` stays the same object, so trait dials work in both eras.
- Outfit panels are segmented to follow the chest curve (`chestZ`). A single straight box sinks into the torso.
- Speaker-balance tests are randomized but have a wide margin (worst-case min 7/70 against a threshold of 5).

## How to verify
- `npm test` passes, including "Turn-taking balance" and "1900s prompts".
- `npx vite build` builds cleanly.
- Live check: with the dev server running and Ollama up, run a council session on "The Panic of 1907". Speakers should vary, and nobody should mention a station or hull.
