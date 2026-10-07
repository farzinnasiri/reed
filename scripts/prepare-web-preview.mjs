import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Build Output API delivery for a locally validated export; no cloud backend credentials.
const destination = '.vercel/output/static';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp('dist', destination, { recursive: true });
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const routes = config.headers.map(entry => ({
  src: entry.source.replaceAll('.', '\\.'),
  headers: Object.fromEntries(entry.headers.map(header => [header.key, header.value])),
  continue: true,
}));
const overrides = {};
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) await walk(join(directory, entry.name), path + '/');
    else if (path.endsWith('.html')) {
      const cleanPath = path === 'index.html' ? '' : path.endsWith('/index.html') ? path.slice(0, -11) : path.slice(0, -5);
      overrides[path] = { path: cleanPath, contentType: 'text/html; charset=utf-8' };
    }
  }
}
await walk(destination);
routes.push({ handle: 'filesystem' }, { src: '/.*', dest: '/+not-found', status: 404 });
await writeFile('.vercel/output/config.json', JSON.stringify({ version: 3, routes, overrides }, null, 2) + '\n');
console.log('Prepared Expo static preview with clean URLs.');
