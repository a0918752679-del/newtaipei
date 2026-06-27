async function checkLoad(){
  try{ const data=await api('/api/admin/store'); renderAdmin(data.store); $('#login').style.display='none'; $('#panel').style.display='block'; }
  catch{ $('#login').style.display='block'; $('#panel').style.display='none'; }
}
function renderAdmin(store){
  $('#settingsGoal').value = store.settings?.annualGoal || 490;
  $('#counts').innerHTML = `<div class="kpi-grid"><div class="kpi"><div class="label">成果資料</div><div class="value">${fmt(store.records.length)}</div></div><div class="kpi"><div class="label">外勤回報</div><div class="value">${fmt(store.fieldReports.length)}</div></div><div class="kpi"><div class="label">更新時間</div><div class="value" style="font-size:24px">${new Date(store.updatedAt).toLocaleString('zh-TW')}</div></div><div class="kpi"><div class="label">年度目標</div><div class="value">${fmt(store.settings?.annualGoal||490)}</div></div></div>`;
  $('#recordPreview').innerHTML = store.records.slice(-20).reverse().map(r=>`<tr><td>${r.date}</td><td>${r.sessionNo}</td><td>${r.district}</td><td>${r.location}</td><td>${r.plateNo||'-'}</td><td>${r.citationCount}</td><td>${r.inspectionCount}</td></tr>`).join('');
}
window.addEventListener('DOMContentLoaded',()=>{
  $('#app').insertAdjacentHTML('afterbegin', header('後端管理系統','資料匯入・總表匯出・年度目標設定・LINE Rich Menu 設定'));
  $('#app').insertAdjacentHTML('beforeend', footer());
  checkLoad();
  $('#loginForm').addEventListener('submit',async e=>{e.preventDefault(); try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#password').value})}); await checkLoad();}catch(err){alert(err.message)}});
  $('#logout').addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST',body:'{}'}); location.reload();});
  $('#settingsForm').addEventListener('submit',async e=>{e.preventDefault(); await api('/api/admin/settings',{method:'POST',body:JSON.stringify({annualGoal:$('#settingsGoal').value})}); await checkLoad(); alert('已更新年度目標');});
  $('#importForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const res=await fetch('/api/admin/import',{method:'POST',body:fd}); const data=await res.json(); if(!res.ok) return alert(data.message||'匯入失敗'); alert(`匯入完成：${data.count}筆`); await checkLoad();});
  $('#reset').addEventListener('click',async()=>{if(confirm('確認還原範例資料？現有資料會被覆蓋。')){await api('/api/admin/reset',{method:'DELETE'}); await checkLoad();}});

  $('#setupRichMenu').addEventListener('click', async()=>{
    if(!confirm('確認建立並設為 LINE 官方帳號的預設圖文選單？')) return;
    $('#richMenuResult').textContent='正在呼叫 LINE API 建立 Rich Menu...';
    try{
      const data=await api('/api/admin/line/rich-menu/setup',{method:'POST',body:'{}'});
      $('#richMenuResult').innerHTML=`✅ ${data.message}<br>Rich Menu ID：${data.richMenuId}<br>成果查詢：${data.spec.areas[0].action.uri}<br>外勤回報：${data.spec.areas[1].action.uri}`;
    }catch(err){
      $('#richMenuResult').textContent='❌ 建立失敗：'+err.message;
    }
  });
  $('#richMenuStatus').addEventListener('click', async()=>{
    $('#richMenuResult').textContent='正在檢查 LINE Rich Menu 狀態...';
    try{
      const data=await api('/api/admin/line/rich-menu/status');
      $('#richMenuResult').innerHTML=`Token：${data.hasToken?'已設定':'未設定'}<br>預設 Rich Menu：${data.defaultRichMenuId || '尚未設定'}<br>既有 Rich Menu 數量：${data.richMenus.length}<br>成果查詢：${data.dashboardUrl}<br>外勤回報：${data.fieldReportUrl}`;
    }catch(err){
      $('#richMenuResult').textContent='❌ 查詢失敗：'+err.message;
    }
  });

  $('#downloadRichSpec').addEventListener('click',async()=>{const data=await api('/api/line/rich-menu-spec'); const blob=new Blob([JSON.stringify(data.spec,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='line-rich-menu.json'; a.click();});
});
