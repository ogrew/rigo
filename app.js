// app.js — index.html（Auto / Manual / Route）の画面側。装置の中身は rigo-core.js
const $=id=>document.getElementById(id); const R=window.RIGO; const player=R.makePlayer();
let S={items:[],labels:[],showBoxes:false,hl:-1,phase:'',guideLine:null,view:1,debris:[],visited:[],pickable:null};
function V(){ return {style:$('style').value, sw:+$('sw').value, ink:$('ink').value, paper:$('paper').value, boxes:$('boxes').checked, hud:$('hud').checked, ruler:$('ruler').checked, debris:$('debris').checked, guide:$('guide').checked, lsize:+$('l_size').value, zoom:+$('zoom').value, vb:[-22,-28,153,165]}; }
function cfg(){ return {gap:+$('gap').value, zoom:+$('zoom').value, scope:$('scope').value, keep:$('keep').checked, beat:+$('beat').value, debris:$('debris').checked, labels:{on:$('labels').checked,name:$('l_name').checked,code:$('l_code').checked,pos:$('l_pos').checked,strokes:$('l_strokes').checked,read:$('l_read').checked,mean:$('l_mean').checked}}; }
function draw(){ R.draw($('stage'),S,V()); }
let AC=null; function snd(kind){ if(!$('sound').checked)return; try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended')AC.resume(); R.scheduleSound(AC,AC.destination,kind,AC.currentTime,+$('vol').value);}catch(e){} }
let AUTO_LIMIT=32; let autoStopped=false; // Auto はこの字数で止める
let mode='auto', settingsOpen=true, running=false, token=0, recording=[], ctx=null, lastPart=null; // lastPart: 直前に運んできた部品名
function setStatus(s){$('status').textContent=s;}
function histRender(){ const v=S.visited||[]; $('hist').innerHTML=v.map((c,i)=>i===v.length-1?'<b>'+c+'</b>':c).join(' → ')+(autoStopped?' →（'+AUTO_LIMIT+'字で自動停止）':''); }
function playSegs(segs){ return player.play(segs,{onFrame:(s,t)=>{R.applySeg(s,t,S,$('easing').value); draw(); histRender();}, onSound:snd}); }
function choose(ch,ps,my,sc){ // 進む部品を決める → {idx, next}
  if(token!==my)return Promise.resolve(null);
  if(sc&&sc.length){ const st=sc.shift(); const idx=ps.findIndex(p=>p.e===st.e&&p.alt); if(idx>=0&&R.D.tree[st.next])return Promise.resolve({idx,next:st.next}); }
  const cands=R.candidates(ch,ps,ctx.visited,$('loopv').checked); const pb=$('parts'); pb.innerHTML='';
  if(!cands.length)return Promise.resolve(null);
  if(mode!=='manual'){ const pool=cands.filter(c=>c.p.e!==lastPart); const from=pool.length?pool:cands; const x=from[Math.floor(Math.random()*from.length)]; /* 直前に運んだ部品は、他に候補があれば選ばない */ return Promise.resolve({idx:x.i,next:x.list[Math.floor(Math.random()*x.list.length)]}); }
  return new Promise(res=>{ const done=i=>{ if(token!==my)return; const x=cands.find(c=>c.i===i); if(!x)return; pb.innerHTML=''; S.pickable=null; S.hl=i; draw(); res({idx:i,next:x.list[Math.floor(Math.random()*x.list.length)]}); };
    S.pickable={set:new Set(cands.map(c=>c.i)),done}; draw();
    ps.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p.e||'?';const x=cands.find(c=>c.i===i);b.disabled=!x; if(x){b.onclick=()=>done(i); b.onmouseenter=()=>{S.hl=i;draw();}; b.onmouseleave=()=>{S.hl=-1;draw();};} pb.appendChild(b);}); setStatus('部品を選んでください（キャンバス上の箱をクリック）'); });
}
async function run(startCh,script){
  const my=++token; player.stop(); running=true; recording=[]; const sc=script?script.slice():null; ctx=R.newCtx(cfg(),startCh); lastPart=null; autoStopped=false; S.pickable=null; S.visited=[startCh]; S.debris=[]; if(!sc)$('path').value=startCh;
  let ch=startCh;
  while(token===my){
    ctx.cfg=cfg(); // 設定の変更は次のステップから
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
const HINT={auto:'Start から部品をランダムに選んで渡り歩く。止めるまで続く。', manual:'ほどけたら下のボタンで進む部品を選ぶ。行き先はランダム。', route:'Start から Goal まで Via 字を挟む経路を探して再生し、Goal で止まる。'};
function setMode(m){ mode=m; document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('goalw').style.display=$('viaw').style.display=(m==='route')?'':'none'; $('loopw').style.display=(m==='route')?'none':'';
  $('go').textContent=m==='route'?'▶ Connect':'▶ Run'; if(m!=='manual')$('parts').innerHTML=''; }
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
$('settoggle').onclick=()=>{settingsOpen=!settingsOpen;$('settings').style.display=settingsOpen?'':'none';$('settoggle').classList.toggle('on',!settingsOpen);};
$('go').onclick=()=>{ const a=[...$('start').value.trim()][0]; if(!a||!R.D.tree[a]){setStatus('Start の字がありません');return;}
  if(mode==='route'){ const b=[...$('goal').value.trim()][0]; if(!b||!R.D.tree[b]){setStatus('Goal の字がありません');return;} if(a===b){setStatus('Start と Goal が同じです');return;}
    const sc=R.findPath(a,b,+$('via').value||0); if(!sc){setStatus(a+' から '+b+' へは辿れません');return;} $('path').value=R.pathStr(a,sc); run(a,sc); return; }
  run(a,null); };
$('replay').onclick=()=>{ const p=R.parsePath($('path').value); if(!p){setStatus('Path が読めません');return;} if(!p.sc.length){setStatus('Path に経路がありません');return;} $('start').value=p.c; run(p.c,p.sc); };
$('copy').onclick=async()=>{ const txt=$('path').value; try{await navigator.clipboard.writeText(txt);setStatus('copied');}catch(e){setStatus(txt);} };
$('export').onclick=()=>{ const st={path:$('path').value,cfg:cfg(),V:V(),ease:$('easing').value,sound:$('sound').checked,vol:+$('vol').value}; delete st.V.vb; token++; player.stop(); location.href='export.html#'+encodeURIComponent(JSON.stringify(st)); };
(()=>{ const svg=$('stage'); const hit=e=>{const t=e.target.closest&&e.target.closest('[data-part]'); return t?+t.dataset.part:-1;};
  svg.addEventListener('mousemove',e=>{ if(!S.pickable)return; const i=hit(e); if(i!==S.hl){S.hl=i;draw();} });
  svg.addEventListener('mouseleave',()=>{ if(!S.pickable)return; if(S.hl!==-1){S.hl=-1;draw();} });
  svg.addEventListener('click',e=>{ if(!S.pickable)return; const i=hit(e); if(i>=0)S.pickable.done(i); }); })();
$('pause').onclick=()=>{player.paused=!player.paused;$('pause').textContent=player.paused?'▶ Resume':'❚❚ Pause';$('pause').classList.toggle('on',player.paused);};
$('stop').onclick=()=>{token++;player.stop();running=false;S.pickable=null;$('parts').innerHTML='';S.phase='stop';draw();setStatus('stopped: '+(S.visited||[]).join(' → '));};
$('vol').oninput=()=>{$('volv').textContent=(+$('vol').value).toFixed(2);};
$('sound').addEventListener('change',()=>{ $('soundopts').style.display=$('sound').checked?'':'none'; if($('sound').checked){ try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); AC.resume(); snd('tick'); }catch(e){} } });
$('labels').addEventListener('change',()=>{$('labopts').style.display=$('labels').checked?'':'none';});
$('beat').oninput=()=>{$('beatv').textContent=(+$('beat').value).toFixed(2);};
$('gap').oninput=()=>{$('gapv').textContent=$('gap').value;};
$('scope').onchange=()=>{ R.buildIndex($('scope').value); setStatus('scope: '+$('scope').options[$('scope').selectedIndex].text); };
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
async function loadData(onProgress){ const r=await fetch('kvg_all.json'); const total=+r.headers.get('content-length')||0; if(!r.body||!total){ return await r.json(); }
  const reader=r.body.getReader(); const chunks=[]; let got=0; while(true){ const {done,value}=await reader.read(); if(done)break; chunks.push(value); got+=value.length; if(onProgress)onProgress(got/total); }
  const buf=new Uint8Array(got); let o=0; chunks.forEach(c=>{buf.set(c,o);o+=c.length;}); return JSON.parse(new TextDecoder().decode(buf)); }
loadData(p=>setStatus('loading '+Math.round(p*100)+'%')).then(d=>{ R.D=d; setStatus('indexing…');
  let st=null; try{ if(location.hash.length>1) st=JSON.parse(decodeURIComponent(location.hash.slice(1))); }catch(e){}
  R.buildIndex($('scope').value); setStatus('ready');
  if(applyState(st)){ R.buildIndex($('scope').value); history.replaceState(null,'',location.pathname); const p=R.parsePath($('path').value); if(p){ $('start').value=p.c; setMode('auto'); if(innerWidth<=700)$('settoggle').click(); const ps=R.parts(p.c,+$('gap').value,+$('zoom').value); S.visited=[p.c]; S.items=[]; if(ps)ps.forEach(q=>q.s.forEach(s=>S.items.push({pts:s,op:1}))); draw(); histRender(); setStatus('export から戻りました — Replay で再生'); return; } }
  const cands=R.scopeChars().filter(c=>{const ps=R.parts(c);return ps&&ps.some(p=>p.alt&&(R.compIndex[p.e]||[]).length>1);}); const st0=cands[Math.floor(Math.random()*cands.length)]; $("start").value=st0; setMode("auto"); if(innerWidth<=700)$("settoggle").click(); run(st0); });
