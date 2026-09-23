/**
 * Builds the private import file: the bundled seed plus the overlay of references, seats
 * and documents that must never ship inside the public site.
 *
 *   node scripts/make-private-trip.mjs <overlay.json> <out.shipshape.json>
 *
 * Document paths in the overlay are relative to the overlay file. The output is imported
 * on each phone from Settings, which replaces the sample trip with the same id.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const [overlayPath, outPath] = process.argv.slice(2);
if (!overlayPath || !outPath) {
  console.error('Usage: node scripts/make-private-trip.mjs <overlay.json> <out.shipshape.json>');
  process.exit(1);
}

// Vite loads the TypeScript sources with the project's `@/` alias, so the script uses the
// same schemas and seed as the app rather than a copy of them.
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { europe2026 } = await server.ssrLoadModule('/src/seed/europe-2026/index.ts');
  const { applyOverlay } = await server.ssrLoadModule('/src/db/privateOverlay.ts');

  const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
  const baseDir = path.dirname(path.resolve(overlayPath));
  const readFile = (relative) => {
    const buffer = readFileSync(path.join(baseDir, relative));
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  };

  const file = applyOverlay(europe2026, overlay, readFile);
  writeFileSync(outPath, JSON.stringify(file));
  const mb = (Buffer.byteLength(JSON.stringify(file)) / 1024 / 1024).toFixed(1);
  console.log(
    `Wrote ${outPath}: ${file.bundle.bookings.length} bookings, ${file.documents.length} documents, ${mb} MB`,
  );
} finally {
  await server.close();
}
