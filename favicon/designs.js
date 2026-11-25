// rigo favicon 案。32 単位の格子（16px で 2 単位 = 1px）。
// 部品 = 矩形。k はキーフレームごとの位置 [x,y]（1 つなら動かない）。
// fav は favicon に使うフレーム。slot は「抜けた跡」の破線枠。
// 案の経緯：Lift / Slice / Carry も作ったが、Frame に絞った。
(function (root) {
// 風車状の箱。外寸 o..o+L、辺の太さ t。push は辺ごとの [dx,dy]（ほどけた位置への移動）。
function pinwheel(o, L, t, push, core, coreTo) {
  const e = o + L, T = [[o, o], [e - t, o], [o + t, e - t], [o, o + t]];
  const R = [[L - t, t], [t, L - t], [L - t, t], [t, L - t]];
  const p = T.map((xy, i) => ({ r: R[i], k: [xy, [xy[0] + push[i][0], xy[1] + push[i][1]], xy] }));
  p.push({ r: [core, core], k: [[16 - core / 2, 16 - core / 2], coreTo, [16 - core / 2, 16 - core / 2]] });
  return p;
}
const D = [
  {
    id: 'frame-a', name: 'A — 基準（前回の Frame）',
    desc: '辺 4・離れ 4。4 辺がそろって外へ離れ、中の塊は右上へ寄る。',
    fav: 1, p: pinwheel(6, 20, 4, [[0, -4], [4, 0], [0, 4], [-4, 0]], 8, [16, 8]),
  },
  {
    id: 'frame-b', name: 'B — 細線',
    desc: '辺を 2（16px で 1px）に細くし、塊との対比を強める。図面・治具のような冷たさ。',
    fav: 1, p: pinwheel(6, 20, 2, [[0, -4], [4, 0], [0, 4], [-4, 0]], 8, [16, 8]),
  },
  {
    id: 'frame-c', name: 'C — 抜け出し',
    desc: '右の辺だけが下へ滑って角が開き、中の塊がそこから外へ出ていく。ほかの辺は動かない。移動がいちばん強い。',
    fav: 1, p: pinwheel(6, 20, 4, [[0, 0], [0, 6], [0, 0], [0, 0]], 8, [22, 2]),
  },
  {
    id: 'frame-d', name: 'D — 片側だけ',
    desc: '上と右の 2 辺だけが外へ離れ、塊は開いた角へ寄る。ほどけかけの途中。',
    fav: 1, p: pinwheel(6, 20, 4, [[0, -4], [4, 0], [0, 0], [0, 0]], 8, [16, 8]),
  },
];

const INK = '#111', PAPER = '#fff';
function at(pc, f) { return pc.k[Math.min(f, pc.k.length - 1)]; }
function svg(d, f = d.fav, bg = true) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">`;
  if (bg) s += `<rect width="32" height="32" fill="${PAPER}"/>`;
  for (const pc of d.p) {
    const [x, y] = at(pc, f), [w, h] = pc.r;
    s += pc.slot
      ? `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1 1"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}"/>`;
  }
  return s + '</svg>\n';
}
const api = { D, svg, at, INK, PAPER };
if (typeof module !== 'undefined') module.exports = api; else root.RIGO_FAV = api;
})(this);
