// export.js — Path をタイムラインにして、1コマずつ描いて動画にする（実時間に頼らない）
const $=id=>document.getElementById(id); const R=window.RIGO, SH=window.RIGO_SHARE; const player=R.makePlayer();
let S={items:[],labels:[],showBoxes:false,hl:-1,phase:'',guideLine:null,view:1,debris:[],visited:[]};
const VB=[-28,-31.5,165,165]; // 1:1
let SS=null, LEXT=null, LVT=false; // 複数レーンのときのレーンごとの S と字の広がり（2 字以上は 16:9 で横に並べる）
const ASPECT=16/9;
function setLanes(n){ const st=$('stage'); if(n>1){ st.style.aspectRatio=LVT?'9/16':'16/9'; st.style.width=LVT?'min(92vw, calc(80vh * 9 / 16))':'min(92vw, calc(62vh * 16 / 9))'; } else { st.style.aspectRatio=''; st.style.width=''; } }
function V(){ return {style:$('style').value, sw:+$('sw').value, ink:$('ink').value, paper:$('paper').value, boxes:$('boxes').checked, hud:$('hud').checked, ruler:$('ruler').checked, debris:$('debris').checked, guide:$('guide').checked, lsize:+$('l_size').value, zoom:+$('zoom').value, vb:VB, aspect:SS?(LVT?1/ASPECT:ASPECT):undefined, ext:SS?LEXT:null, vertical:SS?LVT:false}; }
function cfg(){ return {gap:+$('gap').value, zoom:+$('zoom').value, scope:$('scope').value, keep:$('keep').checked, vertical:$('dir').value==='v', beat:+$('beat').value, debris:$('debris').checked, labels:{on:$('labels').checked,name:$('l_name').checked,code:$('l_code').checked,pos:$('l_pos').checked,strokes:$('l_strokes').checked,read:$('l_read').checked,mean:$('l_mean').checked}}; }
function draw(){ if(SS)R.drawLanes($('stage'),SS,V()); else R.draw($('stage'),S,V()); }
function setStatus(s){ $('status').textContent=s; }
let AC=null; function snd(kind){ if(!$('sound').checked)return; try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended')AC.resume(); R.scheduleSound(AC,AC.destination,kind,AC.currentTime,+$('vol').value);}catch(e){} }
let downloads=null; (async()=>{try{if(window.claude&&claude.use){downloads=await claude.use('downloads');}}catch(e){downloads=null;}})();

// ---- 画面側から渡された状態（#...）を設定に流し込む ----
function applyState(st){ if(!st)return; try{
  if(st.path)$('path').value=st.path; const c=st.cfg||{}, v=st.V||{};
  if(c.gap!==undefined)$('gap').value=c.gap; if(c.zoom!==undefined)$('zoom').value=c.zoom; if(c.scope)$('scope').value=c.scope; if(c.keep!==undefined)$('keep').checked=c.keep; if(c.beat!==undefined)$('beat').value=c.beat; if(c.debris!==undefined)$('debris').checked=c.debris;
  const L=c.labels||{}; if(L.on!==undefined)$('labels').checked=L.on; ['name','code','pos','strokes','read','mean'].forEach(k=>{ if(L[k]!==undefined)$('l_'+k).checked=L[k]; });
  ['style','sw','ink','paper'].forEach(k=>{ if(v[k]!==undefined)$(k).value=v[k]; }); ['boxes','hud','ruler','guide'].forEach(k=>{ if(v[k]!==undefined)$(k).checked=v[k]; }); if(v.lsize!==undefined)$('l_size').value=v.lsize;
  if(st.ease)$('easing').value=st.ease; if(st.sound!==undefined)$('sound').checked=st.sound; if(st.vol!==undefined)$('vol').value=st.vol;
 }catch(e){} refreshUI(); }
function refreshUI(){ $('beatv').textContent=(+$('beat').value).toFixed(2); $('gapv').textContent=$('gap').value; $('zoomv').textContent=(+$('zoom').value).toFixed(2); $('swv').textContent=$('sw').value; $('l_sizev').textContent=$('l_size').value; $('volv').textContent=(+$('vol').value).toFixed(2); $('labopts').style.display=$('labels').checked?'':'none'; $('soundopts').style.display=$('sound').checked?'':'none'; }

// ---- タイムライン ----
function compileTL(){ const v=$('path').value;
  if(v.includes('/')){ const m=R.parseMulti(v); if(!m||!m.some(x=>x.sc.length)){setStatus('Path が読めないか、経路がありません');return null;}
    const tl=R.compileMulti(m.map(x=>({start:x.c,steps:x.sc})),cfg(),+$('leadin').value||0,+$('leadout').value||0); tl.ease=$('easing').value;
    LEXT=tl.ext; LVT=tl.vertical; if(!SS||SS.length!==m.length)SS=m.map(()=>({})); setLanes(m.length); return tl; }
  if(SS){ SS=null; LEXT=null; setLanes(1); }
  const p=R.parsePath(v); if(!p){setStatus('Path が読めません');return null;} if(!p.sc.length){setStatus('Path に経路がありません（例：森 木>梅 毋>海）');return null;}
  const tl=R.compile(p.c,p.sc,cfg(),+$('leadin').value||0,+$('leadout').value||0); tl.ease=$('easing').value; return tl; }
// Path に出てくる字の層を読んでおく（compile は同期なので先に）
async function need(){ try{ await R.ensure(R.pathChars($('path').value),p=>setStatus('loading '+Math.round(p*100)+'%')); return true; }catch(e){ setStatus('字形データを読めませんでした'); return false; } }
async function showFirst(){ if(!await need())return; const tl=compileTL(); if(!tl)return; if(tl.multi){ R.frameAtMulti(tl,0,SS); SS.forEach(x=>x.phase=''); } else { R.frameAt(tl,0,S); S.phase=''; } draw(); setStatus('ready  '+tl.dur.toFixed(2)+'s  ('+Math.ceil(tl.dur*30)+' frames @30fps)'); }

// ---- Preview（実時間） ----
$('preview').onclick=async()=>{ if(!await need())return; const tl=compileTL(); if(!tl)return; S.debris=[]; setStatus('preview  '+tl.dur.toFixed(2)+'s'); $('preview').disabled=true;
  await player.play(tl.segs,{onFrame:(s,t)=>{ if(tl.multi)R.frameAtMulti(tl,t,SS,tl.ease); else R.applySeg(s,t,S,tl.ease); draw();},onSound:snd}); $('preview').disabled=false; setStatus('preview done'); };
$('stopbtn').onclick=()=>{ player.stop(); $('preview').disabled=false; setStatus('stopped'); };

// ---- Render（仮想時計で1コマずつ） ----
let fontCss=null;
async function loadFontCss(){ if(fontCss)return fontCss; const b64=async u=>{const r=await fetch(u); const buf=await r.arrayBuffer(); let s=''; const a=new Uint8Array(buf); for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000)); return btoa(s);};
  try{ const [r,b]=await Promise.all([b64('mono.woff2'),b64('mono-bold.woff2')]);
    fontCss="@font-face{font-family:'Mono';font-weight:400;src:url(data:font/woff2;base64,"+r+") format('woff2')}@font-face{font-family:'Mono';font-weight:700;src:url(data:font/woff2;base64,"+b+") format('woff2')}"; }catch(e){ fontCss=''; } return fontCss; }
function svgToImage(svg,W,H,css){ const c=svg.cloneNode(true); c.setAttribute('xmlns','http://www.w3.org/2000/svg'); c.setAttribute('width',W); c.setAttribute('height',H); if(css){ const st=document.createElementNS('http://www.w3.org/2000/svg','style'); st.textContent=css; c.insertBefore(st,c.firstChild); }
  const xml=new XMLSerializer().serializeToString(c); const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'})); const img=new Image();
  return new Promise((ok,ng)=>{ img.onload=()=>{URL.revokeObjectURL(url);ok(img);}; img.onerror=e=>{URL.revokeObjectURL(url);ng(e);}; img.src=url; }); }
async function pickCodecs(W,H,fps,withAudio){ if(!('VideoEncoder' in window))return null;
  const tryV=async c=>{ try{ const r=await VideoEncoder.isConfigSupported({codec:c,width:W,height:H,framerate:fps,bitrate:12_000_000}); return r.supported; }catch(e){ return false; } };
  const tryA=async c=>{ try{ const r=await AudioEncoder.isConfigSupported({codec:c,sampleRate:48000,numberOfChannels:1,bitrate:128000}); return r.supported; }catch(e){ return false; } };
  if(await tryV('avc1.640028')&&(!withAudio||await tryA('mp4a.40.2'))) return {container:'mp4',v:'avc1.640028',a:'mp4a.40.2'};
  if(await tryV('avc1.4d0028')&&(!withAudio||await tryA('mp4a.40.2'))) return {container:'mp4',v:'avc1.4d0028',a:'mp4a.40.2'};
  if(await tryV('vp09.00.40.08')&&(!withAudio||await tryA('opus'))) return {container:'webm',v:'vp09.00.40.08',a:'opus'};
  if(await tryV('vp8')&&(!withAudio||await tryA('opus'))) return {container:'webm',v:'vp8',a:'opus'};
  return null; }
async function renderAudio(tl,vol){ const sr=48000, n=Math.ceil(tl.dur*sr)+sr/10; const ac=new OfflineAudioContext(1,n,sr); R.soundEvents(tl.segs).forEach(e=>R.scheduleSound(ac,ac.destination,e.kind,e.t,vol)); return await ac.startRendering(); }
let rendering=false;
$('render').onclick=async()=>{ if(rendering)return; if(!await need())return; const tl=compileTL(); if(!tl)return; player.stop();
  const S0=+$('size').value, W=tl.multi&&!tl.vertical?Math.round(S0*ASPECT/2)*2:S0, H=tl.multi&&tl.vertical?Math.round(S0*ASPECT/2)*2:S0, /* 2 字以上：横は 16:9、縦は 9:16 */ fps=30, withAudio=$('sound').checked; const total=Math.ceil(tl.dur*fps);
  const codecs=await pickCodecs(W,H,fps,withAudio); if(!codecs){ setStatus('このブラウザでは動画を書き出せません（WebCodecs 非対応）。Chrome / Edge をお使いください'); return; }
  rendering=true; $('render').disabled=true; $('preview').disabled=true; $('prog').style.display=''; $('result').innerHTML='';
  const css=await loadFontCss(); const svg=$('stage'); const cv=$('cv'); cv.width=W; cv.height=H; const g2=cv.getContext('2d');
  let muxer, target; const isMp4=codecs.container==='mp4';
  if(isMp4){ target=new Mp4Muxer.ArrayBufferTarget(); muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:W,height:H},audio:withAudio?{codec:'aac',sampleRate:48000,numberOfChannels:1}:undefined,fastStart:'in-memory'}); }
  else { target=new WebMMuxer.ArrayBufferTarget(); muxer=new WebMMuxer.Muxer({target,video:{codec:codecs.v.startsWith('vp8')?'V_VP8':'V_VP9',width:W,height:H,frameRate:fps},audio:withAudio?{codec:'A_OPUS',sampleRate:48000,numberOfChannels:1}:undefined}); }
  let failed=null;
  const venc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{failed=e;}});
  venc.configure({codec:codecs.v,width:W,height:H,framerate:fps,bitrate:12_000_000,...(isMp4?{avc:{format:'avc'}}:{})});
  try{
    // 音：同じタイムラインから計算で合成（実時間に依存しない）
    if(withAudio){ const buf=await renderAudio(tl,+$('vol').value); const aenc=new AudioEncoder({output:(chunk,meta)=>muxer.addAudioChunk(chunk,meta),error:e=>{failed=e;}});
      aenc.configure({codec:codecs.a,sampleRate:48000,numberOfChannels:1,bitrate:128000}); const data=buf.getChannelData(0); const CH=4800;
      for(let i=0;i<data.length;i+=CH){ const n=Math.min(CH,data.length-i); const ad=new AudioData({format:'f32-planar',sampleRate:48000,numberOfFrames:n,numberOfChannels:1,timestamp:Math.round(i/48000*1e6),data:data.subarray(i,i+n)}); aenc.encode(ad); ad.close(); }
      await aenc.flush(); aenc.close(); }
    // 画：1コマずつ
    const t0=performance.now();
    for(let f=0;f<total;f++){ if(failed)throw failed; const t=f/fps; if(tl.multi)R.frameAtMulti(tl,t,SS); else R.frameAt(tl,t,S); draw();
      const img=await svgToImage(svg,W,H,css); g2.fillStyle=$('paper').value; g2.fillRect(0,0,W,H); g2.drawImage(img,0,0,W,H);
      const vf=new VideoFrame(cv,{timestamp:Math.round(f*1e6/fps),duration:Math.round(1e6/fps)}); venc.encode(vf,{keyFrame:f%(fps*2)===0}); vf.close();
      while(venc.encodeQueueSize>6) await new Promise(r=>setTimeout(r,5));
      if(f%5===0){ const pc=Math.round((f+1)/total*100); $('bar').style.width=pc+'%'; const el=(performance.now()-t0)/1000, eta=el/(f+1)*(total-f-1); setStatus('rendering '+(f+1)+'/'+total+'  '+pc+'%  残り約 '+Math.ceil(eta)+'s'); } }
    await venc.flush(); venc.close(); muxer.finalize();
    const blob=new Blob([target.buffer],{type:isMp4?'video/mp4':'video/webm'}); const ends=tl.multi?[tl.lanes.map(l=>l.start).join(''),tl.lanes.map(l=>l.visited[l.visited.length-1]).join('')]:[tl.start,tl.visited[tl.visited.length-1]]; const name='rigo_'+ends[0]+'-'+ends[1]+'_'+Date.now()+(isMp4?'.mp4':'.webm');
    const url=URL.createObjectURL(blob); $('result').innerHTML=''; const vid=document.createElement('video'); vid.controls=true; vid.src=url; vid.style.width='min(60vw,420px)'; $('result').appendChild(vid);
    const info=document.createElement('div'); info.className='hint'; info.textContent=name+'  ('+(blob.size/1048576).toFixed(1)+' MB, '+codecs.container.toUpperCase()+' '+codecs.v+(withAudio?' + '+codecs.a:'')+')'; $('result').appendChild(info);
    let saved=false; if(downloads){ try{ await downloads.save({filename:name,data:blob}); saved=true; }catch(e){} }
    if(!saved){ const a=document.createElement('a'); a.href=url; a.download=name; a.textContent='⤓ Download '+name; a.className='dl'; $('result').appendChild(a); try{a.click();}catch(e){} }
    setStatus('done  '+total+' frames  '+tl.dur.toFixed(2)+'s'); $('bar').style.width='100%';
  }catch(e){ console.error(e); setStatus('render failed: '+(e&&e.message||e)); }
  rendering=false; $('render').disabled=false; $('preview').disabled=false; };

$('back').addEventListener('click',e=>{ e.preventDefault(); location.href=SH.url('index.html',$('path').value); });
// ---- UI ----
['style','sw','ink','paper','dir','boxes','hud','ruler','debris','guide','labels','l_name','l_code','l_pos','l_strokes','l_read','l_mean','l_size','gap','zoom','scope','keep','beat','easing','leadin','leadout'].forEach(k=>{ $(k).oninput=()=>{refreshUI(); if(!player.playing&&!rendering)showFirst();}; $(k).onchange=()=>{refreshUI(); if(!player.playing&&!rendering)showFirst();}; });
$('path').onchange=()=>{ if(!player.playing&&!rendering)showFirst(); };
$('vol').oninput=refreshUI; $('sound').onchange=()=>{ refreshUI(); if($('sound').checked){ try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); AC.resume(); snd('tick'); }catch(e){} } };
document.addEventListener('mousedown',e=>{ if(e.target.closest&&e.target.closest('button'))e.preventDefault(); },true);
$('scope').addEventListener('change',async()=>{ const sc=$('scope').value; try{ await R.ensureScope(sc); }catch(e){ return; } if($('scope').value===sc)R.buildIndex(sc); });
R.load('data/',p=>setStatus('loading '+Math.round(p*100)+'%')).then(async()=>{
  const h=location.hash; if(SH.isLegacy(h)){ let st=null; try{ st=JSON.parse(decodeURIComponent(h.slice(1))); }catch(e){} applyState(st); if(st&&st.nav)SH.setCarry({m:st.nav.mode,g:st.nav.goal,v:st.nav.via}); } // 旧形式（#{JSON}）。Mode / Goal / Via は戻るときまで預かる
  else { const r=SH.decode(h); if(r&&r.path)$('path').value=r.path; refreshUI(); }
  if($('scope').value!=='joyo'){ try{ await R.ensureScope($('scope').value); }catch(e){ $('scope').value='joyo'; } }
  R.buildIndex($('scope').value); if(!$('path').value)$('path').value='森 木>梅 毋>海'; showFirst(); }).catch(e=>{ console.error(e); setStatus('字形データを読めませんでした'); });
