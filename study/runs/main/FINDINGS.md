# Which debater wins the room? Findings from run `main`

The run went from 2026-11-04 23:07 to 2026-11-05 05:53. All 198 scheduled debates finished, with 0 errors and 0 retries. The design is in `../../METHOD.md`, and every change made during the night is in `monitor-log.md`. The full tables are in `report-p2.md` (primary analysis) and `report-all.md` (sensitivity check).

## Summary

1. **Style matters more than ideology, and Populist style loses.**
   - Holding ideology fixed (same-ideology pairs), Populist debaters won **30%** of listener votes against 58-63% for Technocrat and Hybrid.
   - In the factorial model, Populist is −0.61 log-odds and Technocrat +0.47. Both CIs exclude zero.
   - The bottom four types are three Populists and the Hybrid Idealist.
2. **Pragmatists gain support and Idealists lose it.** Ideology is +0.36 for Pragmatist and −0.35 for Idealist (both CIs exclude 0). Realist and Liberal are neutral.
   - The pure test (same-style pairs) gives the same picture: Pragmatist 65%, Liberal 59%, Realist 50%, Idealist 28%.
3. **The best type is the Hybrid Pragmatist** (a story plus numbers, and a phased plan that works): 70% of votes, 18-7 in debates. The Technocrat Liberal is second at 65%.
   - The listeners' *favourite* is the Hybrid Pragmatist; they *dislike* the Populist Liberal, Realist and Idealist. All three take about a third of the votes.
4. **Speaking last helps.** The side that speaks first in each round gets 44% of votes (−0.34 log-odds). 12 of the 14 big comebacks were made by the side that speaks last.
5. **Listeners judge feasibility, not tone.**
   - They almost never call a speaker "emotional" or "populist" (under 10% of descriptions).
   - Their dominant pattern is "*X's moral appeal is noble, but it ignores [a hard constraint]*":
     - losers are described in moral terms 33-41% of the time;
     - winners are described as "realistic / feasible / practical" 25-30% of the time, against 4-6% for losers.
6. **Much of the result comes from the plan, not the pitch.**
   - In each scenario the model strongly prefers one plan: sell the company, lower the reservoir, take the power deal, withdraw the brigade. In the 135 debates where only one side held that plan, that side got **78%** of votes.
   - Controlling for the plan, the **Populist penalty survives** (−0.48, CI excludes 0). That is about delivery.
   - The **Idealist penalty mostly disappears** (−0.35 → −0.10). Idealists lose because of *what* they propose: they pick the favoured plan 32% of the time, against 56% for Liberals.
   - The Technocrat and Pragmatist advantages halve, and their CIs then include 0.

## Setup in one paragraph

- **Debaters:** 12 types, from 3 styles × 4 ideologies:
  - styles: Populist, Hybrid (story + evidence), Technocrat;
  - ideologies: Realist, Pragmatist, Liberal, Idealist.
- **Format:** each debate has 3 rounds (openings, rebuttals, closings) and is set in one of 4 fictional scenarios:
  - political: a failing dam;
  - military: a besieged brigade;
  - corporate: a toolmaker nine months from breaching its loan covenants;
  - diplomatic: an upstream dam.
- **Listeners:** 5 blank listeners, with no personality and only a memory stream. Each round they hear the two new speeches, then write notes, how they see the problem, a take on each speaker, and a lean. At the end they cast a forced vote with a reason.
- **Schedule:** a round-robin of all 66 type pairs × 3 passes, with first speaker and scenario counterbalanced.
- **Model:** `qwen3.5:9b` on an RTX 4060 Ti, used for both debaters and listeners.

## The one mid-run change (protocol 2, from debate 38)

- **The problem:** with fully blind openings, both debaters proposed the *same plan* in every dam debate (11 of 11) and every salient debate (9 of 9). The vote then followed speaking order, not type.
- **The fix:**
  - The dam and salient scenarios were rebalanced (v2).
  - A **contrast rule** was added: a coin flip picks one debater to draft its plan blind. The other sees that one-sentence plan and must choose differently.
- **Primary analysis:** protocol 2, 161 debates and 805 votes.
- **Sensitivity check:** all 198 debates. It gives the same ranking and the same signs (see below).
- **Was the rule fair?** The side that drafted first won 53% of votes.

## Results (protocol 2, 161 debates, 805 listener votes)

### Ranking

| # | type | vote share | debates W-L | rating (95% CI) | leaning to it after openings | listeners won / lost after openings |
|---|---|---|---|---|---|---|
| 1 | Hybrid Pragmatist | 70% | 18-7 | 151 (48 … 290) | 43% | +37 / −3 |
| 2 | Technocrat Liberal | 65% | 18-8 | 107 (19 … 209) | 35% | +43 / −4 |
| 3 | Technocrat Idealist | 61% | 16-10 | 75 (−28 … 158) | 23% | +54 / −5 |
| 4 | Technocrat Realist | 59% | 15-10 | 67 (−29 … 186) | 36% | +37 / −8 |
| 5 | Technocrat Pragmatist | 60% | 16-13 | 64 (−27 … 169) | 34% | +50 / −12 |
| 6 | Hybrid Realist | 60% | 16-11 | 59 (−34 … 150) | 24% | +53 / −5 |
| 7 | Hybrid Liberal | 51% | 14-11 | 13 (−77 … 126) | 24% | +41 / −7 |
| 8 | Populist Pragmatist | 45% | 11-18 | −38 (−126 … 56) | 22% | +39 / −6 |
| 9 | Hybrid Idealist | 34% | 9-19 | −118 (−256 … −19) | 17% | +26 / −3 |
| 10 | Populist Idealist | 34% | 11-17 | −120 (−264 … −13) | 7% | +41 / −3 |
| 11 | Populist Liberal | 33% | 9-17 | −124 (−243 … −32) | 9% | +33 / −2 |
| 12 | Populist Realist | 32% | 8-20 | −137 (−261 … −43) | 21% | +24 / −8 |

- **Rating:** Bradley-Terry on an Elo-like scale. A 100-point gap means about a 64% vote share. The CIs come from a bootstrap that resamples whole debates.
- **How to read the ranking:** the middle six types overlap, so only the top one or two and the bottom four are clearly separated.

### What drives a win (factorial logit, log-odds, 95% CI)

| effect | estimate | 95% CI |
|---|---|---|
| speaking first | −0.34 | −0.62 … −0.07 |
| Populist | −0.61 | −0.91 … −0.40 |
| Hybrid | +0.14 | −0.15 … 0.39 |
| Technocrat | +0.47 | 0.22 … 0.73 |
| Realist | −0.03 | −0.41 … 0.30 |
| Pragmatist | +0.36 | 0.03 … 0.64 |
| Liberal | +0.02 | −0.29 … 0.35 |
| Idealist | −0.35 | −0.72 … −0.07 |

- The style gap from Technocrat to Populist is 1.08 log-odds. Holding ideology fixed, a Technocrat facing a Populist is expected to get about **75%** of votes.
- The ideology gap from Pragmatist to Idealist is 0.71, or about **67%**.
- The style spread is about 1.5 times the ideology spread.

### By scenario (vote share, only debates where the two sides differ on that factor)

| scenario | Populist | Hybrid | Technocrat | Realist | Pragmatist | Liberal | Idealist |
|---|---|---|---|---|---|---|---|
| dam (political) | **17%** | 61% | **74%** | 58% | 60% | 46% | 34% |
| salient (military) | 33% | 59% | 59% | 42% | 51% | 54% | 53% |
| board (corporate) | 32% | 50% | 67% | 45% | **68%** | 58% | 34% |
| river (diplomatic) | 38% | 49% | 63% | 54% | 63% | 41% | 44% |

- **Populist** loses everywhere, worst in the town-hall dam debate.
- **Military:** in the salient scenario, ideology barely matters. Hybrid storytelling ties the Technocrats there.
- **Pragmatist** wins the boardroom and the diplomatic file.

### Dynamics and listener agreement

- **Switching:** listeners switched their lean in 35% of round-to-round transitions.
- **Undecided:** 51% were undecided after the openings, 28% after the rebuttals, and none at the forced vote.
- **Leads:** the side leading after the openings won **83%** of 142 debates. There were 24 comebacks, mostly by the side that speaks last.
- **Splits:** 5-0 in 52% of debates, 4-1 in 29% and 3-2 in 19%. The five blank listeners are strongly correlated but are not one judge.
- **Persuaders vs first impressions:**
  - Technocrat Idealist (23% after openings → 61% final; +54 / −5) and Hybrid Realist (24% → 60%) win listeners over as the debate goes on.
  - Hybrid Pragmatist wins on first impression (43% after the openings).
  - Technocrat Pragmatist loses the most listeners it had won after the openings (−12).

## What the listeners said (qualitative)

From the listeners' final descriptions of each speaker (805 votes × 2 speakers) and a reading of about 15 transcripts:

- **Losers get "noble but".**
  - "His moral outrage is inspiring but his strategy ignores the unenforceable nature of ICJ rulings against Saradan" (POP-PRA, river).
  - "Robin's arguments appeal to duty and symbolism but ignore the brutal reality that holding against a 5:1 force buildup … ensures everyone dies" (POP-IDE, salient).
  - The listener grants the moral point, then votes on the constraint.
- **Winners get "cold but sound".**
  - "His plan is cold but mathematically sound: it accepts necessary casualties now to prevent the guaranteed catastrophe" (TEC-PRA, salient).
  - "Realistic / feasible / practical" appears in 25-30% of winner descriptions and 4-6% of loser descriptions.
- **The winning move is to name the binding constraint:**
  - board: the 9-month covenant deadline, the €140M pension deficit;
  - dam: the 1974 Ostbrück agreement, the 40% mill threshold;
  - river: Saradan's election and air defences.
  - Speakers who built a plan on an uncertain outside event (tariffs, a court, allied aid) were punished for it: "relies on three unproven variables".
- **Slogans neither help nor visibly hurt.** Listeners almost never mention them. Populist debaters lose because their *plans* read as unfeasible, and because they spend words on images ("look at that family") instead of answering the constraint.
- **A Populist can win by attacking enforceability.** In `p3-05` (river), the Populist Realist trailed 3-0 after the openings and won 5-0. It hammered one point: "Saradan ignores our treaties … law takes years". Every listener's final reason repeats it.
- **Mirror attacks.** The 9B debaters often throw the scenario's strongest fact at whoever they face. Both sides of `p3-09` claimed the *other* plan "bankrupts farmers in 18 months". Listeners mostly resolve this by plausibility, not by checking.

## Plan or persuader? (post-hoc, exploratory)

Every platform was coded into a plan category per scenario by `classify-plans.mjs`. The coder was the same model at temperature 0, with the categories defined after reading the platforms. A 14-item hand spot-check found no errors. Results are in `plans.json` and `plan-analysis-p2.md`.
- **The contrast rule worked:** both sides fell in the same category in only 6 of 161 debates (4%).

**Each scenario has a plan the model likes.** Vote share, counted where the two plans differ:

| scenario | favoured plan | its vote share | the others |
|---|---|---|---|
| dam | lower the reservoir + spillway | **79%** | relocate 31%, negotiate first 20%, full rebuild 17% |
| board | sell to Crestline | **82%** | offshore / cut 69%, Halberg merger 37%, keep both plants + Volt-One 23% |
| river | slower fill for a power deal | **83%** | hard line 22%, court / mediation first 19% |
| salient | withdraw now | **70%** | ceasefire 40% (n=2), hold a few days + pontoon 36%, hold to the end 6% |

**Who picks the favoured plan?**
- By type:
  - Technocrat Liberal 69%; Hybrid Pragmatist and Hybrid Liberal 64%.
  - Populist Idealist 25%; Hybrid Idealist 21%.
- By ideology: Liberal 56%, Pragmatist 49%, Realist 39%, Idealist 32%.
- By style: Technocrat 53%, Hybrid 45%, Populist 34%.

**Effects with and without the plan in the model** (log-odds, 95% bootstrap CI):

| effect | type only | type + plan |
|---|---|---|
| Populist | −0.61 (−0.91 … −0.36) | **−0.48 (−0.85 … −0.16)** |
| Hybrid | +0.14 | +0.25 (−0.01 … 0.52) |
| Technocrat | +0.47 (0.22 … 0.73) | +0.23 (−0.08 … 0.58) |
| Pragmatist | +0.36 (0.13 … 0.67) | +0.31 (−0.22 … 0.66) |
| Liberal | +0.02 | −0.27 (−0.58 … 0.03) |
| Idealist | −0.35 (−0.75 … 0.00) | −0.10 (−0.48 … 0.32) |
| speaking first | −0.34 | −0.80 (−1.12 … −0.55) |

The plan effect is the largest factor: an SD of 0.85 within a scenario, against 0.34 for style and 0.21 for ideology once the plan is in the model.

**Interpretation:**
- **Populists lose on delivery.** The penalty holds even when they argue the same kind of plan.
- **Idealists lose on choice.** Their principled plans (keep the plants, relocate first, court before deal, hold the line) are the ones this model's listeners reject.
- **Liberals pick well but argue less well.** After the control their effect turns slightly negative.
- **Hybrid style is the best way to argue a given plan:** +0.25 against +0.23 for Technocrat, though the CIs overlap.
- The speaking-order effect *grows* once the plan is controlled. This is expected in a logit when a strong predictor is added, because effects are non-collapsible. The last word clearly matters.

**Caveats:**
- The plan is chosen by the debater, so it is part of what a type *does*. "Pick the plan the room already likes" is a real persuasion skill, not noise.
- The categories are post-hoc. Read this section as exploratory.

## Energy (measured)

| | value |
|---|---|
| GPU energy, measured (`nvidia-smi` every 5 s, 6.77 h) | **0.80 kWh** (mean 118 W, peak 136 W, mean utilisation 83%, max 77 °C) |
| GPU per debate | 4.0 Wh (≈0.8 Wh per listener vote) |
| CPU utilisation, measured | 26% average |
| Whole system, estimated | **≈1.3-1.45 kWh at the wall** (GPU + 50-70 W rest of system, ÷ 0.88 PSU efficiency) |
| Tokens | 6.6 M in, 0.87 M out (21 calls per debate, 4,158 calls) |

The whole-system figure is an estimate because the wall socket was not metered. Cost = kWh × your price per kWh.

## Limitations

- **One model judges itself.** Listeners and debaters are the same `qwen3.5:9b`, so this measures what *this model* finds persuasive. The bias toward "feasible, numbers, phased" may be the model's own house style, and self-preference cannot be ruled out.
  - The planned robustness check, gemma4:12b listeners, did not fit before 06:00.
- **Blank listeners are not a public.** They read text, have no stake, no group identity and no fatigue, and they write a reason before every lean, which favours deliberate judgement. Real audiences may respond to populist delivery very differently. Read "Populist loses" as "Populist loses to a careful, text-only, same-model reader".
- **3 debates per pair** (2 per pair under protocol 2 on average). The ranking and the factor effects are solid. Single head-to-head cells are anecdotal.
- **Protocol change mid-run.** The primary analysis uses protocol 2 only. The ranking and effect signs agree with all 198 debates (Populist −0.68, Technocrat +0.50, Pragmatist +0.39, Idealist −0.38).
- **Scenario facts steer plan choice.** The v2 rebalancing was done by the person running the study during the run. The plan coding above is post-hoc and exploratory.
- **9B debaters misquote facts** and mirror each other's attacks. Listeners only sometimes catch it.

## What to try next

1. **A listener-model swap:** gemma4:12b, or a larger hosted model, judging the *same saved transcripts*. Listeners can be re-run offline from `debates/*.json`, which avoids running new debates and isolates the judge.
2. **Listener profiles:** turn on `listenerProfiles` (e.g. "a worker at the mill", "a pensioner", "a soldier's parent") and test whether the Populist penalty shrinks with a stakeholder audience.
3. **A stronger debater model** with the same listeners, to see whether the gap between styles comes from the archetype or from how well a 9B model performs it.
4. **Fix the plan, vary the style.** Give both debaters assigned plans (each plan × each style). This separates "good plan" from "good persuader" cleanly.
5. **Counterbalance the last word:** let the second speaker in round 2 open round 3 (alternating), or score after each round only. This removes the 44/56 speaking-order gap.
