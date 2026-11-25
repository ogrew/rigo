// node favicon/gen.js — designs.js から案の SVG と、採用案の ../favicon.svg を書き出す
// PNG（タブ用 32px / apple-touch-icon 180px）は ImageMagick で:
//   magick -background none -density 600 favicon.svg -resize 32x32 favicon-32.png
//   magick -background none -density 600 favicon.svg -resize 180x180 apple-touch-icon.png
const fs = require('fs'), path = require('path');
const { D, svg } = require('./designs.js');
const FINAL = 'frame-c';
for (const d of D) fs.writeFileSync(path.join(__dirname, d.id + '.svg'), svg(d));
fs.writeFileSync(path.join(__dirname, '..', 'favicon.svg'), svg(D.find(d => d.id === FINAL)));
console.log(D.map(d => d.id + '.svg').join(' '), '→ favicon.svg =', FINAL);
