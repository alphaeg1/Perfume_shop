/* Local mirror of the cloud data + offline outbox. Every screen reads from S.L and writes through S.write() */
(function () {
  const P = window.P;
  const FB = P.FB;

  const S = (P.S = {
    L: {},
    scope: null,
    me: null, // profile of the logged-in account
    outbox: [],
    failed: [],
    streams: [],
    listeners: new Set(),
    dirty: new Set(),
    stamps: {}, // "b|d" -> stamp of the copy we hold
    revSeen: {},
    st: { net: true, live: 0, pending: 0, lastOk: 0, syncing: false, hist: 0 },
    today: null,
    timers: [],

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit: P.debounce(() => { for (const fn of S.listeners) { try { fn(); } catch (e) { console.error(e); } } }, 120),
    get isOwner() { return !!(this.me && this.me.role === 'owner'); },
    get seesAll() { return !!(this.me && (this.me.role === 'owner' || this.me.role === 'viewer')); },

    chunkOf(path) {
      const k = P.split(path);
      if (!k.length) return '';
      if (k[0] === 'day' || k[0] === 'orders' || k[0] === 'public') return k.slice(0, 2).join('/');
      return k[0];
    },
    get(path) { return P.getAt(this.L, path); },
    ver: 0,
    setLocal(path, val) {
      this.ver++;
      const k = P.split(path);
      if (!k.length) { this.L = val && typeof val === 'object' ? P.clone(val) : {}; Object.keys(this.L).forEach((c) => this.dirty.add(c)); }
      else { P.setAt(this.L, path, val); this.dirty.add(this.chunkOf(path)); }
      this.saveSoon();
      this.emit();
    },
    saveSoon: P.debounce(async () => {
      const d = Array.from(S.dirty); S.dirty.clear();
      for (const c of d) { if (c) await P.kv.set(`L:${S.scope}:${c}`, P.getAt(S.L, c)).catch(() => {}); }
    }, 500),
    async loadCache() {
      this.L = {};
      const pref = `L:${this.scope}:`;
      const keys = (await P.kv.keys()).filter((k) => String(k).startsWith(pref));
      for (const k of keys) { const v = await P.kv.get(k); if (v !== null && v !== undefined) P.setAt(this.L, k.slice(pref.length), v); }
      this.outbox = (await P.kv.get(`OB:${this.scope}`)) || [];
      this.stamps = (await P.kv.get(`ST:${this.scope}`)) || {};
      this.revSeen = (await P.kv.get(`RV:${this.scope}`)) || {};
      this.st.pending = this.outbox.length;
    },
    saveOutbox() { this.st.pending = this.outbox.length; return P.kv.set(`OB:${this.scope}`, this.outbox).catch(() => {}); },
    saveStamps: P.debounce(() => P.kv.set(`ST:${S.scope}`, S.stamps).catch(() => {}), 400),

    // ---------------- writes ----------------
    // updates: { 'path/a': value, 'path/b': null } — applied here at once, sent to the cloud when possible
    write(updates, label, opts) {
      const up = {};
      for (const k in updates) up[P.split(k).join('/')] = updates[k] === undefined ? null : P.clone(updates[k]);
      for (const k in up) P.setAt(this.L, k, up[k]), this.dirty.add(this.chunkOf(k));
      this.ver++;
      this.saveSoon(); this.emit();
      const it = { id: P.uid(), up, ts: Date.now(), label: label || '', ...(opts && opts.silent ? { silent: true } : {}) };
      this.outbox.push(it);
      this.saveOutbox();
      this.flush();
      return it;
    },
    // direct cloud write that must succeed now (used for accounts & setup)
    async writeNow(updates) {
      await FB.patch('', updates);
      for (const k in updates) P.setAt(this.L, k, updates[k]), this.dirty.add(this.chunkOf(k));
      this.ver++;
      this.saveSoon(); this.emit();
    },
    reapply(prefix) {
      const pf = P.split(prefix).join('/');
      for (const it of this.outbox) for (const k in it.up) {
        if (!pf || k === pf || k.startsWith(pf + '/') || pf.startsWith(k + '/')) P.setAt(this.L, k, it.up[k]);
      }
    },
    async flush() {
      if (this._flushing) { this._again = true; return; }
      this._flushing = true;
      this.st.syncing = true; this.emit();
      try {
        while (this.outbox.length) {
          const it = this.outbox[0];
          try {
            await FB.patch('', it.up);
            this.outbox.shift();
            await this.saveOutbox();
            this.netOk();
          } catch (e) {
            if (e.net) { this.netDown(); this.retrySoon(); break; }
            // refused by the server: drop it and reload what it touched
            this.outbox.shift();
            await this.saveOutbox();
            this.failed.push({ ...it, err: e.message, at: Date.now() });
            if (!it.silent) P.toast('السيرفر رفض عملية: ' + (it.label || 'تعديل') + ' — ' + e.message, 'err', 7000);
            this.refetchFor(it.up);
          }
        }
      } finally {
        this._flushing = false;
        this.st.syncing = false;
        this.st.pending = this.outbox.length;
        this.emit();
        if (this._again) { this._again = false; if (this.outbox.length && this.st.net) this.flush(); }
      }
    },
    retrySoon() {
      clearTimeout(this._rt);
      this._back = Math.min((this._back || 2000) * 1.6, 30000);
      this._rt = setTimeout(() => this.flush(), this._back);
    },
    netOk() { if (!this.st.net) { this.st.net = true; this.emit(); } this.st.lastOk = Date.now(); this._back = 2000; },
    netDown() { if (this.st.net) { this.st.net = false; this.emit(); } },
    async refetchFor(up) {
      const chunks = new Set(Object.keys(up).map((k) => P.split(k).slice(0, 4).join('/')));
      for (const c of chunks) await this.pull(c).catch(() => {});
    },

    // ---------------- reads ----------------
    async pull(path, q) {
      const v = await FB.get(path, q);
      this.netOk();
      this.setLocal(path, v);
      this.reapply(path);
      return v;
    },
    stream(path, onChange) {
      const base = P.split(path).join('/');
      const rec = { path: base, up: false };
      rec.h = FB.stream(base, (type, ev) => {
        const full = P.split(base + '/' + (ev.path || '')).join('/');
        this.ver++;
        if (type === 'put') P.setAt(this.L, full, ev.data === undefined ? null : ev.data);
        else if (type === 'patch') for (const k in ev.data || {}) P.setAt(this.L, full + '/' + k, ev.data[k]);
        if (!P.split(full).length && type === 'put') this.L = ev.data || {};
        this.dirty.add(this.chunkOf(full || base));
        this.reapply(full);
        this.saveSoon(); this.emit();
        onChange && onChange(type, ev, full);
      }, (state) => {
        rec.up = state === 'up';
        if (state === 'up') this.netOk(); else if (state === 'down') this.netDown();
        this.st.live = this.streams.filter((s) => s.up).length;
        this.emit();
      });
      this.streams.push(rec);
      return rec;
    },
    closeStream(rec) { rec.h.close(); this.streams = this.streams.filter((s) => s !== rec); },

    // ---------------- lifecycle ----------------
    async start(me) {
      this.stop();
      this.me = me;
      const cf = P.FB.cfg || {};
      const ns = cf.demo ? 'demo' : 'db' + Array.from(String(cf.dbUrl || '')).reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
      this.scope = ns + '_' + (me.role === 'owner' ? 'all' : me.role === 'viewer' ? 'view' : 'b_' + me.b);
      // drop caches left by the old unscoped versions (they mixed demo numbers with real ones)
      if (!(await P.kv.get('cacheV2'))) { for (const k of await P.kv.keys()) { if (/^(L|OB|ST|RV):(all|view|b_)/.test(String(k))) await P.kv.del(k).catch(() => {}); } await P.kv.set('cacheV2', 1); }
      await this.loadCache();
      this.today = P.dayKey();
      this.emit();
      const owner = me.role !== 'staff';
      const b = me.b;

      // base data
      const base = owner
        ? ['meta', 'catalog', 'branches', 'users', 'public/site', 'public/routing', 'public/avail'].concat(me.role === 'owner' ? ['costs'] : [])
        : ['meta', 'catalog', 'branches', `users/${me.uid}`, 'public/site', 'public/routing', `public/avail/${b}`];
      this.ready = Promise.all(base.map((p) => this.pull(p).catch((e) => { if (e.net) this.netDown(); }))).then(() => { this.ensureOrders(); this.emit(); });

      // live: settings revisions, day index, today, open web orders
      this.stream('rev', () => this.onRev());
      this.stream(owner ? 'days' : `days/${b}`, () => this.onDays());
      this.todayRec = this.stream(owner ? `day/${this.today}` : `day/${this.today}/${b}`);
      this.ensureOrders();

      // timers
      this.timers.push(setInterval(() => this.checkDay(), 30000));
      this.timers.push(setInterval(() => this.heartbeat(), 60000));
      if (owner) this.timers.push(setInterval(() => this.pull('presence').catch(() => {}), 60000));
      this.timers.push(setInterval(() => { if (this.outbox.length) this.flush(); }, 20000));
      window.addEventListener('online', this._onl = () => { this.flush(); this.streams.forEach((s) => s.h.reconnect()); });
      this.heartbeat();
      if (owner) this.pull('presence').catch(() => {});
      this.flush();
    },
    ensureOrders() {
      if (!this.me) return;
      const owner = this.seesAll;
      const want = owner || P.can('web_orders');
      if (want && !this.ordersRec) this.ordersRec = this.stream(owner ? 'orders/open' : `orders/open/${this.me.b}`);
      if (!want && this.ordersRec) { this.closeStream(this.ordersRec); this.ordersRec = null; }
    },
    stop() {
      this.ordersRec = null;
      this.todayRec = null;
      this.streams.forEach((s) => s.h.close());
      this.streams = [];
      this.timers.forEach(clearInterval);
      this.timers = [];
      if (this._onl) window.removeEventListener('online', this._onl);
      this.me = null;
    },
    heartbeat() {
      if (!this.me) return;
      FB.put(`presence/${this.me.uid}`, { ts: Date.now(), b: this.me.b || '', n: this.me.n || '', u: this.me.u || '' })
        .then(() => this.netOk(), (e) => { if (e.net) this.netDown(); });
    },
    checkDay() {
      const t = P.dayKey();
      if (t === this.today || !this.me) return;
      const owner = this.seesAll;
      this.today = t;
      if (this.todayRec) this.closeStream(this.todayRec);
      this.todayRec = this.stream(owner ? `day/${t}` : `day/${t}/${this.me.b}`);
      this.onDays();
    },
    onRev() {
      const rev = this.get('rev') || {};
      const owner = this.seesAll;
      const map = {
        cat: ['catalog'],
        br: ['branches'],
        us: owner ? ['users'] : [`users/${this.me.uid}`],
        site: ['public/site', 'public/routing'],
        cost: this.isOwner ? ['costs'] : [],
      };
      let changed = false;
      for (const k in map) {
        if (rev[k] && rev[k] !== this.revSeen[k]) {
          this.revSeen[k] = rev[k]; changed = true;
          map[k].forEach((p) => this.pull(p).then(() => {
            if (k === 'us' && !owner && P.App && P.App.onProfile) P.App.onProfile();
            if (k === 'br' || k === 'us') this.ensureOrders();
          }).catch(() => {}));
        }
      }
      if (changed) P.kv.set(`RV:${this.scope}`, this.revSeen).catch(() => {});
    },
    // day index stamps -> fetch past days we don't have or that changed
    onDays: P.debounce(async function () {
      const S = P.S;
      if (!S.me) return;
      const owner = S.seesAll;
      const idx = owner ? S.get('days') || {} : { [S.me.b]: S.get(`days/${S.me.b}`) || {} };
      const today = S.today;
      const need = {}; // day -> [branches]
      for (const b in idx) for (const d in idx[b] || {}) {
        if (d === today) continue;
        const st = idx[b][d];
        if (S.stamps[b + '|' + d] !== st) (need[d] = need[d] || []).push(b);
      }
      const days = Object.keys(need).sort().reverse();
      if (!days.length) return;
      S.st.hist = days.length; S.emit();
      const nB = Object.keys(idx).length;
      const jobs = [];
      for (const d of days) {
        if (owner && need[d].length === nB && nB > 1) jobs.push({ path: `day/${d}`, pairs: need[d].map((b) => [b, d]) });
        else for (const b of need[d]) jobs.push({ path: `day/${d}/${b}`, pairs: [[b, d]] });
      }
      let i = 0;
      const worker = async () => {
        while (i < jobs.length) {
          const j = jobs[i++];
          try {
            await S.pull(j.path);
            for (const [b, d] of j.pairs) S.stamps[b + '|' + d] = idx[b][d];
            S.saveStamps();
          } catch (e) { if (e.net) { S.netDown(); return; } }
          S.st.hist = Math.max(0, S.st.hist - 1); S.emit();
        }
      };
      await Promise.all([worker(), worker()]);
      S.st.hist = 0; S.emit();
    }, 400),

    // mark a day as modified for a branch (part of every sale / stock write)
    stampUp(updates, b, d) { updates[`days/${b}/${d}`] = Date.now(); return updates; },
  });
})();
