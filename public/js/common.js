const $ = (sel, scope=document) => scope.querySelector(sel);
const $$ = (sel, scope=document) => [...scope.querySelectorAll(sel)];
const fmt = n => Number(n || 0).toLocaleString('zh-TW');
const pct = n => `${(Number(n || 0) * 100).toFixed(1)}%`;
const api = async (url, opts={}) => {
  const res = await fetch(url, { headers: opts.body instanceof FormData ? {} : {'Content-Type':'application/json'}, ...opts });
  if (!res.ok) throw new Error((await res.json().catch(()=>({message:res.statusText}))).message || res.statusText);
  return res.json();
};
function initBottomNav(){
  const nav=document.createElement('nav'); nav.className='mobile-bottom';
  nav.innerHTML=`<a href="/"><b>⌂</b>首頁</a><a href="/dashboard.html"><b>⌕</b>查詢</a><a href="/field-report.html"><b>✚</b>回報</a><a href="/plate.html"><b>車</b>車號</a><a href="/admin.html"><b>⚙</b>後台</a>`;
  document.body.appendChild(nav);
}
function header(title='新北市打擊噪音車管理計畫', sub='LINE BOT 跳轉・成果查詢・外勤回報・KPI管理'){
  return `<header class="hero"><div class="hero-inner"><div class="brand"><div class="brand-badge">NTP</div><div><h1>${title}</h1><div class="subtitle">${sub}</div></div></div><div><div class="logo-line">新北市政府環境保護局</div><div class="top-actions"><a class="btn ghost" href="/line-bot.html">LINE設定</a><a class="btn" href="/admin.html">後端管理</a></div></div></div></header>`;
}
function footer(){return `<footer class="footer"><span>科技執法・精準治理</span><strong>打造宜居新北・守護市民生活品質</strong></footer>`}
function barList(rows, key='caseCount', maxRows=8){
  if(!rows?.length) return '<div class="notice">查無資料</div>';
  const max=Math.max(...rows.map(r=>Number(r[key]||0)),1);
  return rows.slice(0,maxRows).map(r=>`<div class="bar"><div class="bar-name">${r.name||r.plateNo}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,Number(r[key]||0)/max*100)}%"></div></div><div class="bar-val">${fmt(r[key])}</div></div>`).join('');
}
function renderMiniMap(rows=[]){
  const labels=['淡水區','五股區','新莊區','板橋區','中和區','新店區','汐止區','三峽區'];
  const pos=[[31,20],[33,42],[44,55],[50,68],[58,72],[70,76],[77,45],[63,86]];
  const pins=rows.slice(0,18).map((r,i)=>`<span class="pin" title="${r.district} ${r.location||''}" style="left:${20+((i*17)%65)}%;top:${20+((i*23)%58)}%"></span>`).join('');
  const labs=labels.map((l,i)=>`<span class="map-label" style="left:${pos[i][0]}%;top:${pos[i][1]}%">${l}</span>`).join('');
  return `<div class="map-card">${labs}${pins}<div style="position:absolute;left:22px;bottom:20px;color:#d9ecff;font-weight:800">AI熱區、已設點位、建議點位示意圖</div></div>`;
}
async function fillSelects(){
  const meta=(await api('/api/meta')).settings ? await api('/api/meta') : {districts:[],months:[],timePeriods:[]};
  return meta;
}
initBottomNav();
