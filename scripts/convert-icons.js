#!/usr/bin/env node

/**
 * Convert SVG icons to PNG format for PWA manifest
 * This script converts all SVG icons in public/icons/ to PNG format
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function convertIcon(size) {
  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

  if (!fs.existsSync(svgPath)) {
    console.warn(`Warning: ${svgPath} not found, skipping...`);
    return;
  }

  try {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`✓ Converted icon-${size}x${size}.svg to PNG`);
  } catch (error) {
    console.error(`✗ Failed to convert icon-${size}x${size}.svg:`, error.message);
  }
}

async function convertAllIcons() {
  console.log('Converting SVG icons to PNG...\n');
  
  for (const size of sizes) {
    await convertIcon(size);
  }
  
  console.log('\n✓ Icon conversion complete!');
}

convertAllIcons().catch(error => {
  console.error('Error converting icons:', error);
  process.exit(1);
});
