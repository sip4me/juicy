// Bundles the Expo web export (dist/) into one self-contained HTML file for the
// shareable preview: the JS is inlined and every asset the app uses is embedded
// as a data URI, so the page needs no server paths.
// Usage: npx expo export -p web --output-dir dist && node scripts/build-preview.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const jsDir = join(dist, '_expo/static/js/web');
const jsFile = readdirSync(jsDir).find((f) => f.endsWith('.js'));
let js = readFileSync(join(jsDir, jsFile), 'utf8');

// Only the fonts the app loads, plus every image.
const USED_FONTS = ['Fraunces_600SemiBold.', 'Outfit_400Regular.', 'Outfit_500Medium.', 'Outfit_600SemiBold.'];
const mime = { png: 'image/png', jpg: 'image/jpeg', ttf: 'font/ttf', otf: 'font/otf' };
let embedded = 0;
js = js.replace(/"\/assets\/([^"]+\.(png|jpg|ttf|otf))"/g, (whole, rel, ext) => {
  const isFont = ext === 'ttf' || ext === 'otf';
  if (isFont && !USED_FONTS.some((f) => rel.includes(f))) return whole;
  const data = readFileSync(join(dist, 'assets', rel)).toString('base64');
  embedded++;
  return `"data:${mime[ext]};base64,${data}"`;
});

const safeJs = js.replace(/<\/script/gi, '<\\/script');
const out = html
  .replace(/<title>.*?<\/title>/, '<title>Juicy Onboarding</title>')
  .replace(/<link rel="icon"[^>]*>/, '')
  .replace(/<script src="[^"]+" defer><\/script>/, () => `<script>${safeJs}</script>`)
  .replace('</style>', '      html, body { background: #1C1612; }\n    </style>');
writeFileSync(join(dist, 'juicy-preview.html'), out);

// Artifact version: the host adds its own doctype/head/body skeleton, so emit
// only the title, styles, root element and script.
const artifact = `<title>Juicy Onboarding</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; background: #1C1612; overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>${safeJs}</script>
`;
writeFileSync(join(dist, 'juicy-artifact.html'), artifact);
console.log(`embedded ${embedded} assets → dist/juicy-preview.html (${(out.length / 1e6).toFixed(2)} MB)`);
