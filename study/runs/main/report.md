# Persuasion study: results for run `main`

Generated 2026-11-05T05:21:48.071Z from 161 debates (805 listener votes).
Pairs covered: 66/66; debates per pair min 2, max 3. Total model time 5.47 h, mean 122 s per debate.

## Ranking (Bradley-Terry on listener votes, 95% bootstrap CI over debates)

| # | type | rating | 95% CI | debates | W-L-T | vote share | round-1 share | listeners gained / lost |
|---|---|---|---|---|---|---|---|---|
| 1 | **HYB-PRA** Hybrid Pragmatist | 151 | 48 … 290 | 25 | 18-7-0 | 70% | 43% | +37 / −3 |
| 2 | **TEC-LIB** Technocrat Liberal | 107 | 19 … 209 | 26 | 18-8-0 | 65% | 35% | +43 / −4 |
| 3 | **TEC-IDE** Technocrat Idealist | 75 | -28 … 158 | 26 | 16-10-0 | 61% | 23% | +54 / −5 |
| 4 | **TEC-REA** Technocrat Realist | 67 | -29 … 186 | 25 | 15-10-0 | 59% | 36% | +37 / −8 |
| 5 | **TEC-PRA** Technocrat Pragmatist | 64 | -27 … 169 | 29 | 16-13-0 | 60% | 34% | +50 / −12 |
| 6 | **HYB-REA** Hybrid Realist | 59 | -34 … 150 | 27 | 16-11-0 | 60% | 24% | +53 / −5 |
| 7 | **HYB-LIB** Hybrid Liberal | 13 | -77 … 126 | 25 | 14-11-0 | 51% | 24% | +41 / −7 |
| 8 | **POP-PRA** Populist Pragmatist | -38 | -126 … 56 | 29 | 11-18-0 | 45% | 22% | +39 / −6 |
| 9 | **HYB-IDE** Hybrid Idealist | -118 | -256 … -19 | 28 | 9-19-0 | 34% | 17% | +26 / −3 |
| 10 | **POP-IDE** Populist Idealist | -120 | -264 … -13 | 28 | 11-17-0 | 34% | 7% | +41 / −3 |
| 11 | **POP-LIB** Populist Liberal | -124 | -243 … -32 | 26 | 9-17-0 | 33% | 9% | +33 / −2 |
| 12 | **POP-REA** Populist Realist | -137 | -261 … -43 | 28 | 8-20-0 | 32% | 21% | +24 / −8 |

Rating scale: a 100-point gap means the higher type is expected to win about 64% of listener votes against the lower one. "Round-1 share" is the share of listeners leaning to the type after the openings; "gained / lost" counts listeners who changed sides between round 1 and the final vote.

## What drives it: style vs ideology vs speaking first (factorial logit, log-odds)

| effect | estimate | 95% CI |
|---|---|---|
| speaking first | -0.34 | -0.62 … -0.07 |
| style POP (Populist) | -0.61 | -0.91 … -0.40 |
| style HYB (Hybrid (story + evidence)) | 0.14 | -0.15 … 0.39 |
| style TEC (Technocrat (careful analyst)) | 0.47 | 0.22 … 0.73 |
| ideology REA (Realist) | -0.03 | -0.41 … 0.30 |
| ideology PRA (Pragmatist) | 0.36 | 0.03 … 0.64 |
| ideology LIB (Liberal) | 0.02 | -0.29 … 0.35 |
| ideology IDE (Idealist) | -0.35 | -0.72 … -0.07 |

Effects are centred within each factor (they sum to zero). A difference of 0.4 log-odds is roughly a 10-point swing in vote share. Raw first-speaker vote share: 44%.
Contrast rule (protocol 2, 161 debates): the side that drafted its plan first (blind, so it got its natural choice) won 54% of votes.
Debates by protocol: v2 161.

## By scenario: vote share of each style and ideology (only debates where the two sides differ on that factor)

| scenario | POP | HYB | TEC | REA | PRA | LIB | IDE |
|---|---|---|---|---|---|---|---|
| dam (political) | 17% | 61% | 74% | 58% | 60% | 46% | 34% |
| salient (military) | 33% | 59% | 59% | 42% | 51% | 54% | 53% |
| board (corporate) | 32% | 50% | 67% | 45% | 68% | 57% | 34% |
| river (diplomatic) | 38% | 49% | 63% | 54% | 63% | 41% | 44% |

## Persuasion dynamics

- Listeners changed their lean in 35% of round-to-round transitions.
- Undecided by round: 51% → 28% → 0% (the last round is a forced vote).
- When one side led after the openings (142 debates), it won 83% of them; 24 were comebacks.
- Final splits: 5-0 in 83, 4-1 in 47, 3-2 in 31 debates (unanimity 52%). High unanimity means the five blank listeners behave close to one judge.

## Head-to-head vote share (row type against column type)

| | POP<br>REA | POP<br>PRA | POP<br>LIB | POP<br>IDE | HYB<br>REA | HYB<br>PRA | HYB<br>LIB | HYB<br>IDE | TEC<br>REA | TEC<br>PRA | TEC<br>LIB | TEC<br>IDE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **POP-REA** | · | 20<sub>3</sub> | 47<sub>3</sub> | 93<sub>3</sub> | 7<sub>3</sub> | 0<sub>2</sub> | 50<sub>2</sub> | 60<sub>3</sub> | 0<sub>2</sub> | 40<sub>3</sub> | 0<sub>2</sub> | 0<sub>2</sub> |
| **POP-PRA** | 80<sub>3</sub> | · | 20<sub>2</sub> | 100<sub>3</sub> | 10<sub>2</sub> | 0<sub>3</sub> | 60<sub>3</sub> | 53<sub>3</sub> | 20<sub>3</sub> | 60<sub>3</sub> | 20<sub>2</sub> | 40<sub>2</sub> |
| **POP-LIB** | 53<sub>3</sub> | 80<sub>2</sub> | · | 53<sub>3</sub> | 60<sub>3</sub> | 10<sub>2</sub> | 50<sub>2</sub> | 0<sub>2</sub> | 20<sub>2</sub> | 0<sub>3</sub> | 10<sub>2</sub> | 10<sub>2</sub> |
| **POP-IDE** | 7<sub>3</sub> | 0<sub>3</sub> | 47<sub>3</sub> | · | 10<sub>2</sub> | 80<sub>2</sub> | 60<sub>2</sub> | 60<sub>3</sub> | 40<sub>2</sub> | 13<sub>3</sub> | 40<sub>2</sub> | 40<sub>3</sub> |
| **HYB-REA** | 93<sub>3</sub> | 90<sub>2</sub> | 40<sub>3</sub> | 90<sub>2</sub> | · | 50<sub>2</sub> | 40<sub>3</sub> | 67<sub>3</sub> | 50<sub>2</sub> | 47<sub>3</sub> | 50<sub>2</sub> | 50<sub>2</sub> |
| **HYB-PRA** | 100<sub>2</sub> | 100<sub>3</sub> | 90<sub>2</sub> | 20<sub>2</sub> | 50<sub>2</sub> | · | 90<sub>2</sub> | 100<sub>2</sub> | 10<sub>2</sub> | 70<sub>2</sub> | 47<sub>3</sub> | 87<sub>3</sub> |
| **HYB-LIB** | 50<sub>2</sub> | 40<sub>3</sub> | 50<sub>2</sub> | 40<sub>2</sub> | 60<sub>3</sub> | 10<sub>2</sub> | · | 80<sub>2</sub> | 80<sub>2</sub> | 0<sub>2</sub> | 93<sub>3</sub> | 40<sub>2</sub> |
| **HYB-IDE** | 40<sub>3</sub> | 47<sub>3</sub> | 100<sub>2</sub> | 40<sub>3</sub> | 33<sub>3</sub> | 0<sub>2</sub> | 20<sub>2</sub> | · | 50<sub>2</sub> | 50<sub>2</sub> | 7<sub>3</sub> | 0<sub>3</sub> |
| **TEC-REA** | 100<sub>2</sub> | 80<sub>3</sub> | 80<sub>2</sub> | 60<sub>2</sub> | 50<sub>2</sub> | 90<sub>2</sub> | 20<sub>2</sub> | 50<sub>2</sub> | · | 53<sub>3</sub> | 10<sub>2</sub> | 53<sub>3</sub> |
| **TEC-PRA** | 60<sub>3</sub> | 40<sub>3</sub> | 100<sub>3</sub> | 87<sub>3</sub> | 53<sub>3</sub> | 30<sub>2</sub> | 100<sub>2</sub> | 50<sub>2</sub> | 47<sub>3</sub> | · | 53<sub>3</sub> | 30<sub>2</sub> |
| **TEC-LIB** | 100<sub>2</sub> | 80<sub>2</sub> | 90<sub>2</sub> | 60<sub>2</sub> | 50<sub>2</sub> | 53<sub>3</sub> | 7<sub>3</sub> | 93<sub>3</sub> | 90<sub>2</sub> | 47<sub>3</sub> | · | 70<sub>2</sub> |
| **TEC-IDE** | 100<sub>2</sub> | 60<sub>2</sub> | 90<sub>2</sub> | 60<sub>3</sub> | 50<sub>2</sub> | 13<sub>3</sub> | 60<sub>2</sub> | 100<sub>3</sub> | 47<sub>3</sub> | 70<sub>2</sub> | 30<sub>2</sub> | · |

## Energy (measured)

- Logged 6.77 h of GPU telemetry: **0.797 kWh** on the GPU (mean 118 W, peak 136 W, mean utilisation 83%, max 77 °C).
- Per debate: 4.0 Wh GPU (whole run, 198 debates).
- CPU utilisation averaged 27% (measured). Whole-system power was not metered; see METHOD.md for the estimate and the cost formula.
