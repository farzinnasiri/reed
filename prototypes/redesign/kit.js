// Shared bits for the redesign mockups: a simplified Reed mascot, a few icons, and phone chrome.
// The mascot is a static-geometry approximation of the app's mascot (components/reed/mascot: same
// core, halo, rims and aperture), with only a handful of moods. It is for layout, not a port.

(() => {
  const css = `
    reed-mascot { display:inline-block; flex:none; line-height:0 }
    reed-mascot svg { width:100%; height:100%; overflow:visible }
    reed-mascot .core { transform-box:fill-box; transform-origin:center; animation:rm-breathe 5s ease-in-out infinite }
    reed-mascot .ap { transform-box:fill-box; transform-origin:center }
    reed-mascot[mood="idle"] .ap, reed-mascot[mood="watch"] .ap { animation:rm-blink 4.6s ease-in-out infinite }
    reed-mascot[mood="speak"] .ap { animation:rm-speak 1.1s ease-in-out infinite }
    reed-mascot .dot { animation:rm-dot 1.2s ease-in-out infinite }
    reed-mascot .dot:nth-child(2) { animation-delay:.18s }
    reed-mascot .dot:nth-child(3) { animation-delay:.36s }
    @keyframes rm-breathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.03) } }
    @keyframes rm-blink { 0%,91%,100% { transform:scaleX(1) } 94% { transform:scaleX(.12) } }
    @keyframes rm-speak { 0%,100% { transform:scaleX(1) } 50% { transform:scaleX(.62) } }
    @keyframes rm-dot { 0%,100% { opacity:.25 } 40% { opacity:1 } }
    @media (prefers-reduced-motion: reduce) { reed-mascot * { animation:none !important } }
  `;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  let uid = 0;
  const apertures = {
    idle: '<path class="ap" d="M -22.5 0 L 22.5 0"/>',
    watch: '<path class="ap" d="M -16 -5 L 16 -5"/>',
    speak: '<path class="ap" d="M -20 2 L 20 2"/>',
    happy: '<path class="ap" d="M -22 -5 Q 0 13 22 -5"/>',
    thinking:
      '<g><path class="dot" d="M -17 0 L -17 0"/><path class="dot" d="M 0 0 L 0 0"/><path class="dot" d="M 17 0 L 17 0"/></g>',
  };

  class ReedMascot extends HTMLElement {
    static observedAttributes = ['mood', 'size', 'halo'];
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const id = `rm${uid++}`;
      const size = Number(this.getAttribute('size') || 44);
      const mood = this.getAttribute('mood') || 'idle';
      if (!this.hasAttribute('mood')) this.setAttribute('mood', 'idle');
      const halo = this.getAttribute('halo') || '#2455e6';
      this.style.width = this.style.height = `${size}px`;
      this.innerHTML = `
        <svg viewBox="-82 -82 164 164" aria-label="Reed">
          <defs>
            <radialGradient id="${id}h"><stop offset="0" stop-color="${halo}" stop-opacity=".55"/><stop offset=".72" stop-color="${halo}" stop-opacity=".4"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient>
            <linearGradient id="${id}i" gradientUnits="userSpaceOnUse" x1="-54" y1="-58" x2="56" y2="58"><stop offset="0" stop-color="#17181c"/><stop offset=".55" stop-color="#0e0f12"/><stop offset="1" stop-color="#08090b"/></linearGradient>
            <linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="-55" y1="34" x2="32" y2="-56"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#d9dce2" stop-opacity="0"/></linearGradient>
            <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="-36" y1="0" x2="36" y2="0"><stop offset="0" stop-color="#d9dce2"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#d9dce2"/></linearGradient>
          </defs>
          <g class="core">
            <circle r="80" fill="url(#${id}h)" opacity=".85"/>
            <circle r="65" fill="url(#${id}i)"/>
            <path d="M -55 34 A 64.25 64.25 0 0 1 32 -56" fill="none" stroke="url(#${id}r)" stroke-width="1.6" stroke-linecap="round"/>
            <g fill="none" stroke="url(#${id}a)" stroke-width="${mood === 'thinking' ? 10 : 8}" stroke-linecap="round">${apertures[mood] || apertures.idle}</g>
          </g>
        </svg>`;
    }
  }
  customElements.define('reed-mascot', ReedMascot);

  const icons = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4h4M12 7.5V12l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    barbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    swap: '<path d="M7 4L3.5 7.5 7 11M3.5 7.5H16M17 13l3.5 3.5L17 20M20.5 16.5H8"/>',
    minus: '<path d="M5 12h14"/>',
  };
  const reedIcon = (window.reedIcon = (name, stroke = 1.7) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`);
  const status = `
    <span class="st-time">9:41</span><i class="st-island"></i>
    <span class="st-sys"><svg viewBox="0 0 18 12" width="18" height="12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 27 13" width="27" height="13" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="23" height="12" rx="3.5" opacity=".4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M25.5 4.5v4" stroke-linecap="round" opacity=".4"/></svg></span>`;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('i[data-icon]').forEach(el => { el.outerHTML = reedIcon(el.dataset.icon, el.dataset.stroke); });
    document.querySelectorAll('.status').forEach(el => { el.innerHTML = status; });
    document.querySelectorAll('.screen').forEach(el => el.insertAdjacentHTML('beforeend', '<i class="home-ind"></i>'));
  });
})();
