/* ==========================================================================
   GD League broadcast overlay – state, rendering, control panel
   overlay.html#overlay = transparent overlay for OBS, overlay.html#control = control panel
   ========================================================================== */

const LOGO_A = "img/demo-team-a.png";   // example logos, replace them in the control panel
const LOGO_B = "img/demo-team-b.png";
const KEY = 'gdleague-overlay-v2';
const PLACE_PTS = [5,3,2,0];

const DEFAULT = {
  v: 2,
  league: 'GD E-SPORTS LEAGUE',
  stage: 'Gruppenphase · Spieltag 1',
  rounds: 2,
  lives: 50,
  round: 1,
  results: [],          // [{A,B,level,order:[{name,team,pts}]}]
  roundOver: false,
  adj: {A:0,B:0},       // manual score correction
  teams: {
    A: {tag:'FGD', name:"Fightin' Dashers", color:'#9b4dff', logo:LOGO_A},
    B: {tag:'HVM', name:'Hivemind', color:'#ffb020', logo:LOGO_B}
  },
  level: {name:'Bloodbath', creator:'Riot & more', aredl:'120', revealed:true},
  players: [
    {name:'Player 1', team:'A', cur:42, best:67, bestAtt:14, att:23, lives:27, done:false},
    {name:'Player 2', team:'A', cur:12, best:51, bestAtt:20, att:47, lives:3,  done:false},
    {name:'Player 4', team:'B', cur:73, best:73, bestAtt:19, att:19, lives:31, done:false},
    {name:'Player 3', team:'B', cur:0,  best:38, bestAtt:9,  att:50, lives:0,  done:false}
  ],
  board: false,
  side: 'race',           // right sidebar view: race | standings | matchday | off
  sheetUrl: (typeof CONFIG !== 'undefined' && CONFIG.sheetUrl) || '',
  matches: null, sheetStatus: '', liveInTable: true,
  events: []
};

/* ---------- state + sync ---------- */
let S = load();
let seen = S.events.length ? S.events[S.events.length-1].id : 0;
function load(){
  let o=null;
  try{ const r = localStorage.getItem(KEY); if(r){ o = JSON.parse(r); if(!o || o.v!==2) o=null; } }catch(e){}
  return Object.assign(JSON.parse(JSON.stringify(DEFAULT)), o||{});
}
let bc = null; try{ bc = new BroadcastChannel(KEY); }catch(e){}
function save(){
  S.events = S.events.slice(-20);
  S.rev = Date.now() + Math.random();
  const str = JSON.stringify(S);
  try{ localStorage.setItem(KEY, str); }catch(e){}
  try{ bc && bc.postMessage(str); }catch(e){}
  render();
}
function receive(str){
  try{ const o = JSON.parse(str); if(!o || o.rev === S.rev || o.v!==2) return; S = o; render(); }catch(e){}
}
if(bc) bc.onmessage = e => receive(e.data);
addEventListener('storage', e => { if(e.key===KEY && e.newValue) receive(e.newValue); });
setInterval(()=>{ try{ const r = localStorage.getItem(KEY); if(r) receive(r); }catch(e){} }, 400);

/* ---------- mode ---------- */
const hash = location.hash.replace('#','');
const MODE = hash==='overlay' ? 'overlay' : hash==='control' ? 'control' : (window.obsstudio ? 'overlay' : 'control');
document.body.className = 'mode-' + MODE;
document.documentElement.className = 'mode-' + MODE;

const esc = s => String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tc = t => S.teams[t].color;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- scoring ---------- */
// Ranking: whoever beat the level first, then best %, then who reached that best in fewer attempts
function ranking(){
  const r = S.players.map((p,i)=>({...p,i}));
  r.sort((x,y)=>{
    if(x.done!==y.done) return x.done?-1:1;
    if(x.done&&y.done) return x.doneAt-y.doneAt;
    if(y.best!==x.best) return y.best-x.best;
    return (x.bestAtt||999)-(y.bestAtt||999);
  });
  const key=p=>p.done?'d'+p.doneAt:'b'+p.best+'_'+(p.bestAtt||999);
  r.forEach((p,k)=>{
    if(!p.done && p.best<=0){ p.rank='–'; p.pts=0; return; }
    const first = r.findIndex(q=>key(q)===key(p));
    p.rank=first+1; p.pts=PLACE_PTS[first]??0;
  });
  return r;
}
function rankOf(i){ return ranking().find(p=>p.i===i); }
function roundPts(rk){ const s={A:0,B:0}; rk.forEach(p=>s[p.team]+=p.pts); return s; }
function total(t){ return S.results.reduce((s,r)=>s+r[t],0) + (S.adj[t]||0); }
const ord = n => n==='–' ? '–' : n + (['th','st','nd','rd'][(n%100>10&&n%100<14)?0:(n%10<4?n%10:0)]);

/* ---------- avatars ---------- */
function avatar(p, cls){
  const ini = esc((p.name||'?').replace(/[^A-Za-z0-9ÄÖÜäöü]/g,' ').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?');
  return p.avatar ? `<img class="av ${cls||''}" src="${p.avatar}">` : `<div class="av ini ${cls||''}" style="background:${tc(p.team)}">${ini}</div>`;
}
/* ---------- lives: number until last 3, then hearts ---------- */
function livesHTML(p, small){
  if(p.lives>3) return `<div class="lnum"><i>♥</i>${p.lives}</div>`;
  return `<div class="hearts ${p.lives>0?'last':''}">${[0,1,2].map(k=>`<i class="${k<p.lives?'on':''}">♥</i>`).join('')}</div>`;
}
function livesLabel(p){ return p.done ? 'BEATEN' : p.lives<=0 ? 'OUT' : p.lives<=3 ? 'LAST TRIES' : 'ATTEMPTS'; }

/* ---------- league data (Google Sheet, Schedule tab) ----------
   Loading a tab (loadTabRows, parseCSV, norm, lc) comes from js/sheet.js. */
function parseSchedule(rows){
  let H=null; for(let i=0;i<Math.min(rows.length,8);i++){ const h=rows[i].map(lc); if(h.some(x=>x.includes('team a'))&&h.some(x=>x.includes('team b'))){ H={i,h}; break; } }
  if(!H) throw new Error('no Team A / Team B columns in the Schedule tab');
  const idx=(...n)=>{ for(const k of n){ const j=H.h.findIndex(x=>x===k); if(j>=0) return j; } for(const k of n){ const j=H.h.findIndex(x=>x.includes(k)); if(j>=0) return j; } return -1; };
  const c={day:idx('match day'),a:idx('team a'),b:idx('team b'),pa:idx('points a'),pb:idx('points b'),pl:idx('played')};
  const off={day:-2,b:1,pa:4,pb:5,pl:7}; for(const k in off) if(c[k]<0) c[k]=c.a+off[k];
  const num=v=>{ const t=String(v??'').trim().replace(',','.'); return t===''?null:(Number.isFinite(+t)?+t:null); };
  return rows.slice(H.i+1).map(r=>{
    const g=k=>(r[c[k]]??'').trim(); const s1=num(g('pa')), s2=num(g('pb')); const pl=lc(g('pl'));
    const has=s1!==null&&s2!==null, done=pl==='1'||pl==='true'||pl==='yes';
    return {day:g('day'),t1:g('a'),t2:g('b'),s1:has?s1:null,s2:has?s2:null,done:has&&done,live:has&&!done};
  }).filter(m=>m.t1&&m.t2);
}
function computeTable(matches, extra){
  const T=new Map(); const team=n=>{ if(!T.has(n)) T.set(n,{name:n,p:0,pts:0,pf:0,pa:0}); return T.get(n); };
  const add=m=>{ const a=team(m.t1),b=team(m.t2); a.p++;b.p++; a.pf+=m.s1;a.pa+=m.s2;b.pf+=m.s2;b.pa+=m.s1;
    if(m.s1>m.s2) a.pts+=3; else if(m.s2>m.s1) b.pts+=3; else { a.pts++; b.pts++; } };
  (matches||[]).forEach(m=>{ team(m.t1); team(m.t2); if(m.s1!==null && (m.done||m.live)) add(m); });
  if(extra) add(extra);
  const rows=[...T.values()]; rows.forEach(r=>r.diff=r.pf-r.pa);
  rows.sort((x,y)=>y.pts-x.pts||y.diff-x.diff||y.pf-x.pf||x.name.localeCompare(y.name));
  rows.forEach((r,i)=>r.rank=i+1); return rows;
}
function thisMatch(){ // the schedule row of the match on stream
  const a=norm(S.teams.A.name), b=norm(S.teams.B.name);
  const all=(S.matches||[]).filter(m=>[norm(m.t1),norm(m.t2)].sort().join('|')===[a,b].sort().join('|'));
  return all.find(m=>!m.done) || all[all.length-1] || null;
}
function leagueTable(){
  const ms=S.matches||[]; const cur=thisMatch();
  // count the match on stream live (once a round is scored), unless the sheet already has its score
  let extra=null;
  if(cur && S.liveInTable && S.results.length && !cur.done && !cur.live){
    const aFirst = norm(cur.t1)===norm(S.teams.A.name);
    extra={t1:cur.t1,t2:cur.t2,s1:aFirst?total('A'):total('B'),s2:aFirst?total('B'):total('A')};
  }
  return {base:computeTable(ms), cur:computeTable(ms,extra), live:!!extra || !!(cur&&cur.live)};
}
function teamSide(name){ const n=norm(name); return n===norm(S.teams.A.name)?'A':n===norm(S.teams.B.name)?'B':null; }

function sideHTML(bars){
  const v=S.side;
  let head='', body='';
  if(v==='standings'){
    const t=leagueTable();
    head=`STANDINGS<small>${t.live?'<span class="live"></span>LIVE TABLE':'LEAGUE TABLE'}</small>`;
    body = !S.matches ? `<div class="st-note">No sheet data yet</div>` :
      `<div class="st-head"><span>#</span><span>TEAM</span><span>PTS</span></div>`+
      t.cur.slice(0,20).map(r=>{ const sd=teamSide(r.name); const b=t.base.find(x=>x.name===r.name);
        const mv = t.live && b && b.rank!==r.rank ? (b.rank>r.rank?'<span class="mv up">▲</span>':'<span class="mv dn">▼</span>') : '';
        return `<div class="st-row ${sd?'hot':''}" style="${sd?`--tc:${tc(sd)}`:''}"><span class="r">${r.rank}</span><span class="n">${esc(r.name)}${mv}</span><span class="p">${r.pts}</span></div>`; }).join('');
  } else if(v==='matchday'){
    const cur=thisMatch(); const day = cur ? cur.day : '';
    const list=(S.matches||[]).filter(m=>m.day===day);
    head=`MATCH DAY ${esc(day||'–')}<small>RESULTS</small>`;
    body = !list.length ? `<div class="st-note">No sheet data yet</div>` : list.map(m=>{
      const me = cur && m===cur;
      let s1=m.s1, s2=m.s2, live=m.live;
      if(me && m.s1===null && S.results.length){ const aF=norm(m.t1)===norm(S.teams.A.name); s1=aF?total('A'):total('B'); s2=aF?total('B'):total('A'); live=true; }
      const w1 = s1!==null&&!live ? (s1>s2?'w':s1<s2?'l':'') : '', w2 = s1!==null&&!live ? (s2>s1?'w':s2<s1?'l':'') : '';
      return `<div class="md ${me?'cur':''} ${live&&!me?'live':''}">${me?'<small>ON STREAM</small>':live?'<small>LIVE</small>':''}
        <div class="${w1}"><span>${esc(m.t1)}</span><span>${s1??'–'}</span></div>
        <div class="${w2}"><span>${esc(m.t2)}</span><span>${s2??'–'}</span></div></div>`; }).join('');
  } else {
    head=`<span class="live"></span>LEVEL RACE`;
    body=`<div class="race"><div class="bars">${bars}</div></div>`;
  }
  return `<div class="rail ${v==='off'?'off':''}" data-view="${v}"><h4>${head}</h4><div class="body">${body}</div></div>`;
}

/* ---------- stage markup ---------- */
function stageHTML(preview){
  const A=S.teams.A, B=S.teams.B;
  const rk = ranking(); const live = roundPts(rk);
  const chips = t => Array.from({length:S.rounds},(_,k)=>{
    const r=S.results[k]; if(r){ const o=t==='A'?'B':'A'; return `<i class="${r[t]>r[o]?'w':''}">R${k+1}<b>${r[t]}</b></i>`; }
    return `<i class="${k===S.round-1&&!S.roundOver?'cur':''}">R${k+1}<b>–</b></i>`;
  }).join('');
  const frames = S.players.map((p,i)=>{ const me=rk.find(x=>x.i===i); return `
    <div class="frame p${i} ${p.lives<=0&&!p.done?'out':''} ${p.done?'won':''}" style="--tc:${tc(p.team)}">
      ${preview?'<div class="fill"></div>':''}
      <div class="border"></div>
      <div class="plate">
        <div class="pbar"><i style="width:${p.cur}%"></i><u style="left:calc(${p.best}% - 1px)"></u></div>
        <div class="tbar"></div>
        <div class="place r${me.rank}"><em>${ord(me.rank)}</em><span>+${me.pts} PTS</span></div>
        <div class="avw">${avatar(p)}</div>
        <div class="nm"><small>${esc(S.teams[p.team].tag)}</small><b>${esc(p.name)}</b></div>
        <div class="st">
          <div class="lv">${livesHTML(p)}<span>${livesLabel(p)}</span></div>
          <div class="cur"><em>${p.cur}%</em><span>LIVE</span></div>
          <div class="best"><em>${p.best}%</em><span>BEST</span></div>
        </div>
      </div>
    </div>`}).join('');
  const bars = S.players.map(p=>`
    <div class="vb ${p.lives<=0&&!p.done?'out':''} ${p.done?'won':''}" style="--tc:${tc(p.team)}">
      <em>${p.done?'✓':p.best+'%'}</em>
      <div class="track"><i style="height:${p.cur}%"></i><u style="bottom:calc(${p.best}% - 1px)"></u></div>
      ${avatar(p,'sm')}
      <div class="vl">${livesHTML(p)}</div>
    </div>`).join('');
  const L=S.level;
  return `
  <div class="stage ${preview?'preview':''}">
    ${frames}
    ${sideHTML(bars)}
    <div class="bug" style="--a:${A.color};--b:${B.color}">
      <div class="side l">
        <div class="tn"><b>${esc(A.tag)}</b><small>${esc(A.name)}</small><div class="rchips">${chips('A')}</div></div>
        ${A.logo?`<img class="logo" src="${A.logo}">`:''}
      </div>
      <div class="mid">
        <div class="score"><span id="sa">${total('A')}</span><i></i><span id="sb">${total('B')}</span></div>
        <div class="info">LEVEL RACE · <b>ROUND ${S.round}/${S.rounds}</b> · ${L.revealed && L.name ? `<b class="lv">${esc(L.name)}</b>${String(L.aredl).trim()?` · AREDL #${esc(String(L.aredl).trim().replace('#',''))}`:''}` : 'LEVEL ???'}</div>
      </div>
      <div class="side r">
        ${B.logo?`<img class="logo" src="${B.logo}">`:''}
        <div class="tn"><b>${esc(B.tag)}</b><small>${esc(B.name)}</small><div class="rchips">${chips('B')}</div></div>
      </div>
    </div>
    ${boardHTML(rk, live)}
    <div class="fx"></div>
  </div>`;
}

function boardHTML(rk, live){
  const A=S.teams.A,B=S.teams.B;
  const res = S.results.map((r,k)=>`R${k+1}: <b>${A.tag} ${r.A} – ${r.B} ${B.tag}</b>`).join('');
  return `<div class="board ${S.board?'on':''}" style="--a:${A.color};--b:${B.color}">
    <div class="card">
      <div class="hd">
        <div class="t">${A.logo?`<img src="${A.logo}">`:''}<b>${esc(A.name)}</b></div>
        <div class="sc"><span style="color:${A.color}">${total('A')}</span><small>PTS</small><span style="color:${B.color}">${total('B')}</span></div>
        <div class="t r"><b>${esc(B.name)}</b>${B.logo?`<img src="${B.logo}">`:''}</div>
      </div>
      <div class="sub">${res || ''}<span>ROUND ${S.round} LIVE: <b>${A.tag} ${live.A} – ${live.B} ${B.tag}</b></span></div>
      <table>
        <tr><th class="l" style="padding-left:30px">PLACE</th><th class="l">PLAYER</th><th>BEST</th><th>LIVE</th><th>ATTEMPTS LEFT</th><th>POINTS</th></tr>
        ${rk.map(p=>`<tr style="--tc:${tc(p.team)}">
          <td class="rk r${p.rank}">${ord(p.rank)}</td>
          <td class="pl l"><i></i>${avatar(p,'md')}${esc(p.name)}<small>${esc(S.teams[p.team].tag)}</small>${p.done?'<span class="tag w">BEATEN</span>':p.lives<=0?'<span class="tag o">OUT</span>':''}</td>
          <td><span class="minibar"><i style="width:${p.best}%"></i></span>${p.best}%</td>
          <td>${p.cur}%</td>
          <td>${p.done?'–':p.lives}</td>
          <td class="pts">+${p.pts}</td></tr>`).join('')}
      </table>
      <div class="foot">1ST 5 · 2ND 3 · 3RD 2 · 4TH 0 &nbsp;|&nbsp; WIN 3 · DRAW 1 · LOSS 0 LEAGUE POINTS</div>
    </div>
  </div>`;
}

/* ---------- popups ---------- */
const TOAST_POS = [[32,124],[32,600],[869,124],[869,600]];
function playEvents(root){
  const fx = root.querySelector('.fx'); if(!fx) return;
  for(const ev of S.events){
    if(ev.id <= seen) continue;
    seen = ev.id;
    if(Date.now() - ev.t > 8000 + (ev.delay||0)) continue;
    if(ev.kind==='dead'){ setTimeout(()=>flashDead(ev.p),30); continue; }
    const wait = Math.max(0, (ev.delay||0) - (Date.now()-ev.t));
    setTimeout(()=>showEvent(ev), wait);
  }
}
function showEvent(ev){
  const fx = document.querySelector(MODE==='overlay' ? '#app .fx' : '.prev .fx'); if(!fx) return;
  const el = document.createElement('div');
  if(ev.kind==='toast'){
    const p = S.players[ev.p]; const [x,y] = TOAST_POS[ev.p];
    el.className = 'toast ' + (ev.style||'');
    el.style.cssText = `left:${x}px;top:${y}px;--tc:${tc(p.team)}`;
    el.innerHTML = `<div class="ic">${esc(ev.icon||'★')}</div><div class="tx"><small>${esc(ev.title)}</small><b>${esc(ev.text)}</b></div>`;
  } else {
    el.className = 'banner';
    el.style.setProperty('--tc', ev.color || 'var(--gold)');
    const pl = ev.p!=null ? S.players[ev.p] : null;
    el.innerHTML = `<div class="in">${pl?avatar(pl,'lg'):''}<small>${esc(ev.title)}</small><b>${esc(ev.text)}</b>${ev.sub?`<span>${esc(ev.sub)}</span>`:''}</div>`;
  }
  fx.appendChild(el);
  const dur = ev.kind==='toast' ? 3800 : 4200;
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 450); }, dur);
}
function push(ev){ ev.id = (S.events.length ? S.events[S.events.length-1].id : 0) + 1; ev.t = Date.now(); S.events.push(ev); }
function flashDead(i){
  document.querySelectorAll('.frame.p'+i).forEach(f=>{f.classList.remove('dead');void f.offsetWidth;f.classList.add('dead');});
}

/* ---------- actions ---------- */
function freshPlayers(){ S.players.forEach(p=>Object.assign(p,{cur:0,best:0,bestAtt:0,att:0,lives:S.lives,done:false,doneAt:0})); }
const act = {
  death(i, pct){
    const p=S.players[i]; if(p.lives<=0 || p.done || S.roundOver) return;
    pct=clamp(Math.round(pct),0,99);
    p.att++; p.cur=pct; p.lives--;
    const nb = pct>p.best; if(nb){ p.best=pct; p.bestAtt=p.att; }
    if(p.lives===0) push({kind:'toast',p:i,title:'NO ATTEMPTS LEFT',text:`${p.name} · Best ${p.best}%`,icon:'✕',style:'red'});
    else if(nb) push({kind:'toast',p:i,title:'NEW BEST',text:`${p.name} · ${pct}%`,icon:'▲'});
    else if(p.lives===3) push({kind:'toast',p:i,title:'LAST 3 ATTEMPTS',text:`${p.name} · Best ${p.best}%`,icon:'♥',style:'red'});
    else if(pct>=Math.max(80,p.best-3)) push({kind:'toast',p:i,title:'SO CLOSE',text:`${p.name} died at ${pct}%`,icon:'✕',style:'red'});
    push({kind:'dead',p:i}); save();
  },
  complete(i){
    const p=S.players[i]; if(p.lives<=0 || p.done || S.roundOver) return;
    const first = !S.players.some(x=>x.done);
    p.att++; p.lives--; p.cur=100; p.best=100; p.bestAtt=p.att; p.done=true; p.doneAt=Date.now();
    const t=S.teams[p.team];
    push({kind:'banner',p:i,title: first?'LEVEL BEATEN · 1ST PLACE':'LEVEL BEATEN',text:p.name.toUpperCase(),
      sub:`${t.name} · Attempt ${p.att}${first?' · +5 points':''}`,color:t.color});
    save();
  },
  reveal(){
    S.level.revealed = !S.level.revealed;
    if(S.level.revealed){
      const a=String(S.level.aredl).trim();
      push({kind:'banner',title:`ROUND ${S.round} · THE LEVEL IS`,text:S.level.name.toUpperCase(),sub:`by ${S.level.creator}${a?` · AREDL #${a.replace('#','')}`:''}`});
    }
    save();
  },
  endRound(){
    if(S.roundOver) return;
    const rk=ranking(), pts=roundPts(rk), A=S.teams.A, B=S.teams.B;
    S.results.push({A:pts.A,B:pts.B,level:S.level.name,order:rk.map(p=>({name:p.name,team:p.team,pts:p.pts}))});
    S.roundOver=true;
    const w = pts.A>pts.B?'A':pts.B>pts.A?'B':null;
    push({kind:'banner',title:`ROUND ${S.round} RESULT`,text: w? S.teams[w].name.toUpperCase() : 'TIE',
      sub:`${A.tag} ${pts.A} – ${pts.B} ${B.tag} · 1st place: ${rk[0].name}`, color: w? S.teams[w].color : 'var(--silver)'});
    if(S.results.length>=S.rounds){
      const ta=total('A'), tb=total('B'); const mw = ta>tb?'A':tb>ta?'B':null;
      push({kind:'banner',delay:5200,title: mw?'MATCH WIN · +3 LEAGUE POINTS':'DRAW · +1 LEAGUE POINT EACH',
        text: mw? S.teams[mw].name.toUpperCase() : 'DRAW', sub:`${A.tag} ${ta} – ${tb} ${B.tag}`, color: mw? S.teams[mw].color : 'var(--silver)'});
    }
    save();
  },
  nextRound(){
    if(!S.roundOver || S.results.length>=S.rounds) return;
    S.round = S.results.length+1; S.roundOver=false; S.level.revealed=false;
    S.level.name=''; S.level.creator=''; S.level.aredl='';
    freshPlayers(); save();
  },
  resetMatch(){ S.results=[]; S.round=1; S.roundOver=false; S.adj={A:0,B:0}; freshPlayers(); save(); },
  resetRound(){ freshPlayers(); S.roundOver=false; if(S.results.length>=S.round) S.results=S.results.slice(0,S.round-1); save(); },
  adj(t,d){ S.adj[t]=(S.adj[t]||0)+d; save(); },
  life(i,d){ const p=S.players[i]; p.lives=clamp(p.lives+d,0,99); save(); },
  board(){ S.board=!S.board; save(); },
  side(v){ S.side = S.side===v && v!=='race' ? 'race' : v; save(); },
  sheet(){ loadSheet(); },
  liveTable(){ S.liveInTable=!S.liveInTable; save(); },
  custom(title,text){ push({kind:'banner',title,text}); save(); }
};

/* ---------- render ---------- */
function render(){
  if(MODE==='overlay') patchStage(document.getElementById('app'), false);
  else {
    if(!document.querySelector('.ctl')) buildControl();
    patchStage(document.querySelector('.prev'), true);
    syncControl();
  }
}
function patchStage(root, preview){
  let fx = root.querySelector('.fx');
  const keep = fx ? [...fx.children] : [];
  const oldA = root.querySelector('#sa')?.textContent, oldB = root.querySelector('#sb')?.textContent;
  const ANIM='.pbar i,.pbar u,.vb .track i,.vb .track u';
  const old=[...root.querySelectorAll(ANIM)].map(e=>e.getAttribute('style'));
  const wasBoard=root.querySelector('.board')?.classList.contains('on');
  const oldView=root.querySelector('.rail')?.dataset.view;
  root.querySelectorAll('.stage').forEach(s=>s.remove());
  root.insertAdjacentHTML('beforeend', stageHTML(preview));
  const now=[...root.querySelectorAll(ANIM)];
  if(old.length===now.length){
    const target=now.map(e=>e.getAttribute('style'));
    now.forEach((e,i)=>e.setAttribute('style',old[i])); void root.offsetWidth;
    requestAnimationFrame(()=>now.forEach((e,i)=>e.setAttribute('style',target[i])));
  }
  const sd=root.querySelector('.rail'); if(sd && oldView!==undefined && oldView!==S.side && S.side!=='off') sd.classList.add('enter');
  const bd=root.querySelector('.board');
  if(bd && S.board && !wasBoard){ bd.classList.remove('on'); void bd.offsetWidth; requestAnimationFrame(()=>bd.classList.add('on')); }
  fx = root.querySelector('.fx'); keep.forEach(k=>fx.appendChild(k));
  if(oldA!==undefined && oldA!==String(total('A'))) root.querySelector('#sa').classList.add('bump');
  if(oldB!==undefined && oldB!==String(total('B'))) root.querySelector('#sb').classList.add('bump');
  if(MODE==='overlay') fitOverlay(root); else fitPreview();
  playEvents(root);
}
function fitOverlay(root){
  const st=root.querySelector('.stage'); const s=Math.min(innerWidth/1920, innerHeight/1080);
  st.style.transform = s===1?'':`scale(${s})`; st.style.transformOrigin='0 0';
}
function fitPreview(){
  const pv=document.querySelector('.prev'); if(!pv) return;
  pv.querySelector('.stage').style.transform=`scale(${pv.clientWidth/1920})`;
}
addEventListener('resize', ()=> MODE==='overlay'? fitOverlay(document.getElementById('app')) : fitPreview());

/* ---------- control panel ---------- */
function buildControl(){
  const app=document.getElementById('app');
  app.innerHTML = `
  <div class="ctl">
    <h1>GD LEAGUE · CONTROL<small>Level race format · changes show up in the overlay instantly</small></h1>
    <div class="col">
      <div class="box"><h3>MATCH</h3>
        <div class="row"><input data-k="league" placeholder="League name" style="flex:1"></div>
        <div class="row"><span class="mini">Rounds</span><input type="number" min="1" max="5" data-k="rounds" style="width:60px">
          <span class="mini" style="margin-left:auto">Attempts per round</span><input type="number" min="1" max="99" data-k="lives" style="width:64px"></div>
        <div class="ptsinfo">Places 1/2/3/4 = 5/3/2/0 points. 1st = first to beat the level, otherwise best %. Tie on best %: fewer attempts wins.</div>
      </div>

      <div class="box"><h3>LEVEL <span class="mini">shows “???” until revealed</span></h3>
        <div class="row"><input data-k="level.name" placeholder="Level" style="flex:1.3"><input data-k="level.creator" placeholder="Creator" style="flex:1"></div>
        <div class="row"><span class="mini">AREDL #</span><input data-k="level.aredl" placeholder="e.g. 120" style="width:90px">
          <button id="bReveal" class="gold" data-a="reveal" style="margin-left:auto">Reveal level</button></div>
      </div>

      <div class="box"><h3>TEAMS & SCORE</h3>
        ${['A','B'].map(t=>`
        <div class="teamrow">
          <input type="color" data-k="teams.${t}.color">
          <input data-k="teams.${t}.tag" placeholder="TAG">
          <input data-k="teams.${t}.name" placeholder="Team name">
          <label class="logobtn" data-logo="${t}" title="Upload logo"><input class="logoin" type="file" accept="image/*" data-logoin="${t}"></label>
        </div>`).join('')}
        <div class="scorectl">
          <button data-a="adj" data-t="A" data-d="-1">−</button><b id="cA"></b><button data-a="adj" data-t="A" data-d="1">+</button>
          <span class="mini" style="width:70px;text-align:center">correction</span>
          <button data-a="adj" data-t="B" data-d="-1">−</button><b id="cB"></b><button data-a="adj" data-t="B" data-d="1">+</button>
        </div>
      </div>

      <div class="box"><h3>PLAYERS <span class="mini">type death % → Enter</span></h3>
        <div id="pls"></div>
      </div>

      <div class="box"><h3>ROUND</h3>
        <div class="status" id="status"></div>
        <div class="row">
          <button class="pri" data-a="endRound" id="bEnd">End & score round</button>
          <button data-a="nextRound" id="bNext">Next round →</button>
        </div>
        <div class="row">
          <button data-a="resetRound">Restart round</button>
          <button class="red" data-a="resetMatch">Reset whole match</button>
        </div>
      </div>

      <div class="box"><h3>RIGHT SIDEBAR <span class="mini">slides in on the right</span></h3>
        <div class="row">
          <button data-a="sv" data-v="race" id="sv-race">Level race <kbd>R</kbd></button>
          <button data-a="sv" data-v="standings" id="sv-standings">Standings <kbd>T</kbd></button>
          <button data-a="sv" data-v="matchday" id="sv-matchday">Match day <kbd>M</kbd></button>
          <button data-a="sv" data-v="off" id="sv-off">Hide <kbd>H</kbd></button>
        </div>
        <div class="row"><input data-k="sheetUrl" placeholder="League Google Sheet link" style="flex:1"><button data-a="sheet">Reload</button></div>
        <div class="status" id="sheetStatus" style="margin:8px 0 0"></div>
        <div class="row"><label class="mini" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="liveT"> Count this match live in the standings (after round 1)</label></div>
      </div>

      <div class="box"><h3>POP-UPS & BOARD</h3>
        <div class="row"><button id="bBoard" data-a="board">Stats Board <kbd>S</kbd></button></div>
        <div class="row"><input id="cT" placeholder="Small title (e.g. BREAKING)" style="flex:1"></div>
        <div class="row"><input id="cX" placeholder="Big text" style="flex:1"><button class="gold" id="cGo">Show banner</button></div>
      </div>
    </div>

    <div class="prevwrap">
      <div class="prev"></div>
      <div class="hint">
        <b style="color:var(--txt)">OBS:</b> add this file as a <b>Browser source</b> (1920×1080, “Local file”) → shows only the transparent overlay.
        Control panel as a <i>Custom browser dock</i> with <code>file:///PATH/overlay.html#control</code>.
        Put gameplay sources <b>below</b> the overlay. Shortcuts: <kbd>S</kbd> stats board · <kbd>R</kbd>/<kbd>T</kbd>/<kbd>M</kbd>/<kbd>H</kbd> sidebar · <kbd>1</kbd>–<kbd>4</kbd> player % field.
      </div>
    </div>
  </div>`;

  app.querySelectorAll('[data-k]').forEach(el=>{
    el.addEventListener('input',()=>{
      const path=el.dataset.k.split('.'); let o=S; for(let i=0;i<path.length-1;i++) o=o[path[i]];
      let v = el.type==='number' ? (+el.value||0) : el.value;
      if(el.dataset.k==='lives') v=clamp(v,1,99);
      if(el.dataset.k==='rounds') v=clamp(v,1,5);
      o[path.at(-1)] = v; save();
    });
  });
  app.addEventListener('click',e=>{
    const b=e.target.closest('[data-a]'); if(!b) return;
    const a=b.dataset.a, i=+b.dataset.i;
    if(a==='adj') act.adj(b.dataset.t, +b.dataset.d);
    else if(a==='complete') act.complete(i);
    else if(a==='death'){ const inp=app.querySelector('#pc'+i); if(inp.value!==''){ act.death(i, +inp.value); inp.value=''; } }
    else if(a==='avdel'){ delete S.players[i].avatar; save(); }
    else if(a==='life') act.life(i, +b.dataset.d);
    else if(a==='sv') act.side(b.dataset.v);
    else if(act[a]) act[a]();
  });
  app.querySelector('#cGo').onclick=()=>{ const x=app.querySelector('#cX').value.trim(); if(!x) return;
    act.custom(app.querySelector('#cT').value.trim()||'ANNOUNCEMENT', x); };
  app.querySelectorAll('[data-logoin]').forEach(inp=>inp.addEventListener('change',()=>{
    const f=inp.files[0]; if(!f) return; const t=inp.dataset.logoin;
    const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); const s=Math.min(1,200/Math.max(img.width,img.height));
      c.width=img.width*s; c.height=img.height*s; c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      S.teams[t].logo=c.toDataURL('image/png'); save(); };
    img.src=URL.createObjectURL(f);
  }));
  addEventListener('keydown',e=>{
    if(e.target.matches('input,select')) return;
    if(e.key==='s'||e.key==='S') act.board();
    const sv={r:'race',t:'standings',m:'matchday',h:'off'}[e.key.toLowerCase()]; if(sv) act.side(sv);
    if('1234'.includes(e.key)){ e.preventDefault(); app.querySelector('#pc'+(+e.key-1))?.focus(); }
  });

  const box=document.getElementById('pls');
  box.innerHTML = S.players.map((p,i)=>`
    <div class="pl" data-pl="${i}">
      <div class="row">
        <label class="avbtn" data-av="${i}" title="Upload profile picture"><input class="logoin" type="file" accept="image/*" data-avin="${i}"></label>
        <input class="n" data-pk="name" data-i="${i}" placeholder="Name">
        <select data-pk="team" data-i="${i}"><option value="A"></option><option value="B"></option></select>
        <button data-a="avdel" data-i="${i}" title="Remove profile picture">✕</button>
      </div>
      <div class="row">
        <input id="pc${i}" type="number" min="0" max="99" placeholder="Death %">
        <button data-a="death" data-i="${i}">✕ Died</button>
        <button class="gold" data-a="complete" data-i="${i}">Beaten ✓</button>
        <span class="mini" style="margin-left:auto">Best <input type="number" data-pk="best" data-i="${i}" style="width:54px"></span>
      </div>
      <div class="row"><span class="mini">Attempts left</span><button data-a="life" data-i="${i}" data-d="-1">−</button>
        <b class="lvc" style="font:700 16px var(--disp);min-width:64px;text-align:center"></b>
        <button data-a="life" data-i="${i}" data-d="1">+</button><span class="mini rkc" style="margin-left:auto"></span></div>
    </div>`).join('');
  box.querySelectorAll('[data-avin]').forEach(inp=>inp.addEventListener('change',()=>{
    const f=inp.files[0]; if(!f) return; const i=+inp.dataset.avin;
    const img=new Image(); img.onload=()=>{
      // square crop from the center, 160px
      const c=document.createElement('canvas'); c.width=c.height=160; const sz=Math.min(img.width,img.height);
      c.getContext('2d').drawImage(img,(img.width-sz)/2,(img.height-sz)/2,sz,sz,0,0,160,160);
      S.players[i].avatar=c.toDataURL('image/jpeg',0.85); save(); inp.value=''; };
    img.src=URL.createObjectURL(f);
  }));
  box.querySelectorAll('[data-pk]').forEach(el=>{
    el.addEventListener('input',()=>{ const p=S.players[+el.dataset.i]; const k=el.dataset.pk;
      p[k] = k==='best' ? clamp(+el.value||0,0,100) : el.value; save(); });
  });
  box.querySelectorAll('input[id^=pc]').forEach(el=>el.addEventListener('keydown',e=>{
    if(e.key==='Enter' && el.value!==''){ act.death(+el.id.slice(2), +el.value); el.value=''; }
  }));
  app.querySelector('#liveT').addEventListener('change',()=>act.liveTable());
  app.querySelector('[data-k=sheetUrl]').addEventListener('change',()=>loadSheet());
  loadSheet(); setInterval(loadSheet, 60000);
}

/* the control panel fetches the sheet and shares the result with the overlay */
async function loadSheet(){
  if(!S.sheetUrl){ S.matches=null; S.sheetStatus=''; save(); return; }
  try{
    const ms=parseSchedule(await loadTabRows(S.sheetUrl,(typeof CONFIG !== 'undefined' && CONFIG.divisions[0].tab) || 'Schedule'));
    S.matches=ms; S.sheetStatus='ok:'+ms.length+' matches · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }catch(e){ S.sheetStatus='err:'+(e.message||'could not load'); }
  save();
}

function syncControl(){
  const app=document.getElementById('app');
  app.querySelectorAll('[data-k]').forEach(el=>{
    if(el===document.activeElement) return;
    el.value=el.dataset.k.split('.').reduce((o,k)=>o[k],S);
  });
  ['A','B'].forEach(t=>{
    app.querySelector('#c'+t).textContent=total(t);
    const lb=app.querySelector(`[data-logo="${t}"]`); lb.style.backgroundImage=S.teams[t].logo?`url(${S.teams[t].logo})`:'';
  });
  const rk=ranking();
  S.players.forEach((p,i)=>{
    const row=app.querySelector(`[data-pl="${i}"]`); row.style.setProperty('--tc',tc(p.team));
    row.querySelectorAll('[data-pk]').forEach(el=>{ if(el!==document.activeElement) el.value=p[el.dataset.pk]; });
    const sel=row.querySelector('select'); sel.options[0].text=S.teams.A.tag; sel.options[1].text=S.teams.B.tag;
    const ab=row.querySelector('.avbtn'); ab.style.backgroundImage=p.avatar?`url(${p.avatar})`:''; ab.classList.toggle('has',!!p.avatar);
    row.querySelector('[data-a=avdel]').style.display=p.avatar?'':'none';
    row.querySelector('.lvc').innerHTML = p.done?'<span style="color:var(--gold)">BEATEN</span>':p.lives<=0?'<span style="color:var(--red)">OUT</span>':'<span style="color:var(--red)">♥</span> '+p.lives;
    const me=rk.find(x=>x.i===i); row.querySelector('.rkc').textContent= me.rank==='–' ? 'no progress yet' : `currently ${ord(me.rank)} · +${me.pts}`;
  });
  const pts=roundPts(rk), A=S.teams.A, B=S.teams.B;
  const allDone = S.players.every(p=>p.done||p.lives<=0) || S.players.some(p=>p.done);
  app.querySelector('#status').innerHTML =
    `Round <b>${S.round}/${S.rounds}</b> · ${S.roundOver?'<b>scored</b>':'running'} · Live: <b>${A.tag} ${pts.A} – ${pts.B} ${B.tag}</b><br>`+
    (S.results.length? S.results.map((r,k)=>`R${k+1} (${esc(r.level)}): ${A.tag} ${r.A} – ${r.B} ${B.tag}`).join(' · ') : 'No round scored yet') +
    (!S.roundOver && allDone ? '<br><b style="color:var(--gold)">→ round can be scored</b>' : '');
  app.querySelector('#bEnd').disabled = S.roundOver;
  app.querySelector('#bNext').disabled = !S.roundOver || S.results.length>=S.rounds;
  const rv=app.querySelector('#bReveal'); rv.textContent = S.level.revealed?'Hide level':'Reveal level';
  app.querySelector('#bBoard').classList.toggle('on',S.board);
  ['race','standings','matchday','off'].forEach(v=>app.querySelector('#sv-'+v).classList.toggle('on',S.side===v));
  app.querySelector('#liveT').checked=S.liveInTable;
  const ss=app.querySelector('#sheetStatus'), st=S.sheetStatus||'', cm=thisMatch();
  ss.innerHTML = !S.sheetUrl ? 'No sheet linked.' : st.startsWith('ok:') ? `Loaded <b>${esc(st.slice(3))}</b>` :
    st.startsWith('err:') ? (IN_PREVIEW ? 'This preview can’t load data from Google – it works in OBS.' : `Could not load the sheet (${esc(st.slice(4))})${S.matches?' – showing the last loaded data':''}.`) : 'Loading…';
  if(S.matches && !cm) ss.innerHTML += `<br>“${esc(S.teams.A.name)}” vs “${esc(S.teams.B.name)}” is not in the schedule – use the exact team names from the sheet.`;
  else if(cm) ss.innerHTML += `<br>This match: match day ${esc(cm.day)}.`;
}

render();
document.fonts && document.fonts.ready.then(()=>render());
