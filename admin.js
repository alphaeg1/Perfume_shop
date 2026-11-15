/* Phone follow-up page for the owner / follow-up accounts — live view of every branch */
(function () {
  const P = window.P;
  const { h, S, FB, C } = P;
  const CFG = window.SHOP_CONFIG || {};
  const M = { tab: 'today', mode: 'day', br: '', anchor: P.dayKey(), sbr: '' };
  const root = () => P.$('#m');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  async function boot() {
    if (!CFG.dbUrl) { FB.configure({ demo: true }); await P.Demo.load(); if (!P.Demo.tree.meta) await P.seedDemo(); }
    else FB.configure({ apiKey: CFG.apiKey, dbUrl: CFG.dbUrl });
    FB.onSess = (s) => P.kv.set('m:tok', s).catch(() => {});
    const sess = await P.kv.get('m:sess');
    const tok = await P.kv.get('m:tok');
    if (sess && tok) { FB.restore(tok); return enter(sess); }
    login();
  }
  function login() {
    const u = P.input({ dir: 'ltr', placeholder: 'اسم الدخول', autocomplete: 'username', id: 'mu' });
    const pw = P.input({ type: 'password', dir: 'ltr', placeholder: 'كلمة السر', autocomplete: 'current-password', id: 'mp' });
    const go = h('button', { class: 'btn bl', id: 'mgo', style: { background: 'var(--amber)' }, onclick: async () => {
      go.disabled = true;
      try {
        const name = u.value.trim().toLowerCase();
        let email = name.includes('@') ? name : null;
        if (!email) { const l = await FB.get(`logins/${P.normUser(name) || name}`); if (!l) throw new Error('اسم الدخول مش موجود'); email = l.e; }
        const s = await FB.signIn(email, pw.value);
        const prof = await FB.get(`users/${s.uid}`);
        if (!prof || prof.off) throw new Error('الحساب ده مش متاح');
        if (prof.role !== 'owner' && prof.role !== 'viewer') throw new Error('الصفحة دي للحساب الرئيسي وحسابات المتابعة بس');
        const me = { ...prof, uid: s.uid };
        await P.kv.set('m:sess', me); await P.kv.set('m:tok', FB.sess);
        enter(me);
      } catch (e) { P.toast(e.message, 'err'); go.disabled = false; }
    } }, 'دخول');
    root().replaceChildren(h('div', { class: 'gate' }, P.bottle(0.7, '#F2C230', 46), h('h1', null, 'متابعة الفروع'), h('p', { style: { opacity: 0.8, margin: 0 } }, CFG.dbUrl ? 'ادخل بالحساب الرئيسي أو حساب المتابعة' : 'عرض تجريبي: admin / 123456'), u, pw, go));
  }
  async function enter(me) {
    await S.start(me);
    S.on(P.debounce(draw, 150));
    draw();
  }
  async function logout() { S.stop(); FB.signOut(); await P.kv.del('m:sess'); await P.kv.del('m:tok'); login(); }

  function draw() {
    if (!S.me) return;
    const site = S.get('public/site') || {};
    document.documentElement.style.setProperty('--plum', site.primary || '#F2C230');
    const open = P.openOrders();
    const newN = open.filter((o) => o.st === 'new' || o.st === 'rej').length;
    const y = scrollY;
    root().replaceChildren(
      M.tab === 'today' ? today(site) : M.tab === 'orders' ? orders(open) : M.tab === 'rep' ? reports() : stock(),
      h('nav', { class: 'nav' }, [['today', 'النهارده'], ['orders', 'الطلبات'], ['rep', 'الجرد'], ['stock', 'المخزون']].map(([k, l]) => h('button', { class: M.tab === k ? 'on' : '', onclick: () => { M.tab = k; scrollTo(0, 0); draw(); } },
        P.icon({ today: 'home', orders: 'truck', rep: 'chart', stock: 'box' }[k], 22), l, k === 'orders' && newN ? h('i', null, newN) : null))));
    scrollTo(0, y);
  }
  function head(title, big, sub) {
    const live = S.st.net;
    return h('div', { class: 'top' }, h('div', { class: 'r' }, h('div', null, h('b', null, (S.get('public/site') || {}).name || ''), h('div', null, h('small', null, title))),
      h('div', { class: 'row' }, h('span', { class: 'live' + (live ? '' : ' off') }, h('i'), live ? 'لايف' : 'من غير نت'), h('button', { class: 'icon-btn', style: { color: '#fff' }, 'aria-label': 'خروج', onclick: logout }, P.icon('logout', 18)))),
      big !== undefined ? h('div', { class: 'big num' }, big) : null, sub ? h('div', { class: 'sub' }, sub) : null);
  }
  function today() {
    const d = P.dayKey();
    const r = P.R.summary(d, d, null);
    const pres = S.get('presence') || {};
    return h('div', null, head('مبيعات النهارده في كل الفروع', P.fmt.money(r.rev), `${r.bottles} ازازة — ${r.inv} فاتورة`),
      h('div', { class: 'w' },
        h('div', { class: 'kp' }, k('متوسط الفاتورة', P.fmt.money(r.avg)), k('طلبات الموقع', r.web), k('كاش', P.fmt.money(r.pay.cash || 0)), k('محافظ وفيزا', P.fmt.money((r.pay.wallet || 0) + (r.pay.card || 0)))),
        h('div', { class: 'h' }, 'الفروع'),
        P.branches().map(([b, br]) => {
          const x = r.byBranch[b] || { rev: 0, inv: 0, bottles: 0 };
          const on = Object.values(pres).some((p) => p && p.b === b && Date.now() - p.ts < 150000);
          return h('div', { class: 'card' }, h('div', { class: 'br' }, h('b', null, h('span', { class: 'dot' + (on ? ' on' : '') }), br.n), h('span', { class: 'v num' }, P.fmt.money(x.rev))), h('div', { class: 'mut' }, `${x.inv} فاتورة — ${x.bottles} ازازة`));
        }),
        h('div', { class: 'h' }, 'آخر المبيعات'),
        h('div', { class: 'card feed' }, r.sales.length ? r.sales.slice(0, 20).map((s) => h('div', { style: s.void ? { opacity: 0.5 } : null }, P.bottle(0.6, C.color((P.itemsOf(s)[0] || {}).c), 12),
          h('span', { style: { flex: 1 } }, h('b', null, P.branchName(s.b)), ' ', P.itemsOf(s).map((it) => it.q + '× ' + it.n).join('، '), h('div', { class: 'mut' }, P.fmt.time(s.ts) + ' — ' + (s.bn || '') + (s.void ? ' — ملغية' : ''))),
          h('b', { class: 'num' }, P.fmt.money(s.tot)))) : h('div', { class: 'empty' }, 'لسه مفيش مبيعات النهارده'))));
  }
  const k = (l, v) => h('div', { class: 'k' }, h('span', null, l), h('b', { class: 'num' }, v));
  function orders(open) {
    const canAct = S.isOwner;
    return h('div', null, head('طلبات الموقع المفتوحة', open.length, open.filter((o) => o.st === 'new').length + ' جديد'),
      h('div', { class: 'w' }, open.length ? open.map((o) => {
        const c = o.c || {};
        return h('div', { class: 'card' },
          h('div', { class: 'br' }, h('b', null, '#' + (o.code || '') + ' — ' + (c.n || '')), h('span', { class: 'pill ' + (o.st === 'new' ? 'n' : o.st === 'rej' ? 'e' : '') }, P.ORDER_ST[o.st] || o.st)),
          h('div', { class: 'mut' }, P.fmt.dt(o.ts) + ' — ' + P.branchName(o.b) + (c.areaN ? ' — ' + c.areaN : '')),
          h('div', { style: { fontSize: '13.5px', margin: '6px 0' } }, P.arr(o.items).map((it) => it.q + '× ' + it.n + (it.sn ? ' ' + it.sn : '')).join('، ')),
          h('div', { class: 'br' }, h('b', { class: 'num' }, P.fmt.money(o.tot)), h('a', { class: 'btn lt', href: 'tel:' + (c.ph || '') }, P.icon('phone', 16))),
          canAct && (o.b === '_inbox' || o.st === 'rej' || o.st === 'new') ? h('select', { class: 'inp', style: { marginTop: '8px' }, onchange: (e) => { if (e.target.value) { P.A.reassignOrder(o.b, o.id, e.target.value); P.toast('اتحول لـ ' + P.branchName(e.target.value)); } } },
            h('option', { value: '' }, o.b === '_inbox' || o.st === 'rej' ? 'وزّع الطلب على فرع…' : 'حوّله لفرع تاني…'), P.branches().filter(([b]) => b !== o.b).map(([b, br]) => h('option', { value: b }, br.n))) : null);
      }) : h('div', { class: 'empty' }, 'مفيش طلبات مفتوحة')));
  }
  function reports() {
    const [from, to] = P.rangeOf(M.mode, M.anchor);
    const branches = M.br ? [M.br] : null;
    const r = P.R.summary(from, to, branches);
    const label = M.mode === 'day' ? P.fmt.day(from) : M.mode === 'month' ? P.fmt.month(from.slice(0, 7)) : 'سنة ' + from.slice(0, 4);
    const step = (n) => { const d = P.parseDay(M.anchor); M.anchor = M.mode === 'day' ? P.addDays(M.anchor, n) : M.mode === 'month' ? P.dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1)) : (d.getFullYear() + n) + '-01-01'; draw(); };
    return h('div', null, head('الجرد — ' + label, P.fmt.money(r.rev), (M.br ? P.branchName(M.br) : 'كل الفروع') + ` — ${r.bottles} ازازة`),
      h('div', { class: 'w' },
        h('div', { class: 'seg' }, [['day', 'يومي'], ['month', 'شهري'], ['year', 'سنوي']].map(([v, l]) => h('button', { class: M.mode === v ? 'on' : '', onclick: () => { M.mode = v; draw(); } }, l))),
        h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn lt', onclick: () => step(-1) }, 'اللي قبله'),
          P.select([['', 'كل الفروع']].concat(P.branches().map(([b, br]) => [b, br.n])), M.br, { class: 'inp', onchange: (e) => { M.br = e.target.value; draw(); } }),
          h('button', { class: 'btn lt', onclick: () => step(1) }, 'اللي بعده')),
        h('div', { class: 'kp' }, k('فواتير', r.inv), k('متوسط الفاتورة', P.fmt.money(r.avg)), k('طلبات الموقع', r.web + ' — ' + P.fmt.money(r.webRev)), S.isOwner ? k('ربح تقريبي', P.fmt.money(r.profit)) : k('خصومات', P.fmt.money(r.disc))),
        h('div', { class: 'h' }, 'اتباع إيه'),
        h('div', { class: 'card' }, h('table', null, C.cats(true).flatMap(([c, cat]) => C.sizes(c, true).map(([s, sz]) => { const x = ((r.byCat[c] || {}).sizes || {})[s] || { q: 0, rev: 0 }; return h('tr', null, h('td', null, cat.n + ' ' + sz.n), h('td', { class: 'n' }, x.q), h('td', { class: 'n' }, P.fmt.money(x.rev))); })))),
        !M.br && P.branches().length > 1 ? h('div', null, h('div', { class: 'h' }, 'الفروع'), h('div', { class: 'card' }, h('table', null, P.branches().map(([b, br]) => { const x = r.byBranch[b] || { rev: 0, bottles: 0 }; return h('tr', null, h('td', null, br.n), h('td', { class: 'n' }, x.bottles), h('td', { class: 'n' }, P.fmt.money(x.rev))); })))) : null,
        h('div', { class: 'h' }, 'جرد المخزون'),
        h('div', { class: 'card' }, h('table', null, h('tr', { class: 'mut' }, h('td', null, 'الصنف'), h('td', { class: 'n' }, 'أول'), h('td', { class: 'n' }, 'وارد'), h('td', { class: 'n' }, 'مباع'), h('td', { class: 'n' }, 'آخر')),
          P.R.inventory(from, to, branches).filter((x) => x.open || x.inn || x.sold || x.close).map((x) => h('tr', null, h('td', null, C.label(x.k)), h('td', { class: 'n' }, x.open), h('td', { class: 'n' }, x.inn + x.tin + x.tout + x.adj), h('td', { class: 'n' }, x.sold), h('td', { class: 'n' }, h('b', null, x.close))))))));
  }
  function stock() {
    const bs = P.branches();
    const b = M.sbr || (bs[0] || [])[0];
    const st = b ? P.stockOf(b) : {};
    const lim = P.lowLimit();
    const keys = C.keys();
    const low = keys.filter((kk) => P.num(st[kk]) <= lim).length;
    return h('div', null, head('المخزون لحظة بلحظة', b ? P.branchName(b) : '', low ? low + ' صنف قرب يخلص' : 'المخزون كويس'),
      h('div', { class: 'w' }, P.select(bs.map(([id, br]) => [id, br.n]), b, { class: 'inp', style: { marginBottom: '10px' }, onchange: (e) => { M.sbr = e.target.value; draw(); } }),
        h('div', { class: 'card' }, h('table', null, keys.map((kk) => { const q = P.num(st[kk]); return h('tr', null, h('td', null, C.label(kk)), h('td', { class: 'n ' + (q <= 0 ? 'ze' : q <= lim ? 'lo' : '') }, q)); })))));
  }
  boot().catch((e) => { root().textContent = 'حصلت مشكلة: ' + e.message; });
})();
