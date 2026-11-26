// app.js — index.html（Auto / Manual / Route）の画面側。装置の中身は rigo-core.js
const $=id=>document.getElementById(id); const R=window.RIGO, SH=window.RIGO_SHARE; const player=R.makePlayer();
let S={items:[],labels:[],showBoxes:false,hl:-1,phase:'',guideLine:null,view:1,debris:[],visited:[],pickable:null};
let SS=null, LEXT=null, LVT=false; // 複数レーン（2 字以上を並べて渡す）のときのレーンごとの S と、字の広がり（自動縮小用）。1 字なら null
const VB1=[-22,-28,153,165];
function setLanes(n){ const vb=R.laneLayout(n,VB1,null,null,LVT).vb; const st=$('stage'); st.style.aspectRatio=vb[2]+'/'+vb[3]; st.style.width=n>1?'min(92vw, calc('+(LVT?80:65)+'vh * '+(vb[2]/vb[3]).toFixed(3)+'))':''; }
function V(){ return {style:$('style').value, sw:+$('sw').value, ink:$('ink').value, paper:$('paper').value, boxes:$('boxes').checked, hud:$('hud').checked, ruler:$('ruler').checked, debris:$('debris').checked, guide:$('guide').checked, lsize:+$('l_size').value, zoom:+$('zoom').value, vb:VB1, ext:SS?LEXT:null, vertical:SS?LVT:false}; } // vertical は再生中のタイムラインに合わせる（途中で切り替えても絵と動きがずれない）
function cfg(){ return {gap:+$('gap').value, zoom:+$('zoom').value, scope:$('scope').value, keep:$('keep').checked, vertical:$('dir').value==='v', whole:$('whole').checked, beat:+$('beat').value, debris:$('debris').checked, labels:{on:$('labels').checked,name:$('l_name').checked,code:$('l_code').checked,pos:$('l_pos').checked,strokes:$('l_strokes').checked,read:$('l_read').checked,mean:$('l_mean').checked}}; }
function draw(){ if(SS)R.drawLanes($('stage'),SS,V()); else R.draw($('stage'),S,V()); ExportCredits.decorate($('stage'),{project:'rigo',paper:$('paper').value}); }
let AC=null; function snd(kind){ if(!$('sound').checked)return; try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended')AC.resume(); R.scheduleSound(AC,AC.destination,kind,AC.currentTime,+$('vol').value);}catch(e){} }
let AUTO_LIMIT=32; let autoStopped=false; // Auto はこの字数で止める
let mode='auto', settingsOpen=true, running=false, token=0, recording=[], ctx=null, lastPart=null; // lastPart: 直前に運んできた部品名
function setStatus(s){$('status').textContent=s;}
function histRender(){ if(SS){ $('hist').innerHTML=SS.map(x=>{ const v=x.visited||[]; return v.map((c,i)=>i===v.length-1?'<b>'+c+'</b>':c).join(' → '); }).join('<br>'); return; } const v=S.visited||[]; $('hist').innerHTML=v.map((c,i)=>i===v.length-1?'<b>'+c+'</b>':c).join(' → ')+(autoStopped?' →（'+AUTO_LIMIT+'字で自動停止）':''); }
function playSegs(segs){ return player.play(segs,{onFrame:(s,t)=>{R.applySeg(s,t,S,$('easing').value); draw(); histRender();}, onSound:snd}); }
function choose(ch,ps,my,sc){ // 進む部品を決める → {idx, next}
  if(token!==my)return Promise.resolve(null);
  if(sc&&sc.length){ const st=sc.shift(); const idx=ps.findIndex(p=>p.e===st.e&&p.alt); if(idx>=0&&R.has(st.next))return Promise.resolve({idx,next:st.next}); }
  const cands=R.candidates(ch,ps,ctx.visited,$('loopv').checked); const pb=$('parts'); pb.innerHTML='';
  if(!cands.length)return Promise.resolve(null);
  if(mode!=='manual'){ const pool=cands.filter(c=>c.p.e!==lastPart); const from=pool.length?pool:cands; const x=from[Math.floor(Math.random()*from.length)]; /* 直前に運んだ部品は、他に候補があれば選ばない */ return Promise.resolve({idx:x.i,next:x.list[Math.floor(Math.random()*x.list.length)]}); }
  return new Promise(res=>{ const done=i=>{ if(token!==my)return; const x=cands.find(c=>c.i===i); if(!x)return; pb.innerHTML=''; S.pickable=null; S.hl=i; draw(); res({idx:i,next:x.list[Math.floor(Math.random()*x.list.length)]}); };
    S.pickable={set:new Set(cands.map(c=>c.i)),done}; draw();
    ps.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p.e||'?';const x=cands.find(c=>c.i===i);b.disabled=!x; if(x){b.onclick=()=>done(i); b.onmouseenter=()=>{S.hl=i;draw();}; b.onmouseleave=()=>{S.hl=-1;draw();};} pb.appendChild(b);}); setStatus('部品を選んでください（キャンバス上の箱をクリック）'); });
}
async function run(startCh,script){
  const my=++token; player.stop();
  try{ await R.ensure([startCh,...(script||[]).map(s=>s.next)],p=>setStatus('loading '+Math.round(p*100)+'%')); }catch(e){ if(token===my)setStatus('字形データを読めませんでした'); return; } // 範囲外の字は、その層を読んでから
  if(token!==my)return; if(SS){ SS=null; LEXT=null; setLanes(1); } running=true; recording=[]; const sc=script?script.slice():null; ctx=R.newCtx(cfg(),startCh); lastPart=null; autoStopped=false; S.pickable=null; S.visited=[startCh]; S.debris=[]; if(!sc)$('path').value=startCh;
  let ch=startCh;
  while(token===my){
    ctx.cfg=cfg(); if(sc)ctx.cfg.whole=true; // 設定の変更は次のステップから。Path の再生は字そのものの受け渡しも通す
    if(!sc&&mode==='auto'&&ctx.visited.length>=AUTO_LIMIT){ await playSegs([R.endSeg(ctx,0.05,ch)]); if(token!==my)return; autoStopped=true; histRender(); setStatus('auto stop: '+AUTO_LIMIT+'字'); running=false; return; }
    if(sc&&!sc.length){ await playSegs([R.endSeg(ctx,0.05,ch)]); if(token!==my)return; setStatus('到着: '+ctx.visited.join(' → ')); running=false; return; }
    const A=R.stepA(ctx,ch); if(!A){ S.items=[]; draw(); setStatus(ch+' はほどけません'); running=false; return; }
    setStatus(ch);
    await playSegs(A.segs); if(token!==my)return;
    S.phase='select'; S.hl=-1; draw();
    const pick=await choose(ch,A.data.ps,my,sc); if(token!==my)return;
    if(!pick){ setStatus(ch+'：行き先がありません（終了）'); running=false; return; }
    lastPart=A.data.ps[pick.idx].e; recording.push({e:A.data.ps[pick.idx].e,next:pick.next}); if(!sc)$('path').value=R.pathStr(ctx.visited[0],recording);
    const Bq=R.stepB(ctx,A.data,pick);
    await playSegs(Bq.segs); if(token!==my)return;
    ch=Bq.next;
  }
}
// 複数レーン：経路が決まっているもの（Route / Replay / 共有リンク）だけ。全体を一本のタイムラインにして流す
async function runMulti(lanes,auto){ const my=++token; player.stop(); S.pickable=null; $('parts').innerHTML=''; autoStopped=false;
  try{ await R.ensure([].concat(...lanes.map(l=>[l.start,...l.steps.map(s=>s.next)])),p=>setStatus('loading '+Math.round(p*100)+'%')); }catch(e){ if(token===my)setStatus('字形データを読めませんでした'); return; }
  if(token!==my)return; running=true; const tl=R.compileMulti(lanes,cfg(),0,0.05); SS=lanes.map(()=>({})); LEXT=tl.ext; LVT=tl.vertical; setLanes(lanes.length);
  setStatus(lanes.map(l=>l.start).join('')+' ×'+lanes.length);
  await player.play(tl.segs,{onFrame:(s,t)=>{ R.frameAtMulti(tl,t,SS,$('easing').value); draw(); histRender(); }, onSound:snd}); if(token!==my)return;
  running=false; if(auto){ const n=tl.lanes[0].steps.length; autoStopped=n>=AUTO_LIMIT-1; setStatus(autoStopped?'auto stop: '+AUTO_LIMIT+'字':'auto: '+n+' 手で行き先が尽きました'); return; }
  const bad=tl.lanes.filter(l=>!l.ok).map(l=>l.start); setStatus((bad.length?'途中で止まったレーン: '+bad.join(' ')+'  ':'')+'到着: '+tl.lanes.map(l=>l.visited[l.visited.length-1]).join('')); }
// 複数レーンの Auto：ランダムな経路を先にレーンごとに作り（手数は揃える）、Route と同じように流す
async function runAutoMulti(A){ const my=++token; player.stop();
  try{ await R.ensure(A,p=>setStatus('loading '+Math.round(p*100)+'%')); }catch(e){ if(token===my)setStatus('字形データを読めませんでした'); return; } if(token!==my)return;
  const lanes=R.randomWalks(A,AUTO_LIMIT-1,{loop:$('loopv').checked}); if(!lanes[0].steps.length){ setStatus(A.join('')+'：揃って進める行き先がありません'); return; }
  $('path').value=lanes.map(l=>R.pathStr(l.start,l.steps)).join(' / '); runMulti(lanes,true); }
function runPath(v){ if(v.includes('/')){ const m=R.parseMulti(v); if(!m)return false; if(!m.some(x=>x.sc.length))return false; $('start').value=m.map(x=>x.c).join(''); runMulti(m.map(x=>({start:x.c,steps:x.sc}))); return true; }
  const p=R.parsePath(v); if(!p||!p.sc.length)return false; $('start').value=p.c; run(p.c,p.sc); return true; }
const HINT={auto:'Start から部品をランダムに選んで渡り歩く。2 字入れると並べて同じ拍で渡す。', manual:'ほどけたら下のボタンで進む部品を選ぶ。行き先はランダム。', route:'Start から Goal まで Via 字を挟む経路を探して再生し、Goal で止まる。2 字ずつ入れると並べて渡す（平成→令和）。'};
function setMode(m){ mode=m; document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('goalw').style.display=$('viaw').style.display=(m==='route')?'':'none'; $('loopw').style.display=(m==='route')?'none':'';
  $('go').textContent=m==='route'?'▶ Connect':'▶ Run'; if(m!=='manual')$('parts').innerHTML=''; }
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
$('settoggle').onclick=()=>{settingsOpen=!settingsOpen;$('settings').style.display=settingsOpen?'':'none';$('settoggle').classList.toggle('on',!settingsOpen);};
$('go').onclick=()=>{ const A=[...$('start').value.trim()], a=A[0]; if(!a||!R.has(a)){setStatus('Start の字がありません');return;}
  if(mode==='route'&&(A.length>1||[...$('goal').value.trim()].length>1)){ const B=[...$('goal').value.trim()]; // 複数字：字ごとに並べて渡す
    if(A.length!==B.length){setStatus('Start と Goal の字数を揃えてください');return;} const miss=A.concat(B).filter(c=>!R.has(c)); if(miss.length){setStatus(miss.join('')+' がありません');return;}
    const r=R.findRoutes(A.join(''),B.join(''),+$('via').value||0); if(!r||r.fail){setStatus((r?r.fail.join(' / '):'')+' は辿れません');return;}
    $('path').value=r.lanes.map(l=>R.pathStr(l.start,l.steps)).join(' / '); runMulti(r.lanes); return; }
  if(mode==='auto'&&A.length>1){ const miss=A.filter(c=>!R.has(c)); if(miss.length){setStatus(miss.join('')+' がありません');return;} runAutoMulti(A); return; }
  if(A.length>1){ $('start').value=a; setStatus('2 字以上は Auto / Route のみ。先頭の '+a+' で始めます'); } // Manual は 1 字（Start 欄も先頭の字にする）
  if(mode==='route'){ const b=[...$('goal').value.trim()][0]; if(!b||!R.has(b)){setStatus('Goal の字がありません');return;} if(a===b){setStatus('Start と Goal が同じです');return;}
    const sc=R.findPath(a,b,+$('via').value||0); if(!sc){setStatus(a+' から '+b+' へは辿れません');return;} $('path').value=R.pathStr(a,sc); run(a,sc); return; }
  run(a,null); };
$('replay').onclick=()=>{ if(!runPath($('path').value))setStatus('Path が読めないか、経路がありません'); };
async function copyText(txt,msg){ try{await navigator.clipboard.writeText(txt);setStatus(msg);}catch(e){ setStatus(txt); } }
$('copy').onclick=()=>copyText($('path').value,'copied');
// Share：Path と見た目の設定を URL にしてコピー（開くとその通りに再生される）
$('share').onclick=()=>{ const v=$('path').value, m=v.includes('/')?R.parseMulti(v):[R.parsePath(v)]; if(!m||!m[0]||!m.some(x=>x&&x.sc.length)){setStatus('共有できる Path がありません');return;} copyText(SH.url('',v,navExt()),'share link copied'); };
$('export').onclick=()=>{ token++; player.stop(); location.href=SH.url('export.html',$('path').value,navExt()); };
// Mode は URL の m に載せる（Auto は既定なので載せない）。Goal / Via は share.js の F で扱う
function navExt(){ return {m:mode!=='auto'?mode:undefined}; }
(()=>{ const svg=$('stage'); const hit=e=>{const t=e.target.closest&&e.target.closest('[data-part]'); return t?+t.dataset.part:-1;};
  svg.addEventListener('mousemove',e=>{ if(!S.pickable)return; const i=hit(e); if(i!==S.hl){S.hl=i;draw();} });
  svg.addEventListener('mouseleave',()=>{ if(!S.pickable)return; if(S.hl!==-1){S.hl=-1;draw();} });
  svg.addEventListener('click',e=>{ if(!S.pickable)return; const i=hit(e); if(i>=0)S.pickable.done(i); }); })();
$('pause').onclick=()=>{player.paused=!player.paused;$('pause').textContent=player.paused?'▶ Resume':'❚❚ Pause';$('pause').classList.toggle('on',player.paused);};
$('stop').onclick=()=>{token++;player.stop();running=false;S.pickable=null;$('parts').innerHTML='';S.phase='stop';draw();setStatus('stopped: '+(SS?SS.map(x=>(x.visited||[]).join(' → ')).join(' / '):(S.visited||[]).join(' → ')));};
$('vol').oninput=()=>{$('volv').textContent=(+$('vol').value).toFixed(2);};
$('sound').addEventListener('change',()=>{ $('soundopts').style.display=$('sound').checked?'':'none'; if($('sound').checked){ try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); AC.resume(); snd('tick'); }catch(e){} } });
$('labels').addEventListener('change',()=>{$('labopts').style.display=$('labels').checked?'':'none';});
$('beat').oninput=()=>{$('beatv').textContent=(+$('beat').value).toFixed(2);};
$('gap').oninput=()=>{$('gapv').textContent=$('gap').value;};
$('whole').onchange=()=>{ R.setWhole($('whole').checked); setStatus('whole char: '+($('whole').checked?'on':'off')); };
$('scope').onchange=async()=>{ const sc=$('scope').value; try{ await R.ensureScope(sc,p=>setStatus('loading '+Math.round(p*100)+'%')); }catch(e){ setStatus('字形データを読めませんでした'); return; } if($('scope').value!==sc)return; R.buildIndex(sc); setStatus('scope: '+$('scope').options[$('scope').selectedIndex].text); };
$('zoom').oninput=()=>{$('zoomv').textContent=(+$('zoom').value).toFixed(2);draw();};
['style','sw','ink','paper','boxes','hud','ruler','debris','guide','labels','l_name','l_code','l_pos','l_strokes','l_read','l_mean','l_size'].forEach(k=>{$(k).oninput=()=>{$('swv').textContent=$('sw').value;$('l_sizev').textContent=$('l_size').value;draw();};$(k).onchange=()=>draw();});
document.addEventListener('mousedown',e=>{ if(e.target.closest&&e.target.closest('button'))e.preventDefault(); },true);
document.addEventListener('keydown',e=>{ const t=e.target.tagName; if(e.key===' '&&t!=='INPUT'&&t!=='SELECT'&&t!=='TEXTAREA'){ e.preventDefault(); $('pause').click(); } });
document.addEventListener('keyup',e=>{ if(e.key===' '&&e.target.tagName==='BUTTON')e.preventDefault(); });
function applyState(st){ if(!st)return false; try{
  if(st.path)$('path').value=st.path; const c=st.cfg||{}, v=st.V||{};
  if(c.gap!==undefined)$('gap').value=c.gap; if(c.zoom!==undefined)$('zoom').value=c.zoom; if(c.scope)$('scope').value=c.scope; if(c.keep!==undefined)$('keep').checked=c.keep; if(c.beat!==undefined)$('beat').value=c.beat; if(c.debris!==undefined)$('debris').checked=c.debris;
  const L=c.labels||{}; if(L.on!==undefined)$('labels').checked=L.on; ['name','code','pos','strokes','read','mean'].forEach(k=>{ if(L[k]!==undefined)$('l_'+k).checked=L[k]; });
  ['style','sw','ink','paper'].forEach(k=>{ if(v[k]!==undefined)$(k).value=v[k]; }); ['boxes','hud','ruler','guide'].forEach(k=>{ if(v[k]!==undefined)$(k).checked=v[k]; }); if(v.lsize!==undefined)$('l_size').value=v.lsize;
  if(st.ease)$('easing').value=st.ease; if(st.sound!==undefined)$('sound').checked=st.sound; if(st.vol!==undefined)$('vol').value=st.vol;
  $('beatv').textContent=(+$('beat').value).toFixed(2); $('gapv').textContent=$('gap').value; $('zoomv').textContent=(+$('zoom').value).toFixed(2); $('swv').textContent=$('sw').value; $('l_sizev').textContent=$('l_size').value; $('volv').textContent=(+$('vol').value).toFixed(2); $('labopts').style.display=$('labels').checked?'':'none'; $('soundopts').style.display=$('sound').checked?'':'none';
  return !!st.path; }catch(e){ return false; } }
function readHash(){ const h=location.hash; if(h.length<2)return null; // 新形式（#p=…）→ 画面に反映済みで {path}。旧形式（#{JSON}）→ applyState
  if(SH.isLegacy(h)){ try{ const st=JSON.parse(decodeURIComponent(h.slice(1))); if(!applyState(st))return null; const nv=st.nav||{}; if(nv.goal!=null)$('goal').value=nv.goal; if(nv.via!=null)$('via').value=nv.via; return {path:$('path').value,mode:nv.mode}; }catch(e){ return null; } }
  const r=SH.decode(h); if(!r)return null; refreshUI(); if(r.path)$('path').value=r.path; return r.path?{path:r.path,mode:r.q.m}:null; }
function refreshUI(){ $('beatv').textContent=(+$('beat').value).toFixed(2); $('gapv').textContent=$('gap').value; $('zoomv').textContent=(+$('zoom').value).toFixed(2); $('swv').textContent=$('sw').value; $('l_sizev').textContent=$('l_size').value; $('volv').textContent=(+$('vol').value).toFixed(2); $('labopts').style.display=$('labels').checked?'':'none'; $('soundopts').style.display=$('sound').checked?'':'none'; }
R.load('data/',p=>setStatus('loading '+Math.round(p*100)+'%')).then(async()=>{
  const shared=readHash(); if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  if($('scope').value!=='joyo'){ try{ await R.ensureScope($('scope').value,p=>setStatus('loading '+Math.round(p*100)+'%')); }catch(e){ $('scope').value='joyo'; } }
  setStatus('indexing…'); R.setWhole($('whole').checked); R.buildIndex($('scope').value); setStatus('ready');
  if(innerWidth<=700)$('settoggle').click(); setMode(shared&&['auto','manual','route'].includes(shared.mode)?shared.mode:'auto');
  if(shared&&runPath(shared.path))return; // 共有リンク：その Path を再生
  const cands=R.scopeChars().filter(c=>{const ps=R.parts(c);return ps&&ps.some(p=>p.alt&&(R.compIndex[p.e]||[]).length>1);}); const st0=cands[Math.floor(Math.random()*cands.length)]; $("start").value=st0; run(st0); }).catch(e=>{ console.error(e); setStatus('字形データを読めませんでした'); });
