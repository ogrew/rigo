// One-line credit link centered in the existing bottom ruler margin.
// Original project code: MIT License. Source material keeps its own licenses.
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const marker = 'data-export-credits';
  const baseBox = 'data-export-credits-viewbox';
  const font = "'Mono',ui-monospace,Menlo,monospace";
  let fontLicense;

  function rulerMargin(svg, width, height) {
    const tile = svg.querySelector('svg[data-ruler-inset]');
    if (tile) {
      const vb = tile.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      return Number(tile.getAttribute('width')) / vb[2] * Number(tile.getAttribute('data-ruler-inset'));
    }
    return Number(svg.getAttribute('data-ruler-inset')) || 4;
  }

  function color(paper) {
    const rgb = /^#[0-9a-f]{6}$/i.test(paper) ? paper.slice(1).match(/../g).map(v => parseInt(v, 16)) : [255, 255, 255];
    const linear = rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const light = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    const ink = light > 0.179 ? 0 : 255;
    return 'rgb(' + rgb.map(v => Math.round(ink * 0.8 + v * 0.2)).join(',') + ')';
  }

  function decorate(svg, { project, paper = '#ffffff' }) {
    const previous = svg.querySelector('g[' + marker + ']');
    // A repeated call on a clone is idempotent; a renderer may reset viewBox.
    const viewBox = previous && svg.getAttribute('viewBox') === previous.getAttribute('data-decorated-viewbox')
      ? svg.getAttribute(baseBox) : svg.getAttribute('viewBox');
    const box = viewBox.trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) throw new Error('Invalid artwork viewBox');
    svg.querySelectorAll('[' + marker + ']').forEach(n => n.remove());
    const [x, y, width, height] = box;
    const margin = rulerMargin(svg, width, height);
    const size = Math.min(Math.min(width, height) * 0.0105, margin * 0.65);
    const newWidth = width, newHeight = height, newX = x, newY = y;
    const decorated = [x, y, width, height].join(' ');
    svg.setAttribute(baseBox, viewBox);
    svg.setAttribute('viewBox', decorated);
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute(marker, 'background');
    for (const [key, value] of Object.entries({ x: newX, y: newY, width: newWidth, height: newHeight, fill: paper, stroke: 'none', 'pointer-events': 'none' })) bg.setAttribute(key, value);
    svg.insertBefore(bg, svg.firstChild);
    const group = document.createElementNS(NS, 'g');
    group.setAttribute(marker, 'single');
    group.setAttribute('data-decorated-viewbox', decorated);
    group.setAttribute('fill', color(paper));
    group.setAttribute('stroke', 'none');
    group.setAttribute('pointer-events', 'none');
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', x + width / 2);
    text.setAttribute('y', y + height - margin / 2 + size * 0.3);
    text.setAttribute('font-family', font);
    text.setAttribute('font-size', size);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = 'credits: ogrew.github.io/' + project + '/credits.html';
    group.appendChild(text);
    svg.appendChild(group);
  }

  async function embedFontLicense(svg) {
    if (!fontLicense) fontLicense = fetch('licenses/JetBrains-Mono-OFL.txt').then(r => {
      if (!r.ok) throw new Error('Cannot load embedded font license');
      return r.text();
    }).catch(e => { fontLicense = null; throw e; });
    const text = await fontLicense;
    let metadata = svg.querySelector('metadata[data-export-font-license]');
    if (!metadata) {
      metadata = document.createElementNS(NS, 'metadata');
      metadata.setAttribute('data-export-font-license', 'JetBrains Mono');
      svg.insertBefore(metadata, svg.firstChild);
    }
    metadata.textContent = text;
  }

  window.ExportCredits = { decorate, embedFontLicense };
})();
