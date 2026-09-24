/**
 * Builds the private site: the app plus the traveller's trip file, so it opens with every
 * ticket already attached.
 *
 *   node scripts/build-private.mjs <trip.shipshape.json> <out dir outside the repo>
 *
 * Anyone with the URL can read what this produces, including booking references and the
 * documents themselves. So it is written outside the repository (a private build must
 * never be committed), asks search engines not to index it, and is meant for an unlisted
 * address shared only between the travellers.
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const [tripPath, outArg] = process.argv.slice(2);
if (!tripPath || !outArg) {
  console.error('Usage: node scripts/build-private.mjs <trip.shipshape.json> <out dir>');
  process.exit(1);
}

const repo = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.resolve(outArg);
if (outDir === repo || outDir.startsWith(repo + path.sep)) {
  console.error(`Refusing to write a private build inside the repository: ${outDir}`);
  process.exit(1);
}

const trip = JSON.parse(readFileSync(tripPath, 'utf8'));
if (trip.format !== 'shipshape' || !trip.bundle?.trip?.id) {
  console.error(`${tripPath} is not a Shipshape trip file.`);
  process.exit(1);
}

process.env.VITE_PRIVATE_TRIP = '1';
process.env.VITE_BASE = '/';
await build({ root: repo, logLevel: 'warn', build: { outDir, emptyOutDir: true } });

copyFileSync(tripPath, path.join(outDir, 'trip.shipshape.json'));
writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(
  path.join(outDir, '_headers'),
  [
    '/*',
    '  X-Robots-Tag: noindex, nofollow',
    '  Referrer-Policy: no-referrer',
    '/trip.shipshape.json',
    '  Cache-Control: no-store',
    '',
  ].join('\n'),
);

const docs = trip.documents.filter((d) => d.data).length;
console.log(
  `Private site written to ${outDir}: ${trip.bundle.bookings.length} bookings, ${docs} documents.`,
);
