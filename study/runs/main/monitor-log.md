# Monitor log: run `main`

Every check-in by the monitoring agent (Claude Code, hourly at about :07 from 00:07 to 05:07, plus a final wrap-up at 06:12) is recorded here. Any change to `control.json` or `schedule.json` is logged together with its reason.

## 2026-11-04 23:08: launch

- The runner started at 23:07:29 (pid 24064), with a hard stop at 06:00. The model is `qwen3.5:9b` for both debaters and listeners. Ollama 0.40.14 runs on an RTX 4060 Ti 16 GB.
- Debate 1/198 (`p1-48-HYB-PRA-vs-TEC-PRA-dam`) was carried over from the runner smoke test. It had the identical spec, seed and code, and the result was 2-3.
- Pilot timing:
  - 121-128 s per debate.
  - Debater calls take about 6.0 s (about 200 tokens out); listener calls take about 6.2 s (about 217 tokens out).
  - The GPU draws about 120 W during inference; CPU utilisation is about 27%.
- Budget: 6.87 h ≈ 24,700 s, so about 195-200 debates fit. That is right at the edge of 198 (3 full passes). Pass 3 may fall a few debates short.

### Decision rules, fixed before seeing any results
1. **Time.** If pass 3 can't finish by 06:00:
   - A shortfall of 5 debates or fewer is accepted: a few pairs end up with 2 debates. The analysis is per vote, so this costs little.
   - For a larger shortfall, choose between:
     - excluding the one type from pass 3 that sits closest to another type in ratings and style (the user's rule: cut similar types to keep 3 debates on every other pairing);
     - extending the stop time slightly. The user asked for 06:00, so this is a last resort.
2. **Quality.** Prompts change mid-run only if the output is broken: degenerate text, debaters abandoning their platform, listeners ignoring content. Any change is logged with the id of the first affected debate, so the analysis can split before and after.
3. **Unanimity.** High 5-0 unanimity is noted, not "fixed". It is a finding about blank same-model listeners.
4. **Extra phase.** If the run finishes all three passes early, append a listener-model comparison (`gemma4:12b` listeners on a subset of pairs) as pass 4, with a `cfg` override.

## Check-ins

### 2026-11-05 00:15-00:31: check-in 1. Protocol change to v2 at debate 38.

**Health:** OK. 33 of 198 debates were done at 00:14. There were 0 errors and 0 retries; debates took 123 s on average (max 138). The GPU drew about 124 W at 68 °C, and about 1.7 GB of RAM was free.

**Interim pattern:** 33 debates, v1. These are interim numbers.
- Populist style is strongly disliked: log-odds -1.09, and POP-LIB and POP-IDE together won 1 of 11 debates.
- Technocrat style is favoured (+0.81).
- Speaking first costs -0.87 log-odds; the first speaker took 35% of votes, a strong last-word / recency advantage.
- Unanimity is 55% (18 of 33 debates went 5-0). The listeners are correlated but do not act as one judge.

**Problem found: platform convergence.** I classified each platform by keyword:
- In **dam**, both debaters proposed the same core plan in **11 of 11** debates: lower the reservoir.
- In **salient**, they did so in **9 of 9**: withdraw.
- In board and river, the platforms were diverse.
- When the plans were identical, the vote followed speaking order rather than type: B won 10 of 11 dam debates.

The cause was my scenario facts, which made one option dominant (an 80% risk cut for €25 million; withdrawal with no real cost). Under my own rule this is "not broken output". But it voids the ideology comparison in half the debates and violates the user's "keep the contrast between alternatives clear", so I changed it.

**Changes**, effective from debate 38 (`p1-06-POP-REA-vs-HYB-IDE-board`). Debates 1-37 are protocol 1.
1. **Scenario v2** for dam and salient (`version: 2`; the v1 file is saved as `runs/main/scenarios.v1.mjs`).
   - Dam: the drawdown now cuts risk by about 60%, still needs a rebuild in 10-15 years, can be blocked in court under the 1974 agreement, and Nordhalm will close the mill (2,300 jobs) if the reservoir stays below 40%.
   - Salient: the intelligence is split (it may be a feint), withdrawal costs 15-30% of the brigade and abandons most civilians, Halden's fortress needs a 3:1 attacker, a pontoon crossing in 4 days could double supply, and allied aid votes in 8 days.
2. **Contrast rule** (protocol 2, in `prompts.mjs` and `debate.mjs`).
   - A seeded coin flip, independent of speaking order, picks which debater drafts its platform blind.
   - The other debater is shown only that one-sentence platform and must differ in its core choice. It still argues from its own worldview, and it does not hear the rival's speech before its own opening.
   - The record stores `draftFirst`, so "first pick" advantage can be measured.
   - Cost: no extra model calls.
   - A 12-type probe of the v2 dam scenario alone still gave "lower the reservoir" for 4 of 6 types, so the scenario fix by itself was not enough. The probe also slowed one debate to 334 s; no more probes during the run.
3. `analyze.mjs` gained `--protocol 2`, a draft-first advantage line, and debate counts per protocol.
4. `run.mjs` strips a UTF-8 BOM from control.json. PowerShell 5.1 wrote one during the restart; the runner then used its defaults, which are identical, so nothing was lost.

The runner was paused after debate 37 and restarted (pid 13968), then resumed automatically.

**Verification:**
- Debate 38 (board): POP-REA "sell to Crestline" vs HYB-IDE "Volt-One + Halberg merger".
- Debate 39 (salient v2): POP-IDE drafted blind and chose "hold Halden"; HYB-IDE argued for a fighting withdrawal and won 5-0.
- Contrast now holds, and the listeners' reasons engage with it.

**Analysis plan update:**
- Primary analysis: protocol 2 only (`--protocol 2`), which covers about 160 debates: about 2 per pair in passes 2-3, plus the rest of pass 1.
- Sensitivity check: all debates.

**Time:** 159 debates remain and about 155 fit before 06:00. A shortfall of 5 or fewer is acceptable under the rule set at launch, and the average still includes the 334 s outlier. No exclusion for now.

### 2026-11-05 01:15: check-in 2. No changes.

**Health:** OK. 60 of 198 debates were done: 37 under protocol 1 and 23 under protocol 2. There were 0 errors and 0 retries. Protocol-2 debates averaged 125 s (max 144). The GPU drew 119-125 W at 68 °C. The runner (pid 13968) is alive, and 1.3 GB of RAM is free.

**Time:** 138 debates remain and 138 fit; the projected finish is 05:59. That is right on the line. Pass 3 may end 0-3 debates short, which is within the accepted shortfall of 5 or fewer, so no exclusion.

**Quality:** The newest debate was `p1-14` on board (POP-PRA "keep both plants + Volt-One" vs HYB-PRA "accept the Crestline buyout"); HYB-PRA won 5-0.
- Both debaters stayed on their platforms and rebutted on the substance: the tariff uncertainty, Volt-One's missed launches, Crestline's record.
- The listeners' reasons cite the 9-month covenant runway and the pension deficit, so they are judging the content.

**Interim pattern (protocol 2, 23 debates; noisy):**
- Pragmatist ideology leads clearly: +1.98 log-odds; TEC-PRA is 7-0 and HYB-PRA 2-0.
- The Liberal (-1.12) and Idealist (-0.71) ideologies trail.
- Technocrat style is ahead and Populist behind, the same direction as under protocol 1.
- The first-speaker effect flipped from -0.87 under protocol 1 to +1.05, with a very wide CI. My reading: protocol 1's last-word advantage was a tiebreaker effect that only appeared because both sides proposed the same plan.
- The side that drafted its plan first won 59% of votes: a moderate "first pick" advantage, which is counterbalanced by the coin flip.

**Unanimity rose under protocol 2:** 16 of 24 debates went 5-0, against 55% under protocol 1. With contrasting plans, the five blank listeners converge on whichever plan the model prefers. Per the decision rule, this is noted as a finding, not fixed. It also means the bootstrap CIs, which resample debates, are the right uncertainty measure, not a binomial over votes.

**Analysis note for the wrap-up:** the factorial logit's bootstrap shows quasi-separation at small n (CIs reaching ±5). Raise the L2 penalty or report vote shares alongside it.

### 2026-11-05 02:15: check-in 3. No changes.

**Health:** OK. 90 of 198 done: pass 1 complete (66 of 66), pass 2 at 24 of 66. 53 debates under protocol 2. There were 0 errors and 0 retries. The last 20 debates averaged 120 s. The GPU drew 124-127 W at 67-68 °C, and the runner (pid 13968) is alive. GPU energy so far is 0.367 kWh over 3.13 h, which is 6.9 Wh per debate.

**Time:** 108 debates remain and 112 fit; the projected finish is 05:50. That is ahead by about 4 debates. This is not enough room for the gemma4:12b listener phase: one debate with 12b listeners would take about 3× as long. No exclusion is needed.

**Quality:** I read the newest debate, `p2-27` (dam): POP-LIB "lower to 30% + spillway" vs TEC-PRA "relocate Riverside + sirens, negotiate with Ostbrück". TEC-PRA won 5-0.
- Both debaters stayed on their platforms and rebutted each other on the substance.
- POP-LIB repeated its slogans ("freedom over fear", "look at that family" twice) and got one fact backwards: it claimed the rival plan "cuts the paper mill".
- All five listeners cited the mill, the 1974 lawsuit and the budget, so they judge the content.

I also scanned the platforms of the last 10 debates. The contrast rule holds in 9 of 10. In the remaining one (`p2-31` dam), the plans are only partly distinct: both lower the reservoir, one adds relocation and the other a spillway.

**Interim pattern (protocol 2, 53 debates, 265 votes):**
- **Pragmatist** still leads: ideology +0.92 log-odds (CI 0.34 … 1.76). TEC-PRA is 9-0 (91% vote share) and HYB-PRA 6-1. The exception is POP-PRA at 4-8: populist delivery cancels the pragmatist advantage.
- **Style:** Populist -0.70 (CI excludes 0) and Technocrat +0.50.
  - The Populist penalty is strongest in dam, at a 20% vote share.
  - Salient reverses the pattern: Hybrid 73%, Technocrat 37%, and Idealist 70%. In the military scenario, the moral story of leaving civilians behind seems to land.
- **Idealist in river:** 5% vote share (dislike). Listeners reject bold moral stances on the diplomatic file.
- **Speaking first:** -0.16 (CI spans 0), so with protocol 2 the speaking-order artefact is gone. Draft-first won 52%: the two advantages balance out. The drafter gets its natural plan, and the other side knows the rival platform and can pre-empt it in its opening.
- **Unanimity** is 62% (33 of 53 at 5-0). When one side led after the openings, it won 86% of the time; there were 6 comebacks.

**For the wrap-up:**
- Separate *which plan* from *which type*. In dam, the "relocate + negotiate / keep the mill" plans tend to beat "lower to 30%" since v2. Code each platform into a plan category per scenario and check whether the type effects survive after controlling for plan, or whether the Pragmatist advantage is mostly "pragmatists pick the plan this model likes".

### 2026-11-05 03:15: check-in 4. No changes.

**Health:** OK. 119 of 198 debates were done: pass 2 is at 53 of 66, and 82 debates ran under protocol 2. There were 0 errors and 0 retries. The last 20 debates averaged 124 s. The GPU drew 101-132 W at 68-74 °C, and the runner (pid 13968) is alive. GPU energy so far is 0.486 kWh over 4.14 h.

**Time:** 79 debates remain and 80 fit; the projected finish is 05:56. That is right on the line again, and any shortfall will be 0-3 debates, inside the accepted ≤5. No exclusion.

**Quality:** I read the newest debate, `p2-18` (river): TEC-PRA vs POP-PRA. POP-PRA won 4-1, the first loss for TEC-PRA in a head-to-head with its own ideology.
- **Weak contrast:** both platforms are "accept the 7-year fill + power deal". They differ only in a renegotiation clause vs a price cap.
  - Same-ideology pairs (12 of 66) are where the contrast rule is weakest: the second drafter makes the smallest change that counts as different.
  - This is acceptable. Those pairs isolate style with ideology held fixed, so plan convergence there is less harmful than it was in protocol 1.
- **Two odd sentences, not degenerate:** TEC-PRA called the rival's approach "a stronger bluff", and POP-PRA blamed "the Tarsun loans" without context.
- **Listeners:** the reasons are substantive. They weighed Saradan's election timing, the crop-loss window and the loophole risk. One listener (L4) switched from A to B at the vote.

**Interim pattern (protocol 2, 82 debates, 410 votes).** The ratings are regressing toward the middle as n grows.
- **Style is the steadiest effect:**
  - Populist -0.57 (CI -0.96 … -0.27);
  - Technocrat +0.45 (CI 0.05 … 0.74).
  - All three Populist types except POP-PRA sit in the bottom four. POP-LIB is lowest, at a 30% vote share.
- **Ideology:**
  - Pragmatist +0.48 (CI 0.06 … 0.90) and Idealist -0.39.
  - The spread is now smaller than the style spread.
  - TEC-PRA went from 9-0 to 11-6. HYB-PRA (76%) and TEC-LIB (66%, rising) are at the top.
- **Speaking first is again a cost: -0.41 (CI -0.86 … -0.10).** The first speaker got 41% of votes. The last-word (recency) advantage is real even when the plans differ. Under protocol 1 it was larger because of the tie-break effect. The type estimates are unbiased, because A/B is counterbalanced within every pair.
- Draft-first won 53%: still balanced.
- **Unanimity fell to 54%** (44 of 82 at 5-0; 23 at 4-1; 15 at 3-2), and there were 11 comebacks. The listeners are correlated but are not one judge.

**For the wrap-up (in addition to the plan-vs-type check from check-in 3):**
- Report the same-ideology pairs separately as a pure style test.
- Flag the platform-similarity rate per scenario.

### 2026-11-05 04:15: check-in 5. No changes.

**Health:** OK. 149 of 198 done: passes 1 and 2 complete, pass 3 at 17 of 66. 112 debates under protocol 2, now covering all 66 pairs. There were 0 errors and 0 retries; the last 20 debates averaged 121 s. The GPU drew 117-125 W at 67-68 °C, and the runner (pid 13968) is alive. GPU energy so far is 0.605 kWh over 5.14 h.

**Time:** 49 debates remain and 52 fit; the projected finish is 05:53. All three passes should complete. The 3-debate margin is too small for a model-comparison phase: one debate with gemma4:12b listeners takes about 3× as long and would cross 06:00. No change.

**Quality:** newest debate `p3-09` (river): TEC-LIB "7-year fill + 20-year power deal" vs POP-REA "reject, mobilise the army, force Tarsun to pay". TEC-LIB won 5-0.
- The contrast between the plans is clear, and both debaters held their platforms.
- Mirror attack: both sides told the listeners that the *other* plan "bankrupts farmers in 18 months". The 9B debaters reuse the strongest fact in the scenario against whoever they are facing.
- POP-REA used three slogans ("starve tomorrow", "elites", "seize what is ours"). The listeners cited the risk of war with Saradan's air defences and the farmers' timeline, and they did not respond to the slogans.

**Interim pattern (protocol 2, 112 debates, 560 votes):** the estimates are now stable from hour to hour.
- **Style:**
  - Populist -0.63 (CI -0.96 … -0.33), Technocrat +0.43 (CI 0.14 … 0.71), Hybrid +0.20.
  - All three Populist types other than POP-PRA sit in the bottom four.
  - POP-LIB is last, at a 29% vote share and a round-1 share of 8%: listeners reject it from the opening onwards.
- **Ideology:** Pragmatist +0.46 (CI 0.11 … 0.79), Idealist -0.29, Liberal 0.00, Realist -0.17.
- **Top three:** HYB-PRA (75%, CI excludes 0), TEC-LIB and TEC-PRA.
- **Comebacks:** TEC-IDE converts the most listeners after round 1 (+44 / −5). It starts at 23% and finishes at 62%.
- **Speaking first:** -0.32 (CI -0.69 … -0.04). A modest last-word advantage persists.
- **Unanimity:** 52%. The splits are 58 debates at 5-0, 33 at 4-1 and 21 at 3-2. There were 16 comebacks, and the side leading after round 1 won 84%.

### 2026-11-05 05:37: check-in 6 (the last hourly one; it fired late). No changes.

**Health:** OK. 189 of 198 done: pass 3 at 57 of 66, 152 debates under protocol 2. There were 0 errors and 0 retries. The last 20 debates averaged 121 s. The GPU drew 86-123 W at 65-68 °C, and the runner (pid 13968) is alive. GPU energy so far is 0.768 kWh over 6.52 h.

**Time:** 9 remain and 12 fit; the projected finish is 05:54. All 3 passes complete, and every pair gets 3 debates. No exclusions were needed during the night.

**Quality:** I read the newest debate, `p3-28` (board): POP-LIB "stay in both plants, keep jobs and dignity" vs TEC-LIB "accept Crestline now". TEC-LIB won 5-0.
- POP-LIB had the facts right (€140M pension deficit, Crestline closes plants within 4 years) but built its plan on hope for tariffs. TEC-LIB attacked exactly that: "three unproven variables".
- All five listeners named the 9-month covenant deadline and the risk of liquidation for pensions.
- This is the pattern seen all night: listeners reward the side that names the binding constraint and penalise plans that depend on uncertain external events.

**Interim pattern (protocol 2, 152 debates, 760 votes), essentially final:**
- **Style:** Populist -0.63 (CI -0.86 … -0.40), Technocrat +0.46 (CI 0.24 … 0.72), Hybrid +0.16.
- **Ideology:** Pragmatist +0.38 (CI 0.08 … 0.65); Realist, Liberal and Idealist are all within ±0.3 of each other.
- **Speaking first:** -0.33 (CI -0.62 … -0.08).
- **Top:** HYB-PRA at 72%, then TEC-LIB 65% and TEC-IDE 63%.
- **Bottom:** POP-LIB 30%, POP-REA 33% and POP-IDE 34%. Populist delivery is the clearest single disadvantage. POP-PRA is the best Populist type at 44%: pragmatism partly rescues the populist delivery.
- **Persuaders after the openings:** TEC-IDE (+54 / −5 listeners) and HYB-REA (+49 / −4) start low and win listeners over.
- TEC-PRA loses the most listeners it had won after the openings (−12).
- **Unanimity:** 51%. The side leading after the openings won 82%, with 24 comebacks.

Next step: the final wrap-up at 06:12, as planned. The runner stops on its own at 06:00 or when the schedule is empty.

### 2026-11-05 06:12-06:35: final wrap-up

**Run end:**
- The runner reported "schedule exhausted" and "runner finished" at 05:53:41, before the 06:00 stop.
- 198 of 198 debates were done: 37 under protocol 1 and 161 under protocol 2. Every pair got 3 debates.
- There were 0 errors and 0 retries over the whole night. No exclusions were ever needed.
- The runner process and its nvidia-smi logger exited by themselves.

**Analysis outputs:**
- `report-p2.md/.json` (primary), `report-all.md/.json` (sensitivity), `report-p1.md/.json` (protocol 1 only).
- `report.md` is the protocol-2 cut under its default name.
- `analyze.mjs` gained `--out <name>`. Energy per debate now divides by all debates, not the filtered cut; the interim check-ins reported 6.9 Wh, which was inflated. The L2 penalty was left at 0.01: at n=161 the factorial CIs are well-behaved (the earlier quasi-separation was a small-n problem).

**Post-hoc plan analysis (exploratory, not pre-registered):**
- `classify-plans.mjs` codes each platform into a per-scenario plan category, using qwen3.5:9b at temperature 0. This ran after the runner had finished, so its GPU time is not in `power.csv` (about 6 min).
- `plan-analysis.mjs` fits the factorial model with and without plan effects.
- Main result: the plan is the largest factor. The favoured plan gets 78% of votes. The Populist penalty survives the plan control (−0.48). The Idealist penalty mostly disappears (−0.35 → −0.10).

**Energy:**
- GPU, measured: 0.797 kWh over 6.77 h (mean 118 W, peak 136 W).
- Whole system, estimated: about 1.3-1.45 kWh at the wall.

**Deliverables:**
- `FINDINGS.md` in this folder.
- The findings page, published as an Artifact: https://claude.ai/artifact/UTU1hhvBnSeb4XViAStEiK

**Not done:** the gemma4:12b listener phase. There was never more than about 4 debates of slack. Next time, re-judge the saved transcripts with a second listener model offline (see FINDINGS, "What to try next").
