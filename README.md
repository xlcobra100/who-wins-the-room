# Who Wins the Room: an AI council game and an overnight persuasion study

A 3D browser game where AI characters debate around a council table, and a study built on top of it. The study asks: **when AI agents debate in front of AI listeners, who wins the room? Is it how you speak, what you believe, or what you propose?**

![The Halcyon Council chamber](study/runs/main/clips/game-halcyon-chamber.png)

| Look at | What it is |
|---|---|
| **[Presentation (PDF)](docs/presentation.pdf)** | The slides I presented. |
| **[Findings](docs/findings.html)** | Results, method and caveats, with charts. |
| **[Inside the debates](docs/highlights.html)** | The biggest swings, the made-up facts, and the Brenna Dam scenario in depth. |
| **[98-second clip](study/runs/main/clips/p3-41-one-closing-line.mp4)** | One debate, narrated, where a single closing line moved three ministers. |
| **[My project notes](NOTES.md)** | What I decided and what the AI did. |
| [Site landing page](docs/index.html) | Start page for the two result pages. GitHub shows `.html` files as source, so download `docs/` and open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → `main` / `docs`) once the repo is public. |
| [Method](study/METHOD.md) · [Findings (text)](study/runs/main/FINDINGS.md) · [Change log of the night](study/runs/main/monitor-log.md) | The pre-registered design, the full write-up, and every change made during the run. |

## The study in one minute

- **Inspiration:** Built from three ideas: the Stanford "Smallville" generative-agents paper (whether agents with memory streams can recreate a human village), research testing AI ideology on political compasses, and my own 3D AI debating game (Halcyon Council), whose debate mode grew into this study.
- **Debaters:** 12 types, from 3 speaking styles (Populist, Hybrid, Technocrat) × 4 ideologies (Realist, Pragmatist, Liberal, Idealist).
- **Scenarios:** 4 fictional ones: a failing dam (political), a besieged brigade (military), a toolmaker near loan default (corporate) and an upstream dam dispute (diplomatic).
- **Listeners:** 5 blank listeners with no personality, only a memory stream. They take notes and lean after every round, then cast a forced vote. There are no 1–10 ratings.
- **The run:** 198 debates overnight, 4–5 Nov 2026, 23:07–05:53. 4,158 model calls, 0 errors, 0.80 kWh of GPU energy. Everything ran locally on one RTX 4060 Ti with `qwen3.5:9b`.
- **Results:**
  - **Style beats ideology.** Populists won 30% of votes against debaters with the same ideology. The Hybrid Pragmatist (a story plus numbers, and a workable plan) was best at 70%.
  - **The plan matters most.** The side holding the plan the model favours took 78% of votes.
  - **The last word helps.** The side speaking last got 56% of votes.
- **Biggest caveat:** one model wrote and judged every speech, so this measures what *qwen* finds persuasive, not what people do.

## Discussion and reflection (my own written synthesis)

**Pre-training:** Model developers usually choose high-quality data, especially for a smaller model (this test used a 9B model). Quality data is used in order to cut training time and improve results (*The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale*, Penedo et al., 2024). However, this data is mostly aimed at the productive work the model is anticipated to be used for, such as coding, analyzing, or writing. Subsequently, the data used has a pragmatic and intellectual character, since that is what is needed to perform better in those targeted workloads. This contributes towards the more pragmatic and technocratic character types winning more debates in the results.

**Reinforcement Learning (RL)** also played a big role. Again, optimizing model performance to excel in those productive workloads produces a more analytical model.

**Scenario setting and the listeners' voting methodology** also provide important clues in understanding the results. The scenarios were all designed to include many factors to ponder. In addition, they all took place in serious settings, such as a meeting table. This presumably leans the model toward thinking in more serious and analytical terms rather than emotional ones.

Another possible reason was that the structure of the listeners' judgment contained a step where the listener compares both alternatives and then explains why it leans one way or the other. So the listener was instructed to be inherently analytical, which is another factor contributing to the results.

Another experimental condition worth reflecting on is the relevance of using the same model to both listen and debate. The debaters had to choose different plans (a prerequisite for a debate). To address this, one debater (chosen by a coin flip) got to draft their plan first. That debater thinks about the problem and chooses the plan it agrees with most. However, the listeners evaluating both debaters reason in a very similar way to the debaters themselves. Subsequently, the listeners are much more prone to agree with whichever debater holds that default plan (which won 78% of the votes, and was taken 55% of the time by the first drafter vs. 33% by the second). This aligns with observations that have already been confirmed in other research on self-preference bias (*LLM-as-a-Judge Biases*, Zheng et al., 2023; Panickssery et al., 2024). That is why it would be valuable to further research model mixing when studying AI interactions.

## How this was made

By **xlcobra100**. I designed the study, set its rules, picked the scenarios' domains, and chose what to analyse and present. The code was written by **Claude Code (Opus 5.5)**, working from my briefs:

- [game brief](docs/briefs/game-brief.md)
- [study brief](promt.txt), verbatim

During the night, an hourly Claude check-in monitored the run and made changes, all logged. Every debater and listener is the local model `qwen3.5:9b`.

[NOTES.md](NOTES.md) has the split of work, my decisions and what they changed. Every AI-made change is written up in [`agents log/`](agents%20log/).

### Reproduce the analysis

```bash
node study/analyze.mjs --run main --protocol 2 --out report-p2   # rebuilds the main tables from saved data (~2 min, CPU only)
node study/pilot.mjs POP-REA TEC-IDE dam 3                       # runs one new debate (needs Ollama + qwen3.5:9b)
```

---

## The game: Halcyon Council

A 3D browser game in which seven AI council members of an orbital habitat sit around a holographic table and debate a high-stakes emergency in real time. You chair the session. You can strike the gavel, inject a crisis, secretly whisper an idea into one member's mind, and call a binding vote.

![stack](https://img.shields.io/badge/Three.js-r187-111) ![stack](https://img.shields.io/badge/Vite-8-111) ![engine](https://img.shields.io/badge/engine-Ollama%20%7C%20Claude%20%7C%20offline-111)

### Run it

```bash
npm install
npm run dev          # http://localhost:5180
```

On Windows you can also double-click `start.bat`.

For a production build: `npm run serve` builds `dist/` and serves it, with the same API, on http://localhost:4180.

### Thinking engines

Pick one on the start screen. You can switch later in Settings, even mid-debate.

| Engine | What you need | Notes |
|---|---|---|
| **Local GPU (Ollama)**, the default | Ollama running on `127.0.0.1:11434` (or set `OLLAMA_HOST`) | `qwen3.5:9b` is recommended: about 3 s per turn on an RTX 4060 Ti. `gemma4:12b` writes richer lines but is about 4x slower. Thinking is switched off for thinking-capable models to keep turns snappy. |
| **Claude (Anthropic API)** | `ANTHROPIC_API_KEY` (or an `ant auth login` profile) in the environment that starts the server, or a key pasted in Settings | Defaults to `claude-opus-5-5` at `effort: low`. Sonnet 5.5 and Haiku 5.5 are selectable. Server-side refusal fallback (`fallbacks: "default"`) is on for Opus and Sonnet, so a safety false positive on a dark dilemma reroutes instead of stalling the debate. A pasted key lives only in the tab's `sessionStorage` and goes only to the local server. |
| **Offline scripted** | Nothing | A rule-based engine with hand-written voices for every member. It is also the per-turn fallback whenever a model call fails. After three failures in a row the game switches to it automatically. |

Every model call asks for schema-constrained JSON (speech, private thought, stance, conviction, emotion, addressee, trust deltas, whisper usage). Ollama gets it through `format`, Claude through `output_config.format`.

### How to play

| Lever | Key | What it does |
|---|---|---|
| Run / pause | `Space` | Auto-debate. While one member speaks, the next turn is generated in the background. |
| Next turn | `N` | Advance one turn manually. |
| **Gavel** | `G` | Speak as the Chair. Name a member to put the question to them, or say "each of you…" to go round the table. It cuts off the current speaker. |
| **Crisis** | `C` | Inject an emergency: pick a preset or write your own. Tension spikes, the room flashes red, and the members the crisis hurts most react first. |
| **Whisper** | `W` | Implant an idea or secret intel in one mind. That member experiences it as their own thought and champions it at the table without revealing its source. The inspector tracks whether it is still latent or has been championed. |
| **Call vote** | `V` | Binding vote on an option or a motion you write. Each member casts AYE, NAY or ABSTAIN with a spoken rationale, then the Halcyon Chronicle writes what happened next. |
| Camera | `1` `2` `3` | Overview, Auto-focus (cuts to the speaker: close-ups, over-the-shoulder from the person addressed, wide two-shots), and Free orbit. |
| Reveal minds | `M` | Show or hide private thoughts in the transcript and subtitles. |
| Affinity web | `A` | Glowing arcs between members, coloured by mutual trust. |

Click any member, or their nameplate, to open the **Mind Inspector**. It shows their public stance and its history, inner monologue, hidden agenda, trust bars, implanted ideas and episodic memory. Double-click a member to point the camera at them.

### The council

| | Role | Alignment | Private agenda (abridged) |
|---|---|---|---|
| Idris Vance | Security Marshal | Lawful Neutral | Reports to the Earth Directorate |
| Amara Okafor | Chief Medical Officer | Neutral Good | Hiding how sick the lower decks already are |
| Bo "Rivet" Lindqvist | Chief Engineer | Chaotic Good | Signed off on the deferred maintenance that caused this |
| Celeste Marchetti-Thorne | Consortium Liaison | Lawful Evil | A board seat if the station's assets survive |
| Teodor Novak | Archivist & Ethicist | Lawful Good | Fears he is ornamental |
| Kestrel Ashworth | Lower-Deck Delegate | Chaotic Neutral | A strike-and-lockout plan if the council fails their people |

There are five pre-loaded Halcyon dilemmas: The Oxygen Ledger, The Patient Signal (first contact), Hydroponic Bloom (containment breach), The Vesta Accord (treaty) and The Calliope Question (a rogue station AI). There are also three historical ones set in a 1900s boardroom, where the same seven people appear with period identities and clothes: The Titanic Morning (1912), The Panic of 1907 and The July Crisis (1914). Every dilemma comes with background and a note on what is at stake for each member. Read them on the start screen or in the "The Dilemma" tab. You can also type your own; the active model adapts it into a full scenario with options, crises, whispers and opening stances.

### Code map

```
server/api.js            /api/health, /api/generate → Ollama or Claude (Anthropic SDK)
vite.config.js           mounts the API into the dev server
server.js                production static server + API
src/engine/              DOM-free simulation (runs headless in tests)
  council.js             turn pipeline, prefetch, interventions, votes
  memory.js              per-agent memory stream (episodic, thoughts, stance, trust, whispers)
  director.js            who speaks next (no model call)
  prompts.js             system/turn/vote/epilogue/designer prompts + JSON schemas
  offline.js             scripted cognition and fallback
  designer.js            custom dilemma → scenario
  llm.js                 browser client for /api/generate
src/data/                personas and scenarios
src/scene/               Three.js: room, hologram, characters, camera director, affinity web, stage
src/ui/hud.js            all DOM surfaces
src/audio/               procedural SFX (WebAudio) + per-persona TTS casting
tests/engine.test.mjs    headless full-session test (npm test; add -- --live for a real Ollama turn)
study/                   headless persuasion study: 12 debater archetypes, blank listeners (see study/METHOD.md)
```

Notes on voices: speech uses the browser's built-in TTS. Edge's "Online (Natural)" voices sound best, and Chrome's Google voices are fine. Pitch is ignored by some natural voices.
