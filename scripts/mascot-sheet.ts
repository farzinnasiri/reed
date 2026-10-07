/**
 * Draws every mascot expression from the real engine onto one HTML contact sheet, so a face can be
 * judged (and tuned) without running the app.
 *
 *   npm run mascot:sheet                              # all expressions, settled after 3s
 *   npm run mascot:sheet -- --names wink,effort --at 100,3000   # chosen ones, at several moments
 *   npm run mascot:sheet -- --out ./sheet.html --size 220
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  MASCOT_EXPRESSIONS,
  computeMascotFrame,
  createMascotRuntime,
  getMascotExpressionLabel,
  setMascotExpression,
  type MascotExpression,
  type MascotFrame,
} from '../components/reed/mascot/mascot-engine';

const { values } = parseArgs({
  options: {
    at: { default: '3000', type: 'string' },
    names: { type: 'string' },
    out: { default: join(tmpdir(), 'reed-mascot-sheet.html'), type: 'string' },
    size: { default: '160', type: 'string' },
  },
});

const names = (values.names ? values.names.split(',') : MASCOT_EXPRESSIONS) as MascotExpression[];
const unknown = names.filter(name => !MASCOT_EXPRESSIONS.includes(name));
if (unknown.length > 0) throw new Error(`Unknown expression: ${unknown.join(', ')}. Known: ${MASCOT_EXPRESSIONS.join(', ')}`);
const moments = values.at.split(',').map(Number);
const size = Number(values.size);
const START = 1_000_000;
const APERTURE = 'url(#aperture)';

/** The face `elapsed` ms after it began, with blinking switched off so the sheet is repeatable. */
function frameAt(name: MascotExpression, elapsed: number) {
  const runtime = createMascotRuntime('idle', START);
  setMascotExpression(runtime, name, START, false);
  let frame: MascotFrame | undefined;
  for (let time = START; time <= START + elapsed; time += 16) {
    runtime.nextBlinkAt = Infinity;
    runtime.queuedBlinkAt = Infinity;
    frame = computeMascotFrame(runtime, time, false, 0.8);
  }
  return frame as MascotFrame;
}

const stroke = (item: { d: string; opacity: number; width: number }, color = APERTURE) => item.opacity > 0.001
  ? `<path d="${item.d}" fill="none" stroke="${color}" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${item.opacity}"/>` : '';
const strokes = (opacity: number, items: { d: string; width: number }[]) => opacity > 0.001
  ? items.map(item => stroke({ ...item, opacity })).join('') : '';

function face(name: MascotExpression, elapsed: number) {
  const f = frameAt(name, elapsed);
  const ring = f.ring.opacity > 0.001
    ? `<circle r="${f.ring.r}" fill="none" stroke="${APERTURE}" stroke-width="${f.ring.width}" stroke-linecap="round" ${f.ring.dash ? `stroke-dasharray="${f.ring.dash.join(' ')}"` : ''} transform="${f.ring.transform}" opacity="${f.ring.opacity}"/>` : '';
  const dizzy = f.dizzy.opacity > 0.001
    ? [-14, 14].map(x => `<circle cx="${x}" r="8" fill="none" stroke="${APERTURE}" stroke-width="4.5" stroke-dasharray="34 16" stroke-linecap="round" opacity="${f.dizzy.opacity}" transform="rotate(${f.dizzy.angle} ${x} 0)"/>`).join('') : '';
  return `<svg viewBox="-92 -92 184 184" width="${size}" height="${size}"><defs>
<linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="-54" x2="56" y1="-58" y2="58"><stop offset="0" stop-color="#15161a"/><stop offset=".55" stop-color="#0e0f12"/><stop offset="1" stop-color="#090a0c"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#3f6dff" stop-opacity=".38"/><stop offset=".7" stop-color="#3f6dff" stop-opacity=".3"/><stop offset="1" stop-color="#3f6dff" stop-opacity="0"/></radialGradient>
<linearGradient id="aperture" gradientUnits="userSpaceOnUse" x1="-36" x2="36" y1="0" y2="0"><stop offset="0" stop-color="#d9dce2"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#d9dce2"/></linearGradient></defs>
<g transform="${f.core}"><circle r="79" fill="url(#halo)" opacity="${f.haloOpacity}"/><circle r="65" fill="url(#ink)"/>
<g transform="${f.aperture}">${stroke(f.track, '#fff')}${stroke(f.meter)}${stroke(f.main)}${stroke(f.second)}${stroke(f.wave)}${strokes(f.focus.opacity, f.focus.corners)}${strokes(f.bars.opacity, f.bars.items)}${strokes(f.typing.opacity, f.typing.items)}${dizzy}${ring}</g>
${f.accents.map(accent => stroke(accent)).join('')}</g></svg>`;
}

const cells = names.flatMap(name => moments.map(elapsed =>
  `<figure>${face(name, elapsed)}<figcaption>${getMascotExpressionLabel(name)} <span>${name}${moments.length > 1 ? ` · ${elapsed}ms` : ''}</span></figcaption></figure>`)).join('');
writeFileSync(values.out, `<!doctype html><meta charset="utf-8"><title>Reed mascot</title>
<style>body{margin:0;padding:16px;background:#080808;color:#bbb;font:12px system-ui}main{display:grid;grid-template-columns:repeat(auto-fill,${size + 16}px);gap:6px}figure{margin:0;text-align:center}figcaption span{color:#666}</style>
<main>${cells}</main>`);
console.log(values.out);
