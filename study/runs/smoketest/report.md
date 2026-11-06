# Persuasion study: results for run `smoketest`

Generated 2026-11-04T22:07:17.426Z from 1 debates (5 listener votes).
Pairs covered: 1/66; debates per pair min 1, max 1. Total model time 0.03 h, mean 121 s per debate.

## Ranking (Bradley-Terry on listener votes, 95% bootstrap CI over debates)

| # | type | rating | 95% CI | debates | W-L-T | vote share | round-1 share | listeners gained / lost |
|---|---|---|---|---|---|---|---|---|
| 1 | **TEC-PRA** Technocrat Pragmatist | 29 | 29 … 29 | 1 | 1-0-0 | 60% | 40% | +2 / −1 |
| 2 | **POP-REA** Populist Realist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 3 | **POP-PRA** Populist Pragmatist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 4 | **POP-LIB** Populist Liberal | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 5 | **POP-IDE** Populist Idealist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 6 | **HYB-REA** Hybrid Realist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 7 | **HYB-LIB** Hybrid Liberal | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 8 | **HYB-IDE** Hybrid Idealist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 9 | **TEC-REA** Technocrat Realist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 10 | **TEC-LIB** Technocrat Liberal | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 11 | **TEC-IDE** Technocrat Idealist | 0 | 0 … 0 | 0 | 0-0-0 | 0% | 0% | +0 / −0 |
| 12 | **HYB-PRA** Hybrid Pragmatist | -29 | -29 … -29 | 1 | 0-1-0 | 40% | 20% | +2 / −1 |

Rating scale: a 100-point gap means the higher type is expected to win about 64% of listener votes against the lower one. "Round-1 share" is the share of listeners leaning to the type after the openings; "gained / lost" counts listeners who changed sides between round 1 and the final vote.

## What drives it: style vs ideology vs speaking first (factorial logit, log-odds)

| effect | estimate | 95% CI |
|---|---|---|
| speaking first | -0.13 | -0.13 … -0.13 |
| style POP (Populist) | 0.00 | 0.00 … 0.00 |
| style HYB (Hybrid (story + evidence)) | -0.13 | -0.13 … -0.13 |
| style TEC (Technocrat (careful analyst)) | 0.13 | 0.13 … 0.13 |
| ideology REA (Realist) | 0.00 | 0.00 … 0.00 |
| ideology PRA (Pragmatist) | 0.00 | 0.00 … 0.00 |
| ideology LIB (Liberal) | 0.00 | 0.00 … 0.00 |
| ideology IDE (Idealist) | 0.00 | 0.00 … 0.00 |

Effects are centred within each factor (they sum to zero). A difference of 0.4 log-odds is roughly a 10-point swing in vote share. Raw first-speaker vote share: 40%.

## By scenario: vote share of each style and ideology (only debates where the two sides differ on that factor)

| scenario | POP | HYB | TEC | REA | PRA | LIB | IDE |
|---|---|---|---|---|---|---|---|
| dam (political) | – | 40% | 60% | – | – | – | – |
| salient (military) | – | – | – | – | – | – | – |
| board (corporate) | – | – | – | – | – | – | – |
| river (diplomatic) | – | – | – | – | – | – | – |

## Persuasion dynamics

- Listeners changed their lean in 40% of round-to-round transitions.
- Undecided by round: 40% → 20% → 0% (the last round is a forced vote).
- When one side led after the openings (1 debates), it won 100% of them; 0 were comebacks.
- Final splits: 5-0 in 0, 4-1 in 0, 3-2 in 1 debates (unanimity 0%). High unanimity means the five blank listeners behave close to one judge.

## Head-to-head vote share (row type against column type)

| | POP<br>REA | POP<br>PRA | POP<br>LIB | POP<br>IDE | HYB<br>REA | HYB<br>PRA | HYB<br>LIB | HYB<br>IDE | TEC<br>REA | TEC<br>PRA | TEC<br>LIB | TEC<br>IDE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **POP-REA** | · |  |  |  |  |  |  |  |  |  |  |  |
| **POP-PRA** |  | · |  |  |  |  |  |  |  |  |  |  |
| **POP-LIB** |  |  | · |  |  |  |  |  |  |  |  |  |
| **POP-IDE** |  |  |  | · |  |  |  |  |  |  |  |  |
| **HYB-REA** |  |  |  |  | · |  |  |  |  |  |  |  |
| **HYB-PRA** |  |  |  |  |  | · |  |  |  | 40<sub>1</sub> |  |  |
| **HYB-LIB** |  |  |  |  |  |  | · |  |  |  |  |  |
| **HYB-IDE** |  |  |  |  |  |  |  | · |  |  |  |  |
| **TEC-REA** |  |  |  |  |  |  |  |  | · |  |  |  |
| **TEC-PRA** |  |  |  |  |  | 60<sub>1</sub> |  |  |  | · |  |  |
| **TEC-LIB** |  |  |  |  |  |  |  |  |  |  | · |  |
| **TEC-IDE** |  |  |  |  |  |  |  |  |  |  |  | · |

## Energy (measured)

- Logged 0.03 h of GPU telemetry: **0.004 kWh** on the GPU (mean 113 W, peak 125 W, mean utilisation 83%, max 73 °C).
- Per debate: 3.8 Wh GPU.
- CPU utilisation averaged 27% (measured). Whole-system power was not metered; see METHOD.md for the estimate and the cost formula.
