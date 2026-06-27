window.addEventListener('DOMContentLoaded', async()=>{
  $('#app').insertAdjacentHTML('afterbegin', header('外勤人員回報平台','場次架設・設備校正・撤收紀錄・異常回報'));
  $('#app').insertAdjacentHTML('beforeend', footer());
  const meta=await api('/api/meta');
  $('#district').innerHTML = '<option value="">請選擇</option>' + meta.districts.map(d=>`<option>${d}</option>`).join('');
  $('#date').value = new Date().toISOString().slice(0,10);
  $('#form').addEventListener('submit', async e=>{
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target).entries());
    const res=await api('/api/field-reports',{method:'POST',body:JSON.stringify(form)});
    $('#result').innerHTML = `<div class="notice">已完成回報：${res.report.reportType}｜${res.report.district}｜${res.report.sessionNo}</div>`;
    e.target.reset(); $('#date').value = new Date().toISOString().slice(0,10);
  });
  $('#gps').addEventListener('click',()=>{
    if(!navigator.geolocation) return alert('此裝置不支援定位');
    navigator.geolocation.getCurrentPosition(pos=>{ $('#lat').value=pos.coords.latitude.toFixed(6); $('#lng').value=pos.coords.longitude.toFixed(6); },err=>alert(err.message));
  });
});
