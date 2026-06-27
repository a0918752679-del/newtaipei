async function loadMeta(){
  const meta = await api('/api/meta');
  $('#district').innerHTML = '<option value="">全部</option>' + meta.districts.map(d=>`<option>${d}</option>`).join('');
  $('#month').innerHTML = '<option value="">全部</option>' + meta.months.map(m=>`<option value="${m}">${m}月</option>`).join('');
  $('#timePeriod').innerHTML = '<option value="">全部</option>' + meta.timePeriods.map(t=>`<option>${t}</option>`).join('');
}
function queryString(){
  const p=new URLSearchParams();
  ['month','district','timePeriod','keyword'].forEach(id=>{const v=$('#'+id)?.value?.trim(); if(v) p.set(id,v)});
  return p.toString();
}
async function loadDashboard(){
  const qs=queryString();
  const {data}=await api('/api/stats'+(qs?'?'+qs:''));
  $('#progressRate').style.width = `${Math.min(100,data.progressRate*100)}%`;
  $('#kpis').innerHTML = `
    <div class="kpi" style="--accent:#12a85d"><div class="label">年度目標 / 已完成</div><div class="value">${fmt(data.completed)} / ${fmt(data.goal)}</div><div class="sub">達成率 ${pct(data.progressRate)}｜待執行 ${fmt(data.remaining)} 場</div></div>
    <div class="kpi" style="--accent:#0075ff"><div class="label">車流辨識 / 超標</div><div class="value">${fmt(data.total.detectCount)}</div><div class="sub">超標 ${fmt(data.total.exceedCount)}｜超標率 ${pct(data.total.exceedRate)}</div></div>
    <div class="kpi" style="--accent:#ff8a00"><div class="label">告發 / 通知到檢</div><div class="value">${fmt(data.total.citationCount)} / ${fmt(data.total.inspectionCount)}</div><div class="sub">告發率 ${pct(data.total.citationRate)}｜通檢率 ${pct(data.total.inspectionRate)}</div></div>
    <div class="kpi" style="--accent:#6f4be6"><div class="label">KPI 成效</div><div class="value">${Number(data.total.kpi||0).toFixed(2)}</div><div class="sub">成案件數 / 執行場次</div></div>`;
  $('#map').innerHTML = renderMiniMap(data.recent);
  $('#monthly').innerHTML = barList(data.monthly,'caseCount',12);
  $('#districts').innerHTML = barList(data.districts,'caseCount',10);
  $('#times').innerHTML = barList(data.timePeriods,'caseCount',6);
  $('#plates').innerHTML = barList(data.plates.map(p=>({name:p.plateNo,caseCount:p.maxDbOver})), 'caseCount', 8);
  $('#recordsBody').innerHTML = data.recent.map(r=>`<tr><td>${r.date||''}</td><td>${r.sessionNo||''}</td><td>${r.district||''}</td><td>${r.location||r.road||''}</td><td>${r.timePeriod||''}</td><td>${r.machineNo||''}</td><td>${r.plateNo||'-'}</td><td>${Number(r.dbOver||0).toFixed(1)}</td><td>${fmt(r.citationCount)}</td><td>${fmt(r.inspectionCount)}</td><td>${Number(((Number(r.citationCount||0)+Number(r.inspectionCount||0))||0)).toFixed(0)}</td></tr>`).join('');
  $('#updatedAt').textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-TW') : '';
}
window.addEventListener('DOMContentLoaded', async()=>{
  $('#app').insertAdjacentHTML('afterbegin', header('成果查詢系統','即時進度・月份統計・行政區統計・時段統計・車號追蹤'));
  $('#app').insertAdjacentHTML('beforeend', footer());
  await loadMeta();
  await loadDashboard();
  $('#filterForm').addEventListener('submit', e=>{e.preventDefault(); loadDashboard();});
  $('#clearFilters').addEventListener('click', ()=>{$$('#filterForm select,#filterForm input').forEach(el=>el.value=''); loadDashboard();});
});
