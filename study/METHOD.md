# Persuasion study: method and architecture

Written 2026-11-04, before the main run. Every change made during the run is logged in
`runs/<run>/monitor-log.md`, so this file stays the pre-registered design.

## Question

Which debater archetype best gathers support for its own view in a given scenario,
judged by listeners who process the debate round by round the way a person would?

## Design

**Debaters: 12 archetypes = 3 rhetorical styles × 4 ideologies** (`archetypes.mjs`).

| style | short |
|---|---|
| POP: Populist | ordinary people vs elites, concrete images, emotional urgency, common sense |
| HYB: Hybrid | a vivid human example, then backed by hard numbers |
| TEC: Technocrat | evidence, probabilities, trade-offs, honest about uncertainty, no emotion |

| ideology | short |
|---|---|
| REA: Realist | power, security, self-interest, worst-case planning, enforceable promises only |
| PRA: Pragmatist | what works, phased and testable, cost-effective, keep options open |
| LIB: Liberal | rights, markets, rule of law, transparency, voluntary cooperation |
| IDE: Idealist | principle, justice, the vulnerable, future generations, bold moral choices |

- The design is a full factorial, so a type's result can be split into a style effect and an ideology effect.
- There are no hidden agendas (decided with the user). Debaters never name their own type.
- Listeners never see the type. Names come from a gender-neutral pool and are assigned at random in every debate.
- Each debater picks its own plan from its archetype: its **platform**. The platform is written in a blind opening, before the debater hears its opponent. It must be kept for the whole debate, but how the debater argues for it is free: it answers the opponent and attacks from different angles. Debaters may interpret the shared facts but must not invent new ones.

**Listeners: 5, blank.**
- Listeners have no personality, traits or demographics. Each one is only "one of the five voting members" in the scenario's room, plus a memory stream.
- Each round, a listener hears the two new speeches word for word. Earlier rounds reach it **only through its own notes and reflections** from those rounds, which is how a person remembers a debate.
- After every round, each listener writes, in this order:
  1. notes
  2. how it sees the core problem
  3. a take on each speaker
  4. a lean (A, B or undecided) with a firmness (tentative, fairly sure or convinced)
  5. why
- The last round ends in a **forced-choice vote** with a reason. There is no 1-10 scale: the decision is categorical, as for a person.
- Listeners are independent: they never see each other's notes, and each one gets its own sampling seed.
- `listenerProfiles` in `control.json` is the optional hook for a simple character context, as the user asked. It is off in the main study.

**Format: 3 rounds**
1. Openings: blind, with A heard first.
2. Rebuttals: A, then B.
3. Closings: A, then B.

Speeches are about 90-120 words each. One debate makes 6 debater calls and 15 listener calls.

**Scenarios: one per domain** (`scenarios.mjs`). All four are fictional, so real-world political priors do not decide the vote.

| id | domain | the question |
|---|---|---|
| dam | political | Valmora's failing 1961 dam before the spring melt (town-hall debate, citizens' panel) |
| salient | military | a besieged brigade at Halden, an attack expected within 72 h (National Security Council) |
| board | corporate | Brightwater Tools, a 92-year-old toolmaker nine months from breaching its loan covenants (board of directors) |
| river | diplomatic | an upstream neighbour's dam takes 25% of the river during filling (foreign-policy cabinet) |

Every scenario is an open question with 10-11 shared facts. The facts cover money, people, risk, time, outside relations, precedent and uncertainty, and no single plan is obviously right.

**Schedule** (`run.mjs buildSchedule`, seed 20261105)
- A round-robin of all 66 type pairs, repeated in **3 passes**.
- Each pass finishes before the next one starts. If the run stops early, every pair still has the same number of debates.
- Within a pair:
  - the first speaker is counterbalanced: alternating in pass 1, flipped in pass 2, a coin flip in pass 3;
  - every pass uses a different scenario.
- The order within each pass is shuffled.

**Models**
- Debaters and listeners both run on `qwen3.5:9b` (Q4_K_M) in Ollama 0.40.14, with thinking off, temperature 0.8 and `num_ctx` 8192.
- Outputs are constrained by a JSON schema, and every call is seeded, so a run can be reproduced on the same hardware and software.
- Ollama does not support parallel requests for the qwen35 architecture (server log: "model architecture does not currently support parallel requests"), so calls run one after another.

## Analysis (`analyze.mjs`)

The unit of evidence is one listener's final vote, which counts as one pairwise comparison. The five votes in a debate share the same speeches, so every CI comes from a **bootstrap over whole debates**.

1. **Bradley-Terry ratings** per type, on an Elo-like scale where a 100-point gap means about a 64% vote share.
2. A **factorial logit**: P(vote for A) = σ(first-speaker + style[A] − style[B] + ideology[A] − ideology[B]).
3. A head-to-head matrix and scenario × style / ideology vote shares.
4. **Dynamics**, from each listener's lean path:
   - how often listeners switch sides;
   - how quickly undecided listeners make up their minds;
   - whether the side that leads after the openings goes on to win;
   - comebacks;
   - listeners gained or lost per type.
5. **Listener agreement**, from the 5-0 / 4-1 / 3-2 splits. Very high unanimity would mean the blank listeners act almost like one judge.

## Energy

- **GPU:** measured with `nvidia-smi` every 5 s (`power.csv`) and integrated over time.
- **CPU:** utilisation is measured (`cpu.csv`).
- **Rest of the system:** not metered. To estimate it, add the measured GPU energy to a constant for the rest of the system (an i5-9600KF under light load, plus board, RAM, SSD and fans: roughly 50-70 W at the wall) and divide by PSU efficiency (~0.88).
  - Cost = kWh × your all-in price per kWh.

## Known limitations (stated before the run)

- All listeners are the same model, so the study measures what *this model* finds persuasive, not what people find persuasive. The listener-model swap at the end of the run (if there is time) is the robustness check.
- Debaters and listeners are the same model, so self-preference is possible: the model may favour text that sounds like its own.
- The 9B model sometimes misquotes the shared figures. Listeners hold the true background and may punish the error; that is part of what gets measured.
- About 3 debates per pair is enough to rank the types and estimate factor effects. For any single pairing it remains anecdotal, so read the head-to-head cells as directional only.

## Architecture

```
study/
  archetypes.mjs   12 types (styles × ideologies) + name pool
  scenarios.mjs    4 scenarios (background, room, roles, question)
  prompts.mjs      debater + listener prompts and JSON schemas
  ollama.mjs       seeded, schema-constrained, retrying Ollama client with timings
  debate.mjs       one debate → full record + markdown transcript
  run.mjs          overnight runner: schedule, resume, control file, hard stop, power/CPU logging
  analyze.mjs      report.md / report.json
  pilot.mjs        single-debate smoke test
  runs/<run>/      all data (see the header of run.mjs)
```

The runner re-reads `control.json` and `schedule.json` before every debate. The monitoring agent can therefore pause the run, move the stop time, exclude types, or append extra phases without restarting it. A restart resumes automatically, because finished debate ids are read back from `results.jsonl`.

## Amendment 1 (2026-11-05 00:30): protocol 2 from debate 38 of run `main`

Under the fully blind openings above, both debaters proposed the same core plan in every dam (11 of 11) and salient (9 of 9) debate. The vote in those debates then followed speaking order rather than type. Two changes took effect from debate 38 onwards:
- **Scenario v2.** Dam and salient were rebalanced so that several plans are defensible.
- **Contrast rule.** A coin flip, independent of speaking order, picks one debater to draft its platform blind. The other sees only that one-sentence platform and must differ in its core choice.

Every record carries `protocol`, `scenarioVersion` and `draftFirst`. The primary analysis is `--protocol 2`, and all debates together serve as the sensitivity check. The reasoning is in `runs/main/monitor-log.md`. `platform-test.mjs` is the probe that generates one blind platform per type, for checking a scenario's diversity *before* a run.

## Amendment 2 (2026-11-05, after the run): exploratory plan analysis

This analysis was added after looking at the data, so it is **not pre-registered**.
- `classify-plans.mjs` codes each platform into a per-scenario plan category, using the same model at temperature 0. The categories were defined after reading the platforms of run `main`.
- `plan-analysis.mjs` adds plan effects, nested in scenario, to the factorial logit. This asks whether a type wins through its delivery or through the plan it picks. The plan is chosen by the debater, so it is part of the treatment, not a nuisance variable.
- The results are in `runs/main/plan-analysis-p2.md` and `runs/main/FINDINGS.md`.
