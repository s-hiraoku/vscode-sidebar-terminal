const fs = require('fs');
const path = require('path');

// Create resources directory if it doesn't exist
const resourcesDir = path.join(__dirname, '..', 'resources');
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// SVG icon for the extension
const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="128" height="128" rx="16" fill="#1e1e1e"/>
  
  <!-- Terminal window frame -->
  <rect x="16" y="24" width="96" height="80" rx="8" fill="#2d2d30" stroke="#3e3e42" stroke-width="2"/>
  
  <!-- Terminal title bar -->
  <rect x="16" y="24" width="96" height="16" rx="8" fill="#3e3e42"/>
  <circle cx="26" cy="32" r="3" fill="#ff5f56"/>
  <circle cx="36" cy="32" r="3" fill="#ffbd2e"/>
  <circle cx="46" cy="32" r="3" fill="#27ca3f"/>
  
  <!-- Split line -->
  <line x1="64" y1="44" x2="64" y2="100" stroke="#569cd6" stroke-width="2"/>
  
  <!-- Terminal content (left pane) -->
  <text x="20" y="56" font-family="Consolas, monospace" font-size="8" fill="#cccccc">$ npm start</text>
  <text x="20" y="68" font-family="Consolas, monospace" font-size="8" fill="#4ec9b0">&gt; dev server</text>
  <text x="20" y="80" font-family="Consolas, monospace" font-size="8" fill="#cccccc">Local: 3000</text>
  
  <!-- Terminal content (right pane) -->
  <text x="68" y="56" font-family="Consolas, monospace" font-size="8" fill="#cccccc">$ git status</text>
  <text x="68" y="68" font-family="Consolas, monospace" font-size="8" fill="#ce9178">modified:</text>
  <text x="68" y="80" font-family="Consolas, monospace" font-size="8" fill="#cccccc">  src/</text>
  
  <!-- Terminal cursor -->
  <rect x="20" y="88" width="6" height="10" fill="#cccccc" opacity="0.8"/>
  <rect x="68" y="88" width="6" height="10" fill="#cccccc" opacity="0.8"/>
  
  <!-- VS Code accent -->
  <rect x="12" y="20" width="104" height="4" rx="2" fill="#007acc"/>
</svg>`;

// Write the SVG icon
const iconPath = path.join(resourcesDir, 'icon.svg');
fs.writeFileSync(iconPath, iconSvg);

console.log('Created SVG icon at:', iconPath);

// Create PNG conversion script (requires external tool like Inkscape or Node canvas)
const convertScript = `
# Convert SVG to PNG using Inkscape (if available)
# or use online converter: https://convertio.co/svg-png/

# For 128x128 PNG (extension icon)
inkscape --export-type=png --export-width=128 --export-height=128 --export-filename=resources/icon.png resources/icon.svg

# For 120x120 PNG (marketplace)
inkscape --export-type=png --export-width=120 --export-height=120 --export-filename=resources/icon-120.png resources/icon.svg

echo "Icon conversion complete"
`;

fs.writeFileSync(path.join(__dirname, 'convert-icon.sh'), convertScript);
console.log('Created icon conversion script');

// Create a simple banner SVG
const bannerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1e1e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2d2d30;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="1280" height="640" fill="url(#bg)"/>
  
  <!-- Main title -->
  <text x="640" y="200" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="bold" fill="#ffffff">
    Sidebar Terminal
  </text>
  
  <!-- Subtitle -->
  <text x="640" y="260" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" fill="#cccccc">
    Terminal in VS Code Sidebar with Split Functionality
  </text>
  
  <!-- Feature list -->
  <text x="640" y="360" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#569cd6">
    • Multiple Terminals • Split View • Cross Platform • Customizable
  </text>
  
  <!-- VS Code logo inspiration -->
  <rect x="560" y="420" width="160" height="120" rx="16" fill="#007acc" opacity="0.1"/>
  <path d="M600 450 L600 570 L680 570 L680 450 M640 450 L640 570" stroke="#007acc" stroke-width="4" fill="none"/>
  
  <!-- Copyright -->
  <text x="640" y="600" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#888888">
    VS Code Extension
  </text>
</svg>`;

const bannerPath = path.join(resourcesDir, 'banner.svg');
fs.writeFileSync(bannerPath, bannerSvg);
console.log('Created banner SVG at:', bannerPath);

console.log('\nIcon creation completed! Resources created:');
console.log('- resources/icon.svg (extension icon)');
console.log('- resources/banner.svg (marketplace banner)');
console.log('- scripts/convert-icon.sh (PNG conversion script)');
console.log('\nTo convert to PNG, run the conversion script or use an online converter.');
