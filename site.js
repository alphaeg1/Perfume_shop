/* Shop website — reads the live catalog from the system and sends each order to exactly one branch */
(function () {
  const CFG = window.SHOP_CONFIG || {};
  const DB = String(CFG.dbUrl || '').replace(/\/+$/, '');
  const DEMO = !DB;
  for (const proto of [Element.prototype, DocumentFragment.prototype]) for (const m of ['append', 'replaceChildren']) {
    const orig = proto[m]; proto[m] = function (...a) { return orig.apply(this, a.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)); };
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const k in props || {}) { const v = props[k]; if (v === null || v === undefined || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : (window.__T && /^(placeholder|title|aria-label|alt)$/.test(k) ? window.__T(String(v)) : v)); }
    const add = (c) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) return c.forEach(add); el.appendChild(c instanceof Node ? c : document.createTextNode(window.__T ? window.__T(String(c)) : String(c))); };
    kids.forEach(add); return el;
  };
  const svg = (m) => { const t = document.createElement('template'); t.innerHTML = m.trim(); return t.content.firstChild; };
  const ents = (o) => Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined);
  const num = (x) => (typeof x === 'number' ? x : parseFloat(x) || 0);
  const money = (x) => num(x).toLocaleString('en-US') + ' ج';
  const byOrd = (a, b) => num(a[1].ord) - num(b[1].ord);
  const rid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const code = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  const toast = (m) => { const t = h('div', { class: 'toast', role: 'status' }, m); document.body.appendChild(t); setTimeout(() => t.remove(), 3200); };
  const IC = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    wa: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.4z"/><path d="M9 9c0 3.5 2.5 6 6 6l1.2-1.6-2-1-1 1c-1.2-.4-2.2-1.4-2.6-2.6l1-1-1-2z"/>',
    bag: '<path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  const icon = (n, s = 20) => svg(`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`);
  const bottle = (fill, color, w = 30) => {
    const top = 17 + (1 - Math.max(0, Math.min(1, fill))) * 26; const id = 'c' + Math.random().toString(36).slice(2, 7);
    return svg(`<svg width="${w}" height="${w * 1.5}" viewBox="0 0 32 48" aria-hidden="true"><defs><clipPath id="${id}"><rect x="6.6" y="16.4" width="18.8" height="27.6" rx="4.2"/></clipPath></defs><path d="M11.2 1.2h9.6l1.3 8.6H9.9z" fill="${color}" opacity=".95"/><path d="M13.2 1.6h2.2l-.7 7.8h-2.4z" fill="#fff" opacity=".35"/><rect x="12" y="9.6" width="8" height="3.6" rx=".8" fill="${color}" opacity=".6"/><rect x="4.8" y="13.2" width="22.4" height="33" rx="6" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-width="1.5"/><g clip-path="url(#${id})"><rect class="liq" x="0" y="${top}" width="32" height="40" fill="${color}" opacity=".8"/></g><rect x="8.6" y="18" width="2.2" height="20" rx="1.1" fill="#fff" opacity=".55"/><rect x="21.6" y="20" width="1.2" height="10" rx=".6" fill="#fff" opacity=".3"/></svg>`);
  };
  // generic piece for item boxes (burners, sprays, bakhoor): a domed jar
  const jar = (color, w = 30) => svg(`<svg width="${w}" height="${w * 1.5}" viewBox="0 0 32 48" aria-hidden="true"><path d="M16 3.5c1.4 0 2.2 1.6 1.4 3.2l-1.4 2.8-1.4-2.8c-.8-1.6 0-3.2 1.4-3.2z" fill="${color}"/><path d="M6.5 20c0-6 4.3-10.2 9.5-10.2S25.5 14 25.5 20z" fill="${color}" opacity=".9"/><rect x="5" y="19.6" width="22" height="3" rx="1.2" fill="${color}" opacity=".6"/><path d="M7.5 22.6h17l-1.6 15.6c-.2 1.8-1.7 3.2-3.5 3.2h-6.8c-1.8 0-3.3-1.4-3.5-3.2z" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-width="1.5"/><rect x="9" y="41.4" width="14" height="3.4" rx="1.4" fill="${color}" opacity=".85"/><rect x="10.3" y="25" width="1.8" height="11" rx=".9" fill="#fff" opacity=".5"/></svg>`);

  // ---------------- data ----------------
  const api = {
    async get(p) { const r = await fetch(`${DB}/${p}.json`, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
    async patch(body) { const r = await fetch(`${DB}/.json`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); },
  };
  const st = { cat: null, site: {}, routing: {}, avail: {}, cart: load('cart') || [], orders: load('orders') || [], cat0: null };
  function load(k) { try { return JSON.parse(localStorage.getItem('shop:' + k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem('shop:' + k, JSON.stringify(v)); } catch (e) {} }

  async function boot() {
    try {
      if (DEMO) Object.assign(st, demoData());
      else {
        const [cat, site, routing, avail] = await Promise.all([api.get('catalog'), api.get('public/site'), api.get('public/routing'), api.get('public/avail')]);
        Object.assign(st, { catalog: cat || {}, site: site || {}, routing: routing || {}, avail: avail || {} });
      }
    } catch (e) {
      $('#shop').replaceChildren(h('div', { class: 'empty', style: { paddingTop: '40vh' } }, 'مش قادرين نوصل للمتجر دلوقتي. اتأكد من النت وجرب تاني.', h('div', null, h('button', { class: 'cta', style: { marginTop: '16px' }, onclick: () => location.reload() }, 'جرب تاني'))));
      return;
    }
    const s = st.site;
    document.documentElement.style.setProperty('--plum', s.primary || '#F2C230');
    document.documentElement.style.setProperty('--amber', s.accent || '#F2C230');
    document.title = (s.name || 'المتجر') + (s.slogan ? ' — ' + s.slogan : '');
    const mt = document.querySelector('meta[name=theme-color]'); if (mt) mt.content = s.primary || '#F2C230';
    // keep the cart honest with today's prices
    st.cart = st.cart.filter((l) => cat(l.c) && size(l.c, l.s) && (!l.p || prod(l.p))).map((l) => ({ ...l, pr: price(l.c, l.s, l.p) }));
    render();
    if (location.hash.startsWith('#track')) openTrack();
    window.addEventListener('scroll', () => { const b = $('.bar'); if (b) b.classList.toggle('sc', scrollY > 10); }, { passive: true });
    // refresh availability every few minutes
    if (!DEMO) setInterval(async () => { try { st.avail = (await api.get('public/avail')) || {}; } catch (e) {} }, 180000);
  }

  const cats = () => ents((st.catalog || {}).cats).filter(([, c]) => c.on !== false).sort(byOrd);
  const cat = (c) => ((st.catalog || {}).cats || {})[c];
  const sizes = (c) => ents((cat(c) || {}).sizes).filter(([, s]) => s.on !== false).sort(byOrd);
  const size = (c, s) => ((cat(c) || {}).sizes || {})[s];
  const prods = (c) => ents((st.catalog || {}).prods).filter(([, p]) => p.c === c && p.on !== false && p.web !== false && cat(p.c)).sort(byOrd);
  const prod = (p) => ((st.catalog || {}).prods || {})[p];
  const base = (c, s, p) => { const pr = prod(p); if (pr && pr.prices && pr.prices[s] !== undefined && pr.prices[s] !== '') return num(pr.prices[s]); return num((size(c, s) || {}).price); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const offers = () => ents((st.catalog || {}).offers).filter(([, o]) => o && o.on !== false && o.web !== false && (!o.from || o.from <= today()) && (!o.to || o.to >= today()) && cat(o.c));
  const offerOf = (c, s, p) => { let best = null, rank = -1; for (const [id, o] of offers()) { if (o.c !== c) continue; let r = -1; if (o.p) { if (o.p === p && (!o.s || o.s === s)) r = 3; } else if (o.s) { if (o.s === s) r = 2; } else r = 1; if (r > rank) { rank = r; best = { id, ...o }; } } return best; };
  const applyOff = (o, b) => { if (!o || !b) return b; const v = num(o.val); return Math.max(0, Math.round(o.kind === 'price' ? v : o.kind === 'amt' ? b - v : b * (1 - v / 100))); };
  const price = (c, s, p) => applyOff(offerOf(c, s, p), base(c, s, p));
  const onOffer = (c, s, p) => price(c, s, p) < base(c, s, p);
  const priceEl = (c, s, p, pre) => h('span', { class: 'pv' }, pre || null, onOffer(c, s, p) ? h('s', null, money(base(c, s, p))) : null, h('span', null, money(price(c, s, p))));
  const offBadge = (o) => o ? h('span', { class: 'offb' }, o.kind === 'pct' ? 'خصم ' + num(o.val) + '%' : 'عرض') : null;
  const key = (c, s, p) => ((cat(c) || {}).mode === 'product' ? `${c}|${s}|${p}` : `${c}|${s}`);
  const avail = (c, s, p) => { if (DEMO) return 10; let q = 0; for (const b in st.avail) q += num((st.avail[b] || {})[key(c, s, p)]); return q; };
  const fill = (c, s) => { const ml = sizes(c).map(([, z]) => num(z.ml)); const max = Math.max(1, ...ml); return 0.25 + 0.7 * (num((size(c, s) || {}).ml) / max); };
  const minPrice = (c, p) => Math.min(...sizes(c).filter(([s]) => hasPrice(c, s, p)).map(([s]) => price(c, s, p)));
  const byP = (c) => ['product', 'item'].includes((cat(c) || {}).mode);
  const isItem = (c) => (cat(c) || {}).mode === 'item';
  const hasPrice = (c, s, p) => (byP(c) ? !!(prod(p) && prod(p).prices && prod(p).prices[s] !== undefined && prod(p).prices[s] !== '') : num((size(c, s) || {}).price) > 0);
  const webSizes = (c) => sizes(c).filter(([sz, z]) => z.web !== false && (byP(c) || hasPrice(c, sz)));

  // images: small JSON documents holding a compressed picture
  const imgMem = {};
  function img(pid, el, full) {
    let ver = 0, alt = '';
    if (pid.includes('-')) { const [c, sz] = pid.split('-'); const z = size(c, sz); ver = z && z.img; alt = z ? (cat(c) || {}).n + ' ' + z.n : ''; }
    else { const p = prod(pid); ver = p && p.img; alt = p ? p.n : ''; }
    if (!ver || DEMO) return;
    const k = pid + ':' + ver + (full ? ':f' : '');
    const put = (src) => { if (src) el.replaceChildren(h('img', { src, alt, loading: 'lazy' })); };
    if (imgMem[k]) return imgMem[k].then(put);
    const cached = (() => { try { return sessionStorage.getItem('img:' + k); } catch (e) { return null; } })();
    if (cached) { imgMem[k] = Promise.resolve(cached); return put(cached); }
    imgMem[k] = api.get(`public/img/${pid}/${full ? 'f' : 't'}`).then((src) => { try { sessionStorage.setItem('img:' + k, src); } catch (e) {} return src; }).catch(() => null);
    imgMem[k].then(put);
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); img(e.target.dataset.p, e.target); } }), { rootMargin: '300px' }) : null;

  // ---------------- page ----------------
  function render() {
    const s = st.site;
    const list = cats();
    const featured = [];
    const phone = (s.phones || [])[0];
    const wa = String(s.wa || '').replace(/\D/g, '').replace(/^0/, '20');
    const root = $('#shop');
    root.replaceChildren(
      h('header', { class: 'bar' }, s.logo ? h('img', { class: 'lg', src: s.logo, alt: '' }) : null, h('b', null, s.name || 'المتجر'),
        window.__langBtn ? (() => { const lb = window.__langBtn('ib lang'); return lb; })() : null,
        h('button', { class: 'ib', 'aria-label': 'فاتح / غامق', onclick: (e) => { const d = document.documentElement; const n = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; d.setAttribute('data-theme', n); try { localStorage.setItem('theme', n); } catch (er) {} e.currentTarget.replaceChildren(icon(n === 'dark' ? 'sun' : 'moon', 18)); } }, icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 18)),
        phone ? h('a', { class: 'ib', href: 'tel:' + phone, 'aria-label': 'اتصل بينا' }, icon('phone', 18)) : null,
        wa ? h('a', { class: 'ib', href: 'https://wa.me/' + wa, target: '_blank', rel: 'noopener', 'aria-label': 'واتساب' }, icon('wa', 18)) : null),
      h('section', { class: 'hero' }, h('h1', null, s.name || 'المتجر'), s.nameEn ? h('div', { class: 'en' }, s.nameEn) : null, s.slogan ? h('p', null, s.slogan) : null),
      s.open === false ? h('div', { class: 'closed' }, 'استقبال الطلبات واقف دلوقتي. تقدر تتفرج وتكلمنا على الأرقام اللي فوق.') : null,
      h('div', { class: 'cats' }, list.map(([c, ct], i) => h('button', { class: 'ctile', style: { '--c': ct.color || '#F2C230' }, onclick: () => jump(c) },
        h('span', { class: 'cglyph' }, ct.mode === 'item' ? jar(ct.color || '#F2C230', 30) : bottle([0.78, 0.62, 0.9, 0.55][i % 4], ct.color || '#F2C230', 30)), h('span', { class: 'cn' }, ct.n), ct.en ? h('small', { dir: 'ltr' }, ct.en) : null))),
      offerSection(),
      featured.length ? h('div', { class: 'sec' }, h('h2', null, 'مختارات')) : null,
      featured.length ? h('div', { class: 'feat' }, featured.map(([pid, p]) => card(pid, p))) : null,
      h('nav', { class: 'chips', 'aria-label': 'الأقسام' }, list.map(([c, ct]) => h('button', { class: 'chip', 'data-c': c, onclick: () => jump(c) }, ct.n))),
      list.map(([c, ct]) => {
        const items = byP(c) ? prods(c).filter(([pid]) => webSizes(c).some(([sz]) => hasPrice(c, sz, pid))).map(([pid, p]) => card(pid, p)) : webSizes(c).map(([sz, z]) => sizeCard(c, sz, z));
        return h('section', { class: 'sec', id: 'c-' + c, style: { '--c': ct.color } }, h('h2', null, h('i'), ct.n), items.length ? h('div', { class: 'grid' }, items) : h('div', { class: 'empty' }, 'قريب'));
      }),
      footer(),
      cartBar());
    // highlight chip of visible section
    const chips = document.querySelectorAll('.chip');
    if ('IntersectionObserver' in window) {
      const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) chips.forEach((ch) => ch.classList.toggle('on', 'c-' + ch.dataset.c === e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
      document.querySelectorAll('section.sec').forEach((x) => so.observe(x));
    }
  }
  function offerSection() {
    const os = offers(); if (!os.length) return null;
    const items = [];
    for (const [oid, o] of os) {
      if (byP(o.c)) for (const [pid, pp] of prods(o.c)) { if (o.p && pid !== o.p) continue; if (webSizes(o.c).some(([sz]) => hasPrice(o.c, sz, pid) && onOffer(o.c, sz, pid))) items.push(['p', pid, pp]); }
      else for (const [sz, z] of webSizes(o.c)) { if (o.s && sz !== o.s) continue; if (onOffer(o.c, sz)) items.push(['s', o.c, sz, z]); }
    }
    const seen = new Set(); const uniq = items.filter((x) => { const k = x.slice(0, 3).join('|'); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
    if (!uniq.length) return null;
    const ends = os.map(([, o]) => o.to).filter(Boolean).sort()[0];
    return h('section', { class: 'sec offers', id: 'c-offers' },
      h('div', { class: 'off-head' }, h('div', null, h('span', { class: 'off-k' }, 'عروض'), h('h2', null, os[0][1].t || 'عروض لفترة محدودة')), ends ? h('div', { class: 'off-end' }, 'لحد ' + ends.slice(8, 10) + '/' + ends.slice(5, 7)) : null),
      h('div', { class: 'grid' }, uniq.map((x) => (x[0] === 'p' ? card(x[1], x[2]) : sizeCard(x[1], x[2], x[3])))));
  }
  function jump(c) { const el = document.getElementById('c-' + c); if (el) window.scrollTo({ top: el.offsetTop - 110, behavior: 'smooth' }); }
  function sizeCard(c, sz, z) {
    const color = (cat(c) || {}).color || '#F2C230';
    const a = avail(c, sz) > 0;
    const id = `${c}-${sz}`;
    const im = h('div', { class: 'im', 'data-p': id }, bottle(fill(c, sz), color, 34));
    if (z.img && io) io.observe(im); else img(id, im);
    const ob = onOffer(c, sz) ? offBadge(offerOf(c, sz)) : null;
    return h('button', { class: 'pc' + (a ? '' : ' out') + (ob ? ' off' : ''), style: { '--c': color }, onclick: () => openSize(c, sz) },
      im, ob, h('div', { class: 'tx' }, h('b', null, (cat(c) || {}).n + ' ' + z.n), h('div', { class: 'pr num' }, a ? priceEl(c, sz) : 'خلص حالياً')));
  }
  function openSize(c, sz) {
    const z = size(c, sz); const ct = cat(c) || {}; const color = ct.color || '#F2C230';
    const a = avail(c, sz); let q = 1;
    const id = `${c}-${sz}`;
    const imBox = h('div', { class: 'sh-img', style: { '--c': color } }, bottle(fill(c, sz), color, 70));
    img(id, imBox, true);
    const qtyB = h('b', { class: 'num' }, q); const btn = h('button', { class: 'cta' });
    const draw = () => { qtyB.textContent = q; btn.disabled = a <= 0 || st.site.open === false; btn.textContent = st.site.open === false ? 'الطلبات واقفة دلوقتي' : a <= 0 ? 'خلص حالياً' : 'أضف للسلة — ' + money(price(c, sz) * q); };
    const sh = sheet(h('div', null, imBox, h('div', { class: 'sh-b' },
      h('h3', null, ct.n + ' ' + z.n), ct.en ? h('div', { dir: 'ltr', style: { textAlign: 'right', color: 'var(--muted)' } }, ct.en + ' ' + (z.ml ? z.ml + 'ml' : '')) : null,
      h('div', { class: 'big-price num' }, priceEl(c, sz)), onOffer(c, sz) ? h('div', { class: 'offline' }, (offerOf(c, sz).t || 'عرض لفترة محدودة')) : null,
      h('div', { class: 'row', style: { margin: '16px 0', justifyContent: 'space-between' } }, h('span', { class: 'lbl', style: { margin: 0 } }, 'الكمية'),
        h('div', { class: 'qty' }, h('button', { 'aria-label': 'قلل', onclick: () => { q = Math.max(1, q - 1); draw(); } }, '−'), qtyB, h('button', { 'aria-label': 'زود', onclick: () => { q = Math.min(20, q + 1); draw(); } }, '+'))),
      btn)));
    btn.onclick = () => {
      const ex = st.cart.find((l) => !l.p && l.c === c && l.s === sz);
      if (ex) ex.q += q; else st.cart.push({ p: null, c, s: sz, q, pr: price(c, sz), n: ct.n, sn: z.n });
      save('cart', st.cart); refreshBar(); sh.close(); toast('اتضاف للسلة');
    };
    draw();
  }
  function card(pid, p) {
    const c = p.c; const color = (cat(c) || {}).color || '#F2C230';
    const anyAvail = webSizes(c).some(([s]) => hasPrice(c, s, pid) && avail(c, s, pid) > 0);
    const im = h('div', { class: 'im', 'data-p': pid }, isItem(c) ? jar(color, 36) : bottle(0.65, color, 34), p.tag ? h('span', { class: 'tag' }, p.tag) : null);
    if (p.img && io) io.observe(im); else img(pid, im);
    const ws = webSizes(c).filter(([s]) => hasPrice(c, s, pid)); const offS = ws.find(([s]) => onOffer(c, s, pid));
    const one = ws.length === 1 ? ws[0][0] : null;
    return h('button', { class: 'pc' + (anyAvail ? '' : ' out') + (offS ? ' off' : ''), style: { '--c': color }, onclick: () => openProduct(pid) },
      im, offS ? offBadge(offerOf(c, offS[0], pid)) : null, h('div', { class: 'tx' }, h('b', null, p.n), p.en ? h('small', { dir: 'ltr' }, p.en) : null, h('div', { class: 'pr num' }, !anyAvail ? 'خلص حالياً' : one ? priceEl(c, one, pid) : offS ? priceEl(c, offS[0], pid) : 'من ' + money(minPrice(c, pid)))));
  }
  function footer() {
    const s = st.site; const so = s.social || {};
    return h('footer', { class: 'foot' }, h('h4', null, s.name || ''), s.addr ? h('div', null, s.addr) : null,
      (s.phones || []).map((p) => h('div', null, h('a', { href: 'tel:' + p, dir: 'ltr' }, p))),
      h('div', { class: 'soc' }, so.fb ? h('a', { href: so.fb, target: '_blank', rel: 'noopener' }, 'فيسبوك') : null, so.ig ? h('a', { href: so.ig, target: '_blank', rel: 'noopener' }, 'إنستجرام') : null, so.tt ? h('a', { href: so.tt, target: '_blank', rel: 'noopener' }, 'تيك توك') : null,
        st.orders.length ? h('a', { href: '#track', onclick: (e) => { e.preventDefault(); openTrack(); } }, 'تتبع طلبي') : null));
  }
  function cartBar() {
    const n = st.cart.reduce((a, l) => a + l.q, 0);
    if (!n) return null;
    return h('button', { class: 'cartbar', onclick: openCart }, h('span', null, h('span', { class: 'cnt num' }, n), 'السلة'), h('span', { class: 'num' }, money(st.cart.reduce((a, l) => a + l.q * l.pr, 0))));
  }
  function refreshBar() { const old = $('.cartbar'); const nb = cartBar(); if (old) old.remove(); if (nb) $('#shop').appendChild(nb); }

  // ---------------- sheets ----------------
  function sheet(content) {
    const back = h('div', { class: 'back' }); const sh = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }), content);
    const close = () => { back.classList.remove('in'); sh.classList.remove('in'); setTimeout(() => { back.remove(); sh.remove(); }, 280); document.body.style.overflow = ''; };
    back.onclick = close;
    document.body.append(back, sh); document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { back.classList.add('in'); sh.classList.add('in'); });
    sh.close = close; return sh;
  }
  function openProduct(pid) {
    const p = prod(pid); const c = p.c; const color = (cat(c) || {}).color || '#F2C230';
    const szs = webSizes(c).filter(([s]) => hasPrice(c, s, pid));
    let sel = (szs.find(([s]) => avail(c, s, pid) > 0) || [])[0] || null; let q = 1;
    const imBox = h('div', { class: 'sh-img', style: { '--c': color } }, isItem(c) ? jar(color, 74) : bottle(0.7, color, 70));
    img(pid, imBox, true);
    const sizesBox = h('div', { class: 'sizes', role: 'radiogroup', 'aria-label': 'الحجم' });
    const qtyB = h('b', { class: 'num' }, q);
    const btn = h('button', { class: 'cta' });
    const draw = () => {
      sizesBox.replaceChildren(...szs.map(([s, z]) => {
        const a = avail(c, s, pid); const on = s === sel;
        return h('button', { class: 'sz' + (on ? ' on' : ''), role: 'radio', 'aria-checked': on ? 'true' : 'false', disabled: a <= 0, onclick: () => { sel = s; draw(); } },
          bottle(on ? fill(c, s) : fill(c, s) * 0.92, on ? color : '#b9a9b2', 26), h('b', null, z.n), h('small', { class: 'num' }, a > 0 ? priceEl(c, s, pid) : 'خلص'));
      }));
      qtyB.textContent = q;
      btn.disabled = !sel || st.site.open === false;
      btn.textContent = st.site.open === false ? 'الطلبات واقفة دلوقتي' : sel ? 'أضف للسلة — ' + money(price(c, sel, pid) * q) : 'مفيش أحجام متاحة';
    };
    const n = p.notes || {};
    const sh = sheet(h('div', null, imBox, h('div', { class: 'sh-b' },
      h('h3', null, p.n), p.en ? h('div', { dir: 'ltr', style: { textAlign: 'right', color: 'var(--muted)' } }, p.en) : null,
      p.d ? h('p', { style: { color: 'var(--muted)', margin: '8px 0 0' } }, p.d) : null,
      n.top || n.heart || n.base ? h('div', { class: 'notes' }, [['الافتتاحية', n.top], ['القلب', n.heart], ['القاعدة', n.base]].filter((x) => x[1]).map(([l, v]) => h('div', null, h('small', null, l), h('span', null, v)))) : null,
      isItem(c) ? h('div', { class: 'big-price num' }, sel ? priceEl(c, sel, pid) : null) : null, isItem(c) && sel && onOffer(c, sel, pid) ? h('div', { class: 'offline' }, offerOf(c, sel, pid).t || 'عرض لفترة محدودة') : null,
      isItem(c) ? null : h('span', { class: 'lbl' }, 'اختار الحجم'), isItem(c) ? null : sizesBox,
      h('div', { class: 'row', style: { margin: '16px 0', justifyContent: 'space-between' } }, h('span', { class: 'lbl', style: { margin: 0 } }, 'الكمية'),
        h('div', { class: 'qty' }, h('button', { 'aria-label': 'قلل', onclick: () => { q = Math.max(1, q - 1); draw(); } }, '−'), qtyB, h('button', { 'aria-label': 'زود', onclick: () => { q = Math.min(20, q + 1); draw(); } }, '+'))),
      btn)));
    btn.onclick = () => {
      if (!sel) return;
      const ex = st.cart.find((l) => l.p === pid && l.s === sel && l.c === c);
      if (ex) ex.q += q; else st.cart.push({ p: pid, c, s: sel, q, pr: price(c, sel, pid), n: (cat(c) || {}).n + ' ' + p.n, sn: isItem(c) ? '' : size(c, sel).n });
      save('cart', st.cart); refreshBar(); sh.close(); toast('اتضاف للسلة');
    };
    draw();
  }
  function openCart() {
    const s = st.site;
    const areas = ents(s.areas).sort(byOrd);
    const f = { n: h('input', { class: 'inp', autocomplete: 'name', value: (load('me') || {}).n || '' }), ph: h('input', { class: 'inp', type: 'tel', inputmode: 'tel', dir: 'ltr', autocomplete: 'tel', value: (load('me') || {}).ph || '' }),
      area: h('select', { class: 'inp' }, h('option', { value: '' }, 'اختار منطقتك'), areas.map(([a, ar]) => h('option', { value: a }, ar.n + ' — توصيل ' + money(ar.fee)))),
      addr: h('textarea', { class: 'inp', rows: 2, autocomplete: 'street-address', placeholder: 'الشارع، رقم العمارة، الدور، علامة مميزة' }, (load('me') || {}).addr || ''), note: h('input', { class: 'inp', placeholder: 'اختياري' }) };
    if ((load('me') || {}).area) f.area.value = load('me').area;
    let pay = 'cod';
    const lines = h('div'); const sum = h('div', { class: 'sum' }); const err = h('div', { class: 'err', role: 'alert' }); const pays = h('div', { class: 'pays' });
    const send = h('button', { class: 'cta am' }, 'تأكيد الطلب');
    const fee = () => num(((s.areas || {})[f.area.value] || {}).fee);
    const draw = () => {
      lines.replaceChildren(...(st.cart.length ? st.cart.map((l) => h('div', { class: 'line' }, bottle(fill(l.c, l.s), (cat(l.c) || {}).color || '#F2C230', 16),
        h('div', { class: 't' }, h('b', null, l.n), h('small', null, l.sn + ' — ' + money(l.pr))),
        h('div', { class: 'qty' }, h('button', { 'aria-label': 'قلل', onclick: () => { l.q--; if (l.q <= 0) st.cart = st.cart.filter((x) => x !== l); save('cart', st.cart); draw(); refreshBar(); } }, '−'), h('b', { class: 'num' }, l.q),
          h('button', { 'aria-label': 'زود', onclick: () => { l.q++; save('cart', st.cart); draw(); refreshBar(); } }, '+')))) : [h('div', { class: 'empty' }, 'السلة فاضية')]));
      const sub = st.cart.reduce((a, l) => a + l.q * l.pr, 0);
      sum.replaceChildren(h('div', null, h('span', null, 'المنتجات'), h('span', { class: 'num' }, money(sub))), h('div', null, h('span', null, 'التوصيل'), h('span', { class: 'num' }, f.area.value ? money(fee()) : 'حسب المنطقة')),
        h('div', { class: 'big' }, h('span', null, 'الإجمالي'), h('span', { class: 'num' }, money(sub + fee()))));
      const opts = [['cod', 'كاش عند الاستلام']].concat(s.wallet ? [['wallet', 'محفظة: ' + s.wallet]] : []).concat(s.insta ? [['instapay', 'إنستاباي: ' + s.insta]] : []);
      pays.replaceChildren(...opts.map(([k, l]) => h('button', { class: 'pay' + (pay === k ? ' on' : ''), onclick: () => { pay = k; draw(); } }, h('i'), l)));
      send.disabled = !st.cart.length || s.open === false;
    };
    f.area.onchange = draw;
    const sh = sheet(h('div', { class: 'sh-b' }, h('h3', null, 'السلة'), lines, sum,
      h('label', { class: 'f' }, h('span', null, 'الاسم'), f.n), h('label', { class: 'f' }, h('span', null, 'رقم الموبايل'), f.ph),
      areas.length ? h('label', { class: 'f' }, h('span', null, 'المنطقة'), f.area) : null, h('label', { class: 'f' }, h('span', null, 'العنوان بالتفصيل'), f.addr),
      h('label', { class: 'f' }, h('span', null, 'ملاحظة'), f.note), h('span', { class: 'lbl' }, 'الدفع'), pays, h('div', { style: { height: '12px' } }), err, send));
    draw();
    send.onclick = async () => {
      err.textContent = '';
      const name = f.n.value.trim(); const ph = f.ph.value.replace(/[^\d+]/g, '');
      const sub = st.cart.reduce((a, l) => a + l.q * l.pr, 0);
      if (!name) return (err.textContent = 'اكتب اسمك');
      if (ph.length < 10 || ph.length > 15) return (err.textContent = 'اكتب رقم موبايل صحيح');
      if (areas.length && !f.area.value) return (err.textContent = 'اختار منطقتك');
      if (f.addr.value.trim().length < 6) return (err.textContent = 'اكتب العنوان بالتفصيل');
      if (num(s.minOrder) && sub < num(s.minOrder)) return (err.textContent = 'أقل طلب ' + money(s.minOrder));
      send.disabled = true; send.textContent = 'بنبعت الطلب…';
      const area = f.area.value; const ar = (s.areas || {})[area] || {};
      const oid = rid();
      const order = { code: code(), ts: Date.now(), st: 'new', src: 'web', c: { n: name.slice(0, 80), ph, area: area || '', areaN: ar.n || '', addr: f.addr.value.trim().slice(0, 300), note: f.note.value.trim().slice(0, 300) },
        items: st.cart.map((l) => ({ c: l.c, s: l.s, p: l.p, n: l.n, sn: l.sn, q: l.q, pr: l.pr })), sub, fee: fee(), tot: sub + fee(), pay };
      save('me', { n: name, ph, area, addr: f.addr.value.trim() });
      try {
        let b = route(area);
        order.b = b;
        if (!DEMO) {
          try { await api.patch({ [`orders/open/${b}/${oid}`]: order, [`track/${oid}`]: { s: 'new', ts: order.ts } }); }
          catch (e) { if (e.status === 401 && b !== '_inbox') { b = '_inbox'; order.b = b; await api.patch({ [`orders/open/${b}/${oid}`]: order, [`track/${oid}`]: { s: 'new', ts: order.ts } }); } else throw e; }
        }
        st.orders.unshift({ id: oid, code: order.code, ts: order.ts, tot: order.tot }); st.orders = st.orders.slice(0, 10); save('orders', st.orders);
        st.cart = []; save('cart', st.cart); refreshBar(); sh.close();
        setTimeout(() => openTrack(oid), 300);
      } catch (e) {
        send.disabled = false; send.textContent = 'تأكيد الطلب';
        err.textContent = 'الطلب موصلش، اتأكد من النت وجرب تاني. أو كلمنا على ' + ((s.phones || [])[0] || 'الأرقام اللي فوق');
      }
    };
  }
  // one branch per order — never all branches, never two
  function route(area) {
    const r = st.routing || {};
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    if (r.mode === 'single' && r.branch) return r.branch;
    if (r.mode === 'rotate') { const l = (r.rotate || []).filter(Boolean); if (l.length) return pick(l); }
    if (r.mode === 'area') { const l = Object.keys((r.areas || {})[area] || {}); if (l.length) return pick(l); if (r.fallback) return r.fallback; }
    return '_inbox';
  }
  const STEPS = [['new', 'الطلب وصل'], ['acc', 'اتأكد'], ['prep', 'بيتجهز'], ['out', 'خرج للتوصيل'], ['done', 'اتسلم']];
  async function openTrack(oid) {
    const list = st.orders;
    if (!list.length) return toast('مفيش طلبات على الموبايل ده');
    const o = list.find((x) => x.id === oid) || list[0];
    const box = h('div', { class: 'done' });
    const sh = sheet(box);
    const draw = (t) => {
      const s = (t && t.s) || 'new';
      const idx = STEPS.findIndex(([k]) => k === s);
      box.replaceChildren(bottle(s === 'done' ? 0.95 : 0.25 + 0.15 * Math.max(0, idx), getComputedStyle(document.documentElement).getPropertyValue('--plum') || '#F2C230', 46),
        h('h3', null, oid ? 'طلبك وصلنا' : 'حالة طلبك'), h('div', null, 'رقم الطلب'), h('div', { class: 'code' }, o.code),
        s === 'cancel' ? h('p', { style: { color: '#B23A3A' } }, 'الطلب ده اتلغى. كلمنا لو محتاج حاجة.')
          : h('div', { class: 'steps' }, STEPS.map(([k, l], i) => h('div', { class: 'step ' + (i < idx || s === 'done' ? 'ok' : i === idx ? 'now' : '') }, h('i'), h('b', null, l)))),
        h('p', { style: { color: 'var(--muted)' } }, 'هنكلمك على الموبايل نأكد الطلب. الصفحة دي بتتحدث لوحدها.'),
        list.length > 1 ? h('div', { class: 'row', style: { justifyContent: 'center', flexWrap: 'wrap' } }, list.slice(0, 5).map((x) => h('button', { class: 'chip' + (x.id === o.id ? ' on' : ''), onclick: () => { sh.close(); setTimeout(() => openTrack(x.id), 300); } }, x.code))) : null,
        h('button', { class: 'cta', style: { marginTop: '14px' }, onclick: () => sh.close() }, 'تمام'));
    };
    draw(null);
    if (DEMO) return;
    const poll = async () => { if (!document.body.contains(box)) return; try { draw(await api.get(`track/${o.id}`)); } catch (e) {} setTimeout(poll, 15000); };
    poll();
  }

  // ---------------- preview data (when config.js is empty) ----------------
  function demoData() {
    const sz = (a, b, c) => ({ s100: { n: '100 مللي', ml: 100, price: a, ord: 1 }, s50: { n: '50 مللي', ml: 50, price: b, ord: 2 }, s30: { n: '30 مللي', ml: 30, price: c, ord: 3 } });
    return {
      catalog: { cats: { fr: { n: 'فرنساوي', en: 'French', color: '#F2C230', ord: 1, sizes: sz(500, 300, 200) }, gu: { n: 'خليجي', en: 'Gulf', color: '#E39B2D', ord: 2, sizes: sz(650, 380, 250) }, sh: { n: 'أزايز أشكال', en: 'Shaped bottles', color: '#F5F1E6', ord: 3, sizes: sz(600, 350, 230) }, or: { n: 'أوريجينال', en: 'Original', color: '#C9A961', ord: 4, mode: 'product', sizes: { s100: { n: '100 مللي', ml: 100, ord: 1 } } }, bk: { n: 'مباخر', en: 'Incense burners', color: '#D9A21E', ord: 5, mode: 'item', sizes: { u: { n: 'القطعة', ord: 1 } } } }, prods: { p1: { c: 'bk', n: 'مبخرة القبة', prices: { u: 550 }, ord: 1 }, p2: { c: 'bk', n: 'مبخرة الدلّة', prices: { u: 550 }, ord: 2 } }, offers: { o1: { t: 'عرض المباخر — وفّر 300 جنيه', c: 'bk', kind: 'amt', val: 300, on: true, web: true, to: '2099-12-31' }, o2: { t: 'خصم الخليجي', c: 'gu', s: 's50', kind: 'pct', val: 20, on: true, web: true } } },
      site: { name: 'اسم البراند', nameEn: 'BRAND', slogan: 'عرض تجريبي للموقع', phones: ['01000000000'], wa: '01000000000', addr: 'القاهرة', areas: { a1: { n: 'المعادي', fee: 40, ord: 1 }, a2: { n: 'مدينة نصر', fee: 45, ord: 2 } }, open: true },
      routing: { mode: 'manual' }, avail: {},
    };
  }
  boot();
})();
