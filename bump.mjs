// Использование: node bump.mjs 1.3.1 — поднимает версию везде (version.json, app.js, sw.js, index.html)
import fs from 'fs';
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Укажите версию, например 1.3.1'); process.exit(1); }
fs.writeFileSync('version.json', JSON.stringify({ version: v }) + '\n');
const sub = (f, re, to) => { const s = fs.readFileSync(f, 'utf8'); const n = s.replace(re, to); if (s === n && !s.includes(v)) throw new Error('не найдено в ' + f); fs.writeFileSync(f, n); };
sub('js/app.js', /VERSION = '[\d.]+'/, `VERSION = '${v}'`);
sub('sw.js', /dostavka-[\d.]+/, `dostavka-${v}`);
sub('index.html', /\?v=[\d.]+/g, `?v=${v}`);
console.log('версия', v);
