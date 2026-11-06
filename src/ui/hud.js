/**
 * HUD: every DOM surface of the game (start screen, top bar meters, transcript,
 * dilemma brief, mind inspector, subtitles, lever popovers, vote panel, modals,
 * toasts). It renders state it is handed and reports intent through callbacks;
 * it never mutates the council directly.
 */
import { OPTION_COLORS } from '../data/scenarios.js';
import { EMOTION_ICONS } from '../data/personas.js';

const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const optColor = (id) => OPTION_COLORS[id] || OPTION_COLORS.undecided;
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

const GLYPHS = {
  planet: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="8"/><ellipse cx="16" cy="16" rx="14" ry="4.5" transform="rotate(-18 16 16)"/></svg>',
  signal: '<svg viewBox="0 0 32 32"><path d="M16 5 21 16 16 27 11 16Z"/><path d="M6 10a13 13 0 0 0 0 12M26 10a13 13 0 0 1 0 12"/></svg>',
  spore: '<svg viewBox="0 0 32 32"><circle cx="12" cy="13" r="4"/><circle cx="21" cy="11" r="3"/><circle cx="19" cy="21" r="5"/><circle cx="9" cy="22" r="2"/></svg>',
  treaty: '<svg viewBox="0 0 32 32"><circle cx="12" cy="16" r="7"/><circle cx="20" cy="16" r="7"/></svg>',
  mind: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M6 16h4M22 16h4M16 6v4M16 22v4"/></svg>',
};

export class Hud {
  constructor(cb) {
    this.cb = cb; // { onConvene, onLever, onPlay, onStep, onPace, onCamera, onToggleMinds, onToggleWeb, onToggleVoice, onSettings, onHome, onSelect, onInspect }
    this.selected = null;
    this.subTimer = null;
    this.bindStatic();
  }

  // ------------------------------------------------------------------ static wiring
  bindStatic() {
    const cb = this.cb;
    $('#btnPlay').addEventListener('click', () => cb.onPlay());
    $('#btnStep').addEventListener('click', () => cb.onStep());
    $('#pace').addEventListener('input', (e) => cb.onPace(parseFloat(e.target.value)));
    $('#camModes').addEventListener('click', (e) => { const m = e.target.closest('button')?.dataset.mode; if (m) cb.onCamera(m); });
    $('#btnMinds').addEventListener('click', () => cb.onToggleMinds());
    $('#btnWeb').addEventListener('click', () => cb.onToggleWeb());
    $('#btnVoice').addEventListener('click', () => cb.onToggleVoice());
    $('#btnSettings').addEventListener('click', () => cb.onSettings());
    $('#enginePill').addEventListener('click', () => cb.onSettings());
    $('#btnHome').addEventListener('click', () => cb.onHome());
    $('#btnTheme')?.addEventListener('click', () => cb.onThemeToggle?.());
    document.querySelectorAll('.lever').forEach((b) => b.addEventListener('click', () => cb.onLever(b.dataset.lever)));
    document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && this.modalDismissable) this.closeModal(); });
  }

  showTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.id === `tab-${name}`));
  }

  // ------------------------------------------------------------ start screen
  renderStart({ scenarios, personas, health, settings }) {
    $('#castStrip').innerHTML = personas.map((p) => `
      <div class="cast-card" style="--c:${p.color}" title="Click to tune psychological traits"><b>${esc(p.name)}</b><span>${esc(p.role)}</span><em>${esc(p.alignment)}</em></div>`).join('');
    
    $('#castStrip').querySelectorAll('.cast-card').forEach((card, idx) => {
      card.style.cursor = 'pointer';
      card.onclick = () => {
        this.openTraitModal(personas[idx], (traitKey, val) => {
          if (!personas[idx].traits) personas[idx].traits = {};
          personas[idx].traits[traitKey] = val;
          if (this.cb.onTraitChange) this.cb.onTraitChange(personas[idx].id, traitKey, val);
        });
      };
    });

    const initScn = scenarios.find((s) => s.id === (settings.scenario || scenarios[0].id)) || scenarios[0];
    const initTheme = initScn.theme === 'boardroom1900' ? 'boardroom1900' : 'scifi';

    this.startChoice = {
      mode: 'council',
      theme: initTheme,
      debaters: [personas[0].id, personas[Math.min(5, personas.length - 1)].id],
      scenarioId: initScn.id,
      custom: false,
    };

    // Chamber Style selection (1900s Boardroom vs Sci-Fi Chamber)
    const themeCards = document.querySelectorAll('#themeGrid .theme-card');
    themeCards.forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.theme === this.startChoice.theme);
      btn.onclick = () => {
        themeCards.forEach((b) => b.classList.toggle('is-selected', b === btn));
        this.startChoice.theme = btn.dataset.theme;
        if (this.cb.onThemeChange) this.cb.onThemeChange(this.startChoice.theme);
      };
    });

    const updateThemeForScenario = (scId) => {
      const sc = scenarios.find((s) => s.id === scId);
      const chosenTheme = sc?.theme === 'boardroom1900' ? 'boardroom1900' : 'scifi';
      this.startChoice.theme = chosenTheme;
      themeCards.forEach((b) => b.classList.toggle('is-selected', b.dataset.theme === chosenTheme));
      if (this.cb.onThemeChange) this.cb.onThemeChange(chosenTheme);
    };

    // Mode selection (Council Chamber vs Debate Arena)
    const modeCards = document.querySelectorAll('#modeGrid .mode-card');
    const debateSetup = $('#debateSetup');
    const btnConvene = $('#btnConvene');

    modeCards.forEach((btn) => {
      btn.onclick = () => {
        modeCards.forEach((b) => b.classList.toggle('is-selected', b === btn));
        this.startChoice.mode = btn.dataset.mode;
        const isDebate = this.startChoice.mode === 'debate';
        debateSetup.classList.toggle('is-hidden', !isDebate);
        btnConvene.textContent = isDebate ? 'Launch Debate Arena' : 'Convene the Council';
      };
    });

    // Debater pickers
    const selD1 = $('#debater1');
    const selD2 = $('#debater2');
    const juryEl = $('#debateJuryPreview');
    const renderJury = () => {
      const d1 = selD1.value;
      const d2 = selD2.value;
      this.startChoice.debaters = [d1, d2];
      const jury = personas.filter((p) => p.id !== d1 && p.id !== d2);
      juryEl.innerHTML = `<b>Audience Jury (${jury.length} listening):</b> ${jury.map((p) => `<span style="color:${p.color};margin-right:8px">● ${esc(p.short)}</span>`).join('')}`;
    };

    if (selD1 && selD2) {
      selD1.innerHTML = personas.map((p, i) => `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>${esc(p.name)} (${esc(p.role)})</option>`).join('');
      selD2.innerHTML = personas.map((p, i) => `<option value="${p.id}" ${i === 5 ? 'selected' : ''}>${esc(p.name)} (${esc(p.role)})</option>`).join('');
      selD1.onchange = () => {
        if (selD1.value === selD2.value) {
          selD2.value = personas.find((p) => p.id !== selD1.value).id;
        }
        renderJury();
      };
      selD2.onchange = () => {
        if (selD2.value === selD1.value) {
          selD1.value = personas.find((p) => p.id !== selD2.value).id;
        }
        renderJury();
      };
      renderJury();
    }

    const grid = $('#scenarioGrid');
    grid.innerHTML = scenarios.map((s, i) => `
      <button class="scn${s.id === this.startChoice.scenarioId ? ' is-selected' : ''}" data-id="${s.id}">
        <div class="scn-top">
          <span class="scn-glyph">${GLYPHS[s.glyph] || GLYPHS.planet}</span>
          ${s.theme === 'boardroom1900' ? '<span class="theme-chip-1900">1900s Boardroom</span>' : ''}
          <span class="scn-clock">${esc(s.clock)}</span>
        </div>
        <b>${esc(s.title)}</b><p>${esc(s.tagline)}</p>
      </button>`).join('');
    const showDetail = (id) => { $('#scenarioDetail').innerHTML = scenarioDetailHtml(scenarios.find((s) => s.id === id)); };
    showDetail(this.startChoice.scenarioId);
    const custom = $('#customCard');
    const ta = $('#customPrompt');
    grid.onclick = (e) => {
      const card = e.target.closest('.scn');
      if (!card) return;
      grid.querySelectorAll('.scn').forEach((c) => c.classList.toggle('is-selected', c === card));
      custom.classList.remove('is-selected');
      this.startChoice.scenarioId = card.dataset.id;
      this.startChoice.custom = false;
      updateThemeForScenario(card.dataset.id);
      showDetail(card.dataset.id);
    };
    ta.oninput = () => {
      const has = ta.value.trim().length > 0;
      custom.classList.toggle('is-selected', has);
      grid.querySelectorAll('.scn').forEach((c) => c.classList.toggle('is-selected', !has && c.dataset.id === this.startChoice.scenarioId));
      this.startChoice.custom = has;
    };
    this.renderEngines(health, settings);
    $('#startVoices').checked = settings.voices;
    $('#startMinds').checked = settings.minds;
    btnConvene.onclick = () => {
      this.cb.onConvene({
        mode: this.startChoice.mode,
        theme: this.startChoice.theme,
        debaters: this.startChoice.mode === 'debate' ? this.startChoice.debaters : null,
        scenarioId: this.startChoice.scenarioId,
        customText: this.startChoice.custom ? ta.value.trim() : '',
        voices: $('#startVoices').checked,
        minds: $('#startMinds').checked,
      });
    };
  }

  renderEngines(health, settings) {
    const o = health.ollama;
    const ollamaModels = o.models || [];
    const claude = health.claude || { models: [] };
    const box = $('#engineGrid');
    const ollamaStatus = o.ok ? (ollamaModels.length ? 'ok' : 'warn') : 'bad';
    box.innerHTML = `
      <div class="eng${settings.engine === 'ollama' ? ' is-selected' : ''}" data-engine="ollama" role="button" tabindex="0">
        <div class="eng-head"><i class="${ollamaStatus}"></i>Local GPU (Ollama)</div>
        <p>${o.ok ? `${ollamaModels.length} local model${ollamaModels.length === 1 ? '' : 's'} found. Private, free, runs on your graphics card.` : 'Ollama is not reachable on this machine. Start it with <code>ollama serve</code>.'}</p>
        ${ollamaModels.length ? `<select class="sel" id="ollamaModel">${ollamaModels.map((m) => `<option value="${esc(m.name)}" ${m.name === settings.ollamaModel ? 'selected' : ''}>${esc(m.name)} ${m.params ? `· ${esc(m.params)}` : ''}${m.name === o.recommended ? ' · recommended' : ''}</option>`).join('')}</select>` : ''}
      </div>
      <div class="eng${settings.engine === 'claude' ? ' is-selected' : ''}" data-engine="claude" role="button" tabindex="0">
        <div class="eng-head"><i class="${claude.envCredentials || settings.apiKey ? 'ok' : 'warn'}"></i>Claude (Anthropic API)</div>
        <p>${claude.envCredentials ? 'Server credentials detected.' : 'Uses ANTHROPIC_API_KEY or an <code>ant auth</code> profile on the server, or paste a key below (kept in this browser, sent only to your local server).'}</p>
        <select class="sel" id="claudeModel">${claude.models.map((m) => `<option value="${m.id}" ${m.id === settings.claudeModel ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
        ${claude.envCredentials ? '' : `<input class="field" id="claudeKey" type="password" placeholder="sk-ant-… (optional)" value="${esc(settings.apiKey || '')}" autocomplete="off" />`}
      </div>
      <div class="eng${settings.engine === 'offline' ? ' is-selected' : ''}" data-engine="offline" role="button" tabindex="0">
        <div class="eng-head"><i class="ok"></i>Offline scripted</div>
        <p>No model needed. A rule-based engine with hand-written voices for every member. Good for a quick look; far less surprising.</p>
      </div>`;
    box.querySelectorAll('.eng').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('select, input')) return;
        box.querySelectorAll('.eng').forEach((x) => x.classList.toggle('is-selected', x === el));
        settings.engine = el.dataset.engine;
      });
    });
    $('#ollamaModel', box)?.addEventListener('change', (e) => { settings.ollamaModel = e.target.value; });
    $('#claudeModel', box)?.addEventListener('change', (e) => { settings.claudeModel = e.target.value; });
    $('#claudeKey', box)?.addEventListener('input', (e) => { settings.apiKey = e.target.value.trim(); });
  }

  hideStart() {
    const s = $('#startScreen');
    s.classList.add('is-leaving');
    setTimeout(() => s.classList.add('is-hidden'), 800);
    $('#hud').classList.remove('is-hidden');
  }

  showStart() {
    const s = $('#startScreen');
    s.classList.remove('is-hidden');
    requestAnimationFrame(() => s.classList.remove('is-leaving'));
    $('#hud').classList.add('is-hidden');
  }

  loading(text) {
    $('#loading').classList.toggle('is-hidden', !text);
    if (text) $('#loadingText').textContent = text;
  }

  // ------------------------------------------------------------------ session setup
  beginSession(council) {
    const sc = council.scenario;
    $('#scenarioTitle').textContent = sc.title;
    $('#scenarioClock').textContent = sc.clock;
    $('#transcript').innerHTML = '';
    this.selected = null;
    this.renderBrief(council);
    this.renderInspector(council);
    this.updateMeters(council);
    this.hideSubtitle(true);
    $('#votePanel').classList.add('is-hidden');
    $('#alertBanner').classList.add('is-hidden');
    this.closePopover();
    this.showTab('transcript');
  }

  renderBrief(council) {
    const sc = council.scenario;
    const cons = council.consensus();
    $('#brief').innerHTML = `
      <h3>${esc(sc.title)}</h3>
      <p class="tagline">${esc(sc.tagline)}</p>
      ${sc.world ? `<div class="brief-setting">${esc(sc.world)}</div>` : ''}
      <div class="brief-text">${esc(sc.brief)}</div>
      ${sc.options.map((o) => `
        <div class="opt">
          <div class="opt-id" style="background:${optColor(o.id)}">${o.id}</div>
          <div><b>${esc(o.label)}</b><span>${esc(o.desc)}</span>
            <div class="who">${(cons[o.id] || []).map((id) => { const a = council.agents.get(id); return `<i style="--c:${a.persona.color}">${esc(a.persona.short)}</i>`; }).join('')}</div>
          </div>
        </div>`).join('')}
      ${backgroundHtml(sc)}
      ${sc.stakes ? `<h4 class="brief-h">What it means to each of them</h4><ul class="brief-stakes">${council.agentList.filter((a) => sc.stakes[a.id]).map((a) => `<li style="--c:${a.persona.color}"><b>${esc(a.persona.short)}</b> ${esc(sc.stakes[a.id])}</li>`).join('')}</ul>` : ''}`;
  }

  updateMeters(council) {
    const cons = council.consensus();
    const total = council.agentList.length;
    const parts = [...council.scenario.options.map((o) => o.id), 'undecided']
      .filter((k) => cons[k]?.length)
      .map((k) => {
        const names = cons[k].map((id) => council.agents.get(id).persona.short).join(', ');
        const label = k === 'undecided' ? '?' : k;
        return `<div class="seg-part" style="flex-grow:${cons[k].length};background:${optColor(k)}" title="${esc(k === 'undecided' ? 'Undecided' : council.scenario.options.find((o) => o.id === k).label)}: ${esc(names)}">${label}·${cons[k].length}</div>`;
      });
    $('#consensus').innerHTML = parts.join('') || `<div class="seg-part" style="flex-grow:${total}"></div>`;
    $('#tensionFill').style.width = `${council.tension}%`;
    $('#tensionFill').style.backgroundPosition = `${-council.tension * 2}px 0`;
    $('#tensionVal').textContent = Math.round(council.tension);
  }

  setAuto(on) {
    const b = $('#btnPlay');
    b.classList.toggle('is-running', on);
    $('.label', b).textContent = on ? 'Pause' : 'Run debate';
  }

  setCameraMode(mode) {
    document.querySelectorAll('#camModes button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
  }

  setToggle(id, on) { $(id).setAttribute('aria-pressed', String(on)); }

  setEngine(settings, busy = false) {
    const pill = $('#enginePill');
    const name = settings.engine === 'ollama' ? (settings.ollamaModel || 'ollama') : settings.engine === 'claude' ? settings.claudeModel : 'offline scripted';
    $('span', pill).textContent = name;
    pill.classList.toggle('ok', settings.engine !== 'offline' && !busy);
    pill.classList.toggle('busy', busy);
  }

  setLeversEnabled(on) {
    document.querySelectorAll('.lever, #btnPlay, #btnStep').forEach((b) => { b.disabled = !on; });
  }

  // ------------------------------------------------------------------ transcript
  addEntry(e, council) {
    const box = $('#transcript');
    const el = document.createElement('div');
    const a = e.speakerId ? council.agents.get(e.speakerId) : null;
    const p = a?.persona;
    el.className = `entry ${e.kind === 'ballot' ? 'ballot-entry' : e.kind}`;
    if (p) el.style.setProperty('--c', p.color);
    const time = `T${e.turn}`;
    switch (e.kind) {
      case 'speech': {
        const chips = [];
        if (e.prevPosition !== e.position) chips.push(`<span class="chip shift">${esc(e.prevPosition === 'undecided' ? '?' : e.prevPosition)} → <span class="sw" style="background:${optColor(e.position)}"></span>${esc(e.position)}</span>`);
        else chips.push(`<span class="chip"><span class="sw" style="background:${optColor(e.position)}"></span>${esc(e.position)} · ${e.conviction}%</span>`);
        if (e.rhetoric) chips.push(`<span class="rhetoric-tag rhetoric-${e.rhetoric}">${esc(e.rhetoric)}</span>`);
        if (e.championed) chips.push('<span class="chip champ">✶ voicing your whisper</span>');
        if (e.source === 'offline' && council.llm?.online) chips.push('<span class="chip src">scripted</span>');
        const swaysHtml = e.sways?.length ? `<div class="sway-list">${e.sways.map((s) => `<div class="sway-item ${s.flipped ? 'flipped' : s.backfired ? 'backfired' : ''}"><span>${s.flipped ? '✦' : s.backfired ? '▼' : '·'}</span><b>${esc(s.name)}</b><span>${esc(s.reason)}</span></div>`).join('')}</div>` : '';
        el.innerHTML = `<div class="entry-head"><span class="entry-name">${esc(p.name)}</span><span>${EMOTION_ICONS[e.emotion] || ''} ${esc(e.emotion)}</span><span class="entry-meta">${time}</span></div>
          <div class="entry-text">${esc(e.text)}</div>
          ${e.thought ? `<div class="entry-thought">${esc(e.thought)}</div>` : ''}
          <div class="entry-chips">${chips.join('')}</div>
          ${swaysHtml}`;
        break;
      }
      case 'chair':
        el.innerHTML = `<div class="entry-head"><span class="entry-name">THE CHAIR</span><span class="entry-meta">${time}</span></div><div class="entry-text">${esc(e.text)}</div>`;
        break;
      case 'carrier':
        el.innerHTML = `<div class="entry-head"><span class="entry-name" style="color:#5fe1ff">🛰️ CARRIER DISPATCH</span><span class="entry-meta">${time} · public broadcast</span></div><div class="entry-text"><b>${esc(e.title)}.</b> ${esc(e.text)}</div>${e.favors ? `<div class="entry-chips"><span class="carrier-tag">Favors Option ${esc(e.favors)}</span></div>` : ''}`;
        break;
      case 'crisis':
        el.innerHTML = `<div class="entry-head"><span class="entry-name">⚠ EMERGENCY ALERT</span><span class="entry-meta">${time}</span></div><div class="entry-text"><b>${esc(e.title)}.</b> ${esc(e.text)}</div>`;
        break;
      case 'whisper':
        el.innerHTML = `<div class="entry-head"><span class="entry-name">✶ YOU WHISPERED TO ${esc(p.short.toUpperCase())}</span><span class="entry-meta">${time} · private</span></div><div class="entry-text">${esc(e.text)}</div>`;
        break;
      case 'ballot':
        el.innerHTML = `<div class="entry-head"><span class="entry-name">${esc(p.name)}</span><span class="ballot ballot-${e.vote.toLowerCase()}">${e.vote}</span><span class="entry-meta">${time}</span></div>
          <div class="entry-text">${esc(e.text)}</div>${e.thought ? `<div class="entry-thought">${esc(e.thought)}</div>` : ''}`;
        break;
      case 'vote':
        el.innerHTML = `<div class="entry-head"><span class="entry-name" style="color:var(--cyan)">VOTE ${e.tally.passed ? 'PASSED' : 'FAILED'}</span><span class="entry-meta">${e.tally.aye}–${e.tally.nay}–${e.tally.abstain}</span></div>
          <div class="entry-text">${esc(e.motion.text)}</div><div class="entry-thought" style="border-color:rgba(255,180,92,.5);color:#e2d6bd">${esc(e.epilogue.headline)}: ${esc(e.epilogue.epilogue)}</div>`;
        break;
      default:
        el.innerHTML = `<div class="entry-text">${esc(e.text)}</div>`;
    }
    const nearBottom = box.parentElement.scrollHeight - box.parentElement.scrollTop - box.parentElement.clientHeight < 140;
    box.appendChild(el);
    if (nearBottom) box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  // ------------------------------------------------------------------ inspector
  renderInspector(council, id = this.selected) {
    this.selected = id;
    const box = $('#inspector');
    if (!id) {
      box.innerHTML = `<div class="insp-sec"><h4>MIND INSPECTOR</h4><div class="insp-empty">Select a council member, here or by clicking them in the chamber, to open their private memory stream: inner monologue, hidden agenda, trust and every idea you've planted.</div>
        <div class="insp-roster">${council.agentList.map((a) => `
          <button class="roster-row" data-id="${a.id}" style="--c:${a.persona.color}"><span class="dot"></span><span><b>${esc(a.persona.name)}</b><small>${esc(a.persona.role)}</small></span>
          <span class="plate-chip" style="background:${optColor(a.memory.stance.position)}">${a.memory.stance.position === 'undecided' ? '?' : a.memory.stance.position}</span></button>`).join('')}</div></div>`;
      box.querySelectorAll('.roster-row').forEach((b) => b.addEventListener('click', () => this.cb.onSelect(b.dataset.id)));
      return;
    }
    const a = council.agents.get(id);
    const p = a.persona;
    const m = a.memory;
    const opt = council.scenario.options.find((o) => o.id === m.stance.position);
    const thoughts = m.thoughts.slice(0, -1).slice(-5).reverse();
    const nameOf = (pid) => council.agents.get(pid)?.persona.short || pid;
    const peers = council.agentList.filter((x) => x.id !== id);
    const scroll = box.scrollTop;
    box.innerHTML = `
      <div class="insp-head" style="--c:${p.color}">
        <div class="insp-avatar">${esc(p.short.slice(0, 2).toUpperCase())}</div>
        <div><div class="insp-name">${esc(!p.title || p.name.startsWith(p.title) ? p.name : `${p.title} ${p.name}`)}</div><div class="insp-role">${esc(p.role)} · ${esc(p.pronouns)}</div><span class="insp-align">${esc(p.alignment)}</span></div>
        <button class="icon-btn" data-act="close" title="Back to roster"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="insp-sec"><h4>PUBLIC STANCE <span style="margin-left:auto;color:var(--muted);letter-spacing:0;font-family:var(--font)">${EMOTION_ICONS[a.emotion] || ''} ${esc(a.emotion)}</span></h4>
        <div class="stance-row"><div class="stance-chip" style="background:${optColor(m.stance.position)}">${opt ? opt.id : '?'}</div>
          <div><div class="stance-label">${esc(opt ? opt.label : 'Undecided')}</div><div class="conv"><i style="width:${m.stance.conviction}%;background:${optColor(m.stance.position)}"></i></div></div></div>
        <div class="history" title="Stance over time">${m.stanceHistory.slice(-28).map((h) => `<i style="background:${optColor(h.position)};opacity:${0.35 + h.conviction / 160}" title="T${h.turn}: ${h.position} ${h.conviction}%"></i>`).join('')}</div>
      </div>
      <div class="insp-sec"><h4>INNER MONOLOGUE <span class="lock">private</span></h4>
        <p class="thought-now">${esc(m.latestThought() || '…')}</p>
        ${thoughts.length ? `<ul class="thought-list">${thoughts.map((t) => `<li><b>T${t.turn}</b>${esc(t.text)}</li>`).join('')}</ul>` : ''}
      </div>
      ${council.scenario.stakes?.[id] ? `<div class="insp-sec"><h4>WHAT'S AT STAKE FOR THEM</h4><p class="agenda">${esc(council.scenario.stakes[id])}</p></div>` : ''}
      <div class="insp-sec"><h4>HIDDEN AGENDA <span class="lock">private</span></h4><p class="agenda">${esc(p.agenda)}</p></div>
      <div class="insp-sec">
        <h4>PSYCHOLOGICAL TRAITS &amp; DIALS <span class="lock">tune live</span></h4>
        <div class="trait-dials">
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🌐 Openness to Challenging Views</span>
              <span class="trait-val" id="val-openness">${Math.round((p.traits?.openness ?? 0.5) * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="openness" min="5" max="95" step="5" value="${Math.round((p.traits?.openness ?? 0.5) * 100)}" />
            <div class="trait-scale"><span>Entrenched / Resistant</span><span>Receptive / Curious</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🔄 Persuadability (Change Mind)</span>
              <span class="trait-val" id="val-persuadability">${Math.round((p.traits?.persuadability ?? 0.5) * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="persuadability" min="5" max="95" step="5" value="${Math.round((p.traits?.persuadability ?? 0.5) * 100)}" />
            <div class="trait-scale"><span>Immovable Rock</span><span>Easily Swayed</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">⚡ Assertiveness &amp; Voice Dominance</span>
              <span class="trait-val" id="val-assertiveness">${Math.round((p.traits?.assertiveness ?? 0.6) * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="assertiveness" min="5" max="95" step="5" value="${Math.round((p.traits?.assertiveness ?? 0.6) * 100)}" />
            <div class="trait-scale"><span>Soft-Spoken / Yielding</span><span>Commanding / Forceful</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🤝 Compromise Orientation</span>
              <span class="trait-val" id="val-compromise">${Math.round((p.traits?.compromise ?? 0.5) * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="compromise" min="5" max="95" step="5" value="${Math.round((p.traits?.compromise ?? 0.5) * 100)}" />
            <div class="trait-scale"><span>Dogmatic Zealot</span><span>Conciliatory Mediator</span></div>
          </div>
        </div>
      </div>
      <div class="insp-sec"><h4>TRUST &amp; AFFINITY</h4>
        ${peers.map((o) => {
          const v = m.trust[o.id] ?? 0;
          const w = Math.abs(v) / 2;
          const style = v >= 0 ? `left:50%;width:${w}%;background:var(--green)` : `right:50%;width:${w}%;background:var(--red)`;
          return `<div class="trust-row"><span style="color:${o.persona.color}">${esc(o.persona.short)}</span><div class="trust-bar"><i style="${style}"></i></div><b style="color:${v >= 0 ? 'var(--green)' : 'var(--red)'}">${signed(v)}</b></div>`;
        }).join('')}
      </div>
      <div class="insp-sec"><h4>IMPLANTED IDEAS <span class="lock">your whispers</span></h4>
        ${m.whispers.length ? m.whispers.map((w) => `<div class="whisper-item">${esc(w.text)}<span class="st ${w.used ? '' : 'latent'}">${w.used ? `✶ championed at T${w.usedTurn}${w.mentions ? ` · raised ${w.mentions + 1}×` : ''}` : '◌ latent, not yet voiced'}</span></div>`).join('') : '<div class="insp-empty" style="padding:0">None yet. Use the Whisper lever to seed an idea they will believe is their own.</div>'}
      </div>
      <div class="insp-sec"><h4>EPISODIC BUFFER</h4>
        <div class="episodic">${m.episodic.slice(-9).map((e) => `<div>${esc(episodicLine(e, nameOf))}</div>`).join('') || 'Nothing yet.'}</div>
      </div>
      <div class="insp-actions">
        <button class="btn amber" data-act="ask">Ask ${esc(p.short)}</button>
        <button class="btn violet" data-act="whisper">Whisper to ${esc(p.short)}</button>
        <button class="btn ghost" data-act="look">Look</button>
      </div>`;
    box.scrollTop = scroll;
    box.querySelectorAll('.trait-slider').forEach((slider) => {
      slider.oninput = (e) => {
        const traitKey = e.target.dataset.trait;
        const val = Number(e.target.value) / 100;
        const labelEl = box.querySelector(`#val-${traitKey}`);
        if (labelEl) labelEl.textContent = `${e.target.value}%`;
        if (p.traits) p.traits[traitKey] = val;
        if (this.cb.onTraitChange) this.cb.onTraitChange(id, traitKey, val);
      };
    });
    box.querySelector('[data-act=close]').onclick = () => this.cb.onSelect(null);
    box.querySelector('[data-act=ask]').onclick = () => this.cb.onLever('gavel', { target: id });
    box.querySelector('[data-act=whisper]').onclick = () => this.cb.onLever('whisper', { target: id });
    box.querySelector('[data-act=look]').onclick = () => this.cb.onInspect(id);
  }

  openTraitModal(persona, onUpdate) {
    const p = persona;
    const tr = p.traits || { openness: 0.5, persuadability: 0.5, assertiveness: 0.6, compromise: 0.5 };
    const html = `
      <div class="popover-head" style="--c:${p.color};padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:14px">
        <span class="whisper-tag">PSYCHOLOGICAL PROFILE &amp; TRAITS</span>
        <h2 style="margin:6px 0 2px">${esc(p.title)} ${esc(p.name)}</h2>
        <p style="color:var(--dim);margin:0;font-size:13px">${esc(p.role)} · ${esc(p.alignment)}</p>
      </div>
      <div>
        <div class="trait-dials-modal">
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🌐 Openness to Challenging Views</span>
              <span class="trait-val" id="pop-val-openness">${Math.round(tr.openness * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="openness" min="5" max="95" step="5" value="${Math.round(tr.openness * 100)}" />
            <div class="trait-scale"><span>Entrenched / Resistant</span><span>Receptive / Curious</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🔄 Persuadability (Willingness to Change Mind)</span>
              <span class="trait-val" id="pop-val-persuadability">${Math.round(tr.persuadability * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="persuadability" min="5" max="95" step="5" value="${Math.round(tr.persuadability * 100)}" />
            <div class="trait-scale"><span>Immovable Rock</span><span>Easily Swayed</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">⚡ Assertiveness &amp; Voice Dominance</span>
              <span class="trait-val" id="pop-val-assertiveness">${Math.round(tr.assertiveness * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="assertiveness" min="5" max="95" step="5" value="${Math.round(tr.assertiveness * 100)}" />
            <div class="trait-scale"><span>Soft-Spoken / Yielding</span><span>Commanding / Forceful</span></div>
          </div>
          <div class="trait-dial">
            <div class="trait-header">
              <span class="trait-name">🤝 Compromise Orientation</span>
              <span class="trait-val" id="pop-val-compromise">${Math.round(tr.compromise * 100)}%</span>
            </div>
            <input type="range" class="trait-slider" data-trait="compromise" min="5" max="95" step="5" value="${Math.round(tr.compromise * 100)}" />
            <div class="trait-scale"><span>Dogmatic Zealot</span><span>Conciliatory Mediator</span></div>
          </div>
        </div>
        <div style="margin-top:20px;text-align:right">
          <button class="btn primary" id="btnDoneTraits" style="min-width:100px">Done</button>
        </div>
      </div>`;
    this.modal(html, {
      dismissable: true,
      onMount: (card) => {
        card.querySelectorAll('.trait-slider').forEach((sl) => {
          sl.oninput = (e) => {
            const k = e.target.dataset.trait;
            const v = Number(e.target.value) / 100;
            const l = card.querySelector(`#pop-val-${k}`);
            if (l) l.textContent = `${e.target.value}%`;
            onUpdate(k, v);
          };
        });
        const btn = card.querySelector('#btnDoneTraits');
        if (btn) btn.onclick = () => this.closeModal();
      },
    });
  }

  showReassembleBanner(title, text, hoursLater = 5) {
    const el = $('#reassembleBanner');
    if (!el) return;
    el.innerHTML = `
      <div class="rb-inner">
        <div class="rb-clock">⏳ REASSEMBLING ${hoursLater} HOURS LATER</div>
        <div class="rb-title">${esc(title)}</div>
        <div class="rb-text">${esc(text)}</div>
      </div>`;
    el.classList.remove('is-hidden');
    setTimeout(() => {
      el.classList.add('is-hidden');
    }, 5500);
  }

  // ------------------------------------------------------------------ subtitles
  showSubtitle(entry, persona, { minds, chair = false } = {}) {
    clearTimeout(this.subTimer);
    const box = $('#subtitle');
    box.classList.remove('is-hidden', 'show-thought', 'chair');
    void box.offsetWidth; // restart entrance animation
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
    box.classList.toggle('chair', chair);
    box.style.setProperty('--c', chair ? 'var(--amber)' : persona.color);
    $('.sub-name', box).textContent = chair ? 'THE CHAIR' : (!persona.title || persona.name.startsWith(persona.title) ? persona.name : `${persona.title} ${persona.name}`);
    $('.sub-role', box).textContent = chair ? '' : entry.kind === 'ballot' ? `casts ${entry.vote}` : persona.role;
    $('.sub-tag', box).textContent = entry.championed ? '✶ voicing your whisper' : '';
    $('.sub-thought', box).textContent = entry.thought ? `thinks: ${entry.thought}` : '';
    const textEl = $('.sub-text', box);
    const full = entry.text;
    textEl.textContent = '';
    let shown = 0;
    let floor = 0;
    let raf = null;
    let startAt = 0;
    let dur = 3000;
    const render = () => { textEl.textContent = full.slice(0, shown); };
    const tick = (now) => {
      const byTime = Math.floor(((now - startAt) / dur) * full.length);
      shown = Math.min(full.length, Math.max(shown, byTime, floor));
      render();
      if (shown < full.length) raf = requestAnimationFrame(tick);
    };
    const ctl = {
      start(ms) { dur = Math.max(400, ms); startAt = performance.now(); raf = requestAnimationFrame(tick); },
      boundary(i) { floor = Math.max(floor, Math.min(full.length, i + 1)); },
      finish() {
        cancelAnimationFrame(raf); shown = full.length; render();
        if (minds && entry.thought) box.classList.add('show-thought');
      },
      cut() {
        cancelAnimationFrame(raf);
        textEl.innerHTML = `${esc(full.slice(0, Math.max(shown, 1)))}<span class="cut">—</span>`;
      },
    };
    if (chair) { textEl.textContent = full; }
    return ctl;
  }

  hideSubtitle(now = false, delay = 5000) {
    clearTimeout(this.subTimer);
    const go = () => $('#subtitle').classList.add('is-hidden');
    if (now) go(); else this.subTimer = setTimeout(go, delay);
  }

  alert(title, text) {
    const el = $('#alertBanner');
    el.innerHTML = `<div class="k">⚠ EMERGENCY ALERT</div><div class="t">${esc(title)}</div><div class="d">${esc(text)}</div>`;
    el.classList.remove('is-hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => el.classList.add('is-hidden'), 7000);
  }

  // ------------------------------------------------------------------ vote panel
  showVotePanel(council, motion) {
    const el = $('#votePanel');
    el.innerHTML = `<div class="vp-k">BINDING VOTE IN PROGRESS</div><div class="vp-motion">${esc(motion.text)}</div>
      <div class="vp-slots">${council.agentList.map((a) => `<div class="vp-slot" data-id="${a.id}" style="--c:${a.persona.color}"><i></i>${esc(a.persona.short)}<b>…</b></div>`).join('')}</div>
      <div class="vp-status" id="vpStatus">Members are deliberating in private…</div>`;
    el.classList.remove('is-hidden');
  }

  voteSlot(id, state, vote) {
    const s = document.querySelector(`.vp-slot[data-id="${id}"]`);
    if (!s) return;
    if (state === 'ready') { s.classList.add('ready'); $('b', s).textContent = 'sealed'; }
    if (state === 'cast') { s.classList.add(vote); $('b', s).textContent = vote; }
  }

  voteStatus(text) { const el = $('#vpStatus'); if (el) el.textContent = text; }

  hideVotePanel() { $('#votePanel').classList.add('is-hidden'); }

  // ------------------------------------------------------------------ popovers
  openPopover(html, onMount) {
    const pop = $('#popover');
    pop.innerHTML = html;
    pop.classList.remove('is-hidden');
    pop.style.animation = 'none';
    void pop.offsetWidth;
    pop.style.animation = '';
    document.body.classList.add('pop-open');
    onMount?.(pop);
    const first = pop.querySelector('textarea, input');
    first?.focus();
  }

  closePopover() {
    $('#popover').classList.add('is-hidden');
    document.body.classList.remove('pop-open');
    document.querySelectorAll('.lever').forEach((l) => l.classList.remove('is-open'));
    this.openLever = null;
  }

  markLever(name) {
    document.querySelectorAll('.lever').forEach((l) => l.classList.toggle('is-open', l.dataset.lever === name));
    this.openLever = name;
  }

  // ------------------------------------------------------------------ modal + toasts
  modal(html, { dismissable = true, onMount } = {}) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card">${html}</div>`;
    m.classList.remove('is-hidden');
    this.modalDismissable = dismissable;
    onMount?.(m);
  }

  closeModal() { $('#modal').classList.add('is-hidden'); }

  get modalOpen() { return !$('#modal').classList.contains('is-hidden'); }

  toast(text, level = 'info', ms = 5200) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${level}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
  }
}

function episodicLine(e, nameOf) {
  const cut = (s, n = 110) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');
  switch (e.kind) {
    case 'self': return `T${e.turn} me: ${cut(e.text)}`;
    case 'speech': return `T${e.turn} ${nameOf(e.who)}: ${cut(e.text)}`;
    case 'chair': return `T${e.turn} CHAIR: ${cut(e.text)}`;
    case 'crisis': return `T${e.turn} !! ${e.title}`;
    case 'ballot': return `T${e.turn} ${nameOf(e.who)} voted ${e.vote}`;
    case 'vote': return `T${e.turn} ${cut(e.text)}`;
    default: return `T${e.turn} ${cut(e.text)}`;
  }
}

/** The scenario's back story as paragraphs (empty for custom dilemmas without one). */
function backgroundHtml(sc) {
  const bg = Array.isArray(sc?.background) ? sc.background : sc?.background ? [sc.background] : [];
  return bg.length ? `<h4 class="brief-h">Background</h4><div class="brief-bg">${bg.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : '';
}

/** Start-screen panel: what the selected dilemma is about, before you convene. */
function scenarioDetailHtml(sc) {
  if (!sc) return '';
  return `<div class="scn-detail-head"><b>${esc(sc.title)}</b><span>${esc(sc.clock)}</span></div>
    ${sc.world ? `<p class="brief-setting">${esc(sc.world)}</p>` : ''}
    <p class="scn-detail-brief">${esc(sc.brief)}</p>
    ${backgroundHtml(sc)}
    <h4 class="brief-h">The options</h4>
    <ul class="scn-detail-opts">${sc.options.map((o) => `<li><b>${esc(o.label)}</b> ${esc(o.desc)}</li>`).join('')}</ul>`;
}
