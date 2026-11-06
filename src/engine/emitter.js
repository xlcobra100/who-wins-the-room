/** Minimal event emitter shared by the engine (works in the browser and in Node tests). */
export class Emitter {
  constructor() { this._handlers = new Map(); }
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this._handlers.get(type)?.delete(fn);
  }
  emit(type, payload) {
    for (const fn of this._handlers.get(type) || []) {
      try { fn(payload); } catch (e) { console.error(`[halcyon] handler for "${type}" failed`, e); }
    }
    for (const fn of this._handlers.get('*') || []) {
      try { fn(type, payload); } catch (e) { console.error('[halcyon] wildcard handler failed', e); }
    }
  }
}
