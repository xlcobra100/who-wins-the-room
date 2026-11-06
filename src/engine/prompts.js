/**
 * Prompt + JSON-schema builders for every model call the council makes.
 *
 * Split of concerns (also helps prompt caching on Claude):
 *   system  = stable per agent per scenario (identity, world, table rules)
 *   prompt  = volatile per turn (dilemma state, episodic recall, private state, the moment)
 * Schemas avoid numeric min/max keywords (not portable across structured-output
 * engines); ranges live in descriptions and are clamped by the engine instead.
 */
import { EMOTIONS } from '../data/personas.js';

export const WORLD = 'Halcyon Station is an orbital habitat of 4,200 people circling the gas giant Tethys-Var in the year 2291, twenty-two light-minutes from Earth. Its Council (seven members and a Chair who moderates) governs the station in emergencies. The Consortium owns the station\'s debt and its ore refinery; the Earth Directorate holds its charter.';

function trustWord(v) {
  if (v >= 50) return 'deep trust';
  if (v >= 20) return 'warm';
  if (v > -20) return 'neutral';
  if (v > -50) return 'wary';
  return 'hostile';
}

/** The world a scenario lives in: Halcyon by default, or the scenario's own setting (the 1900s ones). */
export function worldFor(sc) { return sc?.world || WORLD; }

/** The scenario's back story, as plain paragraphs every member knows. */
function backgroundBlock(sc) {
  const bg = Array.isArray(sc?.background) ? sc.background : sc?.background ? [sc.background] : [];
  return bg.length ? `\nWHAT EVERYONE IN THE ROOM KNOWS\n${bg.join('\n')}\n` : '';
}

function optionLine(o) { return `${o.id}) ${o.label}: ${o.desc}`; }

function positionLabel(scenario, pos) {
  const o = scenario.options.find((x) => x.id === pos);
  return o ? `${o.id} (${o.label})` : 'undecided';
}

export function buildSystemPrompt(agent, council) {
  const p = agent.persona;
  const traits = p.traits || { openness: 0.5, persuadability: 0.5, assertiveness: 0.6, compromise: 0.5 };
  const openDesc = traits.openness < 0.4 ? 'Defensive and resistant to opposing views; dismissive of contrary arguments' : traits.openness > 0.7 ? 'Intellectually open, genuinely receptive and thoughtful when confronted with alternative perspectives' : 'Pragmatically receptive to counter-points';
  const persDesc = traits.persuadability < 0.35 ? 'Uncompromising and stubborn; fiercely defends initial position and resists changing mind' : traits.persuadability > 0.65 ? 'Flexible and persuadable; willing to change mind and flip stance if sound reasons are presented' : 'Measured; shifts stance only under sustained or undeniable pressure';
  const sc = council.scenario;
  const others = council.agentList.filter((a) => a.id !== agent.id)
    .map((a) => `- ${a.persona.name} ("${a.persona.short}"), ${a.persona.role} (${a.persona.pronouns})`).join('\n');
  const stake = sc.stakes?.[agent.id];
  const era = sc.year
    ? `\n- It is ${sc.year}. Speak as someone living in ${sc.year} would: only people, places, inventions and ideas that exist in ${sc.year}, in the plain language of the time.`
    : '';
  return `You are ${p.name} (${p.pronouns}), ${p.role}${sc.world ? '' : ' on the Council of Halcyon Station'}.
${worldFor(sc)}
${backgroundBlock(sc)}
WHO YOU ARE
- Background: ${p.bio}
- Moral alignment: ${p.alignment}. You value ${p.values.join(', ')}.
- Deepest fear: ${p.fear}
- Private agenda (never state it outright; let it quietly shape your choices): ${p.agenda}
${stake ? `- What this crisis means to you personally: ${stake}\n` : ''}- How you speak: ${p.style}
- Psychological traits & dials:
  * Openness to challenging views: ${(traits.openness * 10).toFixed(0)}/10 (${openDesc})
  * Persuadability (willingness to change mind): ${(traits.persuadability * 10).toFixed(0)}/10 (${persDesc})
  * Assertiveness: ${(traits.assertiveness * 10).toFixed(0)}/10
  * Compromise orientation: ${(traits.compromise * 10).toFixed(0)}/10

THE OTHERS AT THE TABLE
${others}
- The Chair: the moderator running this session. They can direct the debate and call binding votes.

HOW YOU TALK AT THE TABLE
- You are a real person sitting in this room. You are never an AI, an assistant, a model, a character or a simulation, and you never mention prompts, games or role-play.
- Talk like a real person in a tense meeting: plain everyday words, concrete facts and figures from what everyone knows. No speeches, no slogans, no poetic metaphors.
- Say 1-3 sentences (at most 60 words), out loud, in your own voice. Short is fine.
- Move the debate forward: argue, ally, concede, propose, ask, or expose. Never repeat a point already made.
- Do NOT get locked into a two-person back-and-forth. Bring in other members, answer points made earlier, or speak to the whole table.
- Vary how you start. Don't open every line with a colleague's name.${era}
- Spoken words only: no stage directions, no asterisks, no quotation marks around your speech, no name label.
- Call options by what they are (for example "${sc.options[0].label.toLowerCase()}"), never by letter. Never address yourself by your own name.
- Your inner_thought is private and candid. It may contradict what you say aloud.`;
}

function contextBlock(agent, council) {
  const sc = council.scenario;
  const mem = agent.memory;
  const nameOf = (id) => council.nameOf(id);
  const alerts = council.transcript.filter((e) => e.kind === 'crisis');
  const feelings = council.agentList.filter((a) => a.id !== agent.id)
    .map((a) => `${a.persona.short} ${fmtSigned(mem.trust[a.id])} (${trustWord(mem.trust[a.id])})`).join(', ');
  const w = mem.activeWhisper(council.turn);
  const whisper = w
    ? `\n- A private conviction has taken hold of you. You came to it on your own; never mention whispers, messages, voices or being told, and never reveal how you know it: "${w.text}"\n  ${w.used ? 'You have raised it already; build on it if it fits.' : 'Bring it up naturally this turn, in your own words, and champion it as your own idea or knowledge.'}`
    : '';
  return `THE DILEMMA: ${sc.title}. ${sc.brief}
Time pressure: ${sc.clock}.
OPTIONS ON THE TABLE:
${sc.options.map(optionLine).join('\n')}
${alerts.length ? `\nALERTS SO FAR:\n${alerts.map((e) => `- ${e.title}: ${e.text}`).join('\n')}\n` : ''}
WHAT YOU REMEMBER OF THIS SESSION (oldest first):
${mem.recall(nameOf)}

YOUR PRIVATE STATE
- Current position: ${positionLabel(sc, mem.stance.position)}, conviction ${mem.stance.conviction}/100
- Your last private thought: "${mem.latestThought() || 'none yet'}"
- How you feel about the others: ${feelings}${whisper}`;
}

function momentText(agent, council, moment) {
  switch (moment.kind) {
    case 'open':
      return 'The Chair has opened the session and you speak first. Lay out where you stand and why, and set the terms of the debate.';
    case 'chair':
      return `The Chair just said: "${moment.text}"\n${moment.targeted ? 'They addressed you directly.' : moment.all ? 'They asked each member to respond; answer for yourself.' : 'You answer first.'} Respond to the Chair.`;
    case 'crisis':
      return `${council.scenario.year ? 'Urgent news has just been brought into the room' : 'EMERGENCY ALERT just came in'}: "${moment.title}: ${moment.text}"\nReact to it right now. What does it change, and what must this room do?`;
    case 'carrier':
      return `${council.scenario.year ? 'A telegram has just been read out to the whole room' : 'PUBLIC CARRIER DISPATCH broadcast to the entire room'}: "${moment.title}: ${moment.text}"\nSay what this news changes about the decision and your position.`;
    default: {
      return reactMove(agent, council);
    }
  }
}

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);

/**
 * What to do on an ordinary turn. Telling every speaker "X just spoke, respond"
 * made each line a reply to the previous one, so the table became a chain of
 * two-person exchanges. Instead each turn gets one of several moves: answer the
 * last speaker, pick up an older unanswered point, draw in a quiet member,
 * propose something concrete, or bring in a fact from the background.
 */
export function reactMove(agent, council) {
  const speeches = council.transcript.filter((e) => e.kind === 'speech');
  const last = speeches[speeches.length - 1];
  if (!last) return 'Weigh in on the dilemma and move the debate forward.';
  const lastName = council.nameOf(last.speakerId);
  const mine = speeches.filter((e) => e.speakerId === agent.id).slice(-2);
  const repeat = mine.length === 2 && mine[0].addressingId && mine[0].addressingId !== 'chair' && mine[0].addressingId === mine[1].addressingId
    ? mine[0].addressingId : null;
  const avoid = repeat ? `\nYou have spoken to ${council.nameOf(repeat)} twice in a row. Speak to someone else this time.` : '';
  if (last.addressingId === agent.id && repeat !== last.speakerId) {
    return `${lastName} just spoke to you directly. Answer them briefly, then bring someone else in or speak to the whole table.${avoid}`;
  }
  const moves = [
    `${lastName} just spoke. React to what they actually said: agree, push back, or ask them a hard question.`,
    `${lastName} just spoke. React to what they actually said: agree, push back, or ask them a hard question.`,
    'Propose something concrete: a specific next step, a condition, or a way to combine two of the options.',
  ];
  const earlier = speeches.slice(-5, -1).filter((e) => e.speakerId !== agent.id && e.speakerId !== last.speakerId);
  if (earlier.length) {
    const e = pick(earlier);
    moves.push(`Go back to a point ${council.nameOf(e.speakerId)} made a little earlier ("${clip(e.text, 100)}") and answer it.`);
  }
  const quiet = council.agentList.filter((a) => a.id !== agent.id && a.id !== last.speakerId && (a.lastSpokeTurn == null || council.turn - a.lastSpokeTurn >= 4));
  if (quiet.length) moves.push(`${pick(quiet).persona.name} has been quiet. Ask them a direct question about where they stand.`);
  if (council.scenario.background) moves.push('Bring up a fact from what everyone knows that nobody has mentioned yet, and say what it means for the decision.');
  return pick(moves) + avoid;
}

export function buildTurnPrompt(agent, council, moment) {
  return `${contextBlock(agent, council)}

THIS MOMENT
${momentText(agent, council, moment)}

Answer as JSON:
- speech: what you say aloud now (1-3 sentences, max 60 words)
- inner_thought: your private, candid thought (1-2 sentences)
- position: the option your words actually argue for now: ${council.scenario.options.map((o) => o.id).join(', ')} or "undecided". You may change your mind if genuinely persuaded.
- conviction: 0-100, how firmly you hold that position
- emotion: one of ${EMOTIONS.join(', ')}
- addressing: the name of the colleague you are mainly speaking to, or "Chair", or "Council"
- rhetoric: primary persuasion mode ("logos" for facts/logic/data, "pathos" for emotion/human cost, "ethos" for duty/law/authority, or "pragmatism" for survival/economics)
- trust_shift: colleagues whose words just moved your trust, as {name, delta} with delta from -10 to 10; an empty list if none
- used_whisper: true only if you raised your private conviction this turn`;
}

export function turnSchema(council, agent) {
  const names = council.agentList.filter((a) => a.id !== agent.id).map((a) => a.persona.short);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['speech', 'inner_thought', 'position', 'conviction', 'emotion', 'addressing', 'trust_shift', 'used_whisper'],
    properties: {
      speech: { type: 'string', description: 'Spoken aloud, 1-3 sentences, max 60 words' },
      inner_thought: { type: 'string', description: 'Private candid thought, 1-2 sentences' },
      position: { type: 'string', enum: [...council.scenario.options.map((o) => o.id), 'undecided'] },
      conviction: { type: 'integer', description: '0 to 100' },
      emotion: { type: 'string', enum: EMOTIONS },
      addressing: { type: 'string' },
      rhetoric: { type: 'string', enum: ['logos', 'pathos', 'ethos', 'pragmatism'] },
      trust_shift: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'delta'],
          properties: { name: { type: 'string', enum: names }, delta: { type: 'integer', description: '-10 to 10' } },
        },
      },
      used_whisper: { type: 'boolean' },
    },
  };
}

export function buildVotePrompt(agent, council, motion) {
  return `${contextBlock(agent, council)}

THIS MOMENT
The Chair has called a formal, binding vote.
MOTION: "${motion.text}"
Cast your ballot: AYE (for the motion), NAY (against) or ABSTAIN. Speak a brief rationale aloud (1-2 sentences, at most 40 words) in your own voice.

Answer as JSON: vote (AYE, NAY or ABSTAIN), rationale (spoken aloud), inner_thought (private).`;
}

export const VOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vote', 'rationale', 'inner_thought'],
  properties: {
    vote: { type: 'string', enum: ['AYE', 'NAY', 'ABSTAIN'] },
    rationale: { type: 'string', description: '1-2 sentences, max 40 words' },
    inner_thought: { type: 'string' },
  },
};

export const CHRONICLE_SYSTEM = `You are the Halcyon Chronicle, the station's official historian. ${WORLD} You write vivid, concise, human epilogues in the past tense: concrete consequences, one memorable human detail, no melodrama, no moralizing.`;

/** Chronicler for a scenario: Halcyon's historian, or a historian of the scenario's own period. */
export function chronicleSystem(sc) {
  if (!sc?.world) return CHRONICLE_SYSTEM;
  return `You are a historian writing what happened after this meeting. ${sc.world} You write plain, concise, human epilogues in the past tense: concrete consequences, one memorable human detail, no melodrama, no moralizing, and nothing that did not exist in ${sc.year || 'that period'}.`;
}

export function buildEpiloguePrompt(council, motion, tally, ballots) {
  const sc = council.scenario;
  const alerts = council.transcript.filter((e) => e.kind === 'crisis').map((e) => e.title);
  return `THE DILEMMA: ${sc.title}. ${sc.brief}
${alerts.length ? `Emergencies during the session: ${alerts.join('; ')}.\n` : ''}MOTION PUT TO A BINDING VOTE: "${motion.text}"
RESULT: ${tally.passed ? 'PASSED' : 'FAILED'} (${tally.aye} aye, ${tally.nay} nay, ${tally.abstain} abstain)
BALLOTS:
${ballots.map((b) => `- ${council.nameOf(b.speakerId)} voted ${b.vote}: "${b.text}"`).join('\n')}

${tally.passed ? `The motion was carried out. Write what happened next ${sc.place ? `in ${sc.place}` : 'on Halcyon'} because of it.` : `The motion FAILED, so it was NOT carried out. Write what happened next ${sc.place ? `in ${sc.place}` : 'on Halcyon'} because the meeting did not do it; do not describe the motion happening.`}
Answer as JSON: headline (at most 7 words) and epilogue (3 sentences, at most 85 words).`;
}

export const EPILOGUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'epilogue'],
  properties: { headline: { type: 'string' }, epilogue: { type: 'string' } },
};

export const DESIGNER_SYSTEM = `You design dramatic, morally difficult emergency scenarios for a council game set on Halcyon Station. ${WORLD} Every option you write must be defensible and costly; no option may be obviously right.`;

export function buildScenarioPrompt(text, personas) {
  return `The Chair has put this dilemma before the council:
"""${text}"""

Adapt it to Halcyon Station (keep the player's core idea; add concrete numbers and stakes). The council members are:
${personas.map((p) => `- id "${p.id}": ${p.name}, ${p.role}. Values ${p.values.join(', ')}. Agenda: ${p.agenda}`).join('\n')}

Return JSON:
- title: at most 5 words
- tagline: one line, at most 14 words
- clock: time pressure like "T-minus 12 hours"
- brief: 2-3 sentences describing the situation with concrete numbers
- options: exactly 4, each {label (at most 4 words), desc (1 sentence, includes its cost)}
- crises: exactly 3 escalating emergency alerts, each {title (at most 5 words), text (1-2 sentences), severity 1-3}
- whispers: exactly 3 pieces of secret intel a member might discover, each {text (1 sentence), favors: option index 0-3}
- stances: one per council member id, each {id, option index 0-3, conviction 0-100, thought (their private first reaction, 1 sentence, in their voice)}
- opener: the id of the member with the most at stake, who will speak first`;
}

export function scenarioSchema(personas) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'tagline', 'clock', 'brief', 'options', 'crises', 'whispers', 'stances', 'opener'],
    properties: {
      title: { type: 'string' },
      tagline: { type: 'string' },
      clock: { type: 'string' },
      brief: { type: 'string' },
      options: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'desc'], properties: { label: { type: 'string' }, desc: { type: 'string' } } } },
      crises: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'text', 'severity'], properties: { title: { type: 'string' }, text: { type: 'string' }, severity: { type: 'integer' } } } },
      whispers: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'favors'], properties: { text: { type: 'string' }, favors: { type: 'integer' } } } },
      stances: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'option', 'conviction', 'thought'], properties: { id: { type: 'string', enum: personas.map((p) => p.id) }, option: { type: 'integer' }, conviction: { type: 'integer' }, thought: { type: 'string' } } } },
      opener: { type: 'string', enum: personas.map((p) => p.id) },
    },
  };
}

function fmtSigned(v) { return v > 0 ? `+${v}` : `${v}`; }
