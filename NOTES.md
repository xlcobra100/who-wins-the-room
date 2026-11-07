# Project notes: my role, my decisions, and what the AI did

> Sections 1–4 were drafted by Claude Code from my own messages and the session records, and I checked them.
> Section 5 is in my own words.
> To check any claim here, open my original briefs (linked below), the dated notes in `agents log/`, and the night's change log in `study/runs/main/monitor-log.md`.

## 1. Who did what

| | Me | AI |
|---|---|---|
| **Idea and inspiration** | Took the idea from the Stanford "Smallville" generative-agents paper, tests of AI ideology on political compasses, and an AI debating game (deck slide 1). | – |
| **The game** (Halcyon Council) | Gave the brief: a 3D council of AI characters with private memory, and gavel, crisis, whisper and vote levers ([docs/briefs/game-brief.md](docs/briefs/game-brief.md)). Play-tested it and sent back feedback. | Claude Code (Opus 5.5) wrote the code. Some Nov 3 features were added with another coding agent: **[name the tool]**. |
| **The study design** | Wrote the study brief ([promt.txt](promt.txt), verbatim). It sets the question, the 3 styles × 4 ideologies grid, 5 listeners who vote instead of rating, a reflection after every round, a random pairing schedule, hourly monitoring and power measurement. | Turned it into a pre-registered method ([study/METHOD.md](study/METHOD.md)). Asked me 4 clarifying questions (section 3). |
| **Running it** | Set the time window (start once the pilot passed, hard stop at 06:00). Gave the monitor "free hands" to change what wasn't working. | Built the harness, ran 198 debates overnight, and checked in every hour. Changed the protocol at debate 38 and logged why. |
| **Debaters and listeners** | – | All played by a local model, `qwen3.5:9b`, on my RTX 4060 Ti. |
| **Analysis** | Chose what to dig into: the swings, the hallucinations, one scenario in depth, and the technical causes behind the results. | Statistics (Bradley–Terry ratings, factorial logit, plan analysis), the two result pages, the video clip and the mechanism checks. |
| **Presentation** | Edited the deck: **[list the slides you wrote or rewrote, e.g. inspiration, technical causes, next step 4]**. Embedded the video, and wrote the hypotheses on the technical-causes slide (RL training, test structure, memory architecture). | Drafted the first version of the deck. On 6 Nov: fixed typos, matched the example slide to the video, and added measured evidence next to my hypotheses on the causes slide. |

## 2. Timeline

| Date | What happened |
|---|---|
| 1 Nov | Pasted the game brief. The first version of Halcyon Council was built: Three.js, with Ollama, Claude or an offline engine for the characters' thinking. |
| 3 Nov | Debate Arena mode, body language, trait dials, a 1900s boardroom with historical scenarios, vote aftermath. |
| 4 Nov, evening | My feedback: the scenarios "sound very AI", there's no back story, the 1900s cast needs period clothes, two characters only talk to each other, and a beeping sound plays in the background. All fixed. |
| 4 Nov, late evening | Wrote the study brief and answered the design questions. |
| 4–5 Nov, 23:07–05:53 | The overnight run: 198 debates, 4,158 model calls, 0 errors, 0.80 kWh on the GPU. |
| 5 Nov | Findings page. I asked for the best swings and hallucinations and one scenario in depth (highlights page), a short video clip, and the technical factors behind the results (mechanism checks). Built the deck. |
| 6 Nov | Put it on GitHub with these notes. |

## 3. Decisions I made, and what they did to the study

- **Votes, not ratings.**
  - My reasoning in the brief: "We don't make them rate 1-10, because we want to sustain a similarity to human decision making, not only an eval function."
  - Effect: every listener casts one forced vote, and results are vote shares.
- **Listeners reflect after every round,** rather than reading the whole transcript at the end.
  - Effect: this produced the round-by-round lean data. Without it there would be no evidence for 83% of debates being won by the side that led after the openings, for the 24 comebacks, or for which line moved which listener.
- **12 types from style × ideology** (Populist / Hybrid / Technocrat × Realist / Pragmatist / Liberal / Idealist).
  - Effect: the factorial design. It separates *how* you speak from *what* you value, and it is how "style matters more than ideology" could be tested.
- **No hidden agendas.**
  - I chose this when asked, so the debaters are pure archetypes.
- **Blank listeners, with room for profiles later.**
  - My words: "I'm more interested in what the actual model gets to, not a model thinking like an empathetic nurse."
  - The AI warned me that blank listeners would vote alike. I kept them blank, with an optional hook for listener profiles, which is now next step 2.
- **One scenario per domain: political, military, corporate, diplomatic.**
  - Effect: the four scenarios behave differently. Style decides the dam debate, and ideology fades in the military one.
- **Measure watts rather than price them, and stop at 06:00.**
  - Effect: real GPU power logged every 5 s, 0.80 kWh in total.
- **Free hands for the monitor:** "If you determine something is not working … I'd rather see you took actions to change."
  - Effect: at debate 38 the monitor saw that both sides proposed the same plan in every dam and military debate, so votes just followed speaking order.
  - It changed the protocol (a coin flip decides who drafts first, and the other side must propose something different) and logged the change.
- **Ideas I raised that didn't happen, and why:**
  - **Personality RL** (types evolving from their results): it would have changed the treatment during the measurement. Left as a follow-up.
  - **Running listener and debater models in parallel:** tested, but Ollama refuses parallel requests for this model architecture.
  - **Comparing models:** didn't fit before 06:00. The saved transcripts can be re-judged by another model later.

## 4. Results in three lines

1. **Style beats ideology.** Populists won 30% of votes against debaters with the same ideology. The Hybrid Pragmatist (a story plus numbers, and a workable plan) was best at 70%.
2. **The plan matters most.** The side holding the plan the model prefers won 78% of votes. Controlling for the plan, the Populist penalty survives (it's about delivery). The Idealist penalty mostly disappears (it's about what they propose).
3. **Biggest caveat:** the same 9B model wrote and judged everything, so this may describe what qwen finds persuasive, not what people do.

## 5. In my own words

### Discussion: plausible explanations for the experiment results

**Pre-training:** Model developers usually choose high-quality data, especially for a smaller model (this test used a 9B model). Quality data is used in order to cut training time and improve results (*The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale*, 2024). However, this data is mostly aimed at the productive work the model is anticipated to be used for, such as coding, analyzing, or writing. Subsequently, the data used has a pragmatic and intellectual character, since that is what is needed to perform better in those targeted workloads. This contributes towards the more pragmatic and technocratic character types winning more debates in the results.

**Reinforcement Learning (RL)** also played a big role. Again, optimizing model performance to excel in those productive workloads produces a more analytical model.

**Scenario setting and the listeners' voting methodology** also provide important clues in understanding the results. The scenarios were all designed to include many factors to ponder. In addition, they all took place in serious settings, such as a meeting table. This presumably leans the model toward thinking in more serious and analytical terms rather than emotional ones.

Another possible reason was that the structure of the listeners' judgment contained a step where the listener compares both alternatives and then explains why it leans one way or the other. So the listener was instructed to be inherently analytical, which is another factor contributing to the results.

Another experimental condition worth reflecting on is the relevance of using the same model to both listen and debate. The debaters had to choose different plans (a prerequisite for a debate). To address this, one debater (chosen by a coin flip) got to draft their plan first. That debater thinks about the problem and chooses the plan it agrees with most. However, the listeners evaluating both debaters reason in a very similar way to the debaters themselves. Subsequently, the listeners are much more prone to agree with whichever debater holds that default plan (which won 78% of the votes, and was taken 55% of the time by the first drafter vs. 33% by the second). This aligns with observations that have already been confirmed in other research (*LLM-as-a-Judge Biases*, Zheng et al., 2023, MT-Bench; Panickssery et al., 2024). That is why it would be valuable to further research model mixing when studying AI interactions.

<!-- Write these yourself; this is the part your teacher will care about most. A few sentences each is enough. -->

**Why I wanted to do this:**

**What surprised me:**

**Where the AI got something wrong, or I had to correct it:**

**What I learned about directing AI agents:**

**What I'd do differently next time:**

## Questions I might get

- **Did you write the code?** No. Claude Code wrote it. I designed the study, set its rules and constraints, decided the scope, and judged and selected the results. The point of the project was what AI agents do when they debate, and building it by directing an AI agent was part of the experiment.
- **Isn't the model just judging itself?** Yes. That's the biggest limitation, which is why next step 1 is re-judging the saved debates with a different listener model.
- **Can it be reproduced?** Every call is seeded. `node study/analyze.mjs --run main --protocol 2 --out report-p2` rebuilds the main tables from the saved data, and every transcript is in `study/runs/main/transcripts/`.
- **Is Mrs. Gable real?** No. The Hybrid style prompt says "open with a vivid human example", and the model invented the same elderly resident in 21 of 29 dam debates that had a Hybrid speaker.
