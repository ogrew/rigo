// rigo-core.js — 字をほどき、部品を渡す装置の中身。画面（index.html / export.html）から共用する。
// 設計：手順（Path）と設定から「タイムライン」（区間の列）を作り、任意の時刻 t の画面を描けるようにする。
// 実時間の再生も、1コマずつの書き出しも、同じタイムラインを読む。
(function(){
const NS='http://www.w3.org/2000/svg';
const STROKES=new Set(['一','丨','丶','丿','乙','亅','乚','㇏','㇒','㇇','㇉','乛']);
const VC=[54.5,51]; // ほどいた全体を寄せる中心
let D=null, cache={}, compIndex={}, leafSet={}, soloSet={}, partCnt={}, SYNTH={}; // partCnt[ch][e]: ch の中の部品 e の画数 // soloSet: 範囲内でほどけない字

// ---------- データの読み込み（data/：meta + 3 層。src/split_data.js で生成） ----------
// 層 0 = 常用とその部品、1 = 人名用、2 = その他。層 k の字が使う部品の字形は必ず層 k 以下に入っている。
let TIER=null, BASE='data/', META=null; const tierLoad={};
function has(ch){ return TIER? TIER[ch]!==undefined : !!(D&&D.tree&&D.tree[ch]); }
function tierOf(ch){ return TIER? (TIER[ch]===undefined?-1:TIER[ch]) : 0; }
async function fetchJSON(url,onBytes){ const r=await fetch(url); if(!r.ok)throw new Error(url+' '+r.status); if(!r.body||!onBytes)return await r.json();
  const reader=r.body.getReader(); const chunks=[]; let got=0; while(true){ const {done,value}=await reader.read(); if(done)break; chunks.push(value); got+=value.length; onBytes(value.length); }
  const buf=new Uint8Array(got); let o=0; chunks.forEach(c=>{buf.set(c,o);o+=c.length;}); return JSON.parse(new TextDecoder().decode(buf)); }
function loadTier(k,onProgress){ if(tierLoad[k])return tierLoad[k]; const total=(META.bytes&&META.bytes[k])||0; let got=0;
  return tierLoad[k]=fetchJSON(BASE+'t'+k+'.json',onProgress&&total?(n=>{got+=n; onProgress(Math.min(1,got/total));}):null).then(t=>{ Object.assign(D.tree,t); }).catch(e=>{ delete tierLoad[k]; throw e; }); }
async function ensureTier(k,onProgress){ for(let i=0;i<=Math.min(k,2);i++) await loadTier(i,onProgress); }
// 字の列を描けるようにする（足りない層だけ読む）
function ensure(chars,onProgress){ let k=0; (chars||[]).forEach(c=>{ k=Math.max(k,tierOf(c)); }); return ensureTier(k,onProgress); }
function ensureScope(sc,onProgress){ return ensureTier(sc==='all'?2:sc==='jinmei'?1:0,onProgress); }
async function load(base,onProgress){ BASE=base||BASE; META=await fetchJSON(BASE+'meta.json'); TIER={}; META.tiers.forEach((s,k)=>{ for(const c of s)TIER[c]=k; });
  D={order:META.order,grade:META.grade,info:META.info,synth:META.synth,tree:{}}; cache={}; SYNTH={}; await loadTier(0,onProgress); return D; }

// ---------- 木 ----------
// 画は [x0,y0, dx1,dy1, …]（10 倍した整数、2 点目から差分）で入っている。素の [[x,y],…] も読める。
function decodeStroke(s){ if(typeof s[0]!=='number')return s; const o=[]; let x=0,y=0; for(let i=0;i<s.length;i+=2){ x+=s[i]; y+=s[i+1]; o.push([x,y]); } return o; }
function tree(ch){ if(cache[ch])return cache[ch];
  const sc=n=>({e:n.e,p:n.p,pos:n.pos,ty:n.ty,orig:n.orig,bb:n.bb?n.bb.map(v=>v/10):null,own:n.own.map(s=>decodeStroke(s).map(p=>[p[0]/10,p[1]/10])),alt:n.alt?n.alt.map(s=>s.map(p=>[p[0]/10,p[1]/10])):null,kids:n.kids.map(sc)});
  return cache[ch]=norm(sc(D.tree[ch])); }
function norm(n){ let kids=n.kids.filter(k=>k.bb); if(n.e===''&&n.own.length===0&&kids.length===1){return norm(kids[0]);} return Object.assign({},n,{kids:kids.map(norm)}); }
function strokes(n){let o=n.own.slice();n.kids.forEach(k=>o=o.concat(strokes(k)));return o;}
function types(n){let o=(n.ty||[]).slice();n.kids.forEach(k=>o=o.concat(types(k)));return o;}
function isLeaf(n){ if(!n.kids.length)return true; const named=n.kids.filter(k=>k.e&&!STROKES.has(k.e)); if(n.own.length>0){ if(!(n.e===''&&named.length>=1))return true; } if(n.kids.some(k=>k.p))return true; { const lumps=n.kids.filter(k=>k.e===''&&!k.kids.length); if(lumps.length){ const big=lumps.every(k=>k.own.length>=4)&&named.some(k=>strokes(k).length>=3); if(!big)return true; } } if(n.kids.some(k=>STROKES.has(k.e))&&named.length<2)return true; return false; }
function contains(a,b){ const ix=Math.min(a[2],b[2])-Math.max(a[0],b[0]), iy=Math.min(a[3],b[3])-Math.max(a[1],b[1]); if(ix<=0||iy<=0)return false; const ab=(b[2]-b[0])*(b[3]-b[1]), aa=(a[2]-a[0])*(a[3]-a[1]); return aa>ab*1.2 && ix*iy>=ab*0.6; }
function overlap(a,b){return a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];}
function opening(n){ const bb=n.bb,w=bb[2]-bb[0],h=bb[3]-bb[1],m=0.2,NB=12; const bins=[new Set(),new Set(),new Set(),new Set()];
  strokes(n).forEach(st=>st.forEach(q=>{ const bx=Math.min(NB-1,Math.floor((q[0]-bb[0])/w*NB)), by=Math.min(NB-1,Math.floor((q[1]-bb[1])/h*NB));
    if(q[0]>bb[2]-w*m)bins[0].add(by); if(q[1]>bb[3]-h*m)bins[1].add(bx); if(q[0]<bb[0]+w*m)bins[2].add(by); if(q[1]<bb[1]+h*m)bins[3].add(bx); }));
  const order=[1,0,2,3]; let k=1,best=1e9; order.forEach(i=>{ if(bins[i].size<best){best=bins[i].size;k=i;} });
  return [[1,0],[0,1],[-1,0],[0,-1]][k]; }
function clearDist(mv,fx,ux,uy){ const ox=Math.min(mv[2],fx[2])-Math.max(mv[0],fx[0]),oy=Math.min(mv[3],fx[3])-Math.max(mv[1],fx[1]); if(ox<=0||oy<=0)return 0;
  let t=Infinity;if(Math.abs(ux)>1e-6)t=Math.min(t,ox/Math.abs(ux));if(Math.abs(uy)>1e-6)t=Math.min(t,oy/Math.abs(uy)); return isFinite(t)?t:0; }
const center=bb=>[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2];
function bbOf(polys){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; polys.forEach(s=>s.forEach(q=>{x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);})); return [x0,y0,x1,y1]; }

// 字の「部品」= 最深部まで割った葉。{e, s(文脈内の画), alt(素の形), bb, off(ほどいた時の位置ずれ)}
function parts(ch,gap,zoom){ const t=tree(ch); if(isLeaf(t))return null; const out=[]; const ratio=0.5; gap=gap||18; zoom=zoom||1;
  (function rec(n,depth,off){
    if(isLeaf(n)){ const s=strokes(n); out.push({e:n.e,s,alt:altOf(n,s),bb:n.bb,off,pos:n.pos||'',ty:types(n),orig:n.orig||''}); return; }
    const c=center(n.bb); const g=gap*Math.pow(ratio,depth);
    n.own.forEach(st=>out.push({e:'',s:[st],alt:null,bb:n.bb,off}));
    const mv=n.kids.map(k=>{const kc=center(k.bb);let a=Math.atan2(kc[1]-c[1],kc[0]-c[0]);a=Math.round(a/(Math.PI/4))*(Math.PI/4);const L=Math.hypot(kc[1]-c[1],kc[0]-c[0]);return L<2?{k,ux:0,uy:0,d:0}:{k,ux:Math.cos(a),uy:Math.sin(a),d:g};});
    const K=mv.length;
    for(let i=0;i<K;i++)for(let j=0;j<K;j++){if(i===j)continue;const A=mv[i].k.bb,B=mv[j].k.bb;
      if(contains(A,B)&&!contains(B,A)){const o=opening(mv[i].k);mv[j].ux=o[0];mv[j].uy=o[1];mv[j].d=Math.max(g,clearDist(B,A,o[0],o[1])+g*0.6);}}
    const PD=5, sh=m=>[m.k.bb[0]+m.ux*m.d-PD,m.k.bb[1]+m.uy*m.d-PD,m.k.bb[2]+m.ux*m.d+PD,m.k.bb[3]+m.uy*m.d+PD];
    for(let it=0;it<3;it++)for(let i=0;i<K;i++)for(let j=i+1;j<K;j++){
      const A=sh(mv[i]),B=sh(mv[j]);if(!overlap(A,B))continue;
      const ai=(A[2]-A[0])*(A[3]-A[1]),aj=(B[2]-B[0])*(B[3]-B[1]);const m=ai<aj?mv[i]:mv[j],f=ai<aj?B:A,mb=ai<aj?A:B;
      if(Math.abs(m.ux)+Math.abs(m.uy)<1e-6)continue;
      m.d+=clearDist(mb,f,m.ux,m.uy)+g*0.3;}
    mv.forEach(m=>rec(m.k,depth+1,[off[0]+m.ux*m.d,off[1]+m.uy*m.d]));
  })(t,0,[0,0]);
  { const hw=66.5/zoom, hh=65/zoom, X0=VC[0]-hw,X1=VC[0]+hw,Y0=VC[1]-hh,Y1=VC[1]+hh; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; out.forEach(p=>{x0=Math.min(x0,p.bb[0]+p.off[0]);y0=Math.min(y0,p.bb[1]+p.off[1]);x1=Math.max(x1,p.bb[2]+p.off[0]);y1=Math.max(y1,p.bb[3]+p.off[1]);});
    const dx=VC[0]-(x0+x1)/2, dy=VC[1]-(y0+y1)/2; out.forEach(p=>{p.off=[p.off[0]+dx,p.off[1]+dy];});
    out.fit=Math.min(1,(X1-X0)/(x1-x0),(Y1-Y0)/(y1-y0)); }
  return out; }
// 単独の字形を持たない部品は、最初に出てきた文脈の形を中央に寄せて「素の形」の代わりにする
// 字そのものを 1 つの部品として扱う（ほどけない字を渡すとき／部品がそのまま字になるとき）。parts() と同じ形で返す
function wholeParts(ch){ if(!has(ch)||!D.tree[ch])return null; const t=tree(ch), s=strokes(t); if(!s.length)return null;
  const out=[{e:ch,s,alt:s,bb:t.bb,off:[0,0],pos:'',ty:types(t),orig:''}]; out.fit=1; return out; }
// 描くための部品：ほどければ parts、ほどけなければ字そのもの
function partsOrWhole(ch,gap,zoom){ return parts(ch,gap,zoom)||wholeParts(ch); }
function synthShape(s){ const b=bbOf(s); const k=93/Math.max(b[2]-b[0],b[3]-b[1],1e-6), w=(b[2]-b[0])*k, h=(b[3]-b[1])*k, ox=54.5-w/2, oy=54.5-h/2; return s.map(st=>st.map(q=>[(q[0]-b[0])*k+ox,(q[1]-b[1])*k+oy])); }
function synthSources(){ const src={}; Object.keys(D.tree).forEach(ch=>{ const t=tree(ch); (function rec(n){ if(isLeaf(n)){ if(n.e&&!has(n.e)){ const s=strokes(n); const key=n.e+'/'+s.length; if(!src[key])src[key]=s; } return; } n.kids.forEach(rec); })(t); }); return src; }
function synthAlts(){ SYNTH={};
  if(D.synth){ Object.keys(D.synth).forEach(key=>{ SYNTH[key]=synthShape(D.synth[key].map(st=>decodeStroke(st).map(p=>[p[0]/10,p[1]/10]))); }); return; } // 事前計算済み（data/meta.json）
  const src=synthSources(); Object.keys(src).forEach(key=>{ SYNTH[key]=synthShape(src[key]); }); }
function altOf(n,s){ if(n.e&&has(n.e)){ if(!D.tree[n.e])return null; const ss=strokes(tree(n.e)); if(ss.length===s.length) return n.ap?n.ap.map(j=>ss[j]):ss; } const a=SYNTH[n.e+'/'+s.length]; return a||null; }
let SCOPE='joyo'; const inScope=(ch,sc)=>{ const g=(D.grade||{})[ch]||0; return sc==='all'?true: sc==='jinmei'?(g>0&&g<=10): (g>0&&g<=8); };
function scopeChars(sc){ return D.order.filter(c=>inScope(c,sc||SCOPE)); }
function buildIndex(sc){ SCOPE=sc||SCOPE; if(!Object.keys(SYNTH).length)synthAlts(); compIndex={}; leafSet={}; soloSet={}; partCnt={}; scopeChars(SCOPE).forEach(ch=>{const ps=parts(ch); if(!ps){ if(D.tree[ch])soloSet[ch]=1; return; } const seen=new Set(); ps.forEach(p=>{ if(p.e&&p.alt&&!seen.has(p.e)){seen.add(p.e); (partCnt[ch]=partCnt[ch]||{})[p.e]=p.s.length;(compIndex[p.e]=compIndex[p.e]||[]).push(ch);(leafSet[ch]=leafSet[ch]||[]).push(p.e);} }); }); }

// ---------- 画の対応づけ ----------
function normalize(polys){ const b=bbOf(polys); const k=1/Math.max(b[2]-b[0],b[3]-b[1],1e-6); return polys.map(s=>s.map(q=>[(q[0]-b[0])*k,(q[1]-b[1])*k])); }
function matchStrokes(A,B){ const a=normalize(A),b=normalize(B); const n=a.length; const used=new Set(); const perm=[];
  const cost=(s,t)=>s.reduce((acc,q,j)=>acc+Math.hypot(q[0]-t[j][0],q[1]-t[j][1]),0);
  const pairs=[]; for(let i=0;i<n;i++)for(let j=0;j<n;j++)pairs.push([cost(a[i],b[j]),i,j]); pairs.sort((x,y)=>x[0]-y[0]);
  const done=new Set(); for(const [c,i,j] of pairs){ if(done.has(i)||used.has(j))continue; perm[i]=j; done.add(i); used.add(j); if(done.size===n)break; }
  return perm; }

// ---------- 網（経路） ----------
// 字そのものを渡す規則（既定で有効）：
//   出る側：ほどけない字は、字全体を部品としてその字を部品に持つ字へ渡す（平 → 評）
//   入る側：取り出した部品が単独の字でもあれば、その字自身へ渡す（奇 → 大）
let WHOLE=true; function setWhole(v){ WHOLE=!!v; }
function partsOf(ch){ return leafSet[ch]||(WHOLE&&soloSet[ch]?[ch]:[]); }
function wholeTarget(e,ch){ return WHOLE&&e!==ch&&has(e)&&inScope(e,SCOPE)&&!!D.tree[e]; }
// 同じ名前の部品でも画数が違うと形の対応がつかない（例：亀の电は 9 画、俺の电は 5 画）。そういう字へは渡らない
function sameCnt(n,c,e){ const k=partCnt[c]&&partCnt[c][e]; return !n||!k||n===k; }
function cntIn(ch,e){ return partCnt[ch]&&partCnt[ch][e] || (e===ch&&D.tree[ch]?strokes(tree(ch)).length:0); }
function neighborsOf(ch){ const m={}; partsOf(ch).forEach(e=>{ const n=cntIn(ch,e); (compIndex[e]||[]).forEach(c=>{ if(c!==ch&&!m[c]&&sameCnt(n,c,e))m[c]=e; }); if(wholeTarget(e,ch)&&!m[e])m[e]=e; }); return m; }
function findPath(a,b,via){ const dist={}; dist[b]=0; let q=[b]; while(q.length){ const nq=[]; q.forEach(c=>{ Object.keys(neighborsOf(c)).forEach(n=>{ if(dist[n]===undefined){dist[n]=dist[c]+1;nq.push(n);} }); }); q=nq; }
  if(dist[a]===undefined)return null; const L=Math.max(dist[a],via+1); const path=[a]; const used=new Set([a]);
  function dfs(c,rem,prev){ if(rem===0)return c===b; const nb=neighborsOf(c); const ks=Object.keys(nb).filter(n=>!used.has(n)&&dist[n]!==undefined&&dist[n]<=rem-1&&(n!==b||rem===1)); for(let i=ks.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ks[i],ks[j]]=[ks[j],ks[i]];}
    ks.sort((p,q)=>(nb[p]===prev?1:0)-(nb[q]===prev?1:0)); // 直前と同じ部品で進む枝は後回し（他に道があれば使わない）
    for(const n of ks){ used.add(n); path.push(n); if(dfs(n,rem-1,nb[n]))return true; path.pop(); used.delete(n); } return false; }
  if(!dfs(a,L,null)){ path.length=1; used.clear(); used.add(a); if(!dfs(a,dist[a],null))return null; }
  return path.slice(1).map((n,i)=>({e:neighborsOf(path[i])[n],next:n})); }
function candidates(ch,ps,visited,loop){ return ps.map((p,i)=>{ const l=(compIndex[p.e]||[]).slice(); if(wholeTarget(p.e,ch)&&!l.includes(p.e))l.push(p.e); return {i,p,list:l.filter(c=>c!==ch&&(loop||!visited.includes(c))&&(c===p.e||sameCnt(p.s.length,c,p.e)))}; }).filter(x=>x.p.alt&&x.list.length); }
function parsePath(v){ const toks=(v||'').trim().split(/\s+/); const c=[...toks[0]||''][0]; if(!c||!has(c))return null; const sc=toks.slice(1).filter(t=>t.includes('>')).map(t=>{const [e,n]=t.split('>');return {e,next:[...n][0]};}); return {c,sc}; }
function pathStr(start,steps){ return start+(steps.length?' '+steps.map(r=>r.e+'>'+r.next).join(' '):''); }
// Path 文字列に出てくる字（読み込みが要るもの）
function pathChars(v){ if((v||'').includes('/'))return [].concat(...v.split('/').map(pathChars)); const toks=(v||'').trim().split(/\s+/); const o=[]; const c=[...toks[0]||''][0]; if(c)o.push(c); toks.slice(1).forEach(t=>{ const n=t.split('>')[1]; if(n)o.push([...n][0]); }); return o; }

// ---------- 設定 ----------
// cfg: {gap, keep, beat, ease, debris, labels:{on,name,code,pos,strokes,read,mean}}
const EASE={ inout:t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2, out:t=>1-Math.pow(1-t,3), in:t=>t*t*t, linear:t=>t, snap:t=>1-Math.pow(1-t,5),
  back:t=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2);},
  anticipate:t=>{const c=1.70158*1.525;return t<0.5?(Math.pow(2*t,2)*((c+1)*2*t-c))/2:(Math.pow(2*t-2,2)*((c+1)*(t*2-2)+c)+2)/2;} };
const lerp=(a,b,t)=>a+(b-a)*t;
function lerpPoly(A,B,t){return A.map((q,i)=>[lerp(q[0],B[i][0],t),lerp(q[1],B[i][1],t)]);}
function labelFor(p,L){ if(!L||!L.on||!p.e)return null; const inf=(D.info&&D.info[p.e])||{}; const l=[]; const head=[];
  if(L.name)head.push(p.e); if(L.code)head.push('U+'+p.e.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')); if(head.length)l.push(head.join('  '));
  if(L.pos){ l.push((p.pos||'—')+(p.orig?'  ·  var. of '+p.orig:'')); }
  if(L.strokes){ l.push(p.s.length+' strokes'+(p.ty&&p.ty.length?'  '+p.ty.join(' '):'')); }
  if(L.read){ const rd=[...(inf.on||[]),...(inf.kun||[])].join(' '); if(rd)l.push(rd); }
  if(L.mean&&inf.m&&inf.m[0]) l.push(inf.m[0]);
  return l.length?l:null; }

// ---------- 残骸 ----------
// ctx.debris: [{polys, bb, x, y}]（現在位置）。押し出しは区間ごとに「始点→目標」を記録する
function pushDebris(ctx,obstacles){ const zoom=ctx.cfg.zoom||1; const PD=4, sh=(b,x,y)=>[b[0]+x-PD,b[1]+y-PD,b[2]+x+PD,b[3]+y+PD]; const obs=obstacles.concat(ctx.extra||[]).map(b=>b.slice()); // extra: 共有の場で、隣のレーンの字（このレーンの座標）
  const order=ctx.debris.slice().sort((a,b)=>{const ca=center(a.bb),cb=center(b.bb);return Math.hypot(ca[0]+a.x-VC[0],ca[1]+a.y-VC[1])-Math.hypot(cb[0]+b.x-VC[0],cb[1]+b.y-VC[1]);});
  const moves=[]; order.forEach(d=>{ let x=d.x,y=d.y; for(let it=0;it<10;it++){ const b=sh(d.bb,x,y); const o=obs.find(ob=>overlap(b,ob)); if(!o)break;
      const cb=center(b),co=center(o); let ux=cb[0]-co[0],uy=cb[1]-co[1]; let L=Math.hypot(ux,uy); if(L<1e-3){ux=cb[0]-VC[0];uy=cb[1]-VC[1];L=Math.hypot(ux,uy);} if(L<1e-3){ux=1;uy=0;L=1;} ux/=L;uy/=L;
      const dist=clearDist(b,o,ux,uy)+1; x+=ux*dist; y+=uy*dist; }
    moves.push({d,fx:d.x,fy:d.y,tx:x,ty:y}); obs.push(sh(d.bb,x,y)); d.x=x; d.y=y; });
  { const hw=84.5/zoom, hh=90/zoom; const fl=ctx.fieldL||0, fr=ctx.fieldR||0, ft=ctx.fieldT||0, fb=ctx.fieldB||0; ctx.debris=ctx.debris.filter(d=>{const b=d.bb; return b[2]+d.x>VC[0]-hw-fl&&b[0]+d.x<VC[0]+hw+fr&&b[3]+d.y>VC[1]-hh-ft&&b[1]+d.y<VC[1]+hh+fb;}); const cap=Math.min(300,Math.round(80/(zoom*zoom))); if(ctx.debris.length>cap)ctx.debris=ctx.debris.slice(-cap); }
  return moves; }
// 区間用のスナップショット：{polys, bb, fx,fy,tx,ty}
function debrisSnap(ctx,moves){ const mv=new Map(moves.map(m=>[m.d,m])); return ctx.debris.map(d=>{const m=mv.get(d); return m?{polys:d.polys,bb:d.bb,fx:m.fx,fy:m.fy,tx:m.tx,ty:m.ty}:{polys:d.polys,bb:d.bb,fx:d.x,fy:d.y,tx:d.x,ty:d.y};}); }

// ---------- タイムライン ----------
// 区間 seg: {t0, dur, phase, eased, snd:[{at,kind}], deb:[snapshot], fn(te,S)}  … fn は S（画面状態）を書く
// 1ステップ = stepA（hold → decompose → scan）＋ stepB（select → transfer → assemble）。間で「どの部品をどこへ」が決まる。
function newCtx(cfg,start){ return {cfg,debris:[],visited:[start],t:0}; }
function seg(ctx,dur,phase,fn,o){ const s=Object.assign({t0:ctx.t,dur,phase,fn,snd:[],deb:debrisSnap(ctx,[]),eased:false,visitedAt:ctx.visited.slice()},o||{}); ctx.t+=dur; return s; }
function assembledItems(ps){ const items=[]; ps.forEach(p=>p.s.forEach(s=>items.push({pts:s,op:1}))); return items; }
function stepA(ctx,ch){ const cfg=ctx.cfg, B=cfg.beat, gap=cfg.gap; const ps=cfg.whole===false?parts(ch,gap,cfg.zoom):partsOrWhole(ch,gap,cfg.zoom); if(!ps)return null; const off=ps.map(p=>p.off); const segs=[];
  const base=assembledItems(ps);
  segs.push(seg(ctx,B,'hold',(te,S)=>{ S.items=base; S.labels=[]; S.showBoxes=false; S.hl=-1; S.guideLine=null; S.view=1; }));
  const keep=cfg.keep; const from=ps.map(p=>p.s), to=ps.map((p,i)=>(keep?p.s:(p.alt||p.s)).map(s=>s.map(q=>[q[0]+off[i][0],q[1]+off[i][1]])));
  const lab=ps.map((p,i)=>({lines:labelFor(p,cfg.labels),part:i,x:p.bb[0]+off[i][0],y:p.bb[3]+off[i][1]+5}));
  const fit=ps.fit||1; const moves=cfg.debris?pushDebris(ctx,ps.map((p,i)=>[p.bb[0]+off[i][0],p.bb[1]+off[i][1],p.bb[2]+off[i][0],p.bb[3]+off[i][1]])):[]; const snap=debrisSnap(ctx,moves);
  segs.push(seg(ctx,B,'decompose',(te,S)=>{ S.view=1+(fit-1)*te; S.items=[]; ps.forEach((p,i)=>from[i].forEach((s,j)=>S.items.push({pts:lerpPoly(s,to[i][j],te),op:1,part:i}))); S.labels=lab.map(l=>Object.assign({},l,{op:Math.max(0,(te-0.5)*2)})); S.showBoxes=true; S.hl=-1; S.guideLine=null; },{eased:true,snd:[{at:0,kind:'relay'}],deb:snap}));
  const exploded=[]; ps.forEach((p,i)=>to[i].forEach(s=>exploded.push({pts:s,op:1,part:i})));
  const n=ps.length, step=Math.max(0.06,B/Math.max(n,1));
  for(let i=0;i<n;i++){ segs.push(seg(ctx,step,'scan',(te,S)=>{ S.view=fit; S.items=exploded; S.labels=lab.map(l=>Object.assign({},l,{op:1})); S.showBoxes=true; S.hl=i; S.guideLine=null; },{snd:[{at:0,kind:'tick'}]})); }
  return {segs,data:{ch,ps,off,to,lab,fit,exploded,keep}}; }
function stepB(ctx,data,pick){ const cfg=ctx.cfg, B=cfg.beat, gap=cfg.gap; const {ch,ps,to,lab,fit,exploded,keep}=data; const segs=[];
  const P=ps[pick.idx], next=pick.next; const nps=next===P.e?wholeParts(next):partsOrWhole(next,gap,cfg.zoom); const ni=nps.findIndex(q=>q.e===P.e&&q.alt); const Q=nps[ni];
  const pb=to[pick.idx].flat(); const cx=pb.reduce((a,q)=>a+q[0],0)/pb.length, cy=pb.reduce((a,q)=>a+q[1],0)/pb.length; const gl={x0:cx,y0:cy,x1:(Q.bb[0]+Q.bb[2])/2,y1:(Q.bb[1]+Q.bb[3])/2,bb:Q.bb};
  const emph=(te,S)=>{ S.view=fit; S.items=[]; ps.forEach((p,i)=>to[i].forEach(s=>S.items.push({pts:s,op:i===pick.idx?1:1-0.6*te,gray:i!==pick.idx,part:i}))); S.labels=lab.map((l,i)=>Object.assign({},l,{op:i===pick.idx?1:1-0.6*te})); S.showBoxes=true; S.hl=pick.idx; S.guideLine=Object.assign({op:te},gl); };
  segs.push(seg(ctx,B*0.5,'select',emph,{eased:true,snd:[{at:0,kind:'relay'}]}));
  segs.push(seg(ctx,B*0.5,'select',(te,S)=>emph(1,S)));
  const useDebris=cfg.debris; let snap=null; if(useDebris){ ps.forEach((p,i)=>{ if(i!==pick.idx)ctx.debris.push({polys:to[i],bb:bbOf(to[i]),x:0,y:0}); }); const moves=pushDebris(ctx,nps.map(q=>q.bb)); snap=debrisSnap(ctx,moves); }
  const perm=keep?matchStrokes(P.s,Q.s):matchStrokes(P.alt,Q.alt);
  const pFrom=to[pick.idx], pTo=pFrom.map((s,i)=>Q.s[perm[i]]);
  const nFrom=nps.map((q,i)=>(keep?q.s:(q.alt||q.s)).map(s=>s.map(pt=>[pt[0]+q.off[0]*1.6,pt[1]+q.off[1]*1.6]))), nTo=nps.map(q=>q.s);
  segs.push(seg(ctx,B*2,'transfer',(te,S)=>{ S.view=fit+(1-fit)*te; S.items=[]; S.guideLine=Object.assign({op:1-te},gl); S.hl=-1; S.showBoxes=true;
      S.labels=lab.map((l,i)=>i===pick.idx?Object.assign({},l,{op:1-te}):Object.assign({},l,{op:Math.max(0,0.4-te)}));
      if(!useDebris) ps.forEach((p,i)=>{ if(i===pick.idx)return; to[i].forEach(s=>S.items.push({pts:s,op:Math.max(0,0.4-te),gray:true,part:i})); });
      pFrom.forEach((s,i)=>S.items.push({pts:lerpPoly(s,pTo[i],te),op:1,part:pick.idx,boxop:1-te}));
      nps.forEach((q,i)=>{ if(i===ni)return; nFrom[i].forEach((s,j)=>S.items.push({pts:lerpPoly(s,nTo[i][j],te),op:Math.min(1,te*1.2)})); }); },{eased:true,snd:[{at:0,kind:'low'}],deb:snap}));
  ctx.visited.push(next); const asm=assembledItems(nps);
  segs.push(seg(ctx,B*2,'assemble',(te,S)=>{ S.view=1; S.items=asm; S.labels=[]; S.showBoxes=false; S.hl=-1; S.guideLine=null; },{snd:[{at:0,kind:'relay'}]}));
  return {segs,next}; }
function endSeg(ctx,dur,ch){ const ps=partsOrWhole(ch,ctx.cfg.gap,ctx.cfg.zoom); const items=ps?assembledItems(ps):[]; return seg(ctx,dur,'end',(te,S)=>{ S.view=1; S.items=items; S.labels=[]; S.showBoxes=false; S.hl=-1; S.guideLine=null; },{snd:[{at:0,kind:'end'}]}); }
// Path 全体をタイムラインにする（Replay / Route / Export 用）。leadIn/leadOut は秒
function compile(start,steps,cfg,leadIn,leadOut){ cfg=Object.assign({},cfg,{whole:true}); const ctx=newCtx(cfg,start); const segs=[]; let ch=start; // Path に書かれた経路は、設定によらず字そのものの受け渡しも通す
  if(leadIn>0){ const ps=partsOrWhole(ch,cfg.gap,cfg.zoom); const items=ps?assembledItems(ps):[]; segs.push(seg(ctx,leadIn,'hold',(te,S)=>{ S.view=1; S.items=items; S.labels=[]; S.showBoxes=false; S.hl=-1; S.guideLine=null; })); }
  for(const st of steps){ const A=stepA(ctx,ch); if(!A)break; const idx=A.data.ps.findIndex(p=>p.e===st.e&&p.alt); if(idx<0||!has(st.next))break; segs.push(...A.segs); const Bq=stepB(ctx,A.data,{idx,next:st.next}); segs.push(...Bq.segs); ch=Bq.next; }
  segs.push(endSeg(ctx,Math.max(0.001,leadOut||0),ch));
  return {segs,dur:ctx.t,visited:ctx.visited,start,steps}; }
// 時刻 t の画面状態を S に書く（区間は t0 で探す）
function frameAt(tl,t,S){ const segs=tl.segs; let s=segs[segs.length-1]; for(let i=0;i<segs.length;i++){ if(t<segs[i].t0+segs[i].dur){ s=segs[i]; break; } }
  applySeg(s,t,S,tl.ease||tl.cfgEase); return s; }
// ---------- 複数レーン（字を横に並べて、同じ拍で渡す） ----------
// lanes: [{start, steps}]。レーンごとに stepA/stepB で区間を作り、1 手ごとに一番遅いレーンに合わせて他は止めて待つ。
// 返す tl.segs は全体を覆う区間ひとつ（音の時刻表だけを持つ）。画面は frameAtMulti で各レーンの S を書く。
function glyphItems(ch,cfg){ const ps=parts(ch,cfg.gap,cfg.zoom); return ps?assembledItems(ps):(D.tree[ch]?strokes(tree(ch)).map(s=>({pts:s,op:1})):[]); }
function holdSeg(ctx,dur,ch){ const items=glyphItems(ch,ctx.cfg); return seg(ctx,dur,'hold',(te,S)=>{ S.view=1; S.items=items; S.labels=[]; S.showBoxes=false; S.hl=-1; S.guideLine=null; }); }
function compileMulti(lanes,cfg,leadIn,leadOut){ cfg=Object.assign({},cfg,{whole:true}); // compile と同じく、Path に書かれた経路は字そのものの受け渡しも通す
  const L=lanes.map(l=>({ctx:newCtx(cfg,l.start),segs:[],ch:l.start,steps:l.steps||[],ok:true,done:0}));
  // 共有の場：レーンは同じ場に間隔 FD（字の座標）で並ぶ。残骸は場の端まで流れ、隣のレーンの字にも押しのけられる。
  // 画面上のレーンの位置は Scale によらないので、字の座標での間隔は FIELD / Scale（Scale を上げると字だけが大きくなる）
  const shared=L.length>1 /* 2 字以上は常に同じ場 */, n=L.length, vert=!!cfg.vertical, FD=FIELD/(cfg.zoom||1); if(shared)L.forEach((x,i)=>{ x.ctx[vert?'fieldT':'fieldL']=i*FD; x.ctx[vert?'fieldB':'fieldR']=(n-1-i)*FD; }); // 縦書きは上から下へ
  const boxesAt=(ch,exploded)=>{ const ps=partsOrWhole(ch,cfg.gap,cfg.zoom); return ps?ps.map(p=>exploded?[p.bb[0]+p.off[0],p.bb[1]+p.off[1],p.bb[2]+p.off[0],p.bb[3]+p.off[1]]:p.bb.slice()):[]; };
  const others=(i,boxes)=>{ const o=[]; boxes.forEach((bs,j)=>{ if(j===i)return; const d=(j-i)*FD, dx=vert?0:d, dy=vert?d:0; bs.forEach(b=>o.push([b[0]+dx,b[1]+dy,b[2]+dx,b[3]+dy])); }); return o; };
  if(leadIn>0)L.forEach(x=>x.segs.push(holdSeg(x.ctx,leadIn,x.ch)));
  const K=Math.max(0,...L.map(x=>x.steps.length));
  for(let k=0;k<K;k++){
    const act=L.map(x=>x.ok&&k<x.steps.length); let bA=null, bB=null;
    if(shared){ bA=L.map((x,j)=>boxesAt(x.ch,act[j])); bB=L.map((x,j)=>boxesAt(act[j]?x.steps[k].next:x.ch,false)); }
    L.forEach((x,i)=>{ if(!act[i])return; const st=x.steps[k], t0=x.ctx.t; if(shared)x.ctx.extra=others(i,bA); const A=stepA(x.ctx,x.ch); const idx=A?A.data.ps.findIndex(p=>p.e===st.e&&p.alt):-1;
      if(idx<0||!has(st.next)){ x.ctx.t=t0; x.ok=false; return; } x.segs.push(...A.segs); if(shared)x.ctx.extra=others(i,bB); const Bq=stepB(x.ctx,A.data,{idx,next:st.next}); x.ctx.extra=null; x.segs.push(...Bq.segs); x.ch=Bq.next; x.done++; });
    const T=Math.max(...L.map(x=>x.ctx.t)); L.forEach(x=>{ if(x.ctx.t<T-1e-9)x.segs.push(holdSeg(x.ctx,T-x.ctx.t,x.ch)); }); }
  L.forEach(x=>x.segs.push(endSeg(x.ctx,Math.max(0.001,leadOut||0),x.ch)));
  const dur=Math.max(...L.map(x=>x.ctx.t));
  const ev=[]; L.forEach(x=>soundEvents(x.segs).forEach(e=>ev.push(e))); ev.sort((a,b)=>a.t-b.t); const snd=[]; ev.forEach(e=>{ if(!snd.some(q=>q.kind===e.kind&&Math.abs(q.at-e.t)<0.005))snd.push({at:e.t,kind:e.kind}); }); // 同時の同じ音はひとつに
  const master={t0:0,dur,phase:'',fn:()=>{},snd,deb:[],eased:false};
  // 字（残骸を除く）の広がりを測る：中心からの距離の 98 パーセンタイル（部品が外から飛び込む一瞬は除く）。レーンの自動縮小に使う
  const ex=[], ey=[], SS=[]; for(let t=0;t<dur;t+=1/15){ L.forEach((x,i)=>{ const S=SS[i]||(SS[i]={}); frameAt({segs:x.segs},t,S); const v=S.view||1; let mx=0,my=0; (S.items||[]).forEach(it=>it.pts.forEach(q=>{ const a=Math.abs(q[0]-VC[0])*v, b=Math.abs(q[1]-VC[1])*v; if(a>mx)mx=a; if(b>my)my=b; })); ex.push(mx); ey.push(my); }); }
  const p98=a=>{ if(!a.length)return 0; a.sort((x,y)=>x-y); return a[Math.min(a.length-1,Math.floor(a.length*0.98))]; };
  return {multi:true,vertical:vert,segs:[master],dur,ext:{x:p98(ex),y:p98(ey)},lanes:L.map((x,i)=>({segs:x.segs,start:lanes[i].start,steps:x.steps.slice(0,x.done),visited:x.ctx.visited,ok:x.ok})),visited:L.map(x=>x.ctx.visited)}; }
function frameAtMulti(tl,t,SS,easeName){ tl.lanes.forEach((l,i)=>{ const S=SS[i]||(SS[i]={}); frameAt({segs:l.segs,ease:easeName||tl.ease},t,S); }); return SS; }
const FIELD=150; // 隣のレーンとの間隔（Scale 1 のときの字の座標。画面上の間隔は Scale によらない）
// レーンの配置：1 字のときの画面（vb）をレーンの数だけ並べた大きさの場に、レーンを間隔 FIELD で置く（境目なし）。
//   aspect を与えると全体をその縦横比に収め、入りきらなければ全体を ls 倍に縮める。
//   ext（compileMulti が測った字の広がり）を与えると、字が収まるよう中身をさらに fit 倍にする（0.7〜1）。
//   Scale はレーンの位置を変えず、字の大きさだけに効く（drawLanes で掛ける）
function laneLayout(n,vb,aspect,ext,vertical){ if(n<=1)return {vb,cx:[VC[0]],cy:[VC[1]],ls:1,fit:1};
  // 並べる向き a：0 = 横（x 方向に並ぶ）、1 = 縦書き（y 方向に、上から下へ）
  const a=vertical?1:0, size=vb[2+a], T=n*size, F=aspect?(a?vb[2]/aspect:vb[3]*aspect):T, ls=Math.min(1,F/T), f0=vb[a]-(F-n*size*ls)/2;
  let fit=1; if(ext){ const hx=Math.min(VC[0]-vb[0],vb[0]+vb[2]-VC[0])-3, hy=Math.min(VC[1]-vb[1],vb[1]+vb[3]-VC[1])-9; fit=Math.max(0.7,Math.min(1,ext.x>0?hx/ext.x:1,ext.y>0?hy/ext.y:1)); }
  const k=ls*fit, mid=f0+F/2, c=[]; for(let i=0;i<n;i++)c.push(mid+(i-(n-1)/2)*FIELD*k);
  const bot=c.map((v,i)=>i<n-1?(v+c[i+1])/2:f0+F); // レーンの下端（縦書きの HUD の位置）：次のレーンとの中間
  return {vb:a?[vb[0],f0,vb[2],F]:[f0,vb[1],F,vb[3]], cx:a?c.map(()=>VC[0]):c, cy:a?c:c.map(()=>VC[1]), ls,fit, vertical:!!a, bot}; }
// Path の複数レーン：" / " で区切る（森 木>染 氵>海 / 林 木>板 厂>岸）
function parseMulti(v){ const ls=(v||'').split('/').map(x=>x.trim()).filter(Boolean); if(!ls.length)return null; const o=ls.map(parsePath); return o.every(Boolean)?o:null; }
// Auto 用：ランダムに渡り歩いた経路を前もって作る。選び方は画面の Auto と同じ（直前に運んだ部品は、他に候補があれば避ける）
function randomWalk(start,maxSteps,o){ o=o||{}; const vis=(o.avoid||[]).concat([start]); const steps=[]; let ch=start, last=null;
  for(let k=0;k<maxSteps;k++){ const ps=WHOLE?partsOrWhole(ch):parts(ch); if(!ps)break; const cands=candidates(ch,ps,vis,o.loop); if(!cands.length)break;
    const pool=cands.filter(c=>c.p.e!==last), from=pool.length?pool:cands; const x=from[Math.floor(Math.random()*from.length)], next=x.list[Math.floor(Math.random()*x.list.length)];
    steps.push({e:x.p.e,next}); vis.push(next); last=x.p.e; ch=next; }
  return steps; }
// 複数レーンの Auto：レーンごとに歩かせ、手数がなるべく長く揃う組を何度か試して選ぶ（長いレーンは短いほうに合わせて切る）。
// 再訪なしのときは、レーンどうしでも同じ字を通らない
function randomWalks(starts,maxSteps,o){ o=o||{}; const tries=o.tries||16; let best=null;
  for(let t=0;t<tries;t++){ const used=[]; const lanes=starts.map((s,i)=>{ const avoid=o.loop?[]:used.concat(starts.filter((x,j)=>j!==i)); const st=randomWalk(s,maxSteps,{loop:o.loop,avoid}); if(!o.loop){ used.push(s); st.forEach(x=>used.push(x.next)); } return {start:s,steps:st}; });
    const n=Math.min(...lanes.map(l=>l.steps.length)); if(!best||n>best.n)best={n,lanes}; if(n>=maxSteps)break; }
  best.lanes.forEach(l=>{ l.steps=l.steps.slice(0,best.n); }); return best.lanes; }
function findRoutes(A,B,via){ // 字ごとに経路を探し、手数を揃える（揃わなければ短いレーンは最後に待つ）
  const a=[...A],b=[...B]; if(a.length!==b.length)return null; let ps=a.map((x,i)=>findPath(x,b[i],via||0)); if(ps.some(p=>!p))return {fail:a.map((x,i)=>ps[i]?null:x+'→'+b[i]).filter(Boolean)};
  const L=Math.max(...ps.map(p=>p.length)); ps=ps.map((p,i)=>p.length===L?p:(findPath(a[i],b[i],L-1)||p)); return {lanes:a.map((x,i)=>({start:x,steps:ps[i]}))}; }
function applySeg(s,t,S,easeName){ let te=s.dur>0?Math.max(0,Math.min(1,(t-s.t0)/s.dur)):1; if(s.eased)te=(EASE[easeName]||EASE.inout)(te);
  S.phase=s.phase; s.fn(te,S); if(s.visitedAt)S.visited=s.visitedAt;
  S.debris=(s.deb||[]).map(d=>({polys:d.polys,dx:d.fx+(d.tx-d.fx)*te,dy:d.fy+(d.ty-d.fy)*te})); }
function soundEvents(segs){ const ev=[]; segs.forEach(s=>s.snd.forEach(e=>ev.push({t:s.t0+e.at,kind:e.kind}))); return ev; }

// ---------- 音（矩形波の合成。音源ファイルなし） ----------
const SND={tick:[1800,'square',0.012,0.08], relay:[320,'square',0.03,0.18], low:[180,'square',0.045,0.2], end:[520,'square',0.06,0.15]};
function scheduleSound(ac,dest,kind,t0,vol){ const P=SND[kind]||[800,'square',0.02,0.1]; const o=ac.createOscillator(), g=ac.createGain(); o.connect(g); g.connect(dest);
  o.type=P[1]; o.frequency.setValueAtTime(P[0],t0); o.frequency.exponentialRampToValueAtTime(Math.max(40,P[0]*0.5),t0+P[2]);
  g.gain.setValueAtTime(P[3]*(vol||1),t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+P[2]); o.start(t0); o.stop(t0+P[2]+0.01); }

// ---------- 描画 ----------
// S: {items, labels, showBoxes, hl, phase, guideLine, view, debris:[{polys,dx,dy}], visited, pickable}
// V: {style, sw, ink, paper, boxes, hud, ruler, debris, guide, lsize, vb:[x0,y0,w,h]}
function mix(ink,pap,t){ const h=x=>[parseInt(x.slice(1,3),16),parseInt(x.slice(3,5),16),parseInt(x.slice(5,7),16)]; const a=h(ink),b=h(pap); return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')+')'; }
function outlineD(pts,wfn){ const n=pts.length;const L=[],R=[];
  for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];let dx=b[0]-a[0],dy=b[1]-a[1];const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
    const w=wfn(i/(n-1),Math.atan2(dy,dx))/2;L.push([pts[i][0]-dy*w,pts[i][1]+dx*w]);R.push([pts[i][0]+dy*w,pts[i][1]-dx*w]);}
  const f=q=>q[0].toFixed(2)+','+q[1].toFixed(2); return 'M'+L.map(f).join('L')+'L'+R.reverse().map(f).join('L')+'Z'; }
const MONO="'Mono',ui-monospace,Menlo,monospace";
function draw(svg,S,V){ drawLanes(svg,[S],V); }
// SS: レーンごとの S。レーンは laneLayout の位置に、同じ場として並べる（1 レーンなら従来の draw と同じ絵）
function drawLanes(svg,SS,V){ svg.setAttribute('data-ruler-inset','4'); const LY=laneLayout(SS.length,V.vb||[-22,-28,153,165],V.aspect,V.ext,V.vertical); const vb=LY.vb; svg.setAttribute('viewBox',vb.join(' ')); const X0=vb[0],Y0=vb[1],X1=vb[0]+vb[2],Y1=vb[1]+vb[3];
  let bg=svg.querySelector('#bg'); if(!bg){bg=document.createElementNS(NS,'rect');bg.id='bg';bg.setAttribute('stroke','none');svg.appendChild(bg);} bg.setAttribute('x',X0);bg.setAttribute('y',Y0);bg.setAttribute('width',vb[2]);bg.setAttribute('height',vb[3]);bg.setAttribute('fill',V.paper);
  let g0=svg.querySelector('#art'); if(!g0){g0=document.createElementNS(NS,'g');g0.id='art';svg.appendChild(g0);} g0.innerHTML='';
  const zoom=V.zoom||1; let g=null;
  const st=V.style, SW=+V.sw, ink=V.ink, pap=V.paper, mx=t=>mix(ink,pap,t);
  svg.setAttribute('stroke',ink); svg.setAttribute('stroke-width',st==='hair'?Math.min(SW,0.6):SW); svg.setAttribute('fill','none');
  svg.setAttribute('stroke-linecap',st==='flat'?'butt':'round'); svg.setAttribute('stroke-linejoin',st==='flat'?'miter':'round');
  function txt(x,y,str,size,op,anchor,bold,top){ const t=document.createElementNS(NS,'text'); t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('font-size',size);t.setAttribute('font-family',MONO);t.setAttribute('fill',bold?mx(0.2):mx(0.35));if(bold)t.setAttribute('font-weight','700');t.setAttribute('stroke','none');t.setAttribute('opacity',op); if(anchor)t.setAttribute('text-anchor',anchor); t.textContent=str; (top?g0:g).appendChild(t); return t; }
  const hudQ=[]; // レーンごとの HUD は定規の後に描く（1 レーンのとき従来と同じ重なり順）
  SS.forEach((S,li)=>{ const cx=LY.cx[li], cy=LY.cy[li];
  g=document.createElementNS(NS,'g'); g.setAttribute('transform','translate('+cx+','+cy+') scale('+((S.view||1)*zoom*LY.ls*LY.fit)+') translate('+(-VC[0])+','+(-VC[1])+')'); g0.appendChild(g);
  const dItems=[]; if(V.debris&&S.debris)S.debris.forEach(d=>d.polys.forEach(s=>dItems.push({pts:s.map(q=>[q[0]+d.dx,q[1]+d.dy]),op:1,gray:true,deb:true})));
  dItems.concat(S.items||[]).forEach(it=>{const p=document.createElementNS(NS,'path'); const col=it.deb?mx(0.78):it.gray?mx(0.7):ink;
    if(st==='brush'){p.setAttribute('d',outlineD(it.pts,(t,a)=>SW*(0.55+0.75*Math.sin(Math.PI*Math.min(1,t*1.6))*(1-t*0.55)+0.15)));p.setAttribute('fill',col);p.setAttribute('stroke','none');}
    else if(st==='nib'){p.setAttribute('d',outlineD(it.pts,(t,a)=>SW*(0.25+1.1*Math.abs(Math.sin(a-0.15)))));p.setAttribute('fill',col);p.setAttribute('stroke','none');}
    else {p.setAttribute('d','M'+it.pts.map(q=>q[0].toFixed(2)+','+q[1].toFixed(2)).join('L')); if(it.gray)p.setAttribute('stroke',col);}
    p.setAttribute('opacity',it.op); g.appendChild(p);});
  const bx={}; (S.items||[]).forEach(it=>{ if(it.part===undefined)return; const b=bx[it.part]||(bx[it.part]={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9,op:0}); it.pts.forEach(q=>{if(q[0]<b.x0)b.x0=q[0];if(q[1]<b.y0)b.y0=q[1];if(q[0]>b.x1)b.x1=q[0];if(q[1]>b.y1)b.y1=q[1];}); b.op=Math.max(b.op,it.boxop!==undefined?it.boxop:it.op); });
  const hl=S.hl===undefined?-1:S.hl;
  if(S.showBoxes){ Object.keys(bx).forEach(k=>{ const b=bx[k], on=(+k===hl); if(!V.boxes&&!on)return; const r=document.createElementNS(NS,'rect'); const pad=2.5; r.setAttribute('x',b.x0-pad);r.setAttribute('y',b.y0-pad);r.setAttribute('width',b.x1-b.x0+2*pad);r.setAttribute('height',b.y1-b.y0+2*pad); r.setAttribute('fill','none');r.setAttribute('stroke',on?ink:mx(0.45));r.setAttribute('stroke-width',on?0.6:0.35);if(!on)r.setAttribute('stroke-dasharray','1 1');r.setAttribute('stroke-linecap','butt');r.setAttribute('opacity',b.op); g.appendChild(r);
    if(V.hud) txt(b.x0-pad,b.y0-pad-0.8,'x:'+Math.round(b.x0)+' y:'+Math.round(b.y0)+' w:'+Math.round(b.x1-b.x0)+' h:'+Math.round(b.y1-b.y0),2.8,b.op*(on?1:0.8)); }); }
  if(S.pickable&&S.showBoxes){ S.pickable.set.forEach(i=>{ const b=bx[i]; if(!b)return; const r=document.createElementNS(NS,'rect'); const pad=2.5; r.setAttribute('x',b.x0-pad);r.setAttribute('y',b.y0-pad);r.setAttribute('width',b.x1-b.x0+2*pad);r.setAttribute('height',b.y1-b.y0+2*pad); r.setAttribute('fill','#000');r.setAttribute('fill-opacity','0');r.setAttribute('stroke','none');r.setAttribute('pointer-events','all');r.style.cursor='pointer';r.dataset.part=i; g.appendChild(r); }); }
  if(S.guideLine&&V.guide){ const q=S.guideLine; const l=document.createElementNS(NS,'path'); l.setAttribute('d','M'+q.x0+','+q.y0+'L'+q.x1+','+q.y1); l.setAttribute('stroke',mx(0.3));l.setAttribute('stroke-width',0.35);l.setAttribute('stroke-dasharray','1 1');l.setAttribute('stroke-linecap','butt');l.setAttribute('opacity',q.op); g.appendChild(l);
    const r=document.createElementNS(NS,'rect'); r.setAttribute('x',q.bb[0]-2.5);r.setAttribute('y',q.bb[1]-2.5);r.setAttribute('width',q.bb[2]-q.bb[0]+5);r.setAttribute('height',q.bb[3]-q.bb[1]+5);r.setAttribute('fill','none');r.setAttribute('stroke',mx(0.3));r.setAttribute('stroke-width',0.35);r.setAttribute('stroke-dasharray','1 1');r.setAttribute('stroke-linecap','butt');r.setAttribute('opacity',q.op); g.appendChild(r); }
  if(V.hud){ const vis=S.visited||[]; const n=Math.max(0,vis.length-1); const last=vis.slice(-3); if(vis.length) hudQ.push(()=>txt(SS.length>1?cx:(X0+X1)/2,LY.vertical?LY.bot[li]-6:Y1-6,String(n).padStart(4,'0')+'  '+last.join(' → '),4,0.9,'middle',true,true)); }
  const size=+V.lsize;
  (S.labels||[]).forEach(lb=>{ if(!lb.lines)return; const b=lb.part!==undefined?bx[lb.part]:null; const x=b?b.x0-2.5:lb.x, y=b?b.y1+2.5:lb.y;
    lb.lines.forEach((ln,i)=>{const t=document.createElementNS(NS,'text'); t.setAttribute('x',x); t.setAttribute('y',y+size*1.3*(i+1)); t.setAttribute('font-size',size); t.setAttribute('font-family',MONO); t.setAttribute('fill',mx(0.35)); t.setAttribute('stroke','none'); t.setAttribute('opacity',lb.op); t.textContent=ln; g.appendChild(t);}); }); });
  if(V.ruler){ // 目盛りは字の座標（glyph units）。Scale で字が小さくなると、見える範囲が広がり目盛りの間隔を粗くする
    // 複数レーンでは、レーンごとにそのタイルの四辺へ目盛りを打つ（どのレーンも 0〜109 の字の座標で読める）
    const rc=mx(0.55); const k=zoom*LY.ls*LY.fit;
    const minor=[2,5,10,20,50].find(m=>m*k>=1.6)||50, mid=minor*5, major=[50,100,200,500,1000].find(m=>m>=minor*20)||1000; const len=v=>v%major===0?7.2:v%mid===0?3.2:0.8; let d='';
    // 目盛り：画面の四辺に、レーン 0 の字の座標で 1 組（複数レーンは同じ場なので、隣のレーンはその続きの座標で読める）
    const spec=(cx,cy,x0,x1,y0,y1)=>({toSx:v=>cx+(v-VC[0])*k, ax0:VC[0]+(x0+6-cx)/k, ax1:VC[0]+(x1-7-cx)/k, toSy:v=>cy+(v-VC[1])*k, ay0:VC[1]+(y0+6-cy)/k, ay1:VC[1]+(y1-7-cy)/k, T0:y0+4, B0:y1-4, L0:x0+4, R0:x1-4});
    const lanes=[spec(LY.cx[0],LY.cy[0],X0,X1,Y0,Y1)];
    lanes.forEach(ln=>{
      for(let v=Math.ceil(ln.ax0/minor)*minor;v<=ln.ax1;v+=minor){ const L=len(v), sx=ln.toSx(v); d+='M'+sx+','+ln.T0+'v'+L+' M'+sx+','+ln.B0+'v'+(-L)+' '; }
      for(let v=Math.ceil(ln.ay0/minor)*minor;v<=ln.ay1;v+=minor){ const L=len(v), sy=ln.toSy(v); d+='M'+ln.L0+','+sy+'h'+L+' M'+ln.R0+','+sy+'h'+(-L)+' '; } });
    const l1=document.createElementNS(NS,'path'); l1.setAttribute('d',d); l1.setAttribute('data-ruler-frame',''); l1.setAttribute('stroke',rc); l1.setAttribute('stroke-width',0.25); l1.setAttribute('stroke-linecap','butt'); g0.appendChild(l1);
    lanes.forEach(ln=>{
      for(let v=Math.ceil(ln.ay0/major)*major;v<=ln.ay1;v+=major){ txt(ln.L0+8,ln.toSy(v)+0.8,String(v),2.2,0.9,'start',false,true).setAttribute('fill',rc); }
      for(let v=Math.ceil(ln.ax0/major)*major;v<=ln.ax1;v+=major){ txt(ln.toSx(v)+1.2,ln.T0+5.5,String(v),2.2,0.9,'start',false,true).setAttribute('fill',rc); } }); }
  hudQ.forEach(f=>f()); if(V.hud&&SS[0]&&SS[0].phase) txt(X1-5,Y0+3,SS[0].phase,3.2,0.9,'end',true,true); }

// ---------- 再生（実時間） ----------
// player.play(segs, {onFrame(S,seg), onSound(kind), onDone, easeName}) … pause/resume/stop
function makePlayer(){ const P={paused:false,playing:false,_raf:0,_tok:0};
  P.play=function(segs,o){ P.stop(); const tok=++P._tok; P.playing=true; const base=segs.length?segs[0].t0:0; const end=segs.length?segs[segs.length-1].t0+segs[segs.length-1].dur:0; const ev=soundEvents(segs); let ei=0; let t=base, last=performance.now();
    return new Promise(res=>{ (function f(now){ if(tok!==P._tok)return; if(!P.paused){ t+=(now-last)/1000; } last=now;
        while(ei<ev.length&&ev[ei].t<=t){ if(o.onSound)o.onSound(ev[ei].kind); ei++; }
        const tt=Math.min(t,end); let s=segs[segs.length-1]; for(let i=0;i<segs.length;i++){ if(tt<segs[i].t0+segs[i].dur){s=segs[i];break;} }
        if(o.onFrame)o.onFrame(s,tt); if(t>=end){ P.playing=false; res(true); return; } P._raf=requestAnimationFrame(f); })(performance.now()); }); };
  P.stop=function(){ P._tok++; cancelAnimationFrame(P._raf); P.playing=false; };
  return P; }

window.RIGO={ NS,STROKES,VC,EASE, get D(){return D;}, set D(v){D=v;cache={};TIER=null;SYNTH={};}, tree,parts,wholeParts,partsOrWhole,setWhole,isLeaf,strokes,buildIndex,has,tierOf,load,ensure,ensureScope,ensureTier,synthSources,pathChars,scopeChars,inScope,get compIndex(){return compIndex;}, candidates,findPath,parsePath,pathStr,
  newCtx,stepA,stepB,endSeg,compile,frameAt,applySeg,soundEvents,scheduleSound,draw,makePlayer,labelFor,mix,
  compileMulti,frameAtMulti,drawLanes,laneLayout,parseMulti,findRoutes,randomWalk,randomWalks };
})();
