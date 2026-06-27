async function searchPlate(){
  const plate=$('#plateNo').value.trim().toUpperCase();
  if(!plate) return;
  const data=await api('/api/plate/'+encodeURIComponent(plate));
  const p=data.profile;
  if(!p){ $('#result').innerHTML='<div class="notice">查無該車號紀錄。</div>'; return; }
  $('#result').innerHTML=`<div class="kpi-grid"><div class="kpi" style="--accent:#ff8a00"><div class="label">車號</div><div class="value">${p.plateNo}</div><div class="sub">累犯判定：${p.repeatOffender?'是':'否'}</div></div><div class="kpi" style="--accent:#d93636"><div class="label">最高超標</div><div class="value">${p.maxDbOver.toFixed(1)} dB</div><div class="sub">最高量測 ${p.maxDbMeasured.toFixed(1)} dB</div></div><div class="kpi" style="--accent:#0075ff"><div class="label">關聯案件</div><div class="value">${fmt(p.records)}</div><div class="sub">告發 ${fmt(p.citationCount)}｜通檢 ${fmt(p.inspectionCount)}</div></div><div class="kpi" style="--accent:#12a85d"><div class="label">最近日期</div><div class="value" style="font-size:26px">${p.lastDate||'-'}</div><div class="sub">${p.districts||''}</div></div></div><div class="section"><div class="table-wrap"><table><thead><tr><th>日期</th><th>行政區</th><th>地點</th><th>場次</th><th>機台</th><th>量測</th><th>超標</th><th>告發</th><th>通檢</th></tr></thead><tbody>${data.records.map(r=>`<tr><td>${r.date}</td><td>${r.district}</td><td>${r.location}</td><td>${r.sessionNo}</td><td>${r.machineNo}</td><td>${r.dbMeasured}</td><td>${r.dbOver}</td><td>${r.citationCount}</td><td>${r.inspectionCount}</td></tr>`).join('')}</tbody></table></div></div>`;
}
window.addEventListener('DOMContentLoaded',()=>{
  $('#app').insertAdjacentHTML('afterbegin', header('噪音車個案車號追蹤','累犯辨識・超標分貝・告發與通檢紀錄'));
  $('#app').insertAdjacentHTML('beforeend', footer());
  $('#search').addEventListener('click', searchPlate);
  $('#plateNo').addEventListener('keydown', e=>{ if(e.key==='Enter') searchPlate(); });
});
