// share.js — Path と設定を短い URL（#p=…&st=…）にする／URL から戻す。index.html と export.html で共用。
//   例：index.html#p=森木梅毋海&st=brush&ink=c00000&bt=0.35
//   p は「始まりの字・部品・次の字・部品・次の字…」を並べたもの（部品名が 1 字でない経路は Path 文字列のまま）。
//   既定値と同じ設定は載せない。読むときは載っていない項目を既定値に戻すので、URL だけで見た目が決まる。
(function(){
// [URL のキー, 要素 id, 既定値]。既定値は index.html の初期値と揃える
const F=[
  ['st','style','round'],['sw','sw','3'],['ink','ink','#111111'],['pp','paper','#ffffff'],
  ['bt','beat','0.5'],['ez','easing','back'],['gp','gap','18'],['zm','zoom','1'],['sc','scope','joyo'],['kp','keep',true],
  ['bx','boxes',true],['gl','guide',true],['hud','hud',true],['rl','ruler',true],['db','debris',true],
  ['lb','labels',false],['ln','l_name',true],['lc','l_code',true],['lp','l_pos',true],['ls','l_strokes',false],['lr','l_read',false],['lm','l_mean',false],['lz','l_size','4'],
  ['snd','sound',false],['vl','vol','1'],
  ['li','leadin','2'],['lo','leadout','2'],['sz','size','1080'], // export.html のみ
];
const $=id=>document.getElementById(id);
const isColor=v=>typeof v==='string'&&v[0]==='#';
const esc=s=>String(s).replace(/[%&=#+\s]/g,c=>encodeURIComponent(c)); // 漢字はそのまま（読める URL にする）
let carry={}; // この画面に無い項目（export の書き出し設定など）は、往復しても失わないように持ち回る

function pathToP(path){ const toks=(path||'').trim().split(/\s+/).filter(Boolean); if(!toks.length)return '';
  const c=[...toks[0]]; const steps=toks.slice(1).map(t=>t.split('>')); const one=s=>[...(s||'')].length===1;
  if(c.length===1&&steps.every(s=>s.length===2&&one(s[0])&&one(s[1]))) return c[0]+steps.map(s=>s[0]+s[1]).join('');
  return toks.join(' '); }
function pToPath(p){ p=(p||'').trim(); if(!p)return ''; if(/[\s>]/.test(p))return p; const a=[...p]; if(a.length%2===0)return '';
  let o=a[0]; for(let i=1;i<a.length;i+=2)o+=' '+a[i]+'>'+a[i+1]; return o; }

// 今の画面の状態 → "p=…&…"
function encode(path){ const kv=[]; const p=pathToP(path); if(p)kv.push(['p',p]);
  F.forEach(([k,id,def])=>{ const el=$(id); let v;
    if(!el){ if(carry[k]!==undefined)kv.push([k,carry[k]]); return; }
    if(typeof def==='boolean'){ v=el.checked; if(v!==def)kv.push([k,v?'1':'0']); return; }
    v=el.value; if(isColor(def)){ v=v.toLowerCase(); if(v!==def)kv.push([k,v.slice(1)]); return; }
    if(+v===+def&&!isNaN(+def))return; if(v!==def)kv.push([k,v]); });
  return kv.map(([k,v])=>k+'='+esc(v)).join('&'); }

// "p=…&…" → 画面に流し込む。{path} を返す（読めなければ null）
function decode(hash){ hash=(hash||'').replace(/^#/,''); if(!/^p=|&p=|^[a-z]+=/.test(hash))return null;
  const q={}; hash.split('&').forEach(s=>{ const i=s.indexOf('='); if(i<0)return; try{ q[s.slice(0,i)]=decodeURIComponent(s.slice(i+1)); }catch(e){} });
  carry={};
  F.forEach(([k,id,def])=>{ const el=$(id); const has=q[k]!==undefined;
    if(!el){ if(has)carry[k]=q[k]; return; }
    if(typeof def==='boolean'){ el.checked=has?q[k]==='1':def; return; }
    let v=has?q[k]:def; if(isColor(def)&&has)v='#'+v.replace(/^#/,'');
    if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===v))v=def; el.value=v; });
  return {path:pToPath(q.p)}; }

// 旧形式（#{"path":…} の JSON）も読む
function isLegacy(hash){ const h=(hash||'').replace(/^#/,''); return h[0]==='{'||h.slice(0,3)==='%7B'; }

function url(page,path){ const h=encode(path); return new URL(page,location.href).href.replace(/#.*$/,'')+(h?'#'+h:''); }

window.RIGO_SHARE={encode,decode,isLegacy,url,pathToP,pToPath};
})();
