/**
 * Turn-taking director: decides who speaks next without spending a model call.
 *
 * Scores every agent on being addressed, disagreement with the last speaker,
 * distrust of the last speaker, time since they last spoke, temperament
 * (assertiveness), an unspent whisper, and a little randomness, so the debate
 * feels reactive rather than round-robin.
 */

const ALL_PATTERN = /\b(everyone|every one of you|each of you|all of you|the whole council|council members|go around|round the table|around the table|final statements?|each member|all members)\b/i;

/** Which agents does a free-text line address by name? Returns ids in mention order. */
export function detectMentions(text, agents) {
  if (!text) return [];
  const lower = ` ${text.toLowerCase()} `;
  const hits = [];
  for (const a of agents) {
    let best = Infinity;
    for (const n of a.persona.matchNames) {
      const re = new RegExp(`[^a-z]${escapeRe(n.toLowerCase())}(?![a-z])`);
      const m = re.exec(lower);
      if (m && m.index < best) best = m.index;
    }
    if (best < Infinity) hits.push({ id: a.id, at: best });
  }
  return hits.sort((x, y) => x.at - y.at).map((h) => h.id);
}

export function addressesEveryone(text) {
  return ALL_PATTERN.test(text || '');
}

/** Resolve a model's free-form "addressing" field ("Delegate Ashworth", "Kestrel") to an agent id. */
export function resolveAddressee(value, agents, selfId) {
  if (!value || typeof value !== 'string') return null;
  if (/\b(chair|moderator)\b/i.test(value)) return 'chair';
  const ids = detectMentions(value, agents).filter((id) => id !== selfId);
  return ids[0] || null;
}

export function pickNextSpeaker(council, { exclude = [] } = {}) {
  // If in debate mode, alternate between the two stage debaters unless an audience member is called.
  if (council.mode === 'debate' && council.debaters && council.debaters.length === 2) {
    const last = council.lastSpeech();
    const [dA, dB] = council.debaters;
    if (!last || last.speakerId === dB) return council.agents.get(dA) || council.agentList[0];
    return council.agents.get(dB) || council.agentList[1];
  }

  const last = council.lastSpeech();
  const speeches = council.transcript.filter((e) => e.kind === 'speech');
  const recent = speeches.slice(-6);
  const prevSpeaker = speeches.length >= 2 ? speeches[speeches.length - 2].speakerId : null;
  const prevPrevSpeaker = speeches.length >= 3 ? speeches[speeches.length - 3].speakerId : null;
  const prev3Speaker = speeches.length >= 4 ? speeches[speeches.length - 4].speakerId : null;

  // Strict ping-pong breakout: if two agents have ping-ponged for 2 full cycles (A->B->A->B),
  // strictly exclude both of them to force other council members into the debate.
  const activeExclude = [...exclude];
  if (last && prevSpeaker && prevPrevSpeaker && prev3Speaker) {
    if (last.speakerId === prevPrevSpeaker && prevSpeaker === prev3Speaker) {
      activeExclude.push(last.speakerId, prevSpeaker);
    }
  }

  // How often each pair has been talking *to each other* lately (either direction).
  const pairCount = (x, y) => recent.filter((e) => (e.speakerId === x && e.addressingId === y) || (e.speakerId === y && e.addressingId === x)).length;

  // Why these weights: an earlier version leaned hard on "turns since you last
  // spoke" (0.55/turn plus an urgency ramp), which with a live model collapsed
  // into a fixed seven-seat rotation where everyone only answered the person
  // before them, so the same two rivals (Vance and Kestrel) sat next to each
  // other in the loop forever. Now silence is a gentle pull with a hard floor at
  // nine turns, and being addressed, disagreement and randomness pick the rest.
  let best = null;
  let bestScore = -Infinity;
  for (const a of council.agentList) {
    if (activeExclude.includes(a.id)) continue;
    let s = Math.random() * 2.4;
    const never = a.lastSpokeTurn == null;
    const since = never ? 8 : council.turn - a.lastSpokeTurn;
    s += Math.min(since, 8) * 0.15;
    if (never && council.turn >= 3) s += 1.2;
    if (since >= 9) s += (since - 8) * 1.2; // nobody stays silent for long
    s += (a.persona.traits?.assertiveness ?? a.persona.assertiveness ?? 0.6) * 0.9;

    // Hogging: two or more lines in the last six costs you.
    const mine6 = recent.filter((e) => e.speakerId === a.id).length;
    s -= Math.max(0, mine6 - 1) * 1.4;
    if (prevSpeaker === a.id) s -= 2.6; // no A-B-A

    if (last) {
      if (last.speakerId === a.id) s -= 100;
      const isAddressed = last.addressingId === a.id;
      const isMentioned = !isAddressed && detectMentions(last.text, [a]).length > 0;
      // A pair already locked in an exchange gets no bonus for being called out again.
      const locked = pairCount(a.id, last.speakerId) >= 2;
      if (isAddressed) s += locked ? -1.5 : 2.6;
      else if (isMentioned) s += locked ? -0.8 : 1.0;
      else if (locked) s -= 1.2;

      // Picking up a thread from a few turns back, not just the last line.
      if (recent.slice(-4, -1).some((e) => e.addressingId === a.id && e.speakerId !== a.id)) s += 0.5;

      const myPos = a.memory.stance.position;
      if (last.position && myPos !== last.position) s += (a.memory.stance.conviction / 100) * 1.2;
      const t = a.memory.trust[last.speakerId] ?? 0;
      if (t < -25) s += 0.5;
      if (t > 45 && myPos === last.position) s -= 0.5; // allies don't need to pile on every time
    }
    if (a.memory.hasUnusedWhisper()) s += 2.4;
    if (a.emotion === 'angry' || a.emotion === 'defiant') s += 0.5;
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best || council.agentList.find((a) => !activeExclude.includes(a.id)) || council.agentList[0];
}

/** Agents most shaken by a crisis respond first: those whose current option it hurts, then a mix of the rest. */
export function pickCrisisResponders(council, shift = {}, count = 2) {
  const recentSpeakers = council.transcript.filter((e) => e.kind === 'speech').slice(-2).map((e) => e.speakerId);
  return [...council.agentList]
    .map((a) => {
      const hit = shift[a.memory.stance.position] ?? 0;
      const bold = a.persona.traits?.assertiveness ?? a.persona.assertiveness ?? 0.6;
      const justSpoke = recentSpeakers.includes(a.id) ? 1.2 : 0;
      return { a, score: -hit * 0.06 + bold * 0.6 + Math.random() * 1.6 - justSpoke };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, count)
    .map((x) => x.a.id);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
