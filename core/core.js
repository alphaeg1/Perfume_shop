/* Business rules: catalog, permissions, stock, sales, orders, reports */
(function () {
  const P = window.P;
  const S = P.S;

  // ---------------- permissions ----------------
  P.PERMS = [
    ['pos_sell', 'البيع من الكاشير'],
    ['pos_discount', 'يعمل خصم على الفاتورة'],
    ['pos_void', 'يلغي فاتورة'],
    ['view_stock', 'يشوف مخزون الفرع'],
    ['stock_receive', 'يستلم بضاعة ويزوّد المخزون'],
    ['stock_adjust', 'يعمل تسوية جرد (ينقّص المخزون)'],
    ['web_orders', 'يستلم طلبات الموقع'],
    ['view_reports', 'يشوف جرد وتقارير الفرع'],
    ['view_shift_total', 'يشوف إجمالي الشيفت بتاعه'],
  ];
  P.DEFAULT_PERMS = { pos_sell: true, pos_discount: false, pos_void: false, view_stock: false, stock_receive: false, stock_adjust: false, web_orders: true, view_reports: false, view_shift_total: true };
  P.permsOf = function (u) {
    if (!u) return {};
    if (u.role === 'owner') { const all = {}; P.PERMS.forEach(([k]) => (all[k] = true)); return all; }
    const br = S.get(`branches/${u.b}`) || {};
    return Object.assign({}, br.perms || {}, u.perms || {});
  };
  P.can = (k) => P.permsOf(S.me)[k] === true;

  // ---------------- catalog ----------------
  const byOrd = (a, b) => (P.num(a[1].ord) - P.num(b[1].ord)) || String(a[0]).localeCompare(String(b[0]));
  const C = (P.C = {
    cats(all) { return P.ents(S.get('catalog/cats')).filter(([, c]) => all || c.on !== false).sort(byOrd); },
    cat(c) { return S.get(`catalog/cats/${c}`); },
    sizes(c, all) { const cat = C.cat(c) || {}; return P.ents(cat.sizes).filter(([, s]) => all || s.on !== false).sort(byOrd); },
    size(c, s) { return S.get(`catalog/cats/${c}/sizes/${s}`); },
    prods(c, all) { return P.ents(S.get('catalog/prods')).filter(([, p]) => (!c || p.c === c) && (all || p.on !== false)).sort(byOrd); },
    prod(p) { return S.get(`catalog/prods/${p}`); },
    base(c, s, p) {
      const pr = p && C.prod(p);
      if (pr && pr.prices && pr.prices[s] !== undefined && pr.prices[s] !== null && pr.prices[s] !== '') return P.num(pr.prices[s]);
      const sz = C.size(c, s);
      return sz && sz.price !== '' && sz.price !== null && sz.price !== undefined ? P.num(sz.price) : 0;
    },
    // ---- offers: catalog/offers/{id} = {t, c, s, p, kind:'pct'|'amt'|'price', val, from, to, on, web}
    offers(all) { return P.ents(S.get('catalog/offers')).filter(([, o]) => o && (all || C.offerLive(o))).sort((a, b) => P.num(b[1].ts) - P.num(a[1].ts)); },
    offerLive(o, day) { const d = day || P.dayKey(); return !!o && o.on !== false && (!o.from || o.from <= d) && (!o.to || o.to >= d); },
    offerState(o) { const d = P.dayKey(); if (o.on === false) return 'off'; if (o.from && o.from > d) return 'soon'; if (o.to && o.to < d) return 'done'; return 'live'; },
    offerFor(c, s, p) {
      let best = null, rank = -1;
      for (const [id, o] of C.offers()) {
        if (o.c !== c) continue;
        let r = -1;
        if (o.p) { if (o.p === p && (!o.s || o.s === s)) r = 3; }
        else if (o.s) { if (o.s === s) r = 2; }
        else r = 1;
        if (r > rank) { rank = r; best = { id, ...o }; }
      }
      return best;
    },
    applyOffer(o, base) {
      if (!o || !base) return base;
      const v = P.num(o.val);
      const out = o.kind === 'price' ? v : o.kind === 'amt' ? base - v : base * (1 - v / 100);
      return Math.max(0, Math.round(out));
    },
    price(c, s, p) { const b = C.base(c, s, p); return C.applyOffer(C.offerFor(c, s, p), b); },
    hasPrice(c, s, p) {
      const pr = p && C.prod(p);
      if (C.byProduct(c)) return !!(pr && pr.prices && pr.prices[s] !== undefined && pr.prices[s] !== '' && pr.prices[s] !== null);
      const sz = C.size(c, s); return !!sz && sz.price !== '' && sz.price !== null && sz.price !== undefined && P.num(sz.price) > 0;
    },
    cost(c, s, p) {
      const co = S.get('costs') || {};
      if (p && co.p && co.p[p] && co.p[p][s] !== undefined) return P.num(co.p[p][s]);
      return P.num(co[c] && co[c][s]);
    },
    byProduct(c) { const cat = C.cat(c); return !!(cat && (cat.mode === 'product' || cat.mode === 'item')); },
    isItem(c) { const cat = C.cat(c); return !!(cat && cat.mode === 'item'); },
    key(c, s, p) { return C.byProduct(c) && p ? `${c}|${s}|${p}` : `${c}|${s}`; },
    parse(k) { const [c, s, p] = String(k).split('|'); return { c, s, p: p || null }; },
    label(k, short) {
      const { c, s, p } = C.parse(k);
      const cat = C.cat(c); const sz = C.size(c, s); const pr = p && C.prod(p);
      const parts = [];
      if (!short || !pr) parts.push(cat ? cat.n : 'قسم محذوف');
      if (pr) parts.push(pr.n);
      if (!(C.isItem(c) && pr)) parts.push(sz ? sz.n : 'حجم محذوف');
      return parts.join(' — ');
    },
    // every stock line the business tracks
    keys() {
      const out = [];
      for (const [c] of C.cats(true)) for (const [s] of C.sizes(c, true)) {
        if (C.byProduct(c)) { for (const [p, pr] of C.prods(c, true)) if (pr.prices && pr.prices[s] !== undefined && pr.prices[s] !== '') out.push(`${c}|${s}|${p}`); }
        else out.push(`${c}|${s}`);
      }
      return out;
    },
    color(c) { const cat = C.cat(c); return (cat && cat.color) || '#6E5A68'; },
    fill(c, s) { // relative bottle fill by ml inside its category
      const list = C.sizes(c, true).map(([, z]) => P.num(z.ml)).filter(Boolean);
      const ml = P.num((C.size(c, s) || {}).ml);
      const max = Math.max(...list, 1);
      return ml ? 0.25 + 0.7 * (ml / max) : 0.6;
    },
  });

  P.branches = (all) => P.ents(S.get('branches')).filter(([, b]) => all || b.on !== false).sort(byOrd);
  P.branchName = (b) => (b === '_inbox' ? 'لسه متوزعش' : ((S.get(`branches/${b}`) || {}).n || 'فرع محذوف'));
  P.myBranches = () => (S.seesAll ? P.branches().map(([id]) => id) : [S.me.b]);

  // ---------------- customers ----------------
  // one shape for every phone number: 01xxxxxxxxx
  P.normPh = (x) => { let d = String(x || '').replace(/[٠-٩]/g, (ch) => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/\D/g, ''); if (d.startsWith('0020')) d = d.slice(2); if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2); if (d.length === 10 && d[0] === '1') d = '0' + d; return d; };
  // sellers: names of the people working at a branch (no account / password needed)
  P.people = (b) => Object.entries((b && S.get(`branches/${b}/ppl`)) || {}).filter(([, p]) => p && p.n && !p.off).sort((x, y) => (P.num(x[1].ord) - P.num(y[1].ord)) || String(x[1].n).localeCompare(String(y[1].n), 'ar'));
  P.EXP_SUGGEST = ['أكل وشرب', 'شاي وقهوة', 'مواصلات', 'نظافة', 'كهرباء', 'مياه', 'إنترنت', 'شحن', 'أكياس وتغليف', 'صيانة', 'سلفة', 'إيجار'];
  P.expNames = () => { const f = {}; P.eachDay((d, b, n) => { for (const e of Object.values(n.e || {})) if (e && e.r) f[e.r] = (f[e.r] || 0) + 1; }); return Object.keys(f).sort((a, b) => f[b] - f[a]).concat(P.EXP_SUGGEST.filter((x) => !f[x])).slice(0, 60); };
  P.sellerOf = (s) => (s && (s.spn || s.bn)) || '';
  P.itemText = (it) => P.num(it.q) + '× ' + (it.n || '') + (it.oil ? ' (' + it.oil + ')' : '');
  // every purchase of a phone number: local copy first, then the shared cloud index (other branches)
  P.custSales = async function (phone) {
    const ph = P.normPh(phone); const map = {};
    if (ph.length < 10) return [];
    eachDay((d, b, node) => {
      for (const id of Object.keys(node.s || {})) {
        const s = node.s[id];
        if (s && s.cust && P.normPh(s.cust.ph) === ph) map[id] = { id, ts: s.ts, d, b, no: s.no, tot: s.tot, cn: s.cust.n || '', items: P.itemsOf(s), void: !!s.void, src: s.src };
      }
    });
    try {
      const cloud = (await P.FB.get(`cust/${ph}`)) || {};
      for (const id of Object.keys(cloud)) { const x = cloud[id]; if (x && !map[id]) map[id] = { id, ...x, items: P.arr(x.items), void: !!x.void }; }
    } catch (e) { /* offline or not allowed: local copy is enough */ }
    return Object.values(map).sort((a, b) => b.ts - a.ts);
  };
  // the scent names already typed before, most used first (for quick picking at the cashier)
  P.oilNames = function () {
    const n = {};
    eachDay((d, b, node) => { for (const s of P.arr(node.s)) for (const it of P.itemsOf(s)) if (it.oil) n[it.oil] = (n[it.oil] || 0) + P.num(it.q || 1); });
    return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 400);
  };

  // ---------------- data walkers ----------------
  function eachDay(fn, from, to, branches) {
    const day = S.get('day') || {};
    const bset = branches ? new Set(branches) : null;
    for (const d of Object.keys(day)) {
      if ((from && d < from) || (to && d > to)) continue;
      for (const b of Object.keys(day[d] || {})) {
        if (bset && !bset.has(b)) continue;
        fn(d, b, day[d][b] || {});
      }
    }
  }
  P.eachDay = eachDay;
  P.itemsOf = (sale) => P.arr(sale && sale.items).filter((it) => it && it.k);

  // ---------------- stock ----------------
  let memo = { v: -1, stock: {} };
  P.stockOf = function (b) {
    if (memo.v !== S.ver) memo = { v: S.ver, stock: {} };
    if (memo.stock[b]) return memo.stock[b];
    const st = {};
    eachDay((d, bb, node) => {
      for (const m of P.arr(node.m)) if (m && m.k) st[m.k] = (st[m.k] || 0) + P.num(m.q);
      for (const sale of P.arr(node.s)) {
        if (!sale || sale.void) continue;
        for (const it of P.itemsOf(sale)) st[it.k] = (st[it.k] || 0) - P.num(it.q);
      }
    }, null, null, [b]);
    memo.stock[b] = st;
    return st;
  };
  P.qty = (b, k) => P.num(P.stockOf(b)[k]);
  P.lowLimit = () => P.num((S.get('public/site') || {}).low) || 5;

  // ---------------- actions ----------------
  const who = () => ({ by: S.me.uid, bu: S.me.u || '', bn: S.me.n || '' });
  const A = (P.A = {
    // items: [{c,s,p,q,pr,n}] -> sale
    sell({ b, items, disc = 0, pay = 'cash', cust = null, src = 'pos', oid = null, note = '', sp = null }) {
      if (!items.length) throw new Error('الفاتورة فاضية');
      const d = P.dayKey();
      const id = P.uid();
      const its = items.map((it) => {
        const o = { k: C.key(it.c, it.s, it.p), c: it.c, s: it.s, p: it.p || null, n: it.n || C.label(C.key(it.c, it.s, it.p)), q: P.num(it.q), pr: P.num(it.pr) };
        const oil = String(it.oil || '').trim().slice(0, 60);
        if (oil) o.oil = oil;
        return o;
      });
      const sub = its.reduce((a, it) => a + it.q * it.pr, 0);
      disc = Math.max(0, Math.min(P.num(disc), sub));
      const br = S.get(`branches/${b}`) || {};
      const sale = {
        id, no: (br.code || 'B') + '-' + P.shortCode(5), ts: Date.now(), d, b, ...who(),
        sh: (A.myShift() || {}).id || null, items: its, sub, disc, tot: sub - disc, pay, src,
      };
      if (cust && (cust.n || cust.ph)) sale.cust = cust;
      if (oid) sale.oid = oid;
      if (sp && sp.id && sp.n) { sale.sp = sp.id; sale.spn = String(sp.n).slice(0, 40); }
      if (note) sale.note = note;
      const up = { [`day/${d}/${b}/s/${id}`]: sale };
      S.stampUp(up, b, d);
      S.write(up, 'فاتورة ' + sale.no);
      // customer index: lets any branch look up what this phone number bought before
      const ph = P.normPh(cust && cust.ph);
      if (ph.length >= 10) {
        S.write({ [`cust/${ph}/${id}`]: { ts: sale.ts, d, b, no: sale.no, tot: sale.tot, cn: (cust.n || '').slice(0, 60), items: its.map((x) => ({ c: x.c, s: x.s, p: x.p, n: x.n, q: x.q, pr: x.pr, ...(x.oil ? { oil: x.oil } : {}) })) } }, 'سجل العميل', { silent: true });
      }
      return sale;
    },
    voidSale(b, d, sid, reason) {
      const up = { [`day/${d}/${b}/s/${sid}/void`]: { ts: Date.now(), ...who(), r: reason || '' } };
      S.stampUp(up, b, d);
      S.write(up, 'إلغاء فاتورة');
      const sv = S.get(`day/${d}/${b}/s/${sid}`); const vph = P.normPh(sv && sv.cust && sv.cust.ph);
      if (vph.length >= 10) S.write({ [`cust/${vph}/${sid}/void`]: true }, 'سجل العميل', { silent: true });
    },
    move(b, k, q, t, note, extra) {
      q = Math.round(P.num(q));
      if (!q) return null;
      const d = P.dayKey(); const id = P.uid();
      const m = { id, k, q, t, ts: Date.now(), ...who(), note: note || '', ...(extra || {}) };
      const up = { [`day/${d}/${b}/m/${id}`]: m };
      S.stampUp(up, b, d);
      return up;
    },
    receive(b, lines, note) { // lines: [{k,q}]
      const up = {};
      for (const l of lines) Object.assign(up, A.move(b, l.k, Math.abs(l.q), 'in', note) || {});
      if (Object.keys(up).length) S.write(up, 'استلام بضاعة');
    },
    adjust(b, k, actual, note) {
      const cur = P.qty(b, k);
      const diff = Math.round(P.num(actual)) - cur;
      if (!diff) return 0;
      S.write(A.move(b, k, diff, 'adj', note || 'تسوية جرد', { was: cur }), 'تسوية جرد');
      return diff;
    },
    transfer(from, to, lines, note) {
      const up = {}; const ref = P.uid(4);
      for (const l of lines) {
        const q = Math.abs(Math.round(P.num(l.q))); if (!q) continue;
        Object.assign(up, A.move(from, l.k, -q, 'tout', note, { ref, to }), A.move(to, l.k, q, 'tin', note, { ref, from }));
      }
      if (Object.keys(up).length) S.write(up, 'تحويل بين الفروع');
    },
    // ---------- shifts ----------
    myShift() {
      if (!S.me || !S._shift) return null;
      const sh = S.get(`day/${S._shift.d}/${S._shift.b}/h/${S._shift.id}`);
      return sh && !sh.close ? { ...sh, id: S._shift.id, d: S._shift.d } : null;
    },
    async loadShift() {
      S._shift = (await P.kv.get(`shift:${S.me.uid}`)) || null;
      if (S._shift && !A.myShift()) {
        // maybe closed elsewhere or not synced yet; look it up locally
        const sh = S.get(`day/${S._shift.d}/${S._shift.b}/h/${S._shift.id}`);
        if (sh && sh.close) { S._shift = null; await P.kv.del(`shift:${S.me.uid}`); }
      }
    },
    async openShift(b, cash0, pn) {
      const d = P.dayKey(); const id = P.uid();
      const sh = { id, uid: S.me.uid, u: S.me.u || '', n: S.me.n || '', b, open: Date.now(), cash0: P.num(cash0) };
      if (pn) sh.pn = String(pn).slice(0, 40);
      const up = { [`day/${d}/${b}/h/${id}`]: sh };
      S.stampUp(up, b, d);
      S.write(up, 'فتح شيفت');
      S._shift = { d, b, id };
      await P.kv.set(`shift:${S.me.uid}`, S._shift);
      return sh;
    },
    shiftSummary(sh) {
      const out = { inv: 0, tot: 0, bottles: 0, disc: 0, pay: {}, voided: 0, web: 0, bySeller: {}, exp: 0, expN: 0 };
      if (!sh) return out;
      eachDay((d, b, node) => {
        for (const e of Object.values(node.e || {})) { if (e && !e.void && e.sh === sh.id) { out.exp += P.num(e.amt); out.expN++; } }
        for (const s of P.arr(node.s)) {
          if (!s || s.sh !== sh.id) continue;
          if (s.void) { out.voided++; continue; }
          out.inv++; out.tot += P.num(s.tot); out.disc += P.num(s.disc);
          out.pay[s.pay] = (out.pay[s.pay] || 0) + P.num(s.tot);
          if (s.src === 'web') out.web++;
          const sn = P.sellerOf(s) || '—'; const sx = (out.bySeller[sn] = out.bySeller[sn] || { inv: 0, tot: 0 }); sx.inv++; sx.tot += P.num(s.tot);
          for (const it of P.itemsOf(s)) out.bottles += P.num(it.q);
        }
      }, sh.d || null, null, [sh.b]);
      return out;
    },
    // ---------- expenses (paid from the branch drawer) ----------
    addExpense({ b, amt, r, note = '', sp = null }) {
      amt = Math.round(P.num(amt) * 100) / 100;
      r = String(r || '').trim().slice(0, 80);
      if (!(amt > 0)) throw new Error('اكتب المبلغ');
      if (!r) throw new Error('اكتب المصروف ده على إيه');
      const d = P.dayKey(); const id = P.uid();
      const e = { id, ts: Date.now(), d, b, amt, r, ...who(), sh: (A.myShift() || {}).id || null };
      if (note) e.note = String(note).trim().slice(0, 200);
      if (sp && sp.id && sp.n) { e.sp = sp.id; e.spn = String(sp.n).slice(0, 40); }
      const up = { [`day/${d}/${b}/e/${id}`]: e };
      S.stampUp(up, b, d);
      S.write(up, 'مصروف ' + amt);
      return e;
    },
    voidExpense(d, b, id) {
      const up = { [`day/${d}/${b}/e/${id}/void`]: { ts: Date.now(), by: S.me.uid, n: S.me.n || '' } };
      S.stampUp(up, b, d);
      S.write(up, 'إلغاء مصروف');
    },
    // owner: wipe all activity (sales, stock moves, shifts, expenses, web orders, customers) — keeps branches, accounts, products, prices
    async resetActivity() {
      if (!S.isOwner) throw new Error('الحساب الرئيسي بس');
      const ts = Date.now();
      const roots = ['day', 'days', 'orders', 'track', 'cust'];
      try {
        const up = { 'rev/reset': ts }; for (const r of roots) up[r] = null;
        await P.FB.patch('', up);
      } catch (e) {
        if (e.net) throw new Error('لازم يكون فيه نت علشان المسح');
        // older rules: delete record by record (each one the owner is allowed to write)
        const keys = async (p) => Object.keys((await P.FB.get(p, { shallow: 'true' }).catch(() => null)) || {});
        const up = {};
        for (const d of await keys('day')) for (const b of await keys(`day/${d}`)) for (const t of ['s', 'm', 'h', 'o', 'e']) for (const id of await keys(`day/${d}/${b}/${t}`)) up[`day/${d}/${b}/${t}/${id}`] = null;
        for (const b of await keys('days')) for (const d of await keys(`days/${b}`)) up[`days/${b}/${d}`] = null;
        for (const b of await keys('orders/open')) for (const id of await keys(`orders/open/${b}`)) up[`orders/open/${b}/${id}`] = null;
        const paths = Object.keys(up);
        for (let i = 0; i < paths.length; i += 400) { const part = {}; paths.slice(i, i + 400).forEach((k) => (part[k] = null)); await P.FB.patch('', part); }
        await P.FB.patch('', { 'rev/reset': ts });
      }
      await S.wipeActivity(ts);
      return ts;
    },
    async closeShift(cash1, note) {
      const sh = A.myShift();
      if (!sh) return;
      const sum = A.shiftSummary(sh);
      const up = { [`day/${sh.d}/${sh.b}/h/${sh.id}/close`]: Date.now(), [`day/${sh.d}/${sh.b}/h/${sh.id}/cash1`]: P.num(cash1), [`day/${sh.d}/${sh.b}/h/${sh.id}/sum`]: sum, [`day/${sh.d}/${sh.b}/h/${sh.id}/note`]: note || '' };
      S.stampUp(up, sh.b, sh.d);
      S.write(up, 'تقفيل شيفت');
      S._shift = null;
      await P.kv.del(`shift:${S.me.uid}`);
      return sum;
    },

    // ---------- web orders ----------
    orderStatus(b, oid, st, extra) {
      const now = Date.now();
      const up = {
        [`orders/open/${b}/${oid}/st`]: st,
        [`orders/open/${b}/${oid}/h/${st}`]: { ts: now, ...who() },
        [`track/${oid}/s`]: st, [`track/${oid}/ts`]: now,
      };
      if (extra) for (const k in extra) up[`orders/open/${b}/${oid}/${k}`] = extra[k];
      S.write(up, 'تحديث طلب');
    },
    completeOrder(b, oid, pay) {
      const o = S.get(`orders/open/${b}/${oid}`);
      if (!o) throw new Error('الطلب ده مش موجود');
      const items = P.arr(o.items).map((it) => ({ c: it.c, s: it.s, p: it.p || null, q: it.q, pr: it.pr, n: it.n + (it.sn ? ' — ' + it.sn : '') }));
      const d = P.dayKey();
      const sale = A.sell({ b, items, disc: P.num(o.disc), pay: pay || 'cash', cust: { n: o.c && o.c.n, ph: o.c && o.c.ph }, src: 'web', oid, note: o.fee ? 'توصيل ' + o.fee : '' });
      const now = Date.now();
      const arch = { ...P.clone(o), st: 'done', sale: sale.id, b };
      arch.h = Object.assign({}, arch.h, { done: { ts: now, ...who() } });
      const up = {
        [`orders/open/${b}/${oid}`]: null,
        [`day/${d}/${b}/o/${oid}`]: arch,
        [`track/${oid}/s`]: 'done', [`track/${oid}/ts`]: now,
      };
      S.stampUp(up, b, d);
      S.write(up, 'تسليم طلب');
      return sale;
    },
    cancelOrder(b, oid, reason) {
      const o = S.get(`orders/open/${b}/${oid}`);
      if (!o) return;
      const d = P.dayKey(); const now = Date.now();
      const arch = { ...P.clone(o), st: 'cancel', why: reason || '', b };
      arch.h = Object.assign({}, arch.h, { cancel: { ts: now, ...who() } });
      const up = { [`orders/open/${b}/${oid}`]: null, [`day/${d}/${b}/o/${oid}`]: arch, [`track/${oid}/s`]: 'cancel', [`track/${oid}/ts`]: now };
      S.stampUp(up, b, d);
      S.write(up, 'إلغاء طلب');
    },
    reassignOrder(from, oid, to) {
      const o = S.get(`orders/open/${from}/${oid}`);
      if (!o || from === to) return;
      const n = { ...P.clone(o), b: to, st: 'new' };
      n.h = Object.assign({}, n.h, { moved: { ts: Date.now(), ...who(), from, to } });
      S.write({ [`orders/open/${from}/${oid}`]: null, [`orders/open/${to}/${oid}`]: n, [`track/${oid}/s`]: 'new', [`track/${oid}/ts`]: Date.now() }, 'تحويل طلب لفرع');
    },
  });
  P.ORDER_ST = { new: 'جديد', acc: 'اتقبل', prep: 'بيتجهز', out: 'خرج للتوصيل', done: 'اتسلم', cancel: 'اتلغى', rej: 'الفرع رفضه' };
  P.PAY = { cash: 'كاش', card: 'فيزا', wallet: 'محفظة / إنستاباي' };

  P.openOrders = function () {
    const out = [];
    const all = S.get('orders/open') || {};
    for (const b of Object.keys(all)) for (const oid of Object.keys(all[b] || {})) { const o = all[b][oid]; if (o) out.push({ ...o, id: oid, b }); }
    return out.sort((a, b) => b.ts - a.ts);
  };

  // ---------------- reports ----------------
  const R = (P.R = {
    // aggregate sales + stock between two day keys (inclusive) for the given branches
    summary(from, to, branches) {
      const r = {
        rev: 0, sub: 0, disc: 0, inv: 0, bottles: 0, voided: 0, voidedTot: 0, web: 0, webRev: 0, cost: 0,
        pay: {}, byKey: {}, byCat: {}, byBranch: {}, byDay: {}, byMonth: {}, byUser: {}, byProd: {}, byHour: {}, sales: [], exp: 0, expN: 0, expBy: {},
      };
      eachDay((d, b, node) => {
        for (const e of Object.values(node.e || {})) {
          if (!e || e.void) continue;
          const a = P.num(e.amt); r.exp += a; r.expN++;
          const k = String(e.r || '').trim() || '—'; r.expBy[k] = (r.expBy[k] || 0) + a;
          const be = (r.byBranch[b] = r.byBranch[b] || { rev: 0, inv: 0, bottles: 0, web: 0 }); be.exp = (be.exp || 0) + a;
        }
        for (const sid of Object.keys(node.s || {})) {
          const s = node.s[sid]; if (!s) continue;
          if (s.void) { r.voided++; r.voidedTot += P.num(s.tot); r.sales.push({ ...s, id: sid, b, d }); continue; }
          r.sales.push({ ...s, id: sid, b, d });
          const tot = P.num(s.tot); const sub = P.num(s.sub) || tot; const ratio = sub ? tot / sub : 1;
          r.rev += tot; r.sub += sub; r.disc += P.num(s.disc); r.inv++;
          r.pay[s.pay || 'cash'] = (r.pay[s.pay || 'cash'] || 0) + tot;
          if (s.src === 'web') { r.web++; r.webRev += tot; }
          const bb = (r.byBranch[b] = r.byBranch[b] || { rev: 0, inv: 0, bottles: 0, web: 0 });
          bb.rev += tot; bb.inv++; if (s.src === 'web') bb.web++;
          const dd = (r.byDay[d] = r.byDay[d] || { rev: 0, inv: 0, bottles: 0 }); dd.rev += tot; dd.inv++;
          const mk = d.slice(0, 7); const mm = (r.byMonth[mk] = r.byMonth[mk] || { rev: 0, inv: 0, bottles: 0 }); mm.rev += tot; mm.inv++;
          const uk = s.sp ? b + ':' + s.sp : s.bu || s.by || '?'; const uu = (r.byUser[uk] = r.byUser[uk] || { n: P.sellerOf(s) || s.bu || 'غير محدد', rev: 0, inv: 0, bottles: 0, b }); uu.rev += tot; uu.inv++;
          const hr = new Date(s.ts).getHours(); r.byHour[hr] = (r.byHour[hr] || 0) + tot;
          for (const it of P.itemsOf(s)) {
            const q = P.num(it.q); const lr = q * P.num(it.pr) * ratio;
            r.bottles += q; bb.bottles += q; dd.bottles += q; mm.bottles += q; uu.bottles += q;
            const kk = (r.byKey[it.k] = r.byKey[it.k] || { q: 0, rev: 0 }); kk.q += q; kk.rev += lr;
            const ck = (r.byCat[it.c] = r.byCat[it.c] || { q: 0, rev: 0, sizes: {} }); ck.q += q; ck.rev += lr;
            const sk = (ck.sizes[it.s] = ck.sizes[it.s] || { q: 0, rev: 0 }); sk.q += q; sk.rev += lr;
            if (it.p) { const pk = (r.byProd[it.p] = r.byProd[it.p] || { q: 0, rev: 0, n: it.n }); pk.q += q; pk.rev += lr; }
            r.cost += q * C.cost(it.c, it.s, it.p);
          }
        }
      }, from, to, branches);
      r.avg = r.inv ? r.rev / r.inv : 0;
      r.profit = r.rev - r.cost;
      r.net = r.profit - r.exp;
      r.cashNet = P.num(r.pay.cash) - r.exp;
      r.sales.sort((a, b) => b.ts - a.ts);
      return r;
    },
    // stock movement table: opening, received, transferred/adjusted, sold, closing per key
    inventory(from, to, branches) {
      const rows = {};
      const row = (k) => (rows[k] = rows[k] || { k, open: 0, inn: 0, tin: 0, tout: 0, adj: 0, sold: 0, close: 0 });
      eachDay((d, b, node) => {
        const before = d < from;
        for (const m of P.arr(node.m)) {
          if (!m || !m.k) continue;
          const x = row(m.k); const q = P.num(m.q);
          if (before) { x.open += q; continue; }
          if (m.t === 'in' || m.t === 'init') x.inn += q; else if (m.t === 'tin') x.tin += q; else if (m.t === 'tout') x.tout += q; else x.adj += q;
        }
        for (const s of P.arr(node.s)) {
          if (!s || s.void) continue;
          for (const it of P.itemsOf(s)) { const x = row(it.k); if (before) x.open -= P.num(it.q); else x.sold += P.num(it.q); }
        }
      }, null, to, branches);
      for (const k of C.keys()) row(k);
      for (const k in rows) { const x = rows[k]; x.close = x.open + x.inn + x.tin + x.tout + x.adj - x.sold; }
      return Object.values(rows).sort((a, b) => keySort(a.k, b.k));
    },
    expenses(from, to, branches) {
      const out = [];
      eachDay((d, b, node) => { for (const id of Object.keys(node.e || {})) { const e = node.e[id]; if (e && e.ts) out.push({ ...e, id, d, b }); } }, from, to, branches);
      return out.sort((a, b) => b.ts - a.ts);
    },
    shifts(from, to, branches) {
      const out = [];
      eachDay((d, b, node) => { for (const id of Object.keys(node.h || {})) { const h = node.h[id]; if (h) out.push({ ...h, id, d, b }); } }, from, to, branches);
      return out.sort((a, b) => b.open - a.open);
    },
    orders(from, to, branches) {
      const out = [];
      eachDay((d, b, node) => { for (const id of Object.keys(node.o || {})) { const o = node.o[id]; if (o) out.push({ ...o, id, d, b }); } }, from, to, branches);
      return out.sort((a, b) => b.ts - a.ts);
    },
    moves(from, to, branches) {
      const out = [];
      eachDay((d, b, node) => { for (const id of Object.keys(node.m || {})) { const m = node.m[id]; if (m) out.push({ ...m, id, d, b }); } }, from, to, branches);
      return out.sort((a, b) => b.ts - a.ts);
    },
  });
  function keySort(a, b) {
    const pa = C.parse(a), pb = C.parse(b);
    const co = (c) => P.num((C.cat(c) || {}).ord), so = (c, s) => P.num((C.size(c, s) || {}).ord);
    return (co(pa.c) - co(pb.c)) || String(pa.c).localeCompare(pb.c) || (so(pa.c, pa.s) - so(pb.c, pb.s)) || String(pa.p || '').localeCompare(pb.p || '');
  }
  P.keySort = keySort;

  // ---------------- website availability (published for the shop site) ----------------
  let paTimer = null;
  P.publishAvail = function () { if (!paTimer) paTimer = setTimeout(() => { paTimer = null; try { publishAvailNow(); } catch (e) { console.error(e); } }, 1500); };
  function publishAvailNow() {
    if (!S.me || S.me.role === 'viewer') return;
    const up = {};
    for (const b of P.myBranches()) {
      const st = P.stockOf(b);
      const cur = S.get(`public/avail/${b}`) || {};
      const keys = new Set([...Object.keys(st), ...Object.keys(cur)]);
      for (const k of keys) {
        const q = Math.max(0, Math.round(P.num(st[k])));
        if (P.num(cur[k]) !== q || cur[k] === undefined) up[`public/avail/${b}/${k}`] = q;
      }
    }
    if (Object.keys(up).length) S.write(up, 'تحديث المتاح على الموقع');
  }

  // ----- date range state shared by reports -----
  P.rangeOf = (mode, anchor) => {
    const t = anchor || P.dayKey();
    if (mode === 'day') return [t, t];
    if (mode === 'month') { const m = t.slice(0, 7); return [m + '-01', P.monthEnd(m)]; }
    if (mode === 'year') { const y = t.slice(0, 4); return [y + '-01-01', y + '-12-31']; }
    return [t, t];
  };

  // ---------------- defaults for a new business ----------------
  // ---------------- one-time catalog upgrade (Lampika price list + new boxes, Nov 2026) ----------------
  P.LAMPIKA_V2 = {
    sizes: { fr: { 30: 100, 40: 150, 50: 200, 70: 250, 100: 300 }, gu: { 30: 150, 40: 200, 50: 250, 70: 300, 100: 400 } },
    shaped: [['fr50', 'فرنساوي 50 مللي', 50, 300, 1], ['fr100', 'فرنساوي 100 مللي', 100, 400, 2], ['gu50', 'خليجي 50 مللي', 50, 350, 3], ['gu100', 'خليجي 100 مللي', 100, 500, 4]],
    cats: [
      ['own', { n: 'إزازة العميل', en: 'Refill', color: '#FFE08A', mode: 'size', ord: 5, on: true, note: 'لو العميل جايب إزازته' }, [30, 40, 50, 70, 100]],
      ['bk', { n: 'مباخر', en: 'Incense burners', color: '#D9A21E', mode: 'item', ord: 6, on: true }],
      ['hc', { n: 'عطور هاي كوبي', en: 'High copy', color: '#E8B84A', mode: 'product', ord: 7, on: true }, [30, 50, 100]],
      ['fl', { n: 'معطر أرضيات', en: 'Floor freshener', color: '#9FD8C8', mode: 'item', ord: 8, on: true }],
      ['sp', { n: 'معطر رش', en: 'Room spray', color: '#B9DDF0', mode: 'item', ord: 9, on: true }],
      ['bx', { n: 'بخور علب', en: 'Boxed bakhoor', color: '#C98B4E', mode: 'item', ord: 10, on: true }],
      ['st', { n: 'بخور عيدان', en: 'Incense sticks', color: '#B07A47', mode: 'item', ord: 11, on: true }],
      ['bs', { n: 'سبلاش', en: 'Body splash', color: '#F3A7C0', mode: 'item', ord: 12, on: true }],
    ],
  };
  P.migrateV2 = function () {
    if (!S.isOwner || S.get('catalog/mig/v2')) return;
    const M = P.LAMPIKA_V2; const up = {};
    const sizeByMl = (c, ml) => (C.sizes(c, true).find(([, z]) => P.num(z.ml) === ml) || [])[0];
    for (const c of Object.keys(M.sizes)) {
      if (!C.cat(c)) continue;
      for (const ml of Object.keys(M.sizes[c]).map(Number)) {
        const id = sizeByMl(c, ml) || 's' + ml; const base = `catalog/cats/${c}/sizes/${id}`;
        if (!C.size(c, id)) Object.assign(up, { [`${base}/n`]: ml + ' مللي', [`${base}/ml`]: ml, [`${base}/on`]: true, [`${base}/web`]: true });
        up[`${base}/price`] = M.sizes[c][ml]; up[`${base}/ord`] = ml;
      }
    }
    if (C.cat('sh')) for (const [id, n, ml, pr, ord] of M.shaped) {
      const base = `catalog/cats/sh/sizes/${id}`;
      Object.assign(up, { [`${base}/n`]: n, [`${base}/ml`]: ml, [`${base}/price`]: pr, [`${base}/ord`]: ord, [`${base}/on`]: true, [`${base}/web`]: true });
    }
    if (C.cat('sh')) for (const [id, z] of C.sizes('sh', true)) if (!M.shaped.some(([x]) => x === id) && z.on !== false) up[`catalog/cats/sh/sizes/${id}/on`] = false;
    for (const [c, cat, mls] of M.cats) {
      if (C.cat(c)) continue;
      up[`catalog/cats/${c}`] = Object.assign({}, cat, { sizes: cat.mode === 'item' ? { u: { n: 'القطعة', ml: 0, price: 0, ord: 1, on: true, web: true } } :
        Object.fromEntries((mls || []).map((ml) => ['s' + ml, { n: ml + ' مللي', ml, price: '', ord: ml, on: true, web: c !== 'own' }])) });
    }
    up['catalog/mig/v2'] = Date.now(); up['rev/cat'] = Date.now();
    S.write(up, 'تحديث الأسعار والخانات الجديدة');
  };
  P.defaultCatalog = function () {
    return {
      cats: {
        fr: { n: 'فرنساوي', en: 'French', color: '#F2C230', mode: 'size', ord: 1, on: true },
        gu: { n: 'خليجي', en: 'Gulf', color: '#E39B2D', mode: 'size', ord: 2, on: true },
        sh: { n: 'أزايز أشكال', en: 'Shaped bottles', color: '#F5F1E6', mode: 'size', ord: 3, on: true },
        or: { n: 'أوريجينال', en: 'Original', color: '#C9A961', mode: 'product', ord: 4, on: true },
      },
    };
  };
})();
