/* Hyper Grader motion sections: voice to marks, fast and good, time back.
   Vanilla JS. Each scene starts when scrolled into view and loops while visible.
   With prefers-reduced-motion (or no IntersectionObserver) the finished state just shows. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
  if (!still) document.documentElement.classList.add('motion');

  // One looping scene. reset() clears, run(step) plays once; every effect follows a step(),
  // so stopping (scrolled away, or replay) cancels cleanly at the next await.
  function scene(el, { reset, run, stop, hold = 5000 }) {
    if (still) return;
    let tok = { stop: true };
    const halt = () => { tok.stop = true; if (stop) stop(); };
    const play = async () => {
      const mine = tok = { stop: false };
      const step = async ms => { await wait(ms); if (mine.stop) throw mine; };
      try { for (;;) { reset(); await step(500); await run(step); await step(hold); } }
      catch (e) { if (e !== mine) throw e; }
    };
    reset();
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { if (tok.stop) play(); } else halt(); }, { threshold: 0.2 }).observe(el);
    const btn = $('.replay button', el);
    if (btn) btn.onclick = () => { halt(); play(); };
  }
  const tween = async (step, ms, fn) => { for (let t = 0; t < ms; t += 20) { fn(t / ms); await step(20); } fn(1); };

  // Wrap each word so it can appear in turn; elements (the ums) count as one word.
  function wrapWords(el) {
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 1) { n.classList.add('w'); continue; }
      const f = document.createDocumentFragment();
      for (const part of n.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { f.append(part); continue; }
        const s = document.createElement('span'); s.className = 'w'; s.textContent = part; f.append(s);
      }
      n.replaceWith(f);
    }
  }

  // 1. Voice to marks
  const voice = $('#voice');
  if (voice) {
    const BANDS = [['High Distinction', 85], ['Distinction', 75], ['Credit', 65], ['Pass', 50], ['Fail', 0]];
    const meter = $('.meter', voice), status = $('.status', voice);
    const bars = Array.from({ length: 32 }, () => meter.appendChild(document.createElement('span')));
    const phrases = $$('[data-p]', voice), fb = $('.fb', voice), crits = $$('.crit', voice);
    const num = $('.num', voice), grade = $('.grade', voice), flag = $('.flag', voice);
    let speaking = false, flat = false, total = 0;

    const setTotal = t => {
      t = Math.round(t); num.textContent = t;
      const all = crits.every(r => r.classList.contains('lit')); // grade only once every criterion is in
      grade.textContent = t && all ? BANDS.find(b => t >= b[1])[0] : '';
      const next = BANDS.filter(b => b[1] > t).pop();
      flag.textContent = all && t && next && next[1] - t <= 2 ? `${next[1] - t}% below a ${next[0]}` : '';
    };
    // the audio-level bars: a still pattern when reduced, a lively one while "speaking"
    const rest = i => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.31));
    bars.forEach((b, i) => { if (still) b.style.transform = `scaleY(${rest(i)})`; });
    if (!still) {
      for (const el of [...phrases, fb]) wrapWords(el);
      setInterval(() => {
        if (!speaking && flat) return;
        flat = !speaking;
        bars.forEach((b, i) => { b.style.transform = `scaleY(${speaking ? 0.12 + 0.88 * Math.random() * (0.55 + 0.45 * Math.sin(i / 4 + Date.now() / 180)) : 0.08})`; });
      }, 90);
    }

    const light = async (step, c) => {
      const row = crits[c], { band, step: st, pts } = row.dataset, pt = $('.pts b', row);
      row.classList.add('lit'); status.textContent = 'marking';
      $$('.bands b', row)[band].classList.add('on'); await step(320);
      $$('.steps span', row)[st].classList.add('on'); await step(320);
      const from = total; total += +pts;
      await tween(step, 500, k => { pt.textContent = Math.round(pts * k); setTotal(from + pts * k); });
    };
    scene(voice, {
      stop: () => { speaking = false; },
      reset: () => {
        total = 0; speaking = false; status.textContent = 'listening';
        $$('.w', voice).forEach(w => w.classList.remove('on'));
        $$('.on', $('.crits', voice)).forEach(e => e.classList.remove('on'));
        crits.forEach(r => { r.classList.remove('lit'); $('.pts b', r).textContent = 0; });
        setTotal(0);
      },
      run: async step => {
        for (const p of phrases) {
          speaking = true; status.textContent = 'listening';
          for (const w of $$('.w', p)) { w.classList.add('on'); await step(w.tagName === 'I' ? 260 : 130); }
          speaking = false; await step(350);
          if (p.dataset.crit) await light(step, +p.dataset.crit);
          await step(250);
        }
        status.textContent = 'writing';
        for (const w of $$('.w', fb)) { w.classList.add('on'); await step(32); }
        status.textContent = 'written';
      },
      hold: 6000,
    });
  }

  // 2. Fast and good. The bar is illustrative: it carries no timing claim.
  const fast = $('#fast');
  if (fast) {
    const picks = $$('.fnotes i, .fnotes mark', fast), sents = $$('.fs', fast), items = $$('.gk li', fast);
    const bar = $('.bar span', fast), st = $('.gen .status', fast);
    scene(fast, {
      reset: () => {
        [...picks, ...sents, ...items].forEach(e => e.classList.remove('on'));
        bar.style.transition = 'none'; bar.style.width = '0'; bar.offsetWidth; bar.style.transition = '';
        st.textContent = 'ready';
      },
      run: async step => {
        for (const p of picks) { p.classList.add('on'); await step(240); }
        await step(300); st.textContent = 'writing'; bar.style.width = '100%';
        for (const s of sents) { s.classList.add('on'); await step(450); }
        st.textContent = 'written'; await step(300);
        for (const li of items) { li.classList.add('on'); await step(300); }
      },
    });
  }

  // 3. Time back: a class of 30, one student at a time
  const tl = $('.tally-list');
  if (tl) {
    const fmt = m => { const h = (m / 60) | 0, r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
    const rows = $$('li', tl).map(li => {
      const tot = li.insertBefore(document.createElement('span'), li.firstChild), t = li.appendChild(document.createElement('div'));
      tot.className = 'tot'; t.className = 'tally';
      tot.setAttribute('aria-hidden', 'true'); t.setAttribute('aria-hidden', 'true');
      return { min: +li.dataset.min, tot, cells: Array.from({ length: 30 }, () => t.appendChild(document.createElement('span'))) };
    });
    const show = n => rows.forEach(r => { r.tot.textContent = fmt(n * r.min); r.cells.forEach((c, i) => c.classList.toggle('on', i < n)); });
    show(30);
    scene(tl, { reset: () => show(0), run: async step => { for (let n = 1; n <= 30; n++) { show(n); await step(75); } }, hold: 4500 });
  }
})();
