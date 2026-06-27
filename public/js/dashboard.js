const selectedMonths = new Set();
const selectedDistricts = new Set();
function chip(label, value, group){
  return `<button type="button" class="filter-chip" data-group="${group}" data-value="${value}">${label}</button>`;
}
function refreshChipUI(){
  $$('#monthChips .filter-chip').forEach(el=>el.classList.toggle('active', selectedMonths.has(el.dataset.value)));
  $$('#districtChips .filter-chip').forEach(el=>el.classList.toggle('active', selectedDistricts.has(el.dataset.value)));
}
async function loadMeta(){
  const meta = await api('/api/meta');
  const months = meta.months.length ? meta.months : [1,2,3,4,5,6];
  $('#monthChips').innerHTML = months.map(m=>chip(`${m}月`, String(m), 'month')).join('');
  $('#districtChips').innerHTML = meta.districts.map(d=>chip(d, d, 'district')).join('');
  $('#timePeriod').innerHTML = '<option value="">全部時段</option>' + meta.timePeriods.map(t=>`<option>${t}</option>`).join('');
  $$('.filter-chip').forEach(el=>el.addEventListener('click', ()=>{
    const set = el.dataset.group === 'month' ? selectedMonths : selectedDistricts;
    set.has(el.dataset.value) ? set.delete(el.dataset.value) : set.add(el.dataset.value);
    refreshChipUI();
  }));
}
function queryString(){
  const p=new URLSearchParams();
  if(selectedMonths.size) p.set('month',[...selectedMonths].join(','));
  if(selectedDistricts.size) p.set('district',[...selectedDistricts].join(','));
  ['timePeriod','keyword'].forEach(id=>{const v=$('#'+id)?.value?.trim(); if(v) p.set(id,v)});
  return p.toString();
}
async function loadDashboard(){
  const qs=queryString();
  const {data}=await api('/api/stats'+(qs?'?'+qs:''));
  $('#progressRate').style.width = `${Math.min(100,data.projectProgress.progressRate*100)}%`;
  $('#kpis').innerHTML = `
    <div class="kpi" style="--accent:#12a85d"><div class="label">年度目標 / 已完成</div><div class="value">${fmt(data.projectProgress.completed)} / ${fmt(data.projectProgress.goal)}</div><div class="sub">達成率 ${pct(data.projectProgress.progressRate)}｜待執行 ${fmt(data.projectProgress.remaining)} 場</div></div>
    <div class="kpi" style="--accent:#0075ff"><div class="label">查詢範圍場次</div><div class="value">${fmt(data.total.sessions)}</div><div class="sub">資料筆數 ${fmt(data.queryRecordCount)}｜監測時數 ${fmt(data.total.monitorHours)}</div></div>
    <div class="kpi" style="--accent:#ff8a00"><div class="label">告發 / 通知到檢</div><div class="value">${fmt(data.total.citationCount)} / ${fmt(data.total.inspectionCount)}</div><div class="sub">告發率 ${pct(data.total.citationRate)}｜通檢率 ${pct(data.total.inspectionRate)}</div></div>
    <div class="kpi" style="--accent:#6f4be6"><div class="label">KPI 成效</div><div class="value">${Number(data.total.kpi||0).toFixed(2)}</div><div class="sub">成案件數 / 查詢範圍場次</div></div>`;
  $('#map').innerHTML = renderMiniMap(data.recent);
  $('#monthly').innerHTML = barList(data.monthly,'caseCount',12);
  $('#districts').innerHTML = barList(data.districts,'caseCount',12);
  $('#times').innerHTML = barList(data.timePeriods,'caseCount',6);
  $('#plates').innerHTML = barList(data.plates.map(p=>({name:p.plateNo,caseCount:p.maxDbOver})), 'caseCount', 8);
  $('#recordsBody').innerHTML = data.recent.map(r=>`<tr><td>${r.date||''}</td><td>${r.sessionNo||''}</td><td>${r.district||''}</td><td>${r.location||r.road||''}</td><td>${r.timePeriod||''}</td><td>${r.machineNo||''}</td><td>${r.plateNo||'-'}</td><td>${Number(r.dbOver||0).toFixed(1)}</td><td>${fmt(r.citationCount)}</td><td>${fmt(r.inspectionCount)}</td><td>${Number(((Number(r.citationCount||0)+Number(r.inspectionCount||0))||0)).toFixed(0)}</td></tr>`).join('');
  $('#updatedAt').textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-TW') : '';
}
function closeFilter(){ $('#filterPanel')?.classList.remove('open'); $('#filterBackdrop')?.classList.remove('show'); }
window.addEventListener('DOMContentLoaded', async()=>{
  $('#app').insertAdjacentHTML('afterbegin', header('成果查詢系統','即時進度・月份統計・行政區統計・時段統計・車號追蹤'));
  $('#app').insertAdjacentHTML('beforeend', footer());
  await loadMeta(); await loadDashboard();
  $('#filterForm').addEventListener('submit', e=>{e.preventDefault(); loadDashboard(); closeFilter();});
  $('#clearFilters').addEventListener('click', ()=>{selectedMonths.clear(); selectedDistricts.clear(); $$('#filterForm select,#filterForm input').forEach(el=>el.value=''); refreshChipUI(); loadDashboard();});
  $('#quickAll')?.addEventListener('click', ()=>{$('#clearFilters').click();});
  $('#openFilter')?.addEventListener('click', ()=>{$('#filterPanel').classList.add('open'); $('#filterBackdrop').classList.add('show');});
  $('#closeFilter')?.addEventListener('click', closeFilter); $('#filterBackdrop')?.addEventListener('click', closeFilter);
});
