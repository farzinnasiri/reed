/** Deterministic brand exports: keep the app's smile geometry instead of generating a new face. */
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { computeMascotFrame, createMascotRuntime } from '../components/reed/mascot/mascot-engine';

const sharp = createRequire(import.meta.url)('sharp') as typeof import('sharp');
const frame = computeMascotFrame(createMascotRuntime('happy', 0), 0, true, 0);
const arches = [frame.main, frame.second].map(eye => `<path d="${eye.d}" fill="none" stroke="white" stroke-linecap="round" stroke-width="${eye.width}"/>`).join('');
const canvas = '#121110';
const orb = `<defs><linearGradient id="ink" x1="-54" y1="-58" x2="56" y2="58" gradientUnits="userSpaceOnUse"><stop stop-color="#15161a"/><stop offset=".55" stop-color="#0e0f12"/><stop offset="1" stop-color="#090a0c"/></linearGradient><linearGradient id="rim" x1="-55" y1="34" x2="32" y2="-56" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity="0"/><stop offset=".42" stop-color="white" stop-opacity=".34"/><stop offset=".72" stop-color="#d9dce2" stop-opacity=".12"/><stop offset="1" stop-color="#d9dce2" stop-opacity="0"/></linearGradient></defs><circle r="65" fill="url(#ink)"/><path d="M -55 34 A 64.25 64.25 0 0 1 32 -56" fill="none" stroke="url(#rim)" stroke-linecap="round" stroke-width="1.4"/>${arches}`;
function svg(half: number, background: boolean, contents = orb) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${-half} ${-half} ${half * 2} ${half * 2}">${background ? `<rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="${canvas}"/>` : ''}${contents}</svg>`;
}

async function main() {
  await mkdir('assets/images', { recursive: true });
  await mkdir('public', { recursive: true });
  await writeFile('assets/images/reed-smile.svg', svg(92, false));
  const monochrome = `<defs><mask id="smile"><circle r="65" fill="white"/>${arches.replaceAll('stroke="white"', 'stroke="black"')}</mask></defs><circle r="65" fill="white" mask="url(#smile)"/>`;
  const exports = [
    ['assets/images/icon.png', 1024, svg(83, true)],
    ['assets/images/adaptive-icon.png', 1024, svg(108, false)],
    ['assets/images/monochrome-icon.png', 1024, svg(108, false, monochrome)],
    ['assets/images/splash-icon.png', 1024, svg(92, false)],
    ['assets/images/favicon.png', 64, svg(70, false)],
    ['public/apple-touch-icon.png', 180, svg(83, true)],
    ['public/icon-192.png', 192, svg(83, true)],
    ['public/icon-512.png', 512, svg(83, true)],
    ['public/icon-maskable-512.png', 512, svg(108, true)],
    ['assets/images/notification-icon.png', 96, svg(45, false, arches)],
  ] as const;
  for (const [path, size, source] of exports) {
    const bitmap = sharp(Buffer.from(source)).resize(size, size);
    if (path.startsWith('public/') || path.endsWith('/icon.png')) bitmap.removeAlpha();
    await bitmap.png().toFile(path);
  }
  console.log('Rendered smiling Reed icons, native splash and web marks.');
}
void main();
