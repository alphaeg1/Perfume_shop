/* Shared editors for sizes, original items and their photos — used by the laptop app and the phone follow-up page */
(function () {
  const P = window.P;
  const { h, S, C } = P;
  const imgCache = {};
  P.loadThumb = async function (id, v, el) {
    const key = id + ':' + v;
    if (!imgCache[key]) imgCache[key] = (async () => { const c = await P.kv.get('img:' + key); if (c) return c; const t = await P.FB.get(`public/img/${id}/t`); if (t) P.kv.set('img:' + key, t); return t; })().catch(() => null);
    const src = await imgCache[key];
    if (src && el && el.parentNode) el.replaceWith(h('img', { class: el.className || 'thumb', src, alt: '' }));
  };
  const saveCat = (up) => { up['rev/cat'] = Date.now(); S.write(up, 'تعديل المنتجات والأسعار'); };
  const sizeImgId = (c, s) => `${c}-${s}`;

  // photo picker used by size + original item dialogs
  function photoBox(id, v) {
    const st = { img: null };
    const ph = h('span', { class: 'thumb', style: { width: '110px', height: '110px' } }, P.icon('image', 28));
    const box = h('div', { class: 'row gap' }, ph, h('div', null,
      h('button', { class: 'btn sm', onclick: async () => {
        const file = await P.pickFile('image/*'); if (!file) return;
        try {
          st.img = { f: await P.compressImage(file, 1000, 0.82), t: await P.compressImage(file, 420, 0.74) };
          box.firstChild.replaceWith(h('img', { class: 'thumb', src: st.img.t, style: { width: '110px', height: '110px' } }));
        } catch (e) { P.toast(e.message, 'err'); }
      } }, P.icon('upload', 14), 'رفع صورة'),
      h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'بتظهر للعميل على الموقع')));
    if (v) P.loadThumb(id, v, ph).then(() => { const im = box.querySelector('img'); if (im) { im.style.width = '110px'; im.style.height = '110px'; } });
    return { box, st };
  }


  P.CatEdit = {
    save: saveCat, photoBox, sizeImgId,
    size(c, s, done) {
      const cat = C.cat(c); const byP = cat.mode === 'product';
      const sz = s ? C.size(c, s) : { n: '', ml: '', price: '', on: true, web: true };
      const f = {
        ml: P.input({ type: 'number', value: sz.ml, placeholder: '100' }),
        n: P.input({ value: sz.n, placeholder: 'بيتكتب لوحده: 100 مللي' }),
        price: P.input({ type: 'number', value: sz.price }), cost: P.input({ type: 'number', value: s ? C.cost(c, s) || '' : '' }),
        on: sz.on !== false, web: sz.web !== false,
      };
      f.ml.addEventListener('input', () => { if (!s || !sz.n) f.n.value = f.ml.value ? f.ml.value + ' مللي' : ''; });
      const photo = byP ? null : photoBox(sizeImgId(c, s), sz.img);
      P.modal({
        title: s ? 'تعديل ' + cat.n + ' ' + sz.n : 'حجم جديد في ' + cat.n, wide: !byP,
        body: h('div', null,
          h('div', { class: 'grid g2' }, P.field('السعة بالمللي', f.ml), P.field('الاسم اللي بيظهر', f.n)),
          h('div', { class: 'grid g2' }, byP ? null : P.field('سعر البيع (موحّد في كل الفروع)', f.price, 'ممكن تسيبه فاضي دلوقتي وتحطه بعدين'), P.field('تكلفة الازازة (بتظهر لك انت بس)', f.cost, 'علشان صافي الربح في التقارير')),
          photo ? P.field('صورة للموقع', photo.box) : null,
          h('div', { class: 'row gap wrap', style: { gap: '22px' } }, P.toggle(f.on, (v) => (f.on = v), 'شغال في الفروع'), byP ? null : P.toggle(f.web, (v) => (f.web = v), 'ظاهر على الموقع'))),
        actions: [
          s ? { label: 'حذف الحجم', kind: 'ghost', onClick: async (close) => { if (!(await P.confirm('حذف الحجم', 'هيتشال من الفروع والموقع. المبيعات القديمة بتفضل في التقارير.', 'احذف', true))) return; saveCat({ [`catalog/cats/${c}/sizes/${s}`]: null, [`public/img/${sizeImgId(c, s)}`]: null }); close(); done && done(); } } : null,
          { label: 'حفظ', kind: 'primary', onClick: (close) => {
            const name = f.n.value.trim() || (f.ml.value ? f.ml.value + ' مللي' : '');
            if (!name) throw new Error('اكتب السعة');
            const id = s || 's' + (P.num(f.ml.value) || P.uid(2)) + (C.size(c, 's' + P.num(f.ml.value)) ? P.uid(2) : '');
            const base = `catalog/cats/${c}/sizes/${id}`;
            const up = { [`${base}/n`]: name, [`${base}/ml`]: P.num(f.ml.value), [`${base}/price`]: byP ? 0 : (f.price.value === '' ? '' : P.num(f.price.value)), [`${base}/on`]: f.on, [`${base}/web`]: f.web };
            if (!s) up[`${base}/ord`] = Math.max(0, ...C.sizes(c, true).map(([, z]) => P.num(z.ord))) + 1;
            up[`costs/${c}/${id}`] = f.cost.value === '' ? null : P.num(f.cost.value);
            up['rev/cost'] = Date.now();
            if (photo && photo.st.img) { const v = Date.now(); up[`${base}/img`] = v; up[`public/img/${sizeImgId(c, id)}`] = { v, ...photo.st.img }; imgCache[sizeImgId(c, id) + ':' + v] = Promise.resolve(photo.st.img.t); }
            saveCat(up); P.toast('اتحفظ'); close(); done && done();
          } }].filter(Boolean),
      });
    },
    prod(c, pid, done) {
      if (pid) c = C.prod(pid).c;
      const p = pid ? C.prod(pid) : { n: '', prices: {}, on: true, web: true };
      const sizes = C.sizes(c, true);
      if (!sizes.length) return P.toast('ضيف أحجام الخانة دي الأول (مثلاً 100 مللي)', 'err');
      const isItem = C.isItem(c);
      const photo = photoBox(pid, p.img);
      const f = {
        n: P.input({ value: p.n, placeholder: 'اسم المنتج زي ما مكتوب على العلبة' }),
        prices: sizes.map(([s]) => [s, P.input({ type: 'number', value: p.prices && p.prices[s] !== undefined ? p.prices[s] : '', placeholder: 'مش متاح' })]),
        costs: sizes.map(([s]) => [s, P.input({ type: 'number', value: (((S.get('costs') || {}).p || {})[pid] || {})[s] || '', placeholder: '—' })]),
        on: p.on !== false, web: p.web !== false,
      };
      P.modal({
        title: pid ? 'تعديل ' + p.n : 'إضافة صنف في ' + (C.cat(c) || {}).n, wide: true,
        body: h('div', null, P.field('اسم المنتج', f.n), P.field('صورة للموقع', photo.box),
          isItem ? h('div', { class: 'grid g2' }, P.field('سعر البيع', f.prices[0][1]), P.field('التكلفة (ليك انت بس)', f.costs[0][1])) : h('div', null, h('div', { class: 'sec-t' }, 'السعر لكل حجم (سيبه فاضي لو الحجم ده مش موجود)'),
          h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'الحجم'), h('th', null, 'سعر البيع'), h('th', null, 'التكلفة (ليك انت بس)'))),
            h('tbody', null, sizes.map(([s, sz], i) => h('tr', null, h('td', null, sz.n), h('td', null, f.prices[i][1]), h('td', null, f.costs[i][1])))))),
          h('div', { class: 'row gap wrap', style: { gap: '22px', marginTop: '12px' } }, P.toggle(f.on, (v) => (f.on = v), 'متاح في الفروع'), P.toggle(f.web, (v) => (f.web = v), 'ظاهر على الموقع'))),
        actions: [
          pid ? { label: 'حذف المنتج', kind: 'ghost', onClick: async (close) => { if (!(await P.confirm('حذف المنتج', 'هيتشال من الفروع والموقع.', 'احذف', true))) return; saveCat({ [`catalog/prods/${pid}`]: null, [`public/img/${pid}`]: null }); close(); done && done(); } } : null,
          { label: 'حفظ', kind: 'primary', onClick: (close) => {
            if (!f.n.value.trim()) throw new Error('اكتب اسم المنتج');
            const prices = {}; f.prices.forEach(([s, inp]) => { if (inp.value !== '') prices[s] = P.num(inp.value); });
            if (!Object.keys(prices).length) throw new Error(isItem ? 'اكتب السعر' : 'اكتب سعر حجم واحد على الأقل');
            const id = pid || 'p' + P.uid(3);
            const prod = { c, n: f.n.value.trim(), prices, on: f.on, web: f.web, ord: pid ? p.ord || 0 : Math.max(0, ...C.prods(c, true).map(([, x]) => P.num(x.ord))) + 1, img: p.img || 0 };
            const up = {};
            if (photo.st.img) { const v = Date.now(); prod.img = v; up[`public/img/${id}`] = { v, ...photo.st.img }; imgCache[id + ':' + v] = Promise.resolve(photo.st.img.t); }
            up[`catalog/prods/${id}`] = prod;
            const costs = {}; f.costs.forEach(([s, inp]) => { if (inp.value !== '') costs[s] = P.num(inp.value); });
            up[`costs/p/${id}`] = Object.keys(costs).length ? costs : null; up['rev/cost'] = Date.now();
            saveCat(up); P.toast('اتحفظ'); close(); done && done();
          } }].filter(Boolean),
      });
    },
  };
})();
