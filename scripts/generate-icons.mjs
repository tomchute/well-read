#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');

// Design tokens from design-system.md
const paperCream = '#F8F2E7';
const ink = '#1F1B16';
const paperDark = '#1C1915';
const inkDark = '#F0E6D6';

// Helper to generate SVG icon
function generateSvg(size, isDark = false) {
  const bg = isDark ? paperDark : paperCream;
  const fg = isDark ? inkDark : ink;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <text x="${size / 2}" y="${size / 2 + size * 0.15}"
        font-family="Georgia, serif"
        font-size="${size * 0.55}"
        font-weight="600"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${fg}">W</text>
</svg>`;
}

// Generate SVG icons
const icons = [
  { size: 192, name: 'icon-192.svg' },
  { size: 512, name: 'icon-512.svg' },
  { size: 192, name: 'icon-192-maskable.svg', maskable: true },
  { size: 512, name: 'icon-512-maskable.svg', maskable: true },
];

for (const icon of icons) {
  const isDark = false;
  let svg = generateSvg(icon.size, isDark);

  // For maskable icons, use a safe zone (80% of the canvas)
  if (icon.maskable) {
    svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.size} ${icon.size}" width="${icon.size}" height="${icon.size}">
  <rect width="${icon.size}" height="${icon.size}" fill="${paperCream}"/>
  <text x="${icon.size / 2}" y="${icon.size / 2 + icon.size * 0.15}"
        font-family="Georgia, serif"
        font-size="${icon.size * 0.55}"
        font-weight="600"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${ink}">W</text>
</svg>`;
  }

  const svgPath = path.join(iconsDir, icon.name);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created ${icon.name}`);
}

// Try to convert SVG to PNG using ImageMagick or other tools
console.log('Attempting PNG conversion...');
const svgFiles = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.svg'));

for (const svgFile of svgFiles) {
  const svgPath = path.join(iconsDir, svgFile);
  const pngPath = svgPath.replace('.svg', '.png');
  const size = svgFile.includes('192') ? 192 : 512;

  try {
    // Try ImageMagick convert
    execSync(`convert -background none "${svgPath}" -resize ${size}x${size} "${pngPath}"`, {
      stdio: 'pipe',
    });
    console.log(`Converted ${svgFile} to PNG`);
  } catch {
    console.log(
      `⚠️  ImageMagick not available. SVG icon ${svgFile} created but not converted to PNG.`
    );
    console.log(
      'To generate PNGs, install ImageMagick (convert command) or use an online SVG-to-PNG tool.'
    );
  }
}
