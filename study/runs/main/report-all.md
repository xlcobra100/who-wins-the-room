# Persuasion study: results for run `main`

Generated 2026-11-05T05:20:13.046Z from 198 debates (990 listener votes).
Pairs covered: 66/66; debates per pair min 3, max 3. Total model time 6.80 h, mean 124 s per debate.

## Ranking (Bradley-Terry on listener votes, 95% bootstrap CI over debates)

| # | type | rating | 95% CI | debates | W-L-T | vote share | round-1 share | listeners gained / lost |
|---|---|---|---|---|---|---|---|---|
| 1 | **HYB-PRA** Hybrid Pragmatist | 170 | 85 … 274 | 33 | 25-8-0 | 73% | 47% | +50 / −6 |
| 2 | **TEC-LIB** Technocrat Liberal | 132 | 59 … 237 | 33 | 25-8-0 | 68% | 38% | +58 / −8 |
| 3 | **TEC-IDE** Technocrat Idealist | 74 | -3 … 180 | 33 | 20-13-0 | 61% | 21% | +72 / −6 |
| 4 | **TEC-REA** Technocrat Realist | 74 | -10 … 178 | 33 | 20-13-0 | 61% | 40% | +44 / −10 |
| 5 | **HYB-REA** Hybrid Realist | 53 | -27 … 152 | 33 | 18-15-0 | 58% | 24% | +61 / −6 |
| 6 | **TEC-PRA** Technocrat Pragmatist | 44 | -41 … 134 | 33 | 17-16-0 | 56% | 35% | +53 / −18 |
| 7 | **HYB-LIB** Hybrid Liberal | 19 | -86 … 101 | 33 | 19-14-0 | 53% | 27% | +51 / −9 |
| 8 | **POP-PRA** Populist Pragmatist | -31 | -121 … 37 | 33 | 13-20-0 | 45% | 24% | +41 / −6 |
| 9 | **HYB-IDE** Hybrid Idealist | -118 | -227 … -35 | 33 | 10-23-0 | 33% | 18% | +32 / −6 |
| 10 | **POP-REA** Populist Realist | -127 | -251 … -43 | 33 | 10-23-0 | 32% | 19% | +30 / −8 |
| 11 | **POP-IDE** Populist Idealist | -141 | -271 … -52 | 33 | 11-22-0 | 30% | 6% | +43 / −3 |
| 12 | **POP-LIB** Populist Liberal | -150 | -240 … -74 | 33 | 10-23-0 | 29% | 8% | +38 / −3 |

Rating scale: a 100-point gap means the higher type is expected to win about 64% of listener votes against the lower one. "Round-1 share" is the share of listeners leaning to the type after the openings; "gained / lost" counts listeners who changed sides between round 1 and the final vote.

## What drives it: style vs ideology vs speaking first (factorial logit, log-odds)

| effect | estimate | 95% CI |
|---|---|---|
| speaking first | -0.43 | -0.68 … -0.26 |
| style POP (Populist) | -0.68 | -0.90 … -0.51 |
| style HYB (Hybrid (story + evidence)) | 0.18 | -0.06 … 0.39 |
| style TEC (Technocrat (careful analyst)) | 0.50 | 0.30 … 0.74 |
| ideology REA (Realist) | -0.05 | -0.30 … 0.26 |
| ideology PRA (Pragmatist) | 0.39 | 0.09 … 0.66 |
| ideology LIB (Liberal) | 0.03 | -0.17 … 0.21 |
| ideology IDE (Idealist) | -0.38 | -0.71 … -0.13 |

Effects are centred within each factor (they sum to zero). A difference of 0.4 log-odds is roughly a 10-point swing in vote share. Raw first-speaker vote share: 42%.
Contrast rule (protocol 2, 161 debates): the side that drafted its plan first (blind, so it got its natural choice) won 54% of votes.
Debates by protocol: v1 37, v2 161.

## By scenario: vote share of each style and ideology (only debates where the two sides differ on that factor)

| scenario | POP | HYB | TEC | REA | PRA | LIB | IDE |
|---|---|---|---|---|---|---|---|
| dam (political) | 15% | 57% | 78% | 56% | 58% | 49% | 37% |
| salient (military) | 37% | 57% | 56% | 42% | 50% | 53% | 53% |
| board (corporate) | 30% | 53% | 68% | 51% | 69% | 54% | 31% |
| river (diplomatic) | 32% | 56% | 63% | 49% | 67% | 45% | 39% |

## Persuasion dynamics

- Listeners changed their lean in 35% of round-to-round transitions.
- Undecided by round: 49% → 26% → 0% (the last round is a forced vote).
- When one side led after the openings (176 debates), it won 83% of them; 30 were comebacks.
- Final splits: 5-0 in 102, 4-1 in 55, 3-2 in 41 debates (unanimity 52%). High unanimity means the five blank listeners behave close to one judge.

## Head-to-head vote share (row type against column type)

| | POP<br>REA | POP<br>PRA | POP<br>LIB | POP<br>IDE | HYB<br>REA | HYB<br>PRA | HYB<br>LIB | HYB<br>IDE | TEC<br>REA | TEC<br>PRA | TEC<br>LIB | TEC<br>IDE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **POP-REA** | · | 20<sub>3</sub> | 47<sub>3</sub> | 93<sub>3</sub> | 7<sub>3</sub> | 0<sub>3</sub> | 67<sub>3</sub> | 60<sub>3</sub> | 0<sub>3</sub> | 40<sub>3</sub> | 0<sub>3</sub> | 20<sub>3</sub> |
| **POP-PRA** | 80<sub>3</sub> | · | 47<sub>3</sub> | 100<sub>3</sub> | 27<sub>3</sub> | 0<sub>3</sub> | 60<sub>3</sub> | 53<sub>3</sub> | 20<sub>3</sub> | 60<sub>3</sub> | 13<sub>3</sub> | 40<sub>3</sub> |
| **POP-LIB** | 53<sub>3</sub> | 53<sub>3</sub> | · | 53<sub>3</sub> | 60<sub>3</sub> | 7<sub>3</sub> | 33<sub>3</sub> | 20<sub>3</sub> | 13<sub>3</sub> | 0<sub>3</sub> | 7<sub>3</sub> | 20<sub>3</sub> |
| **POP-IDE** | 7<sub>3</sub> | 0<sub>3</sub> | 47<sub>3</sub> | · | 7<sub>3</sub> | 53<sub>3</sub> | 40<sub>3</sub> | 60<sub>3</sub> | 33<sub>3</sub> | 13<sub>3</sub> | 33<sub>3</sub> | 40<sub>3</sub> |
| **HYB-REA** | 93<sub>3</sub> | 73<sub>3</sub> | 40<sub>3</sub> | 93<sub>3</sub> | · | 40<sub>3</sub> | 40<sub>3</sub> | 67<sub>3</sub> | 67<sub>3</sub> | 47<sub>3</sub> | 40<sub>3</sub> | 33<sub>3</sub> |
| **HYB-PRA** | 100<sub>3</sub> | 100<sub>3</sub> | 93<sub>3</sub> | 47<sub>3</sub> | 60<sub>3</sub> | · | 80<sub>3</sub> | 93<sub>3</sub> | 40<sub>3</sub> | 60<sub>3</sub> | 47<sub>3</sub> | 87<sub>3</sub> |
| **HYB-LIB** | 33<sub>3</sub> | 40<sub>3</sub> | 67<sub>3</sub> | 60<sub>3</sub> | 60<sub>3</sub> | 20<sub>3</sub> | · | 80<sub>3</sub> | 53<sub>3</sub> | 20<sub>3</sub> | 93<sub>3</sub> | 53<sub>3</sub> |
| **HYB-IDE** | 40<sub>3</sub> | 47<sub>3</sub> | 80<sub>3</sub> | 40<sub>3</sub> | 33<sub>3</sub> | 7<sub>3</sub> | 20<sub>3</sub> | · | 33<sub>3</sub> | 60<sub>3</sub> | 7<sub>3</sub> | 0<sub>3</sub> |
| **TEC-REA** | 100<sub>3</sub> | 80<sub>3</sub> | 87<sub>3</sub> | 67<sub>3</sub> | 33<sub>3</sub> | 60<sub>3</sub> | 47<sub>3</sub> | 67<sub>3</sub> | · | 53<sub>3</sub> | 20<sub>3</sub> | 53<sub>3</sub> |
| **TEC-PRA** | 60<sub>3</sub> | 40<sub>3</sub> | 100<sub>3</sub> | 87<sub>3</sub> | 53<sub>3</sub> | 40<sub>3</sub> | 80<sub>3</sub> | 40<sub>3</sub> | 47<sub>3</sub> | · | 53<sub>3</sub> | 20<sub>3</sub> |
| **TEC-LIB** | 100<sub>3</sub> | 87<sub>3</sub> | 93<sub>3</sub> | 67<sub>3</sub> | 60<sub>3</sub> | 53<sub>3</sub> | 7<sub>3</sub> | 93<sub>3</sub> | 80<sub>3</sub> | 47<sub>3</sub> | · | 67<sub>3</sub> |
| **TEC-IDE** | 80<sub>3</sub> | 60<sub>3</sub> | 80<sub>3</sub> | 60<sub>3</sub> | 67<sub>3</sub> | 13<sub>3</sub> | 47<sub>3</sub> | 100<sub>3</sub> | 47<sub>3</sub> | 80<sub>3</sub> | 33<sub>3</sub> | · |

## Energy (measured)

- Logged 6.77 h of GPU telemetry: **0.797 kWh** on the GPU (mean 118 W, peak 136 W, mean utilisation 83%, max 77 °C).
- Per debate: 4.0 Wh GPU (whole run, 198 debates).
- CPU utilisation averaged 27% (measured). Whole-system power was not metered; see METHOD.md for the estimate and the cost formula.
