/* Shared helpers — no external libraries */
(function () {
  const P = (window.P = window.P || {});
  // append/replaceChildren ignore null/false children (so conditional pieces can be written inline)
  for (const proto of [Element.prototype, DocumentFragment.prototype]) for (const m of ['append', 'replaceChildren', 'prepend']) {
    const orig = proto[m];
    proto[m] = function (...a) { return orig.apply(this, a.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)); };
  }

  P.$ = (s, r) => (r || document).querySelector(s);
  P.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // DOM builder: h('div', {class:'x', onclick:fn}, 'text', child, [children])
  P.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (c) => {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) return c.forEach(add);
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  };
  P.svg = function (markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  };

  P.normUser = (v) => { v = String(v || '').trim().toLowerCase().replace(/\s+/g, '_'); return /^[\p{L}\p{N}_-]{2,30}$/u.test(v) ? v : null; };
  P.arr = (x) => (Array.isArray(x) ? x.filter((v) => v !== null && v !== undefined) : Object.values(x || {}));
  P.ents = (x) => Object.entries(x || {}).filter(([, v]) => v !== null && v !== undefined);
  P.num = (x) => (typeof x === 'number' && isFinite(x) ? x : parseFloat(x) || 0);
  P.uid = (n = 6) => {
    const r = crypto.getRandomValues(new Uint8Array(n));
    return Date.now().toString(36) + Array.from(r, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  };
  P.shortCode = (n = 6) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  P.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  P.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  P.clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  // ---------- dates (device local time) ----------
  const pad = (n) => String(n).padStart(2, '0');
  P.dayKey = (d = new Date()) => { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  P.monthKey = (d = new Date()) => P.dayKey(d).slice(0, 7);
  P.parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); };
  P.addDays = (k, n) => { const d = P.parseDay(k); d.setDate(d.getDate() + n); return P.dayKey(d); };
  P.daysBetween = (a, b) => { const out = []; let k = a; let guard = 0; while (k <= b && guard++ < 4000) { out.push(k); k = P.addDays(k, 1); } return out; };
  P.monthEnd = (mk) => { const [y, m] = mk.split('-').map(Number); return P.dayKey(new Date(y, m, 0)); };
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const AR_DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  P.fmt = {
    n: (x) => P.num(x).toLocaleString('en-US', { maximumFractionDigits: 2 }),
    money: (x) => P.num(x).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج',
    time: (ts) => { const d = new Date(ts); let h = d.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${pad(d.getMinutes())} ${ap}`; },
    day: (k) => { const d = P.parseDay(k); return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; },
    dayShort: (k) => { const d = P.parseDay(k); return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`; },
    month: (mk) => { const [y, m] = mk.split('-').map(Number); return `${AR_MONTHS[m - 1]} ${y}`; },
    monthName: (m) => AR_MONTHS[m - 1],
    dt: (ts) => { const d = new Date(ts); return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${P.fmt.time(ts)}`; },
    ago: (ts) => {
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 60) return 'دلوقتي';
      if (s < 3600) return `من ${Math.round(s / 60)} دقيقة`;
      if (s < 86400) return `من ${Math.round(s / 3600)} ساعة`;
      return `من ${Math.round(s / 86400)} يوم`;
    },
  };

  // ---------- signature glyph: bottle with liquid level ----------
  P.bottle = function (fill = 0.6, color = 'currentColor', size = 28, cls = '') {
    const f = Math.max(0, Math.min(1, fill));
    const top = 14 + (1 - f) * 30; // liquid surface y inside body (14..44)
    const id = 'b' + Math.random().toString(36).slice(2, 8);
    return P.svg(`<svg class="bottle ${cls}" width="${size}" height="${size * 1.5}" viewBox="0 0 32 48" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="M9 14c0-2 1.5-3.5 3.5-3.5h7c2 0 3.5 1.5 3.5 3.5v28c0 2.2-1.8 4-4 4h-6c-2.2 0-4-1.8-4-4z"/></clipPath></defs>
      <rect x="12.5" y="2" width="7" height="5" rx="1.2" fill="${color}" opacity=".9"/>
      <rect x="13.5" y="7" width="5" height="3.5" fill="${color}" opacity=".45"/>
      <g clip-path="url(#${id})"><rect class="liq" x="0" y="${top}" width="32" height="48" fill="${color}" opacity=".85"/></g>
      <path d="M9 14c0-2 1.5-3.5 3.5-3.5h7c2 0 3.5 1.5 3.5 3.5v28c0 2.2-1.8 4-4 4h-6c-2.2 0-4-1.8-4-4z" fill="none" stroke="${color}" stroke-width="1.6"/>
      <path d="M12 17v18" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>
    </svg>`);
  };

  // ---------- icons (stroke, 24px) ----------
  const IC = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    truck: '<path d="M1 4h14v12H1z"/><path d="M15 9h4l4 4v3h-8"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.4.6 4 2.8 4 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/><path d="M1.5 9a15 15 0 0 1 21 0"/>',
    wifioff: '<path d="M2 2l20 20"/><path d="M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.2-2.8M14.8 10a10 10 0 0 1 4.2 2.5"/><circle cx="12" cy="19.5" r="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    whatsapp: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.4z"/><path d="M9 9c0 3.5 2.5 6 6 6l1.2-1.6-2-1-1 1c-1.2-.4-2.2-1.4-2.6-2.6l1-1-1-2z"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  };
  P.icon = (name, size = 18) => P.svg(`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`);

  // ---------- toasts & modals ----------
  P.toast = function (msg, type = 'ok', ms = 3200) {
    let box = P.$('#toasts');
    if (!box) { box = P.h('div', { id: 'toasts' }); document.body.appendChild(box); }
    const t = P.h('div', { class: 'toast ' + type, role: 'status' }, msg);
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  };

  // modal({title, body: Node|fn(close)=>Node, actions:[{label, kind, onClick:(close)=>{}}], wide})
  P.modal = function ({ title, sub, body, actions = [], wide = false, onClose }) {
    return new Promise((resolve) => {
      const back = P.h('div', { class: 'modal-back' });
      const close = (val) => { back.classList.add('out'); setTimeout(() => back.remove(), 160); document.removeEventListener('keydown', esc); onClose && onClose(val); resolve(val); };
      const esc = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', esc);
      const content = typeof body === 'function' ? body(close) : body;
      const box = P.h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
        P.h('div', { class: 'modal-head' },
          P.h('div', null, P.h('h3', null, title || ''), sub ? P.h('p', { class: 'muted' }, sub) : null),
          P.h('button', { class: 'icon-btn', 'aria-label': 'إغلاق', onclick: () => close(null) }, P.icon('x'))),
        P.h('div', { class: 'modal-body' }, content),
        actions.length ? P.h('div', { class: 'modal-foot' }, actions.map((a) => P.h('button', {
          class: 'btn ' + (a.kind || ''), onclick: async (e) => {
            const btn = e.currentTarget; if (btn.disabled) return;
            btn.disabled = true;
            try { await a.onClick(close); } catch (err) { P.toast(err.message || String(err), 'err'); }
            btn.disabled = false;
          },
        }, a.label))) : null);
      back.appendChild(box);
      back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
      document.body.appendChild(back);
      const f = box.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
    });
  };
  P.confirm = (title, text, okLabel = 'تأكيد', danger = false) => P.modal({
    title, body: P.h('p', null, text),
    actions: [{ label: 'رجوع', kind: 'ghost', onClick: (c) => c(false) }, { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: (c) => c(true) }],
  });

  // form field helper
  P.field = (label, input, hint) => P.h('label', { class: 'field' }, P.h('span', { class: 'lbl' }, label), input, hint ? P.h('small', { class: 'muted' }, hint) : null);
  P.input = (props) => P.h('input', Object.assign({ class: 'inp' }, props));
  P.select = (opts, value, props) => P.h('select', Object.assign({ class: 'inp' }, props), opts.map(([v, l]) => P.h('option', { value: v, selected: String(v) === String(value) }, l)));
  P.toggle = (checked, onchange, label) => P.h('label', { class: 'tgl' }, P.h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), P.h('span', { class: 'tgl-ui' }), label ? P.h('span', null, label) : null);

  // ---------- files ----------
  P.download = function (name, content, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = P.h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  P.csv = (rows) => '﻿' + rows.map((r) => r.map((c) => { const s = c === null || c === undefined ? '' : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  P.pickFile = (accept) => new Promise((res) => { const i = P.h('input', { type: 'file', accept, style: 'display:none' }); i.onchange = () => { res(i.files[0] || null); i.remove(); }; document.body.appendChild(i); i.click(); });
  P.readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });

  // compress an image file -> dataURL (webp), longest side <= max
  P.compressImage = function (file, max = 900, q = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', q);
        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', q);
        URL.revokeObjectURL(img.src);
        resolve(out);
      };
      img.onerror = () => reject(new Error('الصورة دي مش مدعومة'));
      img.src = URL.createObjectURL(file);
    });
  };

  // password hashing for offline login
  P.hashPw = async function (pw, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  };

  // ---------- tiny IndexedDB key-value store ----------
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('perfume-system', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const st = t.objectStore('kv'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); }); };
  P.kv = {
    get: (k) => tx('readonly', (s) => s.get(k)),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)),
    keys: () => tx('readonly', (s) => s.getAllKeys()),
    clearPrefix: async (prefix) => { const ks = await P.kv.keys(); await tx('readwrite', (s) => ks.filter((k) => String(k).startsWith(prefix)).forEach((k) => s.delete(k))); },
  };

  // generic tree helpers (paths like 'a/b/c')
  P.split = (p) => String(p || '').split('/').filter(Boolean);
  P.getAt = (tree, p) => { let n = tree; for (const k of P.split(p)) { if (n === null || typeof n !== 'object' || !(k in n)) return null; n = n[k]; } return n === undefined ? null : n; };
  P.setAt = (tree, p, val) => {
    const ks = P.split(p);
    if (!ks.length) return;
    let n = tree;
    for (let i = 0; i < ks.length - 1; i++) {
      if (n[ks[i]] === null || typeof n[ks[i]] !== 'object') { if (val === null || val === undefined) return; n[ks[i]] = {}; }
      n = n[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (val === null || val === undefined) delete n[last];
    else n[last] = val && typeof val === 'object' ? P.clone(val) : val;
  };
})();
