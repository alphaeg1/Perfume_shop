/* Sample data for "try the system" mode */
(function () {
  const P = window.P;
  P.seedDemo = async function () {
    const D = P.Demo; await D.load();
    const T = {};
    const now = Date.now();
    const auth = (T.__auth = {});
    const mkUser = (u, n, role, b) => { const uid = 'u_' + u; auth[(u + '@demo.app').replace(/\./g, '_')] = { uid, pw: '123456', email: u + '@demo.app' }; return [uid, { u, n, role, b: b || null, email: u + '@demo.app', ts: now }]; };
    T.catalog = P.defaultCatalog();
    const sz = (a, b, c) => ({ s100: { n: '100 مللي', ml: 100, price: a, ord: 1, on: true, web: true }, s50: { n: '50 مللي', ml: 50, price: b, ord: 2, on: true, web: true }, s30: { n: '30 مللي', ml: 30, price: c, ord: 3, on: true, web: true } });
    T.catalog.cats.fr.sizes = sz(500, 300, 200); T.catalog.cats.gu.sizes = sz(650, 380, 250); T.catalog.cats.sh.sizes = sz(600, 350, 230);
    T.catalog.cats.or.sizes = { s100: { n: '100 مللي', ml: 100, price: 0, ord: 1, on: true }, s50: { n: '50 مللي', ml: 50, price: 0, ord: 2, on: true } };
    T.catalog.prods = {};
    T.costs = { fr: { s100: 180, s50: 110, s30: 75 }, gu: { s100: 240, s50: 140, s30: 95 }, sh: { s100: 220, s50: 130, s30: 85 } };
    T.branches = {
      bma: { n: 'فرع المعادي', code: 'MA', addr: 'شارع 9', phone: '01000000001', on: true, ord: 1, perms: { ...P.DEFAULT_PERMS, view_reports: true } },
      bnc: { n: 'فرع مدينة نصر', code: 'NC', addr: 'عباس العقاد', phone: '01000000002', on: true, ord: 2, perms: { ...P.DEFAULT_PERMS } },
      bhr: { n: 'فرع الهرم', code: 'HR', addr: 'شارع الهرم', phone: '01000000003', on: true, ord: 3, perms: { ...P.DEFAULT_PERMS } },
    };
    const users = [mkUser('admin', 'صاحب البراند', 'owner'), mkUser('maadi', 'أحمد', 'staff', 'bma'), mkUser('maadi2', 'سارة', 'staff', 'bma'), mkUser('nasr', 'محمود', 'staff', 'bnc'), mkUser('haram', 'كريم', 'staff', 'bhr')];
    T.users = {}; T.logins = {};
    for (const [uid, u] of users) { T.users[uid] = u; T.logins[u.u] = { e: u.email }; }
    T.meta = { owner: 'u_admin' };
    T.public = {
      site: { name: 'اسم البراند', nameEn: 'BRAND', slogan: 'غيّر الاسم واللوجو من تبويب الموقع', open: true, low: 5, primary: '#F2C230', accent: '#F2C230', phones: ['01000000000'], wa: '01000000000', addr: 'القاهرة',
        areas: { a1: { n: 'المعادي', fee: 40, ord: 1 }, a2: { n: 'مدينة نصر', fee: 45, ord: 2 }, a3: { n: 'الهرم وفيصل', fee: 50, ord: 3 }, a4: { n: 'التجمع', fee: 60, ord: 4 } } },
      routing: { mode: 'area', areas: { a1: { bma: true }, a2: { bnc: true }, a3: { bhr: true }, a4: { bma: true, bnc: true } }, fallback: 'bma' },
    };
    T.rev = { cat: now, br: now, us: now, site: now, cost: now };
    // history
    T.day = {}; T.days = {};
    const keysFor = (c) => Object.keys(T.catalog.cats[c].sizes);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const start = P.addDays(P.dayKey(), -75);
    for (const b in T.branches) {
      const d0 = start; const node = (T.day[d0] = T.day[d0] || {})[b] = { m: {} };
      for (const c in T.catalog.cats) for (const s of keysFor(c)) {
        if (c === 'or') continue;
        if (c === 'or') continue;
        node.m['m' + P.uid(3)] = { k: `${c}|${s}`, q: 220, t: 'init', ts: P.parseDay(d0).getTime() + 3600e3, by: 'u_admin', bn: 'صاحب البراند', note: 'رصيد أول' };
      }
      (T.days[b] = T.days[b] || {})[d0] = now;
    }
    const staff = { bma: ['u_maadi', 'أحمد', 'maadi'], bnc: ['u_nasr', 'محمود', 'nasr'], bhr: ['u_haram', 'كريم', 'haram'] };
    for (const d of P.daysBetween(P.addDays(start, 1), P.dayKey())) {
      for (const b in T.branches) {
        const n = 4 + Math.floor(rnd() * (b === 'bma' ? 9 : 6));
        const node = ((T.day[d] = T.day[d] || {})[b] = T.day[d][b] || {});
        node.s = node.s || {};
        for (let i = 0; i < n; i++) {
          const c = pick(['fr', 'fr', 'fr', 'gu', 'gu', 'sh']); const s = pick(keysFor(c)); const p = null;
          const q = rnd() < 0.8 ? 1 : 2;
          const price = T.catalog.cats[c].sizes[s].price;
          const ts = P.parseDay(d).getTime() + (11 + Math.floor(rnd() * 11)) * 3600e3 + Math.floor(rnd() * 3600e3);
          if (ts > now) continue;
          const id = 'x' + P.uid(4);
          const k = `${c}|${s}`;
          const sub = q * price;
          const [by, bn, bu] = staff[b];
          node.s[id] = { id, no: T.branches[b].code + '-' + P.shortCode(5), ts, d, b, by, bn, bu, items: [{ k, c, s, p, n: T.catalog.cats[c].sizes[s].n.replace(/^/, T.catalog.cats[c].n + ' — '), q, pr: price }], sub, disc: 0, tot: sub, pay: pick(['cash', 'cash', 'cash', 'wallet', 'card']), src: 'pos' };
        }
        if (rnd() < 0.15) { node.m = node.m || {}; for (const c of ['fr', 'gu', 'sh']) for (const s of keysFor(c)) node.m['m' + P.uid(3)] = { k: `${c}|${s}`, q: 30, t: 'in', ts: P.parseDay(d).getTime() + 10 * 3600e3, by: 'u_admin', bn: 'صاحب البراند', note: 'شحنة' }; }
        (T.days[b] = T.days[b] || {})[d] = now;
      }
    }
    // open web orders
    T.orders = { open: { bma: {}, bnc: {} } };
    const mkOrder = (b, n, ph, area, areaN, items, st, mins) => {
      const id = 'o' + P.uid(4); const sub = items.reduce((a, it) => a + it.q * it.pr, 0); const fee = T.public.site.areas[area].fee;
      T.orders.open[b][id] = { code: P.shortCode(5), ts: now - mins * 60e3, st, src: 'web', b, c: { n, ph, area, areaN, addr: 'شارع 15 عمارة 4 الدور التالت' }, items, sub, fee, tot: sub + fee, pay: 'cod' };
    };
    mkOrder('bma', 'منة الله', '01012345678', 'a1', 'المعادي', [{ c: 'fr', s: 's100', p: null, n: 'فرنساوي', sn: '100 مللي', q: 1, pr: 500 }, { c: 'gu', s: 's30', p: null, n: 'خليجي', sn: '30 مللي', q: 1, pr: 250 }], 'new', 4);
    mkOrder('bnc', 'يوسف', '01198765432', 'a2', 'مدينة نصر', [{ c: 'gu', s: 's50', p: null, n: 'خليجي', sn: '50 مللي', q: 2, pr: 380 }], 'prep', 38);
    T.track = {};
    for (const b in T.orders.open) for (const id in T.orders.open[b]) T.track[id] = { s: T.orders.open[b][id].st, ts: now };
    D.tree = T; await P.kv.set('demo:db', T);
  };
})();
