/**
 * Private cognitive memory stream for one council member (dual-channel cognition).
 *
 *  - episodic:  what this agent witnessed at the table (who said what, alerts, votes)
 *  - thoughts:  private inner monologue, which may contradict their public rhetoric
 *  - stance:    current position (option id or 'undecided') + conviction 0–100
 *  - trust:     affinity −100…+100 toward each peer (directional: A→B ≠ B→A)
 *  - whispers:  ideas the Chair implanted; the agent experiences them as its own
 *
 * DOM-free so the engine can run headless (see tests/engine.test.mjs).
 */
export class MemoryStream {
  constructor(selfId, peerIds, initialTrust = {}) {
    this.selfId = selfId;
    this.episodic = [];
    this.thoughts = [];
    this.stance = { position: 'undecided', conviction: 50 };
    this.stanceHistory = [];
    this.trust = {};
    for (const p of peerIds) this.trust[p] = initialTrust[p] ?? 0;
    this.trustHistory = [];
    this.whispers = [];
    this.usedLines = new Set();
  }

  observe(entry) {
    this.episodic.push(entry);
    if (this.episodic.length > 160) this.episodic.shift();
  }

  think(turn, text) {
    if (!text) return;
    this.thoughts.push({ turn, text });
    if (this.thoughts.length > 40) this.thoughts.shift();
  }

  latestThought() {
    return this.thoughts.length ? this.thoughts[this.thoughts.length - 1].text : '';
  }

  setStance(turn, position, conviction) {
    const prev = this.stance.position;
    this.stance = { position, conviction: clamp(Math.round(conviction), 0, 100) };
    this.stanceHistory.push({ turn, position, conviction: this.stance.conviction });
    return prev !== position;
  }

  shiftTrust(peerId, delta, turn) {
    if (!(peerId in this.trust) || !delta) return 0;
    const before = this.trust[peerId];
    this.trust[peerId] = clamp(Math.round(before + delta), -100, 100);
    const applied = this.trust[peerId] - before;
    if (applied) {
      this.trustHistory.push({ turn, peerId, delta: applied, value: this.trust[peerId] });
      if (this.trustHistory.length > 200) this.trustHistory.shift();
    }
    return applied;
  }

  implant(whisper) {
    this.whispers.push({ ...whisper, used: false, usedTurn: null, mentions: 0 });
  }

  /** The whisper the agent should be "thinking about": newest unused, else the newest recently used one. */
  activeWhisper(turn) {
    const unused = [...this.whispers].reverse().find((w) => !w.used);
    if (unused) return unused;
    const recent = [...this.whispers].reverse().find((w) => w.used && turn - (w.usedTurn ?? 0) <= 6);
    return recent || null;
  }

  hasUnusedWhisper() {
    return this.whispers.some((w) => !w.used);
  }

  /**
   * Render the episodic buffer for a prompt: the most recent `full` entries verbatim,
   * up to `gist` older ones compressed to a short line, the rest dropped.
   */
  recall(nameOf, { full = 14, gist = 10 } = {}) {
    const ep = this.episodic;
    const recent = ep.slice(-full);
    const older = ep.slice(Math.max(0, ep.length - full - gist), Math.max(0, ep.length - full));
    const lines = [];
    if (older.length) {
      lines.push('(earlier, in brief)');
      for (const e of older) lines.push(formatEntry(e, nameOf, 90));
      lines.push('(most recent)');
    }
    for (const e of recent) lines.push(formatEntry(e, nameOf));
    return lines.join('\n') || '(nothing has been said yet)';
  }

  snapshot() {
    return {
      stance: { ...this.stance },
      trust: { ...this.trust },
      thoughts: this.thoughts.slice(-8),
      whispers: this.whispers.map((w) => ({ ...w })),
      episodic: this.episodic.slice(-10),
      stanceHistory: this.stanceHistory.slice(-24),
    };
  }
}

function formatEntry(e, nameOf, max = 0) {
  const cut = (s) => (max && s.length > max ? `${s.slice(0, max - 1)}…` : s);
  switch (e.kind) {
    case 'self': return `[T${e.turn}] YOU said: "${cut(e.text)}"`;
    case 'speech': return `[T${e.turn}] ${nameOf(e.who)}: "${cut(e.text)}"`;
    case 'chair': return `[T${e.turn}] THE CHAIR: "${cut(e.text)}"`;
    case 'crisis': return `[T${e.turn}] !! EMERGENCY ALERT: ${e.title}. ${cut(e.text)}`;
    case 'vote': return `[T${e.turn}] VOTE RESULT: ${cut(e.text)}`;
    case 'ballot': return `[T${e.turn}] ${nameOf(e.who)} voted ${e.vote}: "${cut(e.text)}"`;
    default: return `[T${e.turn}] ${cut(e.text || '')}`;
  }
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}
