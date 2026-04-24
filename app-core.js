/* BrandWatch Dashboard - Core */
const S={user:null,mentions:[],brand:null,range:"7d",page:1,ps:10,chartType:"bar",section:"overview",search:"",filter:"all",sort:"latest"};
let trendChart=null,donutChart=null,liveInterval=null;

async function init(){
  try{
    const r=await fetch("/api/auth/me");
    if(!r.ok)return location.href="/login";
    const d=await r.json();S.user=d.user;
    const n=document.getElementById("user-name"),a=document.getElementById("user-avatar");
    if(n)n.textContent=S.user.name||S.user.email;
    if(a)a.textContent=(S.user.name||S.user.email)[0].toUpperCase();
    await loadBrands();await loadAllData();setupNav();setupListeners();
  }catch(e){location.href="/login";}
}

async function loadBrands(){
  try{
    const r=await fetch("/api/brands"),d=await r.json(),sel=document.getElementById("brand-select");
    if(d.brands&&sel){
      sel.innerHTML=d.brands.map(b=>`<option value="${b.brand_name}">${b.brand_name}</option>`).join("");
      if(!S.brand&&d.brands.length)S.brand=d.brands[0].brand_name;
      if(S.brand)sel.value=S.brand;
    }
  }catch(e){console.error(e);}
}

async function loadAllData(){
  try{
    const r=await fetch(`/api/mentions?brand=${encodeURIComponent(S.brand||"")}&limit=500`);
    const d=await r.json();S.mentions=d.mentions||[];
  }catch(e){S.mentions=[];}
  renderAll();
}

function getFiltered(){
  const now=Date.now();
  const ms=S.range==="24h"?864e5:S.range==="7d"?6048e5:2592e6;
  return S.mentions.filter(m=>{
    const t=m.timestamp||new Date(m.published_at).getTime();
    if(now-t>ms)return false;
    if(S.search&&!m.text.toLowerCase().includes(S.search))return false;
    if(S.filter!=="all"&&m.sentimentLabel!==S.filter)return false;
    return true;
  });
}

function renderAll(){
  const f=getFiltered();
  renderKPIs(f);renderCharts(f);renderEmotions();renderPlatforms(f);
  renderMentions(f);loadCrisis();loadCompetitors();loadTrends();
}

function renderKPIs(f){
  const el=document.getElementById("kpi-cards");if(!el)return;
  const t=f.length,p=f.filter(m=>m.sentimentLabel==="positive").length;
  const n=f.filter(m=>m.sentimentLabel==="negative").length;
  const reach=f.reduce((a,m)=>a+(m.reach||0),0);
  const pp=t?Math.round(p/t*100):0;
  const crisis=f.filter(m=>m.crisis_flag).length;
  el.innerHTML=`
    <div class="kpi-card glass glow slide-in"><span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Mentions</span><h2 class="text-2xl font-black text-white mt-1">${t.toLocaleString()}</h2><p class="text-[10px] text-indigo-400 font-bold mt-1">${S.range} window</p></div>
    <div class="kpi-card glass slide-in"><span class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Positive Pulse</span><h2 class="text-2xl font-black text-white mt-1">${pp}%</h2><p class="text-[10px] text-emerald-400 font-bold mt-1">${p} mentions</p></div>
    <div class="kpi-card glass slide-in"><span class="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Negative</span><h2 class="text-2xl font-black text-white mt-1">${n}</h2><p class="text-[10px] ${n>5?"text-rose-400":"text-slate-500"} font-bold mt-1">${n>5?"⚠ Action Req":"Stable"}</p></div>
    <div class="kpi-card glass slide-in"><span class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Reach</span><h2 class="text-2xl font-black text-white mt-1">${(reach/1000).toFixed(1)}k</h2><p class="text-[10px] text-slate-500 font-bold mt-1">impressions</p></div>
    <div class="kpi-card glass slide-in"><span class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Crisis Alerts</span><h2 class="text-2xl font-black text-white mt-1">${crisis}</h2><div class="pulse-dot mt-1 ${crisis>0?"bg-rose-500":"bg-emerald-500"}"></div></div>`;
}

function renderCharts(f){
  const ctx1=document.getElementById("trend-chart");if(!ctx1)return;
  if(trendChart)trendChart.destroy();
  const days={};
  f.forEach(m=>{const d=new Date(m.published_at||m.timestamp).toLocaleDateString("en-US",{month:"short",day:"numeric"});if(!days[d])days[d]={p:0,n:0,u:0};if(m.sentimentLabel==="positive")days[d].p++;else if(m.sentimentLabel==="negative")days[d].n++;else days[d].u++;});
  const labels=Object.keys(days).slice(-14);
  const opt={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:"#94A3B8",font:{size:10,weight:"bold"},boxWidth:10,usePointStyle:true}}},scales:{y:{beginAtZero:true,grid:{color:"rgba(255,255,255,0.05)"},ticks:{color:"#64748B",font:{size:10}}},x:{grid:{display:false},ticks:{color:"#64748B",font:{size:10}}}}};
  trendChart=new Chart(ctx1,{type:S.chartType,data:{labels,datasets:[
    {label:"Positive",data:labels.map(l=>days[l]?.p||0),backgroundColor:"rgba(16,185,129,0.7)",borderColor:"#10B981",borderWidth:2,borderRadius:6,tension:.4},
    {label:"Negative",data:labels.map(l=>days[l]?.n||0),backgroundColor:"rgba(244,63,94,0.7)",borderColor:"#F43F5E",borderWidth:2,borderRadius:6,tension:.4},
    {label:"Neutral",data:labels.map(l=>days[l]?.u||0),backgroundColor:"rgba(148,163,184,0.5)",borderColor:"#94A3B8",borderWidth:2,borderRadius:6,tension:.4}
  ]},options:opt});

  const ctx2=document.getElementById("donut-chart");if(!ctx2)return;
  if(donutChart)donutChart.destroy();
  const p=f.filter(m=>m.sentimentLabel==="positive").length;
  const n=f.filter(m=>m.sentimentLabel==="negative").length;
  const u=f.length-p-n;
  donutChart=new Chart(ctx2,{type:"doughnut",data:{labels:["Positive","Neutral","Negative"],datasets:[{data:[p,u,n],backgroundColor:["#10B981","#64748B","#F43F5E"],borderWidth:0,hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false}}}});
  const leg=document.getElementById("dist-legend");
  if(leg){const t=f.length||1;leg.innerHTML=[["Positive",p,"#10B981"],["Neutral",u,"#64748B"],["Negative",n,"#F43F5E"]].map(([l,v,c])=>`<div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style="background:${c}"></div><span class="text-[11px] text-slate-400 font-semibold">${l}</span></div><span class="text-[11px] font-bold text-white">${Math.round(v/t*100)}%</span></div>`).join("");}
}

async function renderEmotions(){
  const el=document.getElementById("emotion-bars");if(!el)return;
  try{
    const r=await fetch(`/api/analytics/emotions?brand=${encodeURIComponent(S.brand||"")}`);
    const d=await r.json();
    const colors={joy:"#10B981",anger:"#F43F5E",fear:"#F59E0B",sadness:"#3B82F6",surprise:"#8B5CF6",disgust:"#EC4899",trust:"#06B6D4",neutral:"#64748B"};
    el.innerHTML=Object.entries(d).filter(([k])=>k!=="neutral").map(([k,v])=>`<div><div class="flex justify-between mb-1"><span class="text-[11px] font-bold text-slate-400 capitalize">${k}</span><span class="text-[11px] font-bold text-white">${v}%</span></div><div class="w-full bg-white/5 rounded-full h-1.5"><div class="emotion-bar rounded-full" style="width:${v}%;background:${colors[k]||"#818CF8"}"></div></div></div>`).join("");
  }catch(e){el.innerHTML='<p class="text-xs text-slate-500">No emotion data</p>';}
}

function renderPlatforms(f){
  const el=document.getElementById("platform-grid");if(!el)return;
  const platforms=["youtube","twitter","reddit","instagram","tiktok","facebook","linkedin","news"];
  const icons={youtube:"▶",twitter:"𝕏",reddit:"◉",instagram:"📷",tiktok:"♪",facebook:"f",linkedin:"in",news:"📰"};
  const stats=platforms.map(p=>{const ms=f.filter(m=>m.channel===p);const c=ms.length;const ps=ms.filter(m=>m.sentimentLabel==="positive").length;return{p,c,ratio:c?Math.round(ps/c*100):0};});
  const mx=Math.max(...stats.map(s=>s.c))||1;
  el.innerHTML=stats.map(s=>{const int=Math.max(0.2,s.c/mx);const col=s.ratio>50?"rgba(16,185,129,":"rgba(244,63,94,";return`<div class="flex flex-col items-center gap-1 cursor-default" title="${s.c} mentions on ${s.p}"><div class="w-full aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-105" style="background:${col}${int});color:${col}1)">${icons[s.p]||"?"}</div><span class="text-[9px] font-bold text-slate-500 uppercase">${s.p.slice(0,4)}</span><span class="text-[10px] font-bold text-white">${s.c}</span></div>`;}).join("");
}

function renderMentions(f){
  const el=document.getElementById("mentions-list");if(!el)return;
  let sorted=[...f];
  if(S.sort==="impact")sorted.sort((a,b)=>(b.reach||0)-(a.reach||0));
  else if(S.sort==="crisis")sorted.sort((a,b)=>(b.crisis_score||0)-(a.crisis_score||0));
  else sorted.sort((a,b)=>new Date(b.published_at||b.timestamp)-new Date(a.published_at||a.timestamp));
  const total=Math.ceil(sorted.length/S.ps)||1;
  if(S.page>total)S.page=total;
  const paged=sorted.slice((S.page-1)*S.ps,S.page*S.ps);
  const pg=document.getElementById("mentions-pagination");
  if(pg)pg.textContent=`Page ${S.page} of ${total}`;
  if(!paged.length){el.innerHTML='<div class="p-8 text-center text-sm text-slate-500">No mentions found for this filter.</div>';return;}
  el.innerHTML=paged.map((m,i)=>{
    const sc=m.sentimentLabel==="positive"?"badge-pos":m.sentimentLabel==="negative"?"badge-neg":"badge-neu";
    const ico={youtube:"▶",twitter:"𝕏",reddit:"◉",instagram:"📷",tiktok:"♪",facebook:"f",linkedin:"in",news:"📰"}[m.channel]||"●";
    return`<div class="flex gap-3 p-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5" data-idx="${i}" onclick='openDrawer(${JSON.stringify(m).replace(/'/g,"&apos;")})'>
      <div class="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm flex-shrink-0">${ico}</div>
      <div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span class="text-xs font-bold text-white">${m.author||"Unknown"}</span><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${sc} uppercase">${m.sentimentLabel}</span></div>
      <p class="text-xs text-slate-400 line-clamp-2">${m.text}</p>
      <div class="flex gap-3 mt-1.5 text-[10px] font-bold text-slate-600"><span>${m.channel}</span><span>•</span><span>${new Date(m.published_at||m.timestamp).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span><span>•</span><span>${(m.reach||0).toLocaleString()} reach</span></div></div></div>`;
  }).join("");
}
