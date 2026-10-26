// Turns the photos in travel-photos/<Country>/ into small web images for the globe.
//
//   travel-photos/India/IMG_8381.HEIC   ->   src/assets/travels/india/img-8381.webp
//
// Any image works, iPhone HEIC included. Photos are turned upright, shrunk to 1600px on the long
// side and saved as WebP, and their metadata (including GPS location) is dropped. Run it again
// after adding more; photos already done are skipped.
import { readdir, readFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';
import convert from 'heic-convert';

const SRC = 'travel-photos';
const OUT = 'src/assets/travels';
const SIZE = 1600;
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif', '.tif', '.tiff']);

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function exists(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

if (!(await exists(SRC))) {
  await mkdir(SRC, { recursive: true });
  console.log(`Made ${SRC}/. Put a folder per country in it (e.g. ${SRC}/Japan/) with your photos, then run this again.`);
  process.exit(0);
}

let made = 0;
let skipped = 0;
for (const entry of await readdir(SRC, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const country = slug(entry.name);
  const outDir = join(OUT, country);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(join(SRC, entry.name))).filter((f) => IMAGE.has(extname(f).toLowerCase())).sort();
  for (const file of files) {
    const input = join(SRC, entry.name, file);
    const output = join(outDir, `${slug(basename(file, extname(file)))}.webp`);
    const [inStat, outStat] = await Promise.all([stat(input), exists(output)]);
    if (outStat && outStat.mtimeMs >= inStat.mtimeMs) {
      skipped++;
      continue;
    }
    let data = await readFile(input);
    if (['.heic', '.heif'].includes(extname(file).toLowerCase())) {
      data = Buffer.from(await convert({ buffer: data, format: 'JPEG', quality: 0.92 }));
    }
    await sharp(data).rotate().resize({ width: SIZE, height: SIZE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(output);
    made++;
    console.log(`  ${entry.name}/${file} -> ${output}`);
  }
}
console.log(`Done: ${made} new, ${skipped} already up to date. Folders become countries on the globe; add a story for each in src/data/portfolio.ts (trips).`);
