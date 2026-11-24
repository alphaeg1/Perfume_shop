/* Phone follow-up page for the owner / follow-up accounts — live view of every branch */
(function () {
  const P = window.P;
  const { h, S, FB, C } = P;
  const CFG = window.SHOP_CONFIG || {};
  const M = { tab: 'today', mode: 'day', br: '', anchor: P.dayKey(), sbr: '', shd: P.dayKey(), shb: '', pc: '' };
  const root = () => P.$('#m');
  const THEME_KEY = 'theme';
  try { if (localStorage.getItem(THEME_KEY) === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) {}

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
    const go = h('button', { class: 'btn bl', id: 'mgo', onclick: async () => {
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
    root().replaceChildren(h('div', { class: 'gate' },
      h('div', { class: 'gate-mark' }, P.bottle(0.72, '#F2C230', 40)),
      h('h1', null, 'متابعة الفروع'), h('p', null, CFG.dbUrl ? 'ادخل بالحساب الرئيسي أو حساب المتابعة' : 'عرض تجريبي: admin / 123456'),
      u, pw, go));
  }
  async function enter(me) { await S.start(me); S.on(P.debounce(draw, 150)); draw(); }
  async function logout() { S.stop(); FB.signOut(); await P.kv.del('m:sess'); await P.kv.del('m:tok'); login(); }
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    draw();
  }

  /* ---------- small building blocks ---------- */
  const money = (x) => h('span', { class: 'num mny' }, P.fmt.n(Math.round(P.num(x))), h('small', null, ' ج'));
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const trend = (v) => (v === null ? null : h('span', { class: 'trend ' + (v >= 0 ? 'up' : 'dn') }, (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v) + '%'));
  const kpi = (l, v, sub) => h('div', { class: 'k' }, h('span', { class: 'kl' }, l), h('b', null, v), sub ? h('small', null, sub) : null);
  const sec = (t, extra) => h('div', { class: 'h' }, h('span', null, t), extra || null);
  const nameOf = (it) => (it.k && C.cat(C.parse(it.k).c) ? C.label(it.k).split(' — ').join(' ') : (it.n || '') + (it.sn ? ' ' + it.sn : ''));
  const short = (k) => { const parts = C.label(k).split(' — '); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; };
  const itemsList = (items) => h('div', { class: 'items' }, P.arr(items).map((it) => h('div', { class: 'it' }, h('span', { class: 'q num' }, '×' + P.num(it.q)), h('span', null, nameOf(it)), it.oil ? h('b', { class: 'oil' }, it.oil) : null)));
  const catDot = (c) => h('i', { class: 'cd', style: { background: C.color(c) } });

  function draw() {
    if (!S.me) return;
    const open = P.openOrders();
    const newN = open.filter((o) => o.st === 'new' || o.st === 'rej').length;
    const y = scrollY;
    root().replaceChildren(
      M.tab === 'today' ? today() : M.tab === 'orders' ? orders(open) : M.tab === 'rep' ? reports() : M.tab === 'shifts' ? shifts() : M.tab === 'prices' && S.isOwner ? prices() : stock(),
      h('nav', { class: 'nav', style: S.isOwner ? { gridTemplateColumns: 'repeat(6,1fr)' } : null }, [['today', 'النهارده', 'home'], ['shifts', 'الورديات', 'clock'], ['orders', 'الطلبات', 'truck'], ['rep', 'الجرد', 'chart'], ['stock', 'المخزون', 'box']].concat(S.isOwner ? [['prices', 'الأسعار', 'tag']] : []).map(([k, l, ic]) => h('button', { class: M.tab === k ? 'on' : '', onclick: () => { M.tab = k; scrollTo(0, 0); draw(); } },
        h('span', { class: 'ni' }, P.icon(ic, 21), k === 'orders' && newN ? h('i', null, newN) : null), l))));
    scrollTo(0, y);
  }
  function head(title, sub) {
    const live = S.st.net; const site = S.get('public/site') || {};
    return h('header', { class: 'top' },
      h('div', { class: 'r' },
        h('div', { class: 'who' }, h('b', null, site.name || 'المتابعة'), h('small', null, title)),
        h('div', { class: 'acts' }, h('span', { class: 'live' + (live ? '' : ' off') }, h('i'), live ? 'لايف' : 'أوفلاين'), window.__langBtn ? window.__langBtn('ib lang') : null,
          h('button', { class: 'ib', 'aria-label': 'الوضع الليلي', onclick: toggleTheme }, P.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)),
          h('button', { class: 'ib', 'aria-label': 'خروج', onclick: logout }, P.icon('logout', 18)))),
      sub || null);
  }
  const hero = (label, big, ...subs) => h('div', { class: 'hero' }, h('small', null, label), h('div', { class: 'big' }, big), h('div', { class: 'hero-sub' }, subs));

  /* ---------- today ---------- */
  function today() {
    const d = P.dayKey(); const yd = P.addDays(d, -1);
    const r = P.R.summary(d, d, null); const ry = P.R.summary(yd, yd, null);
    const pres = S.get('presence') || {};
    const brs = P.branches(); const maxRev = Math.max(1, ...brs.map(([b]) => (r.byBranch[b] || {}).rev || 0));
    const lim = P.lowLimit(); let low = 0; for (const [b] of brs) { const st = P.stockOf(b); for (const k of C.keys()) if (P.num(st[k]) <= lim) low++; }
    const liveOffers = C.offers ? C.offers().length : 0;
    return h('div', null,
      head(P.fmt.day(d), hero('مبيعات النهارده في كل الفروع', money(r.rev), h('span', null, r.inv + ' فاتورة'), h('span', null, r.bottles + ' قطعة'), trend(pct(r.rev, ry.rev)), ry.rev ? h('span', { class: 'o' }, 'عن امبارح') : null)),
      h('div', { class: 'w' },
        h('div', { class: 'kp' }, kpi('متوسط الفاتورة', money(r.avg)), kpi('طلبات الموقع', r.web, r.webRev ? P.fmt.money(r.webRev) : null), kpi('كاش', money(r.pay.cash || 0)), kpi('محافظ وفيزا', money((r.pay.wallet || 0) + (r.pay.card || 0))), kpi('مصاريف', money(r.exp), r.expN ? r.expN + ' مصروف' : null), kpi('الكاش بعد المصاريف', money(r.cashNet))),
        low || liveOffers ? h('div', { class: 'alerts' },
          low ? h('button', { class: 'al warn', onclick: () => { M.tab = 'stock'; scrollTo(0, 0); draw(); } }, P.icon('box', 17), h('span', null, h('b', null, low + ' صنف'), ' قرب يخلص في الفروع'), h('span', { class: 'go' }, '‹')) : null,
          liveOffers ? h('div', { class: 'al' }, P.icon('tag', 17), h('span', null, h('b', null, liveOffers + ' عرض'), ' شغال دلوقتي على الكاشير والموقع')) : null) : null,
        sec('الفروع'),
        h('div', { class: 'card list' }, brs.length ? brs.map(([b, br]) => {
          const x = r.byBranch[b] || { rev: 0, inv: 0, bottles: 0 };
          const on = Object.values(pres).some((p) => p && p.b === b && Date.now() - p.ts < 150000);
          return h('div', { class: 'brow' },
            h('div', { class: 'br' }, h('b', null, h('span', { class: 'dot' + (on ? ' on' : '') }), br.n), money(x.rev)),
            h('div', { class: 'bar' }, h('i', { style: { width: Math.round((x.rev / maxRev) * 100) + '%' } })),
            h('div', { class: 'mut' }, x.inv + ' فاتورة · ' + x.bottles + ' قطعة' + (on ? ' · فاتح دلوقتي' : '')));
        }) : h('div', { class: 'empty' }, 'مفيش فروع')),
        sec('آخر المبيعات', r.sales.length ? h('small', { class: 'mut' }, r.sales.length + ' فاتورة') : null),
        h('div', { class: 'card list' }, r.sales.length ? r.sales.slice(0, 25).map((s) => h('div', { class: 'sale' + (s.void ? ' void' : '') },
          h('div', { class: 'br' }, h('div', { class: 'meta' }, catDot((P.itemsOf(s)[0] || {}).c), h('b', null, P.branchName(s.b)), h('span', { class: 'mut' }, P.fmt.time(s.ts) + (P.sellerOf(s) ? ' · ' + P.sellerOf(s) : ''))), s.void ? h('span', { class: 'pill e' }, 'اتلغت') : money(s.tot)),
          itemsList(P.itemsOf(s)),
          s.src === 'web' ? h('span', { class: 'pill' }, 'طلب موقع') : null)) : h('div', { class: 'empty' }, 'لسه مفيش مبيعات النهارده'))));
  }

  /* ---------- orders ---------- */
  function orders(open) {
    const canAct = S.isOwner;
    return h('div', null,
      head('طلبات الموقع', hero('طلبات مفتوحة', h('span', { class: 'num' }, open.length), h('span', null, open.filter((o) => o.st === 'new').length + ' جديد'), h('span', null, open.filter((o) => o.st === 'out').length + ' في الطريق'))),
      h('div', { class: 'w' }, open.length ? open.map((o) => {
        const c = o.c || {};
        const wa = String(c.ph || '').replace(/\D/g, '').replace(/^0/, '20');
        return h('div', { class: 'card ord' },
          h('div', { class: 'br' }, h('div', null, h('b', null, c.n || 'عميل'), h('div', { class: 'mut num' }, '#' + (o.code || ''))), h('span', { class: 'pill ' + (o.st === 'new' ? 'n' : o.st === 'rej' ? 'e' : '') }, P.ORDER_ST[o.st] || o.st)),
          h('div', { class: 'mut' }, P.fmt.dt(o.ts) + ' · ' + P.branchName(o.b) + (c.areaN ? ' · ' + c.areaN : '')),
          itemsList(o.items),
          h('div', { class: 'br foot' }, money(o.tot), h('div', { class: 'row' }, wa ? h('a', { class: 'btn lt', href: 'https://wa.me/' + wa, target: '_blank', rel: 'noopener' }, 'واتساب') : null, c.ph ? h('a', { class: 'btn', href: 'tel:' + c.ph }, P.icon('phone', 16), 'اتصال') : null)),
          canAct && (o.b === '_inbox' || o.st === 'rej' || o.st === 'new') ? h('select', { class: 'inp', style: { marginTop: '10px' }, onchange: (e) => { if (e.target.value) { P.A.reassignOrder(o.b, o.id, e.target.value); P.toast('اتحول لـ ' + P.branchName(e.target.value)); } } },
            h('option', { value: '' }, o.b === '_inbox' || o.st === 'rej' ? 'وزّع الطلب على فرع…' : 'حوّله لفرع تاني…'), P.branches().filter(([b]) => b !== o.b).map(([b, br]) => h('option', { value: b }, br.n))) : null);
      }) : h('div', { class: 'card empty' }, P.icon('truck', 26), h('div', null, 'مفيش طلبات مفتوحة دلوقتي'))));
  }

  /* ---------- reports ---------- */
  function reports() {
    const [from, to] = P.rangeOf(M.mode, M.anchor);
    const branches = M.br ? [M.br] : null;
    const r = P.R.summary(from, to, branches);
    const label = M.mode === 'day' ? P.fmt.day(from) : M.mode === 'month' ? P.fmt.month(from.slice(0, 7)) : 'سنة ' + from.slice(0, 4);
    const step = (n) => { const d = P.parseDay(M.anchor); M.anchor = M.mode === 'day' ? P.addDays(M.anchor, n) : M.mode === 'month' ? P.dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1)) : (d.getFullYear() + n) + '-01-01'; draw(); };
    const cats = C.cats(true).map(([c, cat]) => ({ c, cat, x: r.byCat[c] || { q: 0, rev: 0, sizes: {} } })).filter((g) => g.x.q || g.x.rev);
    const maxC = Math.max(1, ...cats.map((g) => g.x.rev));
    const inv = P.R.inventory(from, to, branches).filter((x) => x.open || x.inn || x.sold || x.close || x.tin || x.tout || x.adj);
    const invBy = {}; for (const x of inv) { const c = C.parse(x.k).c; (invBy[c] = invBy[c] || []).push(x); }
    return h('div', null,
      head('الجرد والتقارير', hero((M.br ? P.branchName(M.br) : 'كل الفروع') + ' — ' + label, money(r.rev), h('span', null, r.inv + ' فاتورة'), h('span', null, r.bottles + ' قطعة'))),
      h('div', { class: 'w' },
        h('div', { class: 'seg' }, [['day', 'يومي'], ['month', 'شهري'], ['year', 'سنوي']].map(([v, l]) => h('button', { class: M.mode === v ? 'on' : '', onclick: () => { M.mode = v; M.anchor = P.dayKey(); draw(); } }, l))),
        h('div', { class: 'dnav' }, h('button', { class: 'ib b', 'aria-label': 'اللي قبله', onclick: () => step(-1) }, '›'), h('b', null, label), h('button', { class: 'ib b', 'aria-label': 'اللي بعده', onclick: () => step(1) }, '‹')),
        P.select([['', 'كل الفروع']].concat(P.branches().map(([b, br]) => [b, br.n])), M.br, { class: 'inp', style: { marginBottom: '12px' }, onchange: (e) => { M.br = e.target.value; draw(); } }),
        h('div', { class: 'kp' }, kpi('متوسط الفاتورة', money(r.avg)), kpi('طلبات الموقع', r.web, r.webRev ? P.fmt.money(r.webRev) : null), S.isOwner ? kpi('ربح بعد المصاريف', money(r.net)) : kpi('خصومات', money(r.disc)), kpi('المصاريف', money(r.exp), r.expN ? r.expN + ' مصروف' : null)),
        sec('اتباع إيه'),
        h('div', { class: 'card list' }, cats.length ? cats.map((g) => h('div', { class: 'cgrp' },
          h('div', { class: 'br' }, h('b', null, catDot(g.c), g.cat.n), money(g.x.rev)),
          h('div', { class: 'bar' }, h('i', { style: { width: Math.round((g.x.rev / maxC) * 100) + '%', background: C.color(g.c) } })),
          h('div', { class: 'chips' }, Object.entries(g.x.sizes || {}).filter(([, v]) => v.q).map(([s, v]) => h('span', { class: 'chip' }, h('span', null, (C.size(g.c, s) || {}).n || ''), h('b', { class: 'num' }, '×' + v.q)))))) : h('div', { class: 'empty' }, 'مفيش مبيعات في الفترة دي')),
        Object.keys(r.byUser).length ? h('div', null, sec('مبيعات كل بياع'), h('div', { class: 'card list' }, Object.values(r.byUser).sort((x, y) => y.rev - x.rev).map((u) => h('div', { class: 'br row-line' }, h('div', null, h('b', null, u.n), h('div', { class: 'mut' }, (M.br ? '' : P.branchName(u.b) + ' · ') + u.inv + ' فاتورة · ' + u.bottles + ' قطعة')), money(u.rev))))) : null,
        (() => { const ex = P.R.expenses(from, to, branches).filter((e) => !e.void); return ex.length ? h('div', null, sec('المصاريف', money(r.exp)), h('div', { class: 'card list' }, ex.slice(0, 80).map((e) => h('div', { class: 'br row-line' }, h('div', null, h('b', null, e.r), h('div', { class: 'mut' }, (M.br ? '' : P.branchName(e.b) + ' · ') + (M.mode === 'day' ? P.fmt.time(e.ts) : P.fmt.dt(e.ts)) + (P.sellerOf(e) ? ' · ' + P.sellerOf(e) : '') + (e.note ? ' · ' + e.note : ''))), money(e.amt))))) : null; })(),
        !M.br && P.branches().length > 1 ? h('div', null, sec('الفروع'), h('div', { class: 'card list' }, P.branches().map(([b, br]) => { const x = r.byBranch[b] || { rev: 0, bottles: 0, inv: 0 }; return h('div', { class: 'br row-line' }, h('div', null, h('b', null, br.n), h('div', { class: 'mut' }, x.inv + ' فاتورة · ' + x.bottles + ' قطعة')), money(x.rev)); }))) : null,
        sec('جرد المخزون'),
        Object.keys(invBy).length ? Object.entries(invBy).map(([c, rows]) => h('div', { class: 'card list' },
          h('div', { class: 'grp-t' }, catDot(c), (C.cat(c) || {}).n || ''),
          h('div', { class: 'inv-h' }, h('span', null, 'الصنف'), h('span', null, 'أول'), h('span', null, 'وارد'), h('span', null, 'مباع'), h('span', null, 'آخر')),
          rows.map((x) => h('div', { class: 'inv-r' }, h('span', null, short(x.k)), h('span', { class: 'num' }, x.open), h('span', { class: 'num' }, x.inn + x.tin + x.tout + x.adj), h('span', { class: 'num' }, x.sold), h('b', { class: 'num' }, x.close))))) : h('div', { class: 'card empty' }, 'مفيش حركة مخزون')));
  }

  /* ---------- shifts: when each branch opened / closed, who worked, cash ---------- */
  function shifts() {
    const d = M.shd;
    const all = P.R.shifts(d, d, M.shb ? [M.shb] : null).sort((x, y) => x.open - y.open);
    const pres = S.get('presence') || {};
    const brs = P.branches().filter(([b]) => !M.shb || b === M.shb);
    const openNow = all.filter((sh) => !sh.close).length;
    const step = (n) => { M.shd = P.addDays(M.shd, n); draw(); };
    const unit = (n, one, two, few) => (n === 2 ? two : n >= 3 && n <= 10 ? few : one);
    const dur = (a, b) => { const m = Math.max(0, Math.round((b - a) / 60000)); const hh = Math.floor(m / 60); const mm = m % 60; const hs = hh ? (hh === 2 ? unit(hh, 'ساعة', 'ساعتان', 'ساعات') : hh + ' ' + unit(hh, 'ساعة', 'ساعتان', 'ساعات')) : ''; const ms = mm ? (mm === 2 ? 'دقيقتان' : mm + ' ' + unit(mm, 'دقيقة', 'دقيقتان', 'دقائق')) : ''; return hs && ms ? hs + ' ' + ms : hs || ms || '0 دقيقة'; };
    return h('div', null,
      head('الورديات', hero(P.fmt.day(d), String(all.length), h('span', null, 'عدد الورديات'), openNow ? h('span', { class: 'o' }, openNow + ' شغالة دلوقتي') : null)),
      h('div', { class: 'w' },
        h('div', { class: 'dnav' }, h('button', { class: 'ib b', 'aria-label': 'اليوم اللي قبله', onclick: () => step(-1) }, '›'), h('b', null, P.fmt.day(d)), h('button', { class: 'ib b', 'aria-label': 'اليوم اللي بعده', disabled: d >= P.dayKey(), onclick: () => step(1) }, '‹')),
        P.select([['', 'كل الفروع']].concat(P.branches().map(([b, br]) => [b, br.n])), M.shb, { class: 'inp', style: { marginBottom: '12px' }, onchange: (e) => { M.shb = e.target.value; draw(); } }),
        brs.length ? brs.map(([b, br]) => {
          const list = all.filter((sh) => sh.b === b);
          const first = list.length ? Math.min(...list.map((sh) => sh.open)) : null;
          const lastClose = list.length && list.every((sh) => sh.close) ? Math.max(...list.map((sh) => sh.close)) : null;
          const on = Object.values(pres).some((p) => p && p.b === b && Date.now() - p.ts < 150000);
          return h('div', { class: 'card list' },
            h('div', { class: 'br' }, h('b', null, h('span', { class: 'dot' + (on ? ' on' : '') }), br.n), list.length ? (lastClose ? h('span', { class: 'pill' }, 'مقفول') : h('span', { class: 'pill ok' }, 'فاتح')) : h('span', { class: 'pill e' }, 'مفتحش')),
            list.length ? h('div', { class: 'kp sh-kp' },
              kpi('فتح الساعة', P.fmt.time(first)),
              kpi('قفل الساعة', lastClose ? P.fmt.time(lastClose) : 'لسه فاتح'),
              kpi('مصاريف اليوم', money(P.R.expenses(d, d, [b]).filter((e) => !e.void).reduce((x, e) => x + P.num(e.amt), 0)))) : h('div', { class: 'mut' }, d === P.dayKey() ? 'لسه محدش فتح وردية النهارده' : 'مفيش ورديات اليوم ده'),
            list.map((sh) => {
              const live = P.A.shiftSummary({ ...sh }); const sum = live.inv || live.voided || live.expN || !sh.sum ? live : { ...sh.sum, bySeller: sh.sum.bySeller || {} };
              const cash = P.num((sum.pay || {}).cash);
              const expected = P.num(sh.cash0) + cash - P.num(sum.exp);
              const diff = sh.close ? P.num(sh.cash1) - expected : null;
              return h('div', { class: 'shift' },
                h('div', { class: 'br' }, h('div', null, h('b', null, sh.pn || sh.n || sh.u || 'موظف'), sh.pn && sh.n ? h('span', { class: 'mut' }, ' · حساب ' + sh.n) : null), money(sum.tot)),
                h('div', { class: 'mut' }, 'من ' + P.fmt.time(sh.open) + ' لـ ' + (sh.close ? P.fmt.time(sh.close) : 'دلوقتي') + ' · ' + dur(sh.open, sh.close || Date.now())),
                h('div', { class: 'chips' },
                  h('span', { class: 'chip' }, h('span', null, 'فواتير'), h('b', { class: 'num' }, sum.inv)),
                  h('span', { class: 'chip' }, h('span', null, 'قطع'), h('b', { class: 'num' }, P.num(sum.bottles || sum.items))),
                  h('span', { class: 'chip' }, h('span', null, 'كاش أول الوردية'), h('b', { class: 'num' }, P.fmt.n(sh.cash0))),
                  sum.exp ? h('span', { class: 'chip neg' }, h('span', null, 'مصاريف'), h('b', { class: 'num' }, P.fmt.n(sum.exp))) : null,
                  h('span', { class: 'chip' }, h('span', null, 'المفروض في الدرج'), h('b', { class: 'num' }, P.fmt.n(expected))),
                  sh.close ? h('span', { class: 'chip' }, h('span', null, 'اتعد في الدرج'), h('b', { class: 'num' }, P.fmt.n(sh.cash1))) : null,
                  diff ? h('span', { class: 'chip ' + (diff < 0 ? 'neg' : 'pos') }, h('span', null, diff < 0 ? 'عجز' : 'زيادة'), h('b', { class: 'num' }, P.fmt.n(Math.abs(diff)))) : null,
                  sum.voided ? h('span', { class: 'chip neg' }, h('span', null, 'فواتير ملغية'), h('b', { class: 'num' }, sum.voided)) : null),
                Object.keys(sum.bySeller || {}).length > 1 || (Object.keys(sum.bySeller || {})[0] && Object.keys(sum.bySeller)[0] !== (sh.pn || sh.n)) ? h('div', { class: 'sellers' }, h('span', { class: 'mut' }, 'مبيعات كل بياع:'), Object.entries(sum.bySeller).sort((x, y) => y[1].tot - x[1].tot).map(([n, x]) => h('span', { class: 'chip' }, h('span', null, n), h('b', { class: 'num' }, P.fmt.n(x.tot)), h('small', null, ' (' + x.inv + ')')))) : null,
                sh.note ? h('div', { class: 'mut' }, 'ملاحظة: ' + sh.note) : null);
            }));
        }) : h('div', { class: 'card empty' }, 'مفيش فروع')));
  }

  /* ---------- stock ---------- */
  /* ---------- main account: change stock from the phone ---------- */
  function editStock(b, k) {
    const cur = P.qty(b, k);
    const add = P.input({ type: 'number', inputmode: 'numeric', min: 0, placeholder: 'كام قطعة دخلت؟' });
    const set = P.input({ type: 'number', inputmode: 'numeric', min: 0, placeholder: 'العدد الصح دلوقتي' });
    const note = P.input({ placeholder: 'ملاحظة (اختياري)' });
    P.modal({
      title: C.label(k), sub: P.branchName(b),
      body: h('div', null, h('div', { class: 'stk-big num' }, cur), h('div', { class: 'ed-hint', style: { textAlign: 'center' } }, 'الموجود دلوقتي في السيستم'),
        P.field('استلمت بضاعة (بيتزوّد على الموجود)', add), P.field('أو عدّيت بإيدك (بيتظبط على الرقم ده)', set), P.field('ملاحظة', note)),
      actions: [{ label: 'حفظ', kind: 'primary', onClick: (close) => {
        const q = Math.round(P.num(add.value)); const hasSet = set.value !== '';
        if (!q && !hasSet) throw new Error('اكتب الكمية اللي دخلت أو العدد الصح');
        if (q < 0) throw new Error('الكمية لازم تكون أكبر من صفر');
        if (hasSet) P.A.adjust(b, k, set.value, note.value.trim() || 'تسوية من الموبايل');
        else P.A.receive(b, [{ k, q }], note.value.trim() || 'استلام من الموبايل');
        P.toast('المخزون اتعدّل'); close(); draw();
      } }],
    });
  }

  /* ---------- main account: sizes, prices, original items and photos ---------- */
  function prices() {
    const cats = C.cats(true);
    if (!M.pc || !C.cat(M.pc)) M.pc = cats.length ? cats[0][0] : '';
    const c = M.pc; const cat = C.cat(c) || {};
    const byP = cat.mode === 'product' || cat.mode === 'item'; const isItem = cat.mode === 'item';
    const sizes = C.sizes(c, true); const prods = C.prods(c, true);
    const go = () => draw();
    const move = (list, id, dir, pathOf) => { const ids = list.map(([x]) => x); const i = ids.indexOf(id); const j = i + dir; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; const up = {}; ids.forEach((x, n) => { up[pathOf(x)] = n + 1; }); P.CatEdit.save(up); draw(); };
    const ord = (list, id, pathOf) => { const i = list.findIndex(([x]) => x === id); return h('div', { class: 'ordb', onclick: (e) => e.stopPropagation() },
      h('button', { 'aria-label': 'لفوق', disabled: i <= 0, onclick: () => move(list, id, -1, pathOf) }, P.icon('up', 14)),
      h('button', { 'aria-label': 'لتحت', disabled: i >= list.length - 1, onclick: () => move(list, id, 1, pathOf) }, P.icon('down', 14))); };
    const thumb = (id, v, fill) => { const t = h('span', { class: 'thumb' }, P.bottle ? P.bottle(fill || 0.6, C.color(c), 16) : ''); if (v) P.loadThumb(id, v, t); return t; };
    return h('div', null,
      head('الأحجام والأسعار', hero(cat.n || '', String(byP ? prods.length : sizes.length), h('span', null, byP ? 'صنف' : 'حجم'))),
      h('div', { class: 'w' },
        h('div', { class: 'bchips' }, cats.map(([id, ct]) => h('button', { class: id === c ? 'on' : '', onclick: () => { M.pc = id; draw(); } }, ct.n))),
        h('div', { class: 'ed-hint' }, 'أي تغيير هنا بيوصل لكل الفروع والموقع في نفس اللحظة. دوس على أي سطر علشان تغيّر السعر أو الصورة، والأسهم للترتيب.'),
        !c ? h('div', { class: 'card empty' }, 'مفيش خانات') : h('div', null,
          isItem ? null : h('div', { class: 'card list' },
            h('div', { class: 'grp-t' }, catDot(c), 'أحجام ' + cat.n),
            sizes.length ? sizes.map(([s, sz]) => h('div', { class: 'prow' + (sz.on === false ? ' off' : ''), onclick: () => P.CatEdit.size(c, s, go) },
              ord(sizes, s, (x) => `catalog/cats/${c}/sizes/${x}/ord`),
              byP ? null : thumb(P.CatEdit.sizeImgId(c, s), sz.img, C.fill(c, s)),
              h('div', { class: 'pn' }, h('b', null, sz.n), h('small', null, [sz.on === false ? 'مقفول' : '', !byP && sz.web === false ? 'مش ظاهر على الموقع' : ''].filter(Boolean).join(' · '))),
              byP ? null : h('div', { class: 'pp num' }, C.hasPrice(c, s) ? P.fmt.money(sz.price) : h('span', { class: 'pill e' }, 'من غير سعر')))) : h('div', { class: 'empty' }, 'مفيش أحجام لسه'),
            h('button', { class: 'btn lt addb', onclick: () => P.CatEdit.size(c, null, go) }, P.icon('plus', 16), 'حجم جديد')),
          byP ? h('div', { class: 'card list' },
            h('div', { class: 'grp-t' }, catDot(c), (isItem ? 'أصناف ' : 'منتجات ') + cat.n),
            prods.length ? prods.map(([pid, p]) => h('div', { class: 'prow' + (p.on === false ? ' off' : ''), onclick: () => P.CatEdit.prod(c, pid, go) },
              ord(prods, pid, (x) => `catalog/prods/${x}/ord`),
              thumb(pid, p.img),
              h('div', { class: 'pn' }, h('b', null, p.n), h('small', null, sizes.filter(([s]) => p.prices && p.prices[s] !== undefined && p.prices[s] !== '').map(([s, sz]) => (isItem ? '' : sz.n + ': ') + P.fmt.n(p.prices[s])).join(' · ') + (p.web === false ? ' · مش ظاهر على الموقع' : ''))))) : h('div', { class: 'empty' }, 'مفيش أصناف لسه'),
            h('button', { class: 'btn lt addb', onclick: () => P.CatEdit.prod(c, null, go) }, P.icon('plus', 16), isItem ? 'صنف جديد' : 'منتج جديد')) : null)));
  }

  function stock() {
    const bs = P.branches();
    const b = M.sbr || (bs[0] || [])[0];
    const st = b ? P.stockOf(b) : {};
    const lim = P.lowLimit();
    const keys = C.keys();
    const low = keys.filter((kk) => P.num(st[kk]) <= lim).length;
    const by = {}; for (const kk of keys) { const c = C.parse(kk).c; (by[c] = by[c] || []).push(kk); }
    return h('div', null,
      head('المخزون لحظة بلحظة', hero(b ? P.branchName(b) : '', h('span', { class: 'num' }, P.fmt.n(keys.reduce((a, kk) => a + Math.max(0, P.num(st[kk])), 0)), h('small', null, ' قطعة')), h('span', null, low ? low + ' صنف قرب يخلص' : 'المخزون كويس'))),
      h('div', { class: 'w' },
        h('div', { class: 'bchips' }, bs.map(([id, br]) => h('button', { class: id === b ? 'on' : '', onclick: () => { M.sbr = id; draw(); } }, br.n))),
        Object.entries(by).map(([c, ks]) => h('div', { class: 'card list' },
          h('div', { class: 'grp-t' }, catDot(c), c === 'pool' ? 'أزايز الفرع — رصيد واحد لكل الزيوت' : (C.cat(c) || {}).n || ''),
          h('div', { class: 'stk' }, ks.map((kk) => { const q = P.num(st[kk]);
            return h('div', { class: 'sk ' + (q <= 0 ? 'ze' : q <= lim ? 'lo' : '') + (S.isOwner ? ' ed' : ''), role: S.isOwner ? 'button' : null, tabindex: S.isOwner ? 0 : null, onclick: S.isOwner ? () => editStock(b, kk) : null }, h('span', null, short(kk)), h('b', { class: 'num' }, q)); }))))));
  }
  boot().catch((e) => { root().textContent = 'حصلت مشكلة: ' + e.message; });
})();
