// split_data.js — kvg_all.json を、画面が段階的に読み込む data/ に分ける（rigo 用）。
//   node src/split_data.js            （kvg_all.json → data/meta.json, data/t0.json, t1.json, t2.json）
// 部品の判定などは rigo-core.js をそのまま使うので、core の isLeaf 等を変えたら作り直すこと。
//
//   meta.json: {v, order, grade, info(部品名のみ), synth(単独字形のない部品の形), tiers:[層0の字…,層1…,層2…], bytes:[各層の大きさ]}
//   tK.json  : {字: 木}。画は [x0,y0, dx1,dy1, …]（10 倍した整数、2 点目から差分）
//   層 0 = 常用、1 = 人名用、2 = その他。字の部品が単独の字形を持つとき、その字形は同じ層以下に入れる。
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.window={}; require(path.join(ROOT,'rigo-core.js')); const R=window.RIGO;
const D=JSON.parse(fs.readFileSync(path.join(ROOT,'kvg_all.json'),'utf8')); R.D=D;
const chars=Object.keys(D.tree);

// 字 → 部品（葉）の名前。parts() と同じ割り方
function leaves(ch){ const t=R.tree(ch); if(R.isLeaf(t))return []; const o=[]; (function rec(n){ if(R.isLeaf(n)){ if(n.e)o.push(n.e); return; } n.kids.forEach(rec); })(t); return o; }
const L={}; chars.forEach(c=>{ L[c]=leaves(c); });

// 層：学年から決め、部品の字形が要る字は使う側の層まで引き上げる（不動点まで）
const g=c=>(D.grade||{})[c]||0;
const tier={}; chars.forEach(c=>{ tier[c]= (g(c)>0&&g(c)<=8)?0 : (g(c)>0&&g(c)<=10)?1 : 2; });
for(let changed=true;changed;){ changed=false; chars.forEach(c=>{ L[c].forEach(e=>{ if(D.tree[e]&&tier[e]>tier[c]){ tier[e]=tier[c]; changed=true; } }); }); }

// 画の符号化
const enc=s=>{ const o=[]; let px=0,py=0; s.forEach(([x,y],i)=>{ o.push(x-px,y-py); px=x; py=y; }); return o; };
const encNode=n=>{ const m=Object.assign({},n); m.own=n.own.map(enc); m.kids=n.kids.map(encNode); return m; };

// 単独字形のない部品の形（core の synthAlts と同じ選び方。全字が要るのでここで済ませる）
const src=R.synthSources(); const synth={}; Object.keys(src).forEach(k=>{ synth[k]=src[k].map(st=>enc(st.map(p=>[Math.round(p[0]*10),Math.round(p[1]*10)]))); });

// 読み・意味はラベル（部品名）にしか使わないので、部品名の分だけ
const names=new Set(); chars.forEach(c=>L[c].forEach(e=>names.add(e))); const info={}; [...names].forEach(e=>{ if(D.info[e])info[e]=D.info[e]; });

const OUT=path.join(ROOT,'data'); fs.mkdirSync(OUT,{recursive:true});
const tiers=['','','']; const shard=[{},{},{}]; chars.forEach(c=>{ tiers[tier[c]]+=c; shard[tier[c]][c]=encNode(D.tree[c]); });
const bytes=shard.map((t,k)=>{ const s=JSON.stringify(t); fs.writeFileSync(path.join(OUT,'t'+k+'.json'),s); return Buffer.byteLength(s); });
const order=D.order.filter(c=>D.tree[c]);
const meta={v:2,order,grade:D.grade,info,synth,tiers,bytes};
fs.writeFileSync(path.join(OUT,'meta.json'),JSON.stringify(meta));
console.log('tiers',tiers.map(s=>[...s].length).join(' / '),'bytes',bytes.join(' / '),'meta',Buffer.byteLength(JSON.stringify(meta)),'synth',Object.keys(synth).length,'info',Object.keys(info).length,'order dropped',D.order.length-order.length);
