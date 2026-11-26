// The icon in motion: the bars talk, the pencil writes the loop, the dots pop in, then it rewinds.
// "talk to it" lets your own voice move the bars and the pencil. Only the sound level is read,
// in the browser; nothing is recorded or sent.
(() => {
  const svg = document.querySelector('.hg-mark');
  if (!svg) return;
  const ink = svg.querySelector('.hg-ink'), pen = svg.querySelector('.hg-pen');
  const bars = [...svg.querySelectorAll('.hg-bars rect')].map(r => {
    const y = +r.getAttribute('y'), h = +r.getAttribute('height'), w = +r.getAttribute('width');
    return { r, w, h, cy: y + h / 2 };
  });
  const dots = [...svg.querySelectorAll('.hg-dots rect')].map(r => {
    const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width');
    return { r, cx: x + w / 2, cy: y + w / 2 };
  });
  const len = ink.getTotalLength();
  const start = ink.getPointAtLength(0);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function setBars(levels) {
    bars.forEach((b, i) => {
      const h = Math.max(b.w, b.h * levels[i]);
      b.r.setAttribute('y', (b.cy - h / 2).toFixed(1));
      b.r.setAttribute('height', h.toFixed(1));
    });
  }
  function setLoop(p) {
    ink.style.strokeDashoffset = p <= 0.001 ? 1.2 : 1 - p;
    const pt = ink.getPointAtLength(clamp(p) * len), ahead = ink.getPointAtLength(clamp(p + .01) * len);
    const tilt = (p <= 0.001 || p >= 0.999) ? 0 : Math.max(-3, Math.min(3, (ahead.y - pt.y) * 0.8));
    pen.setAttribute('transform', `translate(${(pt.x - start.x).toFixed(1)} ${(pt.y - start.y).toFixed(1)}) rotate(${tilt.toFixed(1)} ${start.x} ${start.y})`);
  }
  function setDots(k) {   // k: 0..1 across all three dots, one after another
    dots.forEach((d, i) => {
      const s = back(clamp(k * 3 - i)) * (k * 3 - i > 0 ? 1 : 0);
      d.r.setAttribute('transform', `translate(${d.cx} ${d.cy}) scale(${Math.max(0, s).toFixed(3)}) translate(${-d.cx} ${-d.cy})`);
    });
  }
  // A made-up voice: syllables of different loudness, each bar with its own wobble.
  const phase = bars.map((_, i) => i * 1.7), speed = bars.map((_, i) => 9 + (i * 5) % 7);
  function voice(t) {
    const syl = Math.max(0, Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 2.1)) + 0.25 * Math.max(0, Math.sin(t * 13.7 + 1));
    return bars.map((_, i) => 0.22 + syl * 0.95 * (0.5 + 0.5 * Math.sin(t * speed[i] + phase[i])));
  }

  const T = 8.2;  // seconds per cycle
  function frame(t) {
    const c = t % T;
    const talk = clamp((c - .3) / .25) * (1 - clamp((c - 3.1) / .5));   // talking, then quiet
    const rest = bars.map(() => 1);
    const v = voice(t);
    const unwind = clamp((c - 7.1) / .9);                                // rewind at the end
    const settle = clamp((c - 3.1) / .7);
    setBars(v.map((x, i) => (x * talk + (talk < 1 ? (0.18 + (rest[i] - .18) * ease(settle)) * (1 - talk) : 0)) * (1 - unwind) + .18 * unwind));
    setLoop(ease(clamp((c - 1.0) / 2.6)) * (1 - ease(unwind)));
    setDots(clamp((c - 3.5) / .7) * (1 - unwind));
  }

  const still = () => { setBars(bars.map(() => 1)); setLoop(1); setDots(1); pen.setAttribute('transform', ''); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { still(); return; }

  let mode = 'auto', raf = 0, t0 = performance.now(), visible = true;
  const tick = now => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    if (mode === 'auto') frame((now - t0) / 1000);
    else listen(now);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
  raf = requestAnimationFrame(tick);

  // Talk to it: your voice level moves the bars and pushes the pencil along.
  const button = document.querySelector('.hg-talk'), note = document.querySelector('.hg-talk-note');
  let audio, analyser, data, stream, progress = 0, last = 0, quietFor = 0;
  function listen(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    analyser.getByteFrequencyData(data);
    const per = Math.floor(data.length * .45 / bars.length), lv = [];
    for (let i = 0; i < bars.length; i++) {
      let s = 0; for (let j = 2 + i * per; j < 2 + (i + 1) * per; j++) s += data[j];
      lv.push(0.18 + Math.min(1.1, (s / per / 255) * 2.2));
    }
    setBars(lv);
    const loud = lv.reduce((a, b) => a + b, 0) / lv.length - .18;
    if (loud > .12) { progress = Math.min(1, progress + dt * (0.15 + loud * .5)); quietFor = 0; } else quietFor += dt;
    setLoop(ease(progress));
    setDots(clamp((progress - .85) / .15));
    if (progress >= 1 && quietFor > 2.5) progress = 0;   // write it again next time you talk
  }
  async function startListening() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { note.textContent = "The browser didn't allow the microphone, so it's playing on its own."; return; }
    audio = new AudioContext();
    analyser = audio.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .6;
    audio.createMediaStreamSource(stream).connect(analyser);
    data = new Uint8Array(analyser.frequencyBinCount);
    progress = 0; last = performance.now(); mode = 'listen';
    button.textContent = 'stop listening'; button.setAttribute('aria-pressed', 'true');
    note.textContent = 'Listening. Only the sound level is read, in your browser. Nothing is recorded or sent.';
  }
  function stop() {
    stream?.getTracks().forEach(t => t.stop()); audio?.close();
    mode = 'auto'; t0 = performance.now();
    button.textContent = 'talk to it'; button.setAttribute('aria-pressed', 'false');
    note.textContent = '';
  }
  button?.addEventListener('click', () => mode === "listen" ? stop() : startListening());
})();
