/**
 * Prompts and JSON schemas for the two roles in a study debate.
 *
 * DEBATER: knows its style + worldview, the shared background and the full
 * transcript. Commits to one plan (its "platform") in a blind opening and keeps it.
 *
 * LISTENER: no personality at all, only a memory stream. Each round it hears the
 * two new speeches verbatim, but earlier rounds reach it only through its own
 * notes and reflections. That keeps listening path-dependent like a person's
 * (you remember what you noted, not a transcript) instead of judging a full
 * transcript at the end. Field order in the schemas is deliberate: the listener
 * writes notes and reasoning before it names a lean or casts a vote.
 */
import { STYLES, IDEOLOGIES } from './archetypes.mjs';

export const ROUND_NAMES = {
  3: ['Opening statements', 'Rebuttals', 'Closing statements'],
  4: ['Opening statements', 'First rebuttals', 'Second rebuttals', 'Closing statements'],
};
export const roundName = (r, total) => (ROUND_NAMES[total] || [])[r - 1] || `Round ${r}`;

const first = (name) => name.split(' ')[0];
const bg = (sc) => sc.background.join('\n\n');

// ---------------------------------------------------------------- debater

export function debaterSystem(sc, type, me, opp) {
  const style = STYLES[type.style];
  const ideo = IDEOLOGIES[type.ideology];
  return `You are ${me}, ${sc.role}.
${sc.room}

WHAT EVERYONE IN THE ROOM KNOWS
${bg(sc)}

THE QUESTION: ${sc.question}

YOUR WORLDVIEW
${ideo.desc}

YOUR WAY OF SPEAKING
${style.desc}

YOUR OPPONENT is ${opp}. You don't know their views in advance; learn them from what they say.

THE RULES OF THIS DEBATE
- You are a real person speaking aloud in this room. Never mention AI, prompts, roles, "worldview" or "style", and never label yourself (don't say "as a realist" or "as a populist").
- Your goal is to win the votes of the five voting members. Each will vote for the speaker whose plan they agree with most.
- In your opening you commit to one plan. You never switch to your opponent's plan and never drop your core position. You may sharpen details, add conditions or answer objections.
- Engage with your opponent: answer their strongest points directly and take them apart from different angles (cost, risk, feasibility, fairness, timing, relations with others, precedent, who pays).
- Use the facts everyone knows. Interpret and weigh them freely, but do not invent new numbers, studies or events.
- Speak about 90-120 words. Spoken words only: no headings, lists, stage directions or quotation marks.`;
}

function transcriptBlock(transcript) {
  if (!transcript.length) return '(nothing has been said yet)';
  return transcript.map((t) => `[${t.roundName}] ${t.name}: ${t.speech}`).join('\n\n');
}

/**
 * Round 1 is a prepared opening. Contrast rule (protocol v2, from debate 38 of run
 * `main`): one debater, picked by coin flip independent of speaking order, drafts
 * blind; the other is told only that rival's one-sentence plan and must differ in
 * its core choice. Under v1 (fully blind), the model gave both sides the same plan
 * in two of four scenarios, and the vote then followed speaking order, not type.
 */
export function debaterTurnPrompt({ round, totalRounds, me, opp, platform, transcript, speaksFirst, rivalPlatform = null }) {
  const name = roundName(round, totalRounds);
  if (round === 1) {
    const rival = rivalPlatform
      ? `\nYou already know ${opp}'s announced plan: "${rivalPlatform}"\nPropose the plan your own worldview leads to. It must differ from ${opp}'s in its core choice, not only in details or emphasis. If you share part of their diagnosis, say what you would do differently and why that is better.`
      : '';
    return `ROUND 1 of ${totalRounds}: ${name}.
You prepared this opening before the debate, without hearing ${opp}'s speech. You speak ${speaksFirst ? 'first' : 'second'}.${rival}
State clearly what you propose should be done (your plan), and make your main case for it.

Answer as JSON:
- platform: your plan in one sentence. You will defend this plan for the whole debate.
- speech: your opening statement, spoken aloud (90-120 words)
- strategy: your private plan for winning this room (one short sentence; nobody hears it)`;
  }
  const last = round === totalRounds;
  return `THE DEBATE SO FAR
${transcriptBlock(transcript)}

YOUR PLAN (you committed to it in your opening; keep it): ${platform}

ROUND ${round} of ${totalRounds}: ${name}. You speak ${speaksFirst ? 'first' : 'second'} in this round.
${last
    ? `This is your closing statement and your last chance to win the five votes. Say why your plan and not ${first(opp)}'s. Don't just repeat yourself: sharpen your strongest point and answer the doubt that most hurts you.`
    : `Answer ${first(opp)}: take apart their strongest argument from a fresh angle, and strengthen your case with a point you have not made yet.`}

Answer as JSON:
- speech: what you say aloud now (90-120 words)
- strategy: your private read of the room and what you are trying to do (one short sentence; nobody hears it)`;
}

export const OPENING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['platform', 'speech', 'strategy'],
  properties: {
    platform: { type: 'string', description: 'Your plan, one sentence' },
    speech: { type: 'string', description: 'Opening statement, 90-120 words' },
    strategy: { type: 'string', description: 'Private, one short sentence' },
  },
};

export const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['speech', 'strategy'],
  properties: {
    speech: { type: 'string', description: 'Spoken aloud, 90-120 words' },
    strategy: { type: 'string', description: 'Private, one short sentence' },
  },
};

// ---------------------------------------------------------------- listener

/**
 * `profile` is the optional "simple character context" hook the user asked to keep
 * open. It is null in the main study: listeners are blank so the vote reflects the
 * model's own judgement, not a role it plays.
 */
export function listenerSystem(sc, nameA, nameB, totalRounds, profile = null) {
  return `${sc.room}
You are ${sc.listenerRole}.${profile ? `\nAbout you: ${profile}` : ''}

WHAT EVERYONE IN THE ROOM KNOWS
${bg(sc)}

THE QUESTION: ${sc.question}

Two speakers, ${nameA} and ${nameB}, will each propose a plan and argue for it over ${totalRounds} rounds. After each round you write private notes and reflect. When the debate ends you vote for the speaker whose plan you agree with most.

How you listen:
- Judge for yourself. Think about the actual problem and the facts, not only about who sounds good.
- Your notes are your only memory of earlier rounds, so write down what matters.
- Your reflections are private; be honest. You may change your mind at any point, or not.`;
}

function memoryBlock(memory, nameA, nameB) {
  if (!memory.length) return '(nothing yet: this is the first round)';
  return memory.map((m) => `${m.roundName}:
  Notes: ${m.notes}
  How I saw the problem: ${m.problem}
  On ${first(nameA)}: ${m.onA}
  On ${first(nameB)}: ${m.onB}
  ${m.vote ? `I voted for ${m.vote}` : `Leaning: ${m.lean}${m.firmness ? ` (${m.firmness})` : ''}`}. Why: ${m.why}`).join('\n\n');
}

export function listenerRoundPrompt({ round, totalRounds, nameA, nameB, speechA, speechB, memory }) {
  const final = round === totalRounds;
  const fa = first(nameA);
  const fb = first(nameB);
  return `YOUR MEMORY: your own notes and reflections from earlier rounds
${memoryBlock(memory, nameA, nameB)}

ROUND ${round} of ${totalRounds}: ${roundName(round, totalRounds)}. What was just said:

${nameA}: ${speechA}

${nameB}: ${speechB}

${final
    ? 'The debate is over. Reflect one last time, then cast your vote. You must vote for one of the two speakers.'
    : 'Reflect privately on this round.'}

Keep every field short; these are private notes, not essays.
Answer as JSON:
- notes: the points from this round you want to remember, a few words each (at most 40 words in total)
- problem: how you now see the core problem (one sentence)
- about_${fa}: your honest take on ${fa}'s plan and arguments so far (one sentence)
- about_${fb}: your honest take on ${fb}'s plan and arguments so far (one sentence)
${final
    ? `- vote: "${nameA}" or "${nameB}", the speaker whose plan you agree with most
- why: why you vote this way, in your own words (1-2 sentences)`
    : `- lean: "${nameA}", "${nameB}" or "undecided": whose plan you agree with most so far
- firmness: "tentative", "fairly sure" or "convinced"
- why: what moved you this round, or what kept you where you were (one sentence)`}`;
}

export function listenerSchema(nameA, nameB, final) {
  const fa = `about_${first(nameA)}`;
  const fb = `about_${first(nameB)}`;
  const props = {
    notes: { type: 'string' },
    problem: { type: 'string' },
    [fa]: { type: 'string' },
    [fb]: { type: 'string' },
  };
  if (final) {
    props.vote = { type: 'string', enum: [nameA, nameB] };
  } else {
    props.lean = { type: 'string', enum: [nameA, nameB, 'undecided'] };
    props.firmness = { type: 'string', enum: ['tentative', 'fairly sure', 'convinced'] };
  }
  props.why = { type: 'string' };
  return { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props };
}
