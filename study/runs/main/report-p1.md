# Persuasion study: results for run `main`

Generated 2026-11-05T05:16:27.098Z from 37 debates (185 listener votes).
Pairs covered: 37/66; debates per pair min 1, max 1. Total model time 1.33 h, mean 129 s per debate.

## Ranking (Bradley-Terry on listener votes, 95% bootstrap CI over debates)

| # | type | rating | 95% CI | debates | W-L-T | vote share | round-1 share | listeners gained / lost |
|---|---|---|---|---|---|---|---|---|
| 1 | **TEC-LIB** Technocrat Liberal | 253 | 93 … 462 | 7 | 7-0-0 | 83% | 51% | +15 / −4 |
| 2 | **HYB-PRA** Hybrid Pragmatist | 210 | 22 … 475 | 8 | 7-1-0 | 83% | 57% | +13 / −3 |
| 3 | **TEC-REA** Technocrat Realist | 111 | -116 … 333 | 8 | 5-3-0 | 65% | 53% | +7 / −2 |
| 4 | **TEC-IDE** Technocrat Idealist | 76 | -164 … 334 | 7 | 4-3-0 | 60% | 11% | +18 / −1 |
| 5 | **HYB-REA** Hybrid Realist | 50 | -187 … 253 | 6 | 2-4-0 | 47% | 23% | +8 / −1 |
| 6 | **POP-PRA** Populist Pragmatist | 37 | -180 … 227 | 4 | 2-2-0 | 50% | 40% | +2 / −0 |
| 7 | **HYB-LIB** Hybrid Liberal | 17 | -233 … 221 | 8 | 5-3-0 | 57% | 38% | +10 / −2 |
| 8 | **POP-REA** Populist Realist | -5 | -407 … 245 | 5 | 2-3-0 | 32% | 8% | +6 / −0 |
| 9 | **TEC-PRA** Technocrat Pragmatist | -110 | -403 … 218 | 4 | 1-3-0 | 30% | 45% | +3 / −6 |
| 10 | **HYB-IDE** Hybrid Idealist | -142 | -357 … 52 | 5 | 1-4-0 | 32% | 20% | +6 / −3 |
| 11 | **POP-LIB** Populist Liberal | -236 | -581 … -95 | 7 | 1-6-0 | 14% | 3% | +5 / −1 |
| 12 | **POP-IDE** Populist Idealist | -261 | -491 … -33 | 5 | 0-5-0 | 8% | 0% | +2 / −0 |

Rating scale: a 100-point gap means the higher type is expected to win about 64% of listener votes against the lower one. "Round-1 share" is the share of listeners leaning to the type after the openings; "gained / lost" counts listeners who changed sides between round 1 and the final vote.

## What drives it: style vs ideology vs speaking first (factorial logit, log-odds)

| effect | estimate | 95% CI |
|---|---|---|
| speaking first | -0.84 | -1.94 … -0.34 |
| style POP (Populist) | -1.02 | -1.99 … -0.47 |
| style HYB (Hybrid (story + evidence)) | 0.36 | -0.13 … 0.98 |
| style TEC (Technocrat (careful analyst)) | 0.66 | 0.12 … 1.32 |
| ideology REA (Realist) | -0.10 | -1.00 … 0.87 |
| ideology PRA (Pragmatist) | 0.49 | -0.17 … 1.45 |
| ideology LIB (Liberal) | 0.04 | -0.78 … 0.45 |
| ideology IDE (Idealist) | -0.43 | -1.39 … 0.12 |

Effects are centred within each factor (they sum to zero). A difference of 0.4 log-odds is roughly a 10-point swing in vote share. Raw first-speaker vote share: 34%.
Debates by protocol: v1 37.

## By scenario: vote share of each style and ideology (only debates where the two sides differ on that factor)

| scenario | POP | HYB | TEC | REA | PRA | LIB | IDE |
|---|---|---|---|---|---|---|---|
| dam (political) | 10% | 49% | 86% | 50% | 47% | 60% | 47% |
| salient (military) | 52% | 53% | 44% | 45% | 45% | 53% | 55% |
| board (corporate) | 20% | 100% | 73% | 72% | 80% | 0% | 20% |
| river (diplomatic) | 0% | 80% | 60% | 10% | 80% | 57% | 13% |

## Persuasion dynamics

- Listeners changed their lean in 31% of round-to-round transitions.
- Undecided by round: 39% → 19% → 0% (the last round is a forced vote).
- When one side led after the openings (34 debates), it won 82% of them; 6 were comebacks.
- Final splits: 5-0 in 19, 4-1 in 8, 3-2 in 10 debates (unanimity 51%). High unanimity means the five blank listeners behave close to one judge.

## Head-to-head vote share (row type against column type)

| | POP<br>REA | POP<br>PRA | POP<br>LIB | POP<br>IDE | HYB<br>REA | HYB<br>PRA | HYB<br>LIB | HYB<br>IDE | TEC<br>REA | TEC<br>PRA | TEC<br>LIB | TEC<br>IDE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **POP-REA** | · |  |  |  |  | 0<sub>1</sub> | 100<sub>1</sub> |  | 0<sub>1</sub> |  | 0<sub>1</sub> | 60<sub>1</sub> |
| **POP-PRA** |  | · | 100<sub>1</sub> |  | 60<sub>1</sub> |  |  |  |  |  | 0<sub>1</sub> | 40<sub>1</sub> |
| **POP-LIB** |  | 0<sub>1</sub> | · |  |  | 0<sub>1</sub> | 0<sub>1</sub> | 60<sub>1</sub> | 0<sub>1</sub> |  | 0<sub>1</sub> | 40<sub>1</sub> |
| **POP-IDE** |  |  |  | · | 0<sub>1</sub> | 0<sub>1</sub> | 0<sub>1</sub> |  | 20<sub>1</sub> |  | 20<sub>1</sub> |  |
| **HYB-REA** |  | 40<sub>1</sub> |  | 100<sub>1</sub> | · | 20<sub>1</sub> |  |  | 100<sub>1</sub> |  | 20<sub>1</sub> | 0<sub>1</sub> |
| **HYB-PRA** | 100<sub>1</sub> |  | 100<sub>1</sub> | 100<sub>1</sub> | 80<sub>1</sub> | · | 60<sub>1</sub> | 80<sub>1</sub> | 100<sub>1</sub> | 40<sub>1</sub> |  |  |
| **HYB-LIB** | 0<sub>1</sub> |  | 100<sub>1</sub> | 100<sub>1</sub> |  | 40<sub>1</sub> | · | 80<sub>1</sub> | 0<sub>1</sub> | 60<sub>1</sub> |  | 80<sub>1</sub> |
| **HYB-IDE** |  |  | 40<sub>1</sub> |  |  | 20<sub>1</sub> | 20<sub>1</sub> | · | 0<sub>1</sub> | 80<sub>1</sub> |  |  |
| **TEC-REA** | 100<sub>1</sub> |  | 100<sub>1</sub> | 80<sub>1</sub> | 0<sub>1</sub> | 0<sub>1</sub> | 100<sub>1</sub> | 100<sub>1</sub> | · |  | 40<sub>1</sub> |  |
| **TEC-PRA** |  |  |  |  |  | 60<sub>1</sub> | 40<sub>1</sub> | 20<sub>1</sub> |  | · |  | 0<sub>1</sub> |
| **TEC-LIB** | 100<sub>1</sub> | 100<sub>1</sub> | 100<sub>1</sub> | 80<sub>1</sub> | 80<sub>1</sub> |  |  |  | 60<sub>1</sub> |  | · | 60<sub>1</sub> |
| **TEC-IDE** | 40<sub>1</sub> | 60<sub>1</sub> | 60<sub>1</sub> |  | 100<sub>1</sub> |  | 20<sub>1</sub> |  |  | 100<sub>1</sub> | 40<sub>1</sub> | · |

## Energy (measured)

- Logged 6.77 h of GPU telemetry: **0.797 kWh** on the GPU (mean 118 W, peak 136 W, mean utilisation 83%, max 77 °C).
- Per debate: 21.6 Wh GPU.
- CPU utilisation averaged 27% (measured). Whole-system power was not metered; see METHOD.md for the estimate and the cost formula.
