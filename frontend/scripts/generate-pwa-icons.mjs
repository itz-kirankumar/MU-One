/**
 * generate-pwa-icons.mjs
 * Run once: node scripts/generate-pwa-icons.mjs
 * Requires: npm install --save-dev sharp
 * Resizes public/logo-mu-one.png into all PWA icon sizes.
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../public/logo-mu-one.png');
const OUT = join(__dirname, '../public/icons');

mkdirSync(OUT, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

await Promise.all(
  SIZES.map((size) =>
    sharp(SRC)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .png()
      .toFile(join(OUT, `icon-${size}.png`))
      .then(() => console.log(`✓ icon-${size}.png`))
  )
);

console.log('\n✅ All PWA icons generated in public/icons/');
