const fs = require('fs');
const path = require('path');

// Read the built HTML file
const htmlPath = path.join(__dirname, '../src/lexical-html/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Escape backticks and template literal syntax
const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$');

// Create TypeScript file with exported constant
const output = `// Auto-generated from lexical-editor workspace build
// Do not edit manually - changes will be overwritten on next build
export const LEXICAL_HTML = \`${escaped}\`;
`;

// Write to src/components directory
const outputPath = path.join(__dirname, '../src/components/lexicalHtml.ts');
fs.writeFileSync(outputPath, output);

console.log('✓ Created lexicalHtml.ts from built HTML');
console.log(`  Size: ${Math.round(html.length / 1024)}KB`);
