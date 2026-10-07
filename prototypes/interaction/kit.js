// Shared kit for the interaction mockups (prototypes/interaction/*.html).
//
// What lives here:
//   REED.springs     the motion tokens (names match design/motion.ts) as CSS linear() easings
//   <reed-face>      a mascot approximation with the app's expression names (mascot-engine.ts)
//   GlowField        the ambient glow, drawn on a canvas with the same parameters the Skia
//                    implementation should take (energy, cy, spread, warmth, breath, waves, tilt)
//   REED.page(...)   the step player: steps list | phone | notes, plus the full spec below
//
// This is a mockup. The mascot and glow approximate the real thing; the timings, tokens,
// states and rules written in the notes are the contract.

(() => {
  const REED = (window.REED = {});
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => window.__errs.push(String(e.reason && e.reason.stack || e.reason)));

  // ------------------------------------------------------------------ springs
  // Reanimated 4 `withSpring({ duration, dampingRatio })` approximated as a CSS linear() curve.
  function springCurve(dampingRatio, samples = 72) {
    const z = dampingRatio;
    const w = z < 1 ? 6.9 / z : 9.2;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let x;
      if (z < 1) {
        const wd = w * Math.sqrt(1 - z * z);
        x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
      } else {
        x = 1 - (1 + w * t) * Math.exp(-w * t);
      }
      pts.push(+x.toFixed(4));
    }
    pts[samples] = 1;
    return `linear(${pts.join(', ')})`;
  }
  // Existing tokens (design/motion.ts) + the two new ones this work adds (pop, glide).
  const springs = (REED.springs = {
    snappy: { duration: 260, dampingRatio: 0.7, real: 'stiffness 400, damping 28, mass 1', note: 'existing · press feedback, toggles' },
    smooth: { duration: 420, dampingRatio: 0.78, real: 'stiffness 200, damping 22, mass 1', note: 'existing · reveals, list inserts' },
    gentle: { duration: 560, dampingRatio: 0.82, real: 'stiffness 120, damping 18, mass 1', note: 'existing · mode transitions' },
    morph: { duration: 550, dampingRatio: 0.92, note: 'existing · Pulse, mascot glide, stage recede' },
    sheet: { duration: 450, dampingRatio: 1, note: 'existing · bottom sheets' },
    pop: { duration: 380, dampingRatio: 0.62, note: 'NEW · composer focus, chips arriving, mascot reactions' },
    lift: { duration: 480, dampingRatio: 0.86, note: 'NEW · text lifting from composer into the thread' },
  });
  for (const [name, s] of Object.entries(springs)) {
    s.css = springCurve(s.dampingRatio);
    document.documentElement.style.setProperty(`--${name}`, s.css);
  }

  // ------------------------------------------------------------------ icons
  const icons = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    barbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    swap: '<path d="M7 4L3.5 7.5 7 11M3.5 7.5H16M17 13l3.5 3.5L17 20M20.5 16.5H8"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
    dots: '<path d="M12 6h.01M12 12h.01M12 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>',
    flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
    note: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M10 12h5M10 15.5h5"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  };
  const icon = (REED.icon = (name, stroke = 1.7) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`);

  REED.statusBar = `<div class="status"><span class="st-time">9:41</span><i class="st-island"></i>
    <span class="st-sys"><svg viewBox="0 0 18 12" width="18" height="12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 27 13" width="27" height="13" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="23" height="12" rx="3.5" opacity=".4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M25.5 4.5v4" stroke-linecap="round" opacity=".4"/></svg></span></div><i class="home-ind"></i>`;
  REED.keyboard = `<div class="kb">${['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((r, i) => `<div>${i === 2 ? '<i class="m"></i>' : ''}${[...r].map(() => '<i></i>').join('')}${i === 2 ? '<i class="m"></i>' : ''}</div>`).join('')}<div><i class="m"></i><i class="m"></i><i class="w"></i><i class="m" style="width:88px"></i></div></div>`;

  // ------------------------------------------------------------------ mascot
  // Expression names are the app's (components/reed/mascot/mascot-engine.ts). Glyphs approximate them.
  const faceCss = `
    reed-face { display:block; line-height:0 }
    reed-face svg { width:100%; height:100%; overflow:visible; display:block }
    reed-face .pose, reed-face .gaze { transition: transform calc(var(--k,1) * 480ms) var(--smooth) }
    reed-face .act, reed-face .g, reed-face .core-wrap { transform-box: fill-box; transform-origin: center }
    reed-face .g { opacity:0; transform: scale(.7); transition: opacity calc(var(--k,1) * 200ms) ease-out, transform calc(var(--k,1) * 380ms) var(--pop) }
    reed-face .g.on { opacity:1; transform:none }
    reed-face .halo { transition: opacity calc(var(--k,1) * 600ms) }
    reed-face .core-wrap { animation: rf-breathe calc(var(--ks,1) * 4.8s) ease-in-out infinite }
    reed-face [data-g="line"] path, reed-face [data-g="watching"] circle { transform-box: fill-box; transform-origin:center; animation: rf-blink calc(var(--ks,1) * 4.4s) ease-in-out infinite }
    reed-face .spin { transform-box: view-box; transform-origin: 0 0; animation: rf-spin calc(var(--ks,1) * 1.1s) linear infinite }
    reed-face .bar { transform-box: fill-box; transform-origin:center; animation: rf-bar calc(var(--ks,1) * .9s) ease-in-out infinite }
    reed-face .bar:nth-child(2) { animation-delay: calc(var(--ks,1) * -.3s) } reed-face .bar:nth-child(3) { animation-delay: calc(var(--ks,1) * -.6s) }
    reed-face .bar:nth-child(4) { animation-delay: calc(var(--ks,1) * -.15s) } reed-face .bar:nth-child(5) { animation-delay: calc(var(--ks,1) * -.45s) }
    reed-face .dot { animation: rf-dot calc(var(--ks,1) * 1.2s) ease-in-out infinite } reed-face .dot:nth-child(2) { animation-delay: calc(var(--ks,1) * .18s) } reed-face .dot:nth-child(3) { animation-delay: calc(var(--ks,1) * .36s) }
    reed-face .in-l { animation: rf-in-l calc(var(--ks,1) * 1.3s) ease-in-out infinite } reed-face .in-r { animation: rf-in-r calc(var(--ks,1) * 1.3s) ease-in-out infinite }
    reed-face .in-c { animation: rf-dot calc(var(--ks,1) * 1.3s) ease-in-out infinite }
    @keyframes rf-breathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.025) } }
    @keyframes rf-blink { 0%,90%,100% { transform:scaleY(1) scaleX(1) } 94% { transform:scaleX(.15) } }
    @keyframes rf-spin { to { transform: rotate(360deg) } }
    @keyframes rf-bar { 0%,100% { transform:scaleY(.35) } 50% { transform:scaleY(1) } }
    @keyframes rf-dot { 0%,100% { opacity:.25 } 40% { opacity:1 } }
    @keyframes rf-in-l { 0% { transform:translateX(-9px); opacity:0 } 50% { opacity:1 } 100% { transform:translateX(3px); opacity:0 } }
    @keyframes rf-in-r { 0% { transform:translateX(9px); opacity:0 } 50% { opacity:1 } 100% { transform:translateX(-3px); opacity:0 } }
    .reduce reed-face * { animation: none !important }`;
  document.head.insertAdjacentHTML('beforeend', `<style>${faceCss}</style>`);

  const S = 'stroke="url(#APG)" fill="none" stroke-linecap="round"';
  const glyphs = {
    line: `<path ${S} stroke-width="7" d="M -22.5 0 L 22.5 0"/>`,
    inbound: `<path class="in-l" ${S} stroke-width="5.5" d="M -27 0 L -17 0"/><path class="in-c" ${S} stroke-width="5.5" d="M -3 0 L 3 0"/><path class="in-r" ${S} stroke-width="5.5" d="M 17 0 L 27 0"/>`,
    thinking: `<circle r="16" ${S} stroke-width="6.5" opacity=".28"/><g class="spin"><path ${S} stroke-width="6.5" d="M 0 -16 A 16 16 0 0 1 16 0"/></g>`,
    speaking: [-20, -10, 0, 10, 20].map((x, i) => `<path class="bar" ${S} stroke-width="5.5" d="M ${x} ${-[7, 12, 15, 11, 6][i]} L ${x} ${[7, 12, 15, 11, 6][i]}"/>`).join(''),
    typing: [-17, 0, 17].map(x => `<path class="dot" ${S} stroke-width="8" d="M ${x} 0 L ${x} 0"/>`).join(''),
    watching: `<circle r="13" ${S} stroke-width="6"/>`,
    encouraging: `<path ${S} stroke-width="8" d="M -11 -10 L -11 10"/><path ${S} stroke-width="8" d="M 11 -10 L 11 10"/>`,
    happy: `<path ${S} stroke-width="7.5" d="M -27 5 Q -16 -9 -5 5"/><path ${S} stroke-width="7.5" d="M 5 5 Q 16 -9 27 5"/>`,
    excited: `<path ${S} stroke-width="8.5" d="M -14 -14 L -14 12"/><path ${S} stroke-width="8.5" d="M 14 -14 L 14 12"/>`,
    surprised: `<circle r="21" ${S} stroke-width="8"/>`,
    concerned: `<path ${S} stroke-width="6" d="M -26 4 L -8 -3"/><path ${S} stroke-width="6" d="M 8 -3 L 26 4"/>`,
    proud: `<path ${S} stroke-width="6.5" d="M -28 -2 Q 0 14 28 -2"/>`,
    sleepy: `<path ${S} stroke-width="4" d="M -24 4 Q 0 10 24 4"/>`,
    dizzy: `<g class="spin"><circle cx="-14" cy="0" r="7" ${S} stroke-width="4.5"/><circle cx="14" cy="0" r="7" ${S} stroke-width="4.5"/></g>`,
  };
  // body offset (x, y) and default gaze per mood, from mascot-engine.ts (scaled to this glyph set)
  const poses = {
    idle: [0, 0], listening: [3, -2], thinking: [-2, -6], speaking: [2, -2], typing: [1, -1], watching: [2, -5],
    encouraging: [3, -6], happy: [0, -5], excited: [0, -9], surprised: [0, -8], concerned: [-2, 5], proud: [0, -10],
    sleepy: [0, 14], dizzy: [0, 0],
  };
  const moodGlyph = { idle: 'line', listening: 'inbound', thinking: 'thinking', speaking: 'speaking', typing: 'typing',
    watching: 'watching', encouraging: 'encouraging', happy: 'happy', excited: 'excited', surprised: 'surprised',
    concerned: 'concerned', proud: 'proud', sleepy: 'sleepy', dizzy: 'dizzy' };

  let faceId = 0;
  class ReedFace extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      const id = `rf${faceId++}`;
      const size = Number(this.getAttribute('size') || 96);
      this.style.width = this.style.height = `${size}px`;
      this.innerHTML = `<svg viewBox="-82 -82 164 164" aria-label="Reed">
        <defs>
          <radialGradient id="${id}h"><stop offset="0" stop-color="#2455e6" stop-opacity=".55"/><stop offset=".72" stop-color="#2455e6" stop-opacity=".38"/><stop offset="1" stop-color="#2455e6" stop-opacity="0"/></radialGradient>
          <linearGradient id="${id}i" gradientUnits="userSpaceOnUse" x1="-54" y1="-58" x2="56" y2="58"><stop offset="0" stop-color="#17181c"/><stop offset=".55" stop-color="#0e0f12"/><stop offset="1" stop-color="#08090b"/></linearGradient>
          <linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="-55" y1="34" x2="32" y2="-56"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#d9dce2" stop-opacity="0"/></linearGradient>
          <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="-36" y1="0" x2="36" y2="0"><stop offset="0" stop-color="#d9dce2"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#d9dce2"/></linearGradient>
        </defs>
        <g class="act"><g class="core-wrap">
          <circle class="halo" r="80" fill="url(#${id}h)" opacity=".7"/>
          <circle r="65" fill="url(#${id}i)"/>
          <path d="M -55 34 A 64.25 64.25 0 0 1 32 -56" fill="none" stroke="url(#${id}r)" stroke-width="1.6" stroke-linecap="round"/>
          <g class="pose"><g class="gaze">
            ${Object.entries(glyphs).map(([k, v]) => `<g class="g" data-g="${k}">${v.replaceAll('APG', `${id}a`)}</g>`).join('')}
          </g></g>
        </g></g></svg>`;
      this.mood(this.getAttribute('mood') || 'idle');
    }
    mood(name) {
      if (!this._built) { this.setAttribute('mood', name); return; }
      this._mood = name;
      const g = moodGlyph[name] || 'line';
      this.querySelectorAll('.g').forEach(el => el.classList.toggle('on', el.dataset.g === g));
      const [x, y] = poses[name] || [0, 0];
      this.querySelector('.pose').style.transform = `translate(${x}px, ${y}px)`;
    }
    get current() { return this._mood; }
    gaze(x = 0, y = 0) { this.querySelector('.gaze').style.transform = `translate(${x * 6}px, ${y * 6}px)`; }
    energy(v) { this.querySelector('.halo').setAttribute('opacity', String(0.45 + v * 0.5)); }
    act(name) {
      const el = this.querySelector('.act');
      const k = REED.k ?? 1;
      if (!k || REED.reduce) return Promise.resolve();
      const frames = {
        hop: [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px) scale(1.03)', offset: 0.35 }, { transform: 'translateY(0)' }],
        bounce: [{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: 0.25 }, { transform: 'scale(1.07)', offset: 0.6 }, { transform: 'scale(1)' }],
        nod: [{ transform: 'translateY(0)' }, { transform: 'translateY(4px)', offset: 0.3 }, { transform: 'translateY(-1px)', offset: 0.65 }, { transform: 'translateY(0)' }],
        tick: [{ transform: 'translateY(0)' }, { transform: 'translateY(2.5px)', offset: 0.4 }, { transform: 'translateY(0)' }],
        shake: [0, -7, 7, -5, 5, -2, 0].map(r => ({ transform: `rotate(${r}deg)` })),
        squish: [{ transform: 'scale(1,1)' }, { transform: 'scale(1.1,.84) translateY(8px)' }],
        spring: [{ transform: 'scale(1.1,.84) translateY(8px)' }, { transform: 'scale(.94,1.1) translateY(-22px)', offset: 0.35 }, { transform: 'scale(1.03,.98) translateY(0)', offset: 0.7 }, { transform: 'scale(1,1)' }],
        wobble: [0, 0.4, 0.7, 1].map((o, i) => ({ transform: `scale(${[1, 1.06, 0.97, 1][i]}, ${[1, 0.95, 1.03, 1][i]})`, offset: o })),
      }[name];
      const dur = { hop: 420, bounce: 460, nod: 440, tick: 200, shake: 520, squish: 260, spring: 620, wobble: 480 }[name];
      const a = el.animate(frames, { duration: dur * k, easing: name === 'squish' ? 'ease-out' : 'ease-in-out', fill: name === 'squish' ? 'forwards' : 'none' });
      this._held = name === 'squish' ? a : null;
      return a.finished.catch(() => {});
    }
  }
  customElements.define('reed-face', ReedFace);

  // ------------------------------------------------------------------ glow
  // The ambient field. Parameters map 1:1 to the proposed <ReedGlowField> (Skia) props.
  class GlowField {
    constructor(canvas) {
      this.c = canvas;
      this.x = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = 390 * dpr;
      canvas.height = 844 * dpr;
      this.x.scale(dpr, dpr);
      this.t = { energy: 0.35, cy: 40, spread: 1, warmth: 0, breath: 0, speed: 1 };
      this.p = { ...this.t };
      this.time = 0;
      this.waves = [];
      this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
      this.last = performance.now();
      this.alive = true;
      const loop = now => {
        if (!this.alive) return;
        this.frame(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      const phone = canvas.closest('.phone');
      if (phone) {
        phone.addEventListener('pointermove', e => {
          const r = phone.getBoundingClientRect();
          this.tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
          this.tilt.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        });
        phone.addEventListener('pointerleave', () => { this.tilt.tx = 0; this.tilt.ty = 0; });
      }
    }
    set(params) { Object.assign(this.t, params); }
    snap() { Object.assign(this.p, this.t); }
    wave(opts = {}) { if (!REED.reduce) this.waves.push({ age: 0, from: opts.from ?? 780, to: opts.to ?? -160, dur: opts.dur ?? 900 }); }
    destroy() { this.alive = false; }
    frame(now) {
      const k = REED.k || 1;
      const dt = Math.min(0.05, (now - this.last) / 1000) / k;
      this.last = now;
      const ease = 1 - Math.exp(-dt / 0.35);
      for (const key in this.t) this.p[key] += (this.t[key] - this.p[key]) * ease;
      const reduce = REED.reduce;
      if (!reduce) this.time += dt * this.p.speed;
      this.tilt.x += (this.tilt.tx - this.tilt.x) * ease;
      this.tilt.y += (this.tilt.ty - this.tilt.y) * ease;
      const { energy, cy, spread, warmth, breath } = this.p;
      const T = this.time;
      const br = reduce ? 0 : breath * 0.32 * Math.sin((T * Math.PI * 2) / 2.4);
      const e = Math.max(0, energy * (1 + br));
      const mix = (a, b, m) => a.map((v, i) => Math.round(v + (b[i] - v) * m));
      const warm = [229, 163, 111];
      const tx = this.tilt.x, ty = this.tilt.y;
      const blobs = [
        { x: 195 + Math.sin(T * 0.21) * 38 + tx * 6, y: cy + Math.cos(T * 0.17) * 18 + ty * 4, r: 270 * spread, c: [61, 102, 242], a: 0.4 },
        { x: 115 + Math.cos(T * 0.13) * 55 + tx * 12, y: cy - 30 + Math.sin(T * 0.19) * 28 + ty * 8, r: 205 * spread, c: mix([86, 120, 255], warm, warmth), a: 0.26 },
        { x: 285 + Math.sin(T * 0.11 + 1) * 48 - tx * 8, y: cy + 50 + Math.cos(T * 0.15 + 2) * 22 - ty * 5, r: 225 * spread, c: mix([45, 80, 220], warm, warmth * 0.5), a: 0.22 },
      ];
      const x = this.x;
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, 390, 844);
      x.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        const a = Math.min(1, b.a * e);
        g.addColorStop(0, `rgba(${b.c},${a})`);
        g.addColorStop(0.5, `rgba(${b.c},${a * 0.38})`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        x.fillStyle = g;
        x.fillRect(0, 0, 390, 844);
      }
      this.waves = this.waves.filter(w => {
        w.age += dt * 1000;
        const p = Math.min(1, w.age / w.dur);
        const ep = 1 - Math.pow(1 - p, 3);
        const y = w.from + (w.to - w.from) * ep;
        const a = 0.22 * Math.sin(Math.PI * p);
        const g = x.createRadialGradient(195, y, 0, 195, y, 300);
        g.addColorStop(0, `rgba(90,125,255,${a})`);
        g.addColorStop(1, 'rgba(90,125,255,0)');
        x.save();
        x.translate(195, y);
        x.scale(1.4, 0.45);
        x.translate(-195, -y);
        x.fillStyle = g;
        x.fillRect(-200, y - 320, 790, 640);
        x.restore();
        return p < 1;
      });
    }
  }
  REED.GlowField = GlowField;

  // ------------------------------------------------------------------ pages
  REED.pages = [
    ['index.html', '00', 'Overview'],
    ['01-presence.html', '01', "Reed's states"],
    ['02-composer.html', '02', 'Composer'],
    ['03-send.html', '03', 'Today → answer'],
    ['04-chapters.html', '04', 'Chapters'],
    ['05-suggestions.html', '05', 'Suggestions'],
    ['06-touch.html', '06', 'Touching Reed'],
    ['07-session-watch.html', '07', 'Reed watches'],
    ['08-session-ask.html', '08', 'Ask mid-session'],
    ['09-build.html', '09', 'Build reference'],
  ];
  REED.nav = current =>
    `<nav class="nav">${REED.pages.map(([href, n, label]) => `<a href="${href}" class="${href === current ? 'on' : ''}"><b>${n}</b>${label}</a>`).join('')}</nav>`;
  REED.pager = current => {
    const i = REED.pages.findIndex(p => p[0] === current);
    const prev = REED.pages[i - 1], next = REED.pages[i + 1];
    return `<div class="pager">${prev ? `<a class="ctl" href="${prev[0]}">← ${prev[2]}</a>` : ''}${next ? `<a class="ctl primary" href="${next[0]}">${next[2]} →</a>` : ''}</div>`;
  };

  // ------------------------------------------------------------------ step player
  class Abort extends Error {}
  const SPEEDS = [['1×', 1], ['½×', 2], ['⅕×', 5]];

  REED.page = cfg => {
    const file = location.pathname.split('/').pop() || 'index.html';
    REED.k = 1;
    REED.reduce = false;
    let speed = 1;
    let token = 0;
    let current = -1;
    let glow = null;

    const notesHtml = (s, i) => {
      const sec = (title, body) => (body ? `<div class="nsec"><h3>${title}</h3>${body}</div>` : '');
      const list = arr => (arr && arr.length ? `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>` : '');
      const tl = s.when && s.when.length ? `<div class="tl">${s.when.map(([ms, txt]) => `<span class="ms">${ms}</span><span>${txt}</span>`).join('')}</div>` : '';
      return [
        sec('What happens', tl),
        sec('Spec', list(s.spec)),
        sec('Haptic', s.haptic ? `<ul><li>${s.haptic}</li></ul>` : '<ul><li>none</li></ul>'),
        sec('Reduce Motion', s.reduce ? `<ul><li>${s.reduce}</li></ul>` : ''),
        sec('Build', list(s.build)),
      ].join('');
    };

    document.body.innerHTML = `
      ${REED.nav(file)}
      <section class="intro"><div class="kicker">${cfg.kicker}</div><h1>${cfg.title}</h1>${cfg.intro.map(p => `<p>${p}</p>`).join('')}</section>
      <div class="stage-grid">
        <aside class="steps-col"><div class="col-label">Steps</div><ol class="steps">${cfg.steps
          .map((s, i) => `<li><button data-i="${i}"><span class="n">${i + 1}</span><span class="t">${s.t}</span><span class="u">${s.u}</span></button></li>`)
          .join('')}</ol></aside>
        <div class="phone-col">
          <div class="readout"><span class="pill" id="st"><i></i><span>Reed: resting</span></span><span class="pill haptic" id="hp">haptic</span></div>
          <div class="phone"><div class="app" id="app"></div></div>
          <div class="controls">
            <div class="ctl-row">
              <button class="ctl" id="prev">← Prev</button>
              <button class="ctl" id="replay">↻ Replay step</button>
              <button class="ctl primary" id="next">Next →</button>
              <button class="ctl" id="all">▶ Play all</button>
            </div>
            <div class="ctl-row">
              <span class="seg" id="speed">${SPEEDS.map(([l, v]) => `<button data-v="${v}" class="${v === 1 ? 'on' : ''}">${l}</button>`).join('')}</span>
              <span class="seg" id="rm"><button data-v="0" class="on">Motion</button><button data-v="1">Reduce Motion</button></span>
            </div>
            ${cfg.hint ? `<p class="ctl-hint">${cfg.hint}</p>` : ''}
          </div>
        </div>
        <aside class="notes-col"><div class="col-label">Notes for this step</div><div class="note-card" id="notes"></div></aside>
      </div>
      <section class="spec"><h2>Full spec, every step</h2><p>Same content as the notes beside the phone, all at once, for the implementing agent. Timings are from the moment the user acts. Springs are tokens in <code>design/motion.ts</code>; see <a href="09-build.html">Build reference</a>.</p>
        ${cfg.steps.map((s, i) => `<div class="spec-step"><div class="hd"><div class="n">STEP ${i + 1}</div><h3>${s.t}</h3><p>${s.u}</p></div><div>${notesHtml({ when: s.when }, i)}</div><div>${notesHtml({ spec: s.spec, haptic: s.haptic, reduce: s.reduce, build: s.build }, i)}</div></div>`).join('')}
      </section>
      ${cfg.after || ''}
      ${REED.pager(file)}`;

    const app = document.getElementById('app');
    const $ = sel => app.querySelector(sel);
    const $$ = sel => [...app.querySelectorAll(sel)];
    const stEl = document.querySelector('#st span');
    const hpEl = document.getElementById('hp');

    const check = t => { if (t !== token) throw new Abort(); };
    const ctx = {
      app, $, $$,
      get k() { return REED.k; },
      get reduce() { return REED.reduce; },
      get glow() { return glow; },
      get face() { return app.querySelector('reed-face'); },
      wait(ms) {
        const t = token;
        if (!REED.k) return Promise.resolve();
        return new Promise(r => setTimeout(r, ms * REED.k)).then(() => check(t));
      },
      async anim(el, frames, { dur = 300, spring, easing, delay = 0 } = {}) {
        const t = token;
        if (!el) return;
        let f = frames;
        if (REED.reduce) {
          const hasOpacity = frames.some(fr => 'opacity' in fr);
          f = hasOpacity ? frames.map(fr => ({ opacity: fr.opacity ?? 1 })) : [frames[frames.length - 1]];
          dur = hasOpacity ? 200 : 0;
          spring = null;
          easing = 'ease-out';
        }
        const a = el.animate(f, { duration: dur * REED.k, delay: delay * REED.k, easing: spring ? springs[spring].css : easing || 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
        try { await a.finished; } catch { /* cancelled */ }
        try { a.commitStyles(); } catch { /* detached */ }
        a.cancel();
        check(t);
      },
      haptic(name) {
        hpEl.textContent = `haptic · ${name}`;
        hpEl.classList.add('fire');
        clearTimeout(hpEl._t);
        hpEl._t = setTimeout(() => { hpEl.classList.remove('fire'); hpEl.textContent = 'haptic'; }, 900);
      },
      state(label) { stEl.textContent = `Reed: ${label}`; },
      rect(el) {
        const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
        return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
      },
      // Place the single mascot over a slot element (hero or corner). Animated = the glide.
      async placeMascot(slot, { animate = false, spring = 'morph' } = {}) {
        const layer = app.querySelector('.mascot-layer');
        if (!layer || !slot) return;
        const at = () => { const r = ctx.rect(slot); return `translate(${r.x}px, ${r.y}px) scale(${r.w / 112})`; };
        // While resting on a slot, the mascot follows it (keyboard, layout changes).
        const follow = () => {
          layer._slot = slot;
          if (layer._loop) return;
          layer._loop = true;
          const tick = () => {
            if (!layer.isConnected) return;
            if (!layer._animating && layer._slot) layer.style.transform = (() => { const r = ctx.rect(layer._slot); return `translate(${r.x}px, ${r.y}px) scale(${r.w / 112})`; })();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        };
        const to = at();
        if (!animate || !REED.k) { layer.style.transform = to; layer.style.opacity = 1; follow(); return; }
        layer._animating = true;
        try {
          if (REED.reduce) {
            await ctx.anim(layer, [{ opacity: 1 }, { opacity: 0 }], { dur: 120 });
            layer.style.transform = to;
            await ctx.anim(layer, [{ opacity: 0 }, { opacity: 1 }], { dur: 200 });
          } else {
            await ctx.anim(layer, [{ transform: getComputedStyle(layer).transform }, { transform: to }], { dur: springs[spring].duration, spring });
          }
        } finally {
          layer._animating = false;
          follow();
        }
      },
      // FLIP a clone of `from` onto the rect of `to` (chip → bubble, composer text → bubble).
      async fly(from, to, { spring = 'lift', fadeFrom = true } = {}) {
        const a = ctx.rect(from), b = ctx.rect(to);
        const clone = from.cloneNode(true);
        Object.assign(clone.style, { position: 'absolute', left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, margin: 0, zIndex: 35, pointerEvents: 'none', transformOrigin: '0 0' });
        app.appendChild(clone);
        if (fadeFrom) from.style.visibility = 'hidden';
        to.style.visibility = 'hidden';
        try {
          await ctx.anim(clone, [
            { transform: 'translate(0,0) scale(1,1)', borderRadius: getComputedStyle(from).borderRadius },
            { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${b.w / a.w}, ${b.h / a.h})`, borderRadius: getComputedStyle(to).borderRadius },
          ], { dur: springs[spring].duration, spring });
        } finally {
          clone.remove();
          to.style.visibility = '';
        }
      },
      // type text into an element character by character
      async type(el, text, { cps = 16, onBurst } = {}) {
        let out = el.dataset.text || '';
        for (const ch of text) {
          out += ch;
          el.dataset.text = out;
          el.innerHTML = `${out.replace(/</g, '&lt;')}<span class="caret"></span>`;
          el.classList.add('has-text');
          if (onBurst && /\s/.test(ch)) onBurst();
          await ctx.wait(1000 / cps);
        }
      },
    };
    REED.ctx = ctx;

    function setK(v) {
      REED.k = v;
      app.style.setProperty('--k', String(v));
      app.style.setProperty('--ks', String(v || speed));
    }

    function reset() {
      if (glow) glow.destroy();
      glow = null;
      app.innerHTML = '';
      app.classList.toggle('reduce', REED.reduce);
      app.className = `app${REED.reduce ? ' reduce' : ''}`;
      cfg.build(ctx);
      if (!app.querySelector('.status')) app.insertAdjacentHTML('beforeend', REED.statusBar);
      const canvas = app.querySelector('canvas.glow');
      if (canvas) glow = new GlowField(canvas);
      ctx.state('resting');
    }

    async function go(i, { animate = true } = {}) {
      token++;
      const my = token;
      current = i;
      document.querySelectorAll('.steps button').forEach((b, j) => {
        b.classList.toggle('on', j === i);
        b.classList.toggle('done', j < i);
      });
      const s = cfg.steps[i];
      document.getElementById('notes').innerHTML = `<h2>${i + 1}. ${s.t}</h2><p class="user">${s.u}</p>${notesHtml(s, i)}`;
      document.getElementById('prev').disabled = i === 0;
      document.getElementById('next').disabled = i === cfg.steps.length - 1;
      setK(0);
      reset();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        if (cfg.settle) await cfg.settle(ctx);
        for (let j = 0; j < i; j++) await cfg.steps[j].run(ctx, { instant: true });
        if (glow) glow.snap();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (my !== token) return;
        setK(animate ? speed : 0);
        await ctx.wait(animate ? 350 : 0);
        await cfg.steps[i].run(ctx, { instant: false });
      } catch (e) {
        if (!(e instanceof Abort)) { console.error(e); (window.__errs ||= []).push(String((e && e.stack) || e)); }
      }
    }

    let playId = 0;
    const stop = fn => (...args) => { playId++; return fn(...args); };
    document.querySelectorAll('.steps button').forEach(b => b.addEventListener('click', stop(() => go(Number(b.dataset.i)))));
    document.getElementById('prev').onclick = stop(() => current > 0 && go(current - 1));
    document.getElementById('next').onclick = stop(() => current < cfg.steps.length - 1 && go(current + 1));
    document.getElementById('replay').onclick = stop(() => go(current));
    // Play all: runs each step from its real start state, so every step is shown as built.
    document.getElementById('all').onclick = async () => {
      const my = ++playId;
      for (let i = 0; i < cfg.steps.length; i++) {
        await go(i);
        await new Promise(r => setTimeout(r, 1400 * speed));
        if (my !== playId) return;
      }
    };
    document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => {
      speed = Number(b.dataset.v);
      document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', x === b));
      go(current);
    }));
    document.querySelectorAll('#rm button').forEach(b => b.addEventListener('click', () => {
      REED.reduce = b.dataset.v === '1';
      document.querySelectorAll('#rm button').forEach(x => x.classList.toggle('on', x === b));
      go(current);
    }));
    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('[contenteditable]')) return;
      if (e.key === 'ArrowRight') document.getElementById('next').click();
      if (e.key === 'ArrowLeft') document.getElementById('prev').click();
      if (e.key === 'r') document.getElementById('replay').click();
    });

    go(0, { animate: true });
    return ctx;
  };

  // ------------------------------------------------------------------ app fragments
  REED.ui = {
    pulse: (week = 'd..t...', weight = '73.1') => {
      const days = [...week].map(c => `<i class="${{ d: 'done', t: 'is-today' }[c] || ''}"></i>`).join('');
      const n = [...week].filter(c => c === 'd').length;
      return `<div class="pulse"><span class="pm"><span class="days">${days}</span>${n}<small>of 3</small></span><span class="sep"></span><span class="pm num">${weight}<small>kg</small></span>${icon('chevron-down')}</div><button class="you-btn">${icon('person')}</button>`;
    },
    dock: (placeholder = 'Talk to Reed') => `<footer class="dock"><button class="act">${icon('barbell', 2)}</button>
      <div class="composer"><span class="plus">${icon('plus')}</span><div class="field" data-ph="${placeholder}">${placeholder}</div>
      <button class="send"><span class="i-mic">${icon('mic')}</span><span class="i-send">${icon('arrow-up', 2.2)}</span></button></div></footer>`,
    mascotLayer: (mood = 'idle') => `<div class="mascot-layer"><reed-face size="112" mood="${mood}"></reed-face></div>`,
    chips: (labels, cls = '') => `<div class="chips ${cls}">${labels.map(l => `<button class="chip">${l}</button>`).join('')}</div>`,
  };

  // ------------------------------------------------------------------ shared chat moves
  // Every page that sends or receives uses these, so the same move looks the same everywhere.
  REED.chat = {
    async focus(c, { gaze = [0.5, 0.6] } = {}) {
      const comp = c.$('.composer'), field = c.$('.field');
      c.state('listening');
      c.app.classList.add('kb-up');
      c.$('.act')?.classList.add('small');
      comp.classList.add('focus');
      if (!field.dataset.text) field.innerHTML = `<span class="caret"></span>${field.dataset.ph}`;
      c.face?.mood('listening');
      c.face?.gaze(...gaze);
      c.glow?.set({ energy: 0.5, cy: 110, breath: 0, speed: 1, warmth: 0 });
      await c.anim(comp, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.3 }, { transform: 'scale(.997)', offset: 0.7 }, { transform: 'scale(1)' }], { dur: 380, easing: 'ease-out' });
    },
    async blur(c) {
      const comp = c.$('.composer'), field = c.$('.field');
      c.app.classList.remove('kb-up');
      c.$('.act')?.classList.remove('small');
      comp.classList.remove('focus', 'typing');
      if (!field.dataset.text) field.innerHTML = field.dataset.ph;
      else field.innerHTML = field.dataset.text;
      c.face?.mood('idle');
      c.face?.gaze(0, 0);
      c.glow?.set({ energy: 0.35, cy: 40 });
      c.state('resting');
      await c.wait(380);
    },
    async type(c, text, { tick = true } = {}) {
      const comp = c.$('.composer'), field = c.$('.field'), send = c.$('.send');
      c.state('following');
      comp.classList.add('typing');
      let lastTick = 0;
      const first = !field.dataset.text;
      if (first) { field.dataset.text = ''; send.classList.remove('waiting'); }
      const armedNow = () => { if (!c.app.classList.contains('pending')) send.classList.add('armed'); else send.classList.add('waiting'); };
      armedNow();
      await c.type(field, text, {
        onBurst: () => {
          const now = performance.now();
          if (!tick || now - lastTick < 450 * (REED.k || 1)) return;
          lastTick = now;
          c.face?.act('tick');
          if (c.glow) { const e = c.glow.t.energy; c.glow.set({ energy: e + 0.06 }); setTimeout(() => c.glow && c.glow.set({ energy: e }), 400 * (REED.k || 1)); }
        },
      });
      comp.classList.toggle('multi', field.getBoundingClientRect().height > 44);
    },
    // Makes room at the bottom of the thread for `el` (already appended), then runs `during`.
    async makeRoom(c, el, during) {
      const scroll = c.$('.tscroll');
      const h = el.getBoundingClientRect().height + 14;
      scroll.style.transform = `translateY(${h}px)`;
      const room = c.anim(scroll, [{ transform: `translateY(${h}px)` }, { transform: 'translateY(0)' }], { dur: REED.springs.smooth.duration, spring: 'smooth' });
      await Promise.all([room, during ? during() : null]);
      scroll.style.transform = '';
    },
    // The send: the typed text lifts out of the composer and becomes your bubble. Text never scales.
    async send(c, { into = '.tscroll', pending = true } = {}) {
      const field = c.$('.field'), send = c.$('.send'), comp = c.$('.composer');
      const text = field.dataset.text || '';
      c.haptic('light');
      c.state('received');
      const scroll = c.$(into);
      const bubble = document.createElement('div');
      bubble.className = 'you';
      bubble.textContent = text;
      bubble.style.visibility = 'hidden';
      scroll.appendChild(bubble);
      const b = c.rect(bubble), f = c.rect(field);
      const flyer = bubble.cloneNode(true);
      Object.assign(flyer.style, { position: 'absolute', left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, margin: 0, zIndex: 35, visibility: 'visible', pointerEvents: 'none' });
      c.app.appendChild(flyer);
      // clear the composer at once; the flyer now carries the text
      field.dataset.text = '';
      field.innerHTML = `<span class="caret"></span>${field.dataset.ph}`;
      field.classList.remove('has-text');
      comp.classList.remove('typing', 'multi');
      send.classList.remove('armed');
      if (pending) { c.app.classList.add('pending'); }
      c.glow?.wave();
      c.face?.act('hop');
      const dx = f.x - b.x - 15, dy = f.y - b.y - 2;
      await REED.chat.makeRoom(c, bubble, () => c.anim(flyer, [
        { transform: `translate(${dx}px, ${dy}px)`, backgroundColor: 'rgba(38,35,31,0)', borderRadius: '28px' },
        { transform: 'translate(0,0)', backgroundColor: 'rgba(38,35,31,1)', borderRadius: '22px 22px 8px 22px' },
      ], { dur: REED.springs.lift.duration, spring: 'lift' }));
      flyer.remove();
      bubble.style.visibility = '';
      return bubble;
    },
    async thinking(c, { hint = 'Thinking' } = {}) {
      c.state('thinking');
      c.face?.mood('thinking');
      c.face?.gaze(-0.3, -0.3);
      c.glow?.set({ energy: 0.5, breath: 1, speed: 2.5, warmth: 0.15 });
      const h = c.$('.hint');
      if (h) {
        h.textContent = hint;
        h.style.opacity = 0;
        await c.wait(400);
        await c.anim(h, [{ opacity: 0 }, { opacity: 1 }], { dur: 220 });
      }
    },
    // A reply arrives whole (no streaming today); it reveals sentence by sentence.
    async reply(c, html, { into = '.tscroll', card = null } = {}) {
      const p = document.createElement('div');
      p.className = 'voice';
      const parts = html.split(/(?<=[.?!])\s+/);
      p.innerHTML = parts.map(s => `<span style="opacity:0;display:inline">${s} </span>`).join('');
      c.$(into).appendChild(p);
      c.state('speaking');
      c.face?.mood('speaking');
      c.face?.gaze(0.2, -0.7);
      c.glow?.set({ energy: 0.45, breath: 0, speed: 1, warmth: 0 });
      const h = c.$('.hint');
      if (h) c.anim(h, [{ opacity: 1 }, { opacity: 0 }], { dur: 160 }).catch(() => {});
      c.app.classList.remove('pending');
      const send = c.$('.send');
      if (send?.classList.contains('waiting')) { send.classList.remove('waiting'); send.classList.add('armed'); }
      await REED.chat.makeRoom(c, p);
      const spans = [...p.children];
      await Promise.all(spans.map((s, i) => c.anim(s, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { dur: 180, delay: i * 90, easing: 'ease-out' })));
      if (card) {
        const wrap = document.createElement('div');
        wrap.innerHTML = card;
        const el = wrap.firstElementChild;
        c.$(into).appendChild(el);
        await REED.chat.makeRoom(c, el, () => c.anim(el, [{ opacity: 0, transform: 'translateY(12px) scale(.96)' }, { opacity: 1, transform: 'none' }], { dur: REED.springs.smooth.duration, spring: 'smooth' }));
        c.haptic('light');
      }
      return p;
    },
    async chipsIn(c, labels, { into = '.presence .chips' } = {}) {
      const box = c.$(into);
      box.innerHTML = labels.map(l => `<button class="chip" style="opacity:0">${l}</button>`).join('');
      c.state('waiting on you');
      // vertical-eye moods read as a pause glyph below ~80 px; small mascots use happy instead
      const small = c.face && c.face.getBoundingClientRect().width < 80;
      c.face?.mood(small ? 'happy' : 'encouraging');
      c.face?.gaze(0.8, 0);
      await Promise.all([...box.children].map((el, i) => c.anim(el, [{ opacity: 0, transform: 'translateX(8px) scale(.94)' }, { opacity: 1, transform: 'none' }], { dur: REED.springs.pop.duration, spring: 'pop', delay: i * 60 })));
      await c.wait(1600);
      c.face?.mood('idle');
    },
  };
})();
