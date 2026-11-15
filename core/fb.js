/* Firebase connection over plain REST (no SDK) + an offline demo backend with the same API */
(function () {
  const P = window.P;
  const DEF = { authUrl: 'https://identitytoolkit.googleapis.com/v1', tokenUrl: 'https://securetoken.googleapis.com/v1' };

  const AUTH_MSG = {
    INVALID_LOGIN_CREDENTIALS: 'اسم المستخدم أو كلمة السر غلط',
    EMAIL_NOT_FOUND: 'اسم المستخدم أو كلمة السر غلط',
    INVALID_PASSWORD: 'اسم المستخدم أو كلمة السر غلط',
    INVALID_EMAIL: 'الإيميل مكتوب غلط',
    EMAIL_EXISTS: 'الاسم ده متسجل قبل كده',
    WEAK_PASSWORD: 'كلمة السر لازم تبقى 6 حروف أو أرقام على الأقل',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'محاولات كتير ورا بعض، استنى دقيقة وجرب تاني',
    USER_DISABLED: 'الحساب ده موقوف من الإدارة',
    OPERATION_NOT_ALLOWED: 'لازم تفعّل تسجيل الدخول بالإيميل وكلمة السر في Firebase',
    CONFIGURATION_NOT_FOUND: 'لازم تفعّل Authentication في مشروع Firebase',
    INVALID_REFRESH_TOKEN: 'الجلسة خلصت، سجل دخول تاني',
    TOKEN_EXPIRED: 'الجلسة خلصت، سجل دخول تاني',
    USER_NOT_FOUND: 'الحساب ده اتمسح',
    INVALID_ID_TOKEN: 'الجلسة خلصت، سجل دخول تاني',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'سجل خروج ودخول تاني وبعدين غيّر كلمة السر',
  };
  function authMsg(code) {
    code = String(code || '');
    for (const k in AUTH_MSG) if (code.startsWith(k)) return AUTH_MSG[k];
    if (/API key not valid|API_KEY_INVALID/i.test(code)) return 'مفتاح Firebase (API Key) غلط';
    return 'حصلت مشكلة في تسجيل الدخول: ' + code;
  }
  class NetError extends Error { constructor(m) { super(m || 'مفيش اتصال بالنت دلوقتي'); this.net = true; } }
  class DeniedError extends Error { constructor(m) { super('مش مسموح للحساب ده' + (m ? ' (' + m + ')' : '')); this.denied = true; } }
  class AuthError extends Error { constructor(code) { super(authMsg(code)); this.code = String(code || ''); this.auth = true; } }
  P.NetError = NetError;

  const FB = (P.FB = {
    cfg: null,
    sess: null, // {uid, email, idToken, refreshToken, exp}
    demo: false,
    onSess: null,
    onRevoked: null,

    configure(cfg) {
      let test = {};
      try { test = JSON.parse(localStorage.getItem('fbx') || '{}'); } catch (e) {}
      this.cfg = Object.assign({}, DEF, cfg || {}, test);
      this.demo = !!this.cfg.demo;
      if (this.cfg.dbUrl) this.cfg.dbUrl = String(this.cfg.dbUrl).trim().replace(/\/+$/, '');
    },

    async _authPost(endpoint, body) {
      if (this.demo) return Demo.auth(endpoint, body);
      let r;
      try {
        r = await fetch(`${this.cfg.authUrl}/${endpoint}?key=${encodeURIComponent(this.cfg.apiKey || '')}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } catch (e) { throw new NetError(); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new AuthError((j.error && j.error.message) || 'HTTP ' + r.status);
      return j;
    },
    _setSess(j) {
      const prev = this.sess || {};
      this.sess = {
        uid: j.localId || j.user_id || prev.uid,
        email: j.email || prev.email,
        idToken: j.idToken || j.id_token,
        refreshToken: j.refreshToken || j.refresh_token || prev.refreshToken,
        exp: Date.now() + parseInt(j.expiresIn || j.expires_in || '3600', 10) * 1000,
      };
      this.onSess && this.onSess(this.sess);
      return this.sess;
    },
    async signIn(email, password) {
      const j = await this._authPost('accounts:signInWithPassword', { email, password, returnSecureToken: true });
      return this._setSess(j);
    },
    async signUpSelf(email, password) {
      const j = await this._authPost('accounts:signUp', { email, password, returnSecureToken: true });
      return this._setSess(j);
    },
    // create another person's login without touching the current session
    async createLogin(email, password) {
      const j = await this._authPost('accounts:signUp', { email, password, returnSecureToken: true });
      return { uid: j.localId, email: j.email };
    },
    async changeMyPassword(password) {
      const idToken = await this.token(true);
      const j = await this._authPost('accounts:update', { idToken, password, returnSecureToken: true });
      return this._setSess(j);
    },
    sendReset(email) { return this._authPost('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email }); },
    restore(sess) { this.sess = sess || null; },
    signOut() { this.sess = null; },

    async token(force) {
      if (!this.sess) return null;
      if (this.demo) return 'demo:' + this.sess.uid;
      if (!force && this.sess.idToken && this.sess.exp - 5 * 60 * 1000 > Date.now()) return this.sess.idToken;
      if (this._ref) return this._ref;
      this._ref = (async () => {
        let r;
        try {
          r = await fetch(`${this.cfg.tokenUrl}/token?key=${encodeURIComponent(this.cfg.apiKey || '')}`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.sess.refreshToken || ''),
          });
        } catch (e) { throw new NetError(); }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const code = (j.error && j.error.message) || 'HTTP ' + r.status;
          if (r.status === 400 || r.status === 403) this.onRevoked && this.onRevoked(code);
          throw new AuthError(code);
        }
        this._setSess(j);
        return this.sess.idToken;
      })().finally(() => { this._ref = null; });
      return this._ref;
    },

    url(path, q, tok) {
      const segs = P.split(path).map(encodeURIComponent).join('/');
      const ps = [];
      if (tok) ps.push('auth=' + encodeURIComponent(tok));
      for (const k in q || {}) ps.push(k + '=' + encodeURIComponent(q[k]));
      return `${this.cfg.dbUrl}/${segs}.json` + (ps.length ? '?' + ps.join('&') : '');
    },

    async req(method, path, body, q, retried) {
      if (this.demo) return Demo.req(method, path, body, q);
      let tok = null;
      try { tok = await this.token(); } catch (e) { if (e.net) throw e; tok = null; }
      let r;
      try {
        r = await fetch(this.url(path, q, tok), {
          method, cache: 'no-store',
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (e) { throw new NetError(); }
      if (r.status === 401) {
        const j = await r.json().catch(() => ({}));
        const msg = String(j.error || '');
        if (/expired|parse auth/i.test(msg) && !retried && this.sess) {
          await this.token(true);
          return this.req(method, path, body, q, true);
        }
        throw new DeniedError(msg);
      }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        const e = new Error('Firebase ' + r.status + ' ' + t.slice(0, 160));
        e.http = r.status;
        if (r.status >= 500 || r.status === 429) e.net = true;
        throw e;
      }
      return r.json();
    },
    get(path, q) { return this.req('GET', path, undefined, q); },
    put(path, v) { return this.req('PUT', path, v); },
    patch(path, v) { return this.req('PATCH', path, v); },
    del(path) { return this.req('DELETE', path); },

    // live stream (Server-Sent Events). onEv(type, {path, data}); onState('up'|'down'|'denied')
    stream(path, onEv, onState) {
      if (this.demo) return Demo.stream(path, onEv, onState);
      const h = { closed: false, es: null, last: Date.now(), backoff: 1000, rt: null };
      const cleanup = () => { if (h.es) { h.es.close(); h.es = null; } };
      const retry = () => {
        if (h.closed) return;
        clearTimeout(h.rt);
        h.rt = setTimeout(connect, h.backoff);
        h.backoff = Math.min(h.backoff * 2, 30000);
      };
      const connect = async () => {
        if (h.closed) return;
        cleanup();
        let tok;
        try { tok = await FB.token(); } catch (e) { onState && onState('down'); return retry(); }
        if (h.closed) return;
        const es = new EventSource(FB.url(path, null, tok));
        h.es = es; h.last = Date.now();
        const handle = (type) => (e) => {
          h.last = Date.now(); h.backoff = 1000;
          onState && onState('up');
          let d; try { d = JSON.parse(e.data); } catch (_) { return; }
          if (d && typeof d === 'object') onEv(type, d);
        };
        es.addEventListener('put', handle('put'));
        es.addEventListener('patch', handle('patch'));
        es.addEventListener('keep-alive', () => { h.last = Date.now(); onState && onState('up'); });
        es.addEventListener('cancel', () => { onState && onState('denied'); cleanup(); h.backoff = 30000; retry(); });
        es.addEventListener('auth_revoked', () => { cleanup(); FB.token(true).then(() => connect(), () => retry()); });
        es.onerror = () => { onState && onState('down'); cleanup(); retry(); };
      };
      h.watch = setInterval(() => { if (h.es && Date.now() - h.last > 95000) { cleanup(); connect(); } }, 15000);
      h.close = () => { h.closed = true; cleanup(); clearTimeout(h.rt); clearInterval(h.watch); };
      h.reconnect = () => { h.backoff = 1000; connect(); };
      connect();
      return h;
    },
  });

  // ------------------------------------------------------------------
  // Demo backend: same API, data kept on this computer only (for trying the system)
  // ------------------------------------------------------------------
  const Demo = (P.Demo = {
    tree: null,
    subs: new Set(),
    async load() {
      if (this.tree) return;
      this.tree = (await P.kv.get('demo:db')) || {};
    },
    save: P.debounce(() => P.kv.set('demo:db', Demo.tree), 300),
    async auth(endpoint, body) {
      await this.load();
      const users = this.tree.__auth || (this.tree.__auth = {});
      const email = String(body.email || '').toLowerCase();
      const mk = (uid) => ({ localId: uid, email, idToken: 'demo', refreshToken: 'demo', expiresIn: '3600' });
      if (endpoint === 'accounts:signUp') {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AuthError('INVALID_EMAIL');
        if ((body.password || '').length < 6) throw new AuthError('WEAK_PASSWORD');
        const key = email.replace(/[.#$[\]/]/g, '_');
        if (users[key]) throw new AuthError('EMAIL_EXISTS');
        const uid = 'd' + P.uid(4);
        users[key] = { uid, pw: body.password, email };
        this.save();
        return mk(uid);
      }
      if (endpoint === 'accounts:signInWithPassword') {
        const u = users[email.replace(/[.#$[\]/]/g, '_')];
        if (!u || u.pw !== body.password) throw new AuthError('INVALID_LOGIN_CREDENTIALS');
        return mk(u.uid);
      }
      if (endpoint === 'accounts:update') {
        const u = Object.values(users).find((x) => x.uid === FB.sess.uid);
        if ((body.password || '').length < 6) throw new AuthError('WEAK_PASSWORD');
        if (u) u.pw = body.password;
        this.save();
        return { localId: FB.sess.uid, email: u && u.email, idToken: 'demo', refreshToken: 'demo', expiresIn: '3600' };
      }
      return {};
    },
    async req(method, path, body, q) {
      await this.load();
      const p = P.split(path).join('/');
      if (method === 'GET') {
        let v = P.getAt(this.tree, p);
        v = v === null ? null : P.clone(v);
        if (q && q.shallow === 'true' && v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = typeof v[k] === 'object' ? true : v[k]; v = o; }
        return v;
      }
      const ups = {};
      if (method === 'PUT') ups[p] = body;
      else if (method === 'DELETE') ups[p] = null;
      else if (method === 'PATCH') for (const k in body) ups[P.split(p + '/' + k).join('/')] = body[k];
      for (const k in ups) P.setAt(this.tree, k, ups[k] === undefined ? null : ups[k]);
      this.save();
      const paths = Object.keys(ups);
      setTimeout(() => {
        for (const s of this.subs) {
          if (paths.some((x) => x === s.p || x.startsWith(s.p + '/') || s.p.startsWith(x + '/') || s.p === '' || x === '')) {
            s.onEv('put', { path: '/', data: P.clone(P.getAt(this.tree, s.p)) });
          }
        }
      }, 0);
      return method === 'DELETE' ? null : body;
    },
    stream(path, onEv, onState) {
      const s = { p: P.split(path).join('/'), onEv };
      this.subs.add(s);
      this.load().then(() => { onState && onState('up'); onEv('put', { path: '/', data: P.clone(P.getAt(this.tree, s.p)) }); });
      return { close: () => this.subs.delete(s), reconnect() {} };
    },
    async reset() { this.tree = {}; await P.kv.del('demo:db'); },
  });
})();
