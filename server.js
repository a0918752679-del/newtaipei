const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'https://noise115.zeabur.app').replace(/\/$/, '');
const FIELD_REPORT_URL = (process.env.FIELD_REPORT_URL || 'https://out115.zeabur.app').replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Wayne0118';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const upload = multer({ dest: path.join(DATA_DIR, 'uploads') });

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const debugState = { lastEvents: [], lastReply: null, lastSignature: null, errors: [] };
function pushDebug(type, data) {
  const entry = { at: new Date().toISOString(), type, ...data };
  debugState.lastEvents.unshift(entry);
  debugState.lastEvents = debugState.lastEvents.slice(0, 30);
}
function addError(err, data={}) {
  debugState.errors.unshift({ at: new Date().toISOString(), error: String(err && err.stack || err), ...data });
  debugState.errors = debugState.errors.slice(0, 20);
}

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch (e) {
    return { summary:{goal:490,sessions:0,traffic:0,exceed:0,accusation:0,inspection:0,progressRate:0,accusationRate:0,inspectionRate:0,kpi:0}, byMonth:{}, byDistrict:{}, plates:[], plateStats:{}, equipment:[], law:{} };
  }
}
function saveStore(s) { fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8'); }
function pct(a,b){ return b ? Math.round(a/b*1000)/10 : 0; }
function kpi(d){ return d.sessions ? Math.round(((d.accusation||0)+(d.inspection||0))/d.sessions*100)/100 : 0; }
function normalizePlate(t){ return String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function parseMonth(text){ const m=String(text).match(/(1[0-2]|[1-9])\s*月|([一二三四五六七八九十])月|^(1[0-2]|[1-9])$/); if(!m) return null; const map={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10}; return m[1]||m[3]||map[m[2]]; }
function twMoney(n){ return Number(n||0).toLocaleString('zh-TW'); }
function metricBlock(title, value, unit='') { return { type:'box', layout:'vertical', contents:[{type:'text', text:title, size:'xs', color:'#668099'}, {type:'text', text:String(value)+unit, size:'xl', weight:'bold', color:'#003b7a'}], backgroundColor:'#f3f8ff', cornerRadius:'12px', paddingAll:'12px' }; }
function textMessage(text){ return { type:'text', text: String(text).slice(0,4900) }; }
function quick(items){ return { items: items.slice(0,13).map(it=>({ type:'action', action:{ type:'message', label: it.label, text: it.text || it.label } })) }; }
function flex(altText, contents){ return { type:'flex', altText, contents }; }
function bubble(title, bodyContents, buttons=[]) {
  const footerContents = buttons.map(b => ({ type:'button', style:b.style||'primary', color:b.color||'#0066cc', action:b.action || { type:'message', label:b.label, text:b.text || b.label } }));
  return { type:'bubble', size:'mega', header:{ type:'box', layout:'vertical', backgroundColor:'#003b7a', paddingAll:'16px', contents:[{type:'text', text:title, color:'#ffffff', weight:'bold', size:'lg'}] }, body:{ type:'box', layout:'vertical', spacing:'md', contents:bodyContents }, ...(footerContents.length?{footer:{type:'box',layout:'vertical',spacing:'sm',contents:footerContents}}:{}) };
}
function carousel(bubbles){ return { type:'carousel', contents:bubbles.slice(0,10) }; }

function summaryText(d, title='全計畫執行成效') {
  return `【${title}】\n年度目標：${d.sessions || 0}/${d.goal || 490}場（${d.progressRate ?? pct(d.sessions||0,d.goal||490)}%）\n車流辨識：${twMoney(d.traffic)}件\n超標件數：${twMoney(d.exceed)}件\n告發件數：${twMoney(d.accusation)}件\n通知到檢：${twMoney(d.inspection)}件\n告發率：${d.accusationRate ?? pct(d.accusation,d.exceed)}%\n通檢率：${d.inspectionRate ?? pct(d.inspection,d.exceed)}%\nKPI成效：${d.kpi ?? kpi(d)}`;
}
function resultFlex(d, title='全計畫執行成效') {
  return flex(title, bubble(`📊 ${title}`, [
    { type:'text', text:`已完成 ${d.sessions||0}/${d.goal||490} 場｜達成率 ${d.progressRate ?? pct(d.sessions||0,d.goal||490)}%`, size:'md', color:'#003b7a', weight:'bold' },
    { type:'separator' },
    { type:'box', layout:'horizontal', spacing:'sm', contents:[metricBlock('車流辨識', twMoney(d.traffic)), metricBlock('超標件數', twMoney(d.exceed))] },
    { type:'box', layout:'horizontal', spacing:'sm', contents:[metricBlock('告發', twMoney(d.accusation)), metricBlock('通檢', twMoney(d.inspection))] },
    { type:'box', layout:'horizontal', spacing:'sm', contents:[metricBlock('告發率', d.accusationRate ?? pct(d.accusation,d.exceed), '%'), metricBlock('KPI', d.kpi ?? kpi(d))] }
  ], [
    { label:'開啟成果平台', action:{ type:'uri', label:'開啟成果平台', uri:DASHBOARD_URL } },
    { label:'統計查詢', text:'統計查詢', style:'secondary', color:'#1b8a8f' }
  ]));
}

function lawFlex() {
  const card=(title,desc,btn)=>bubble(title,[{type:'text',text:desc,wrap:true,size:'sm',color:'#445'}],[btn]);
  return flex('法規中心', carousel([
    card('📚 最新修法','最高罰鍰提高至3萬6千元；情節重大或一年內再犯，可吊扣牌照。',{label:'修法重點',text:'修法'}),
    card('📖 常用法條','可查詢第11條、第13條、第26條、第28條。直接輸入「法條26」即可。',{label:'法條26',text:'法條26'}),
    card('🔍 修法比較','整理修法原因、修法日期、修法重點，以及舊法與新法差異。',{label:'查看修法',text:'修法'}),
    card('📰 噪音車新聞','整合環境部、噪音車專區、中央社等新聞來源摘要。',{label:'今日新聞',text:'新聞'})
  ]));
}
function lawText(q) {
  if (/26/.test(q)) return '📖 噪音管制法第26條重點\n違反車輛噪音相關規定，依情節裁處罰鍰；最新修法方向提高裁罰強度，最高可至3萬6千元，並強化累犯與重大違規處理。';
  if (/11/.test(q)) return '📖 噪音管制法第11條重點\n管制對象、噪音標準與相關限制依主管機關公告標準辦理；車輛噪音以環境部公告檢測標準與作業規範執行。';
  if (/13/.test(q)) return '📖 噪音管制法第13條重點\n針對疑似噪音車輛，主管機關可通知到指定地點接受檢驗；未依通知辦理者，依規定處理。';
  if (/28/.test(q)) return '📖 噪音管制法第28條重點\n未依主管機關通知檢驗、改善或違反相關義務者，依規定裁處並得要求限期改善。';
  return '可輸入：法條11、法條13、法條26、法條28。';
}
function equipmentStatus(dateStr, years) {
  if (!dateStr) return {label:'未建檔', color:'⚪', days:null, due:'-'};
  const d = new Date(dateStr); if (isNaN(d)) return {label:'日期異常', color:'⚪', days:null, due:'-'};
  const due = new Date(d); due.setFullYear(due.getFullYear()+years);
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.ceil((due-today)/86400000);
  return { due: due.toISOString().slice(0,10), days, color: days < 0 ? '🔴' : days <= 30 ? '🟡' : '🟢', label: days < 0 ? `已逾期${Math.abs(days)}天` : days <= 30 ? `剩${days}天` : `正常｜剩${days}天` };
}
function equipmentFlex(store) {
  const eq = store.equipment || [];
  const cards = eq.slice(0,10).map(e=>{
    const a=equipmentStatus(e.compareDate,2), n=equipmentStatus(e.noiseMeterDate,1), w=equipmentStatus(e.anemometerDate,1);
    const worst=[a,n,w].some(x=>x.color==='🔴')?'🔴':[a,n,w].some(x=>x.color==='🟡')?'🟡':'🟢';
    return bubble(`${worst} ${e.id}`,[
      {type:'text',text:`比測：${a.due}｜${a.label}`,wrap:true,size:'sm'},
      {type:'text',text:`噪音計：${n.due}｜${n.label}`,wrap:true,size:'sm'},
      {type:'text',text:`風速計：${w.due}｜${w.label}`,wrap:true,size:'sm'}
    ], [{label:'設備總覽',text:'設備'}]);
  });
  if (!cards.length) cards.push(bubble('🔧 設備管理',[{type:'text',text:'尚未匯入設備資料。請於後台匯入設備管理 Excel。',wrap:true}],[]));
  return flex('設備管理', carousel(cards));
}
function equipmentSummary(store){
  let normal=0,soon=0,late=0; (store.equipment||[]).forEach(e=>{const s=[equipmentStatus(e.compareDate,2),equipmentStatus(e.noiseMeterDate,1),equipmentStatus(e.anemometerDate,1)]; if(s.some(x=>x.color==='🔴')) late++; else if(s.some(x=>x.color==='🟡')) soon++; else normal++;});
  return `📊 設備總覽\n共${(store.equipment||[]).length}台\n🟢 正常 ${normal}\n🟡 30天內到期 ${soon}\n🔴 已逾期 ${late}`;
}
function statisticsFlex(store) {
  const months=Object.keys(store.byMonth||{}).sort((a,b)=>Number(a)-Number(b));
  const dists=Object.keys(store.byDistrict||{}).sort();
  return flex('統計查詢', bubble('📈 統計查詢',[
    {type:'text',text:'請直接點選月份或行政區，也可輸入「2月份執行成效」、「淡水區執行成效」。',wrap:true,size:'sm'},
    {type:'separator'},
    {type:'text',text:'月份快速查詢',weight:'bold',color:'#003b7a'},
    {type:'box',layout:'horizontal',spacing:'sm',contents:months.slice(0,3).map(m=>({type:'button',style:'secondary',action:{type:'message',label:`${m}月`,text:`${m}月份執行成效`}}))},
    {type:'text',text:'行政區快速查詢',weight:'bold',color:'#003b7a'},
    {type:'box',layout:'horizontal',spacing:'sm',contents:dists.slice(0,3).map(x=>({type:'button',style:'secondary',action:{type:'message',label:x,text:`${x}執行成效`}}))}
  ], [{label:'開啟成果平台',action:{type:'uri',label:'成果平台',uri:DASHBOARD_URL}}]));
}
function plateReply(store, text) {
  const key=normalizePlate(text.replace('車牌',''));
  const foundKey=Object.keys(store.plateStats||{}).find(k=>normalizePlate(k)===key);
  if(!foundKey) return textMessage(`🚗 車號查詢\n未查到 ${text.replace('車牌','').trim()} 的紀錄。可輸入完整車牌，例如：車牌 ABC-1234。`);
  const p=store.plateStats[foundKey];
  return flex('車號追蹤', bubble(`🚗 ${foundKey}`,[
    metricBlock('累計案件', p.count, '件'), metricBlock('最高量測', p.maxDb, 'dB'),
    {type:'text',text:`告發：${p.accusation||0}件｜通檢：${p.inspection||0}件`,wrap:true}
  ], [{label:'查詢其他車牌',text:'車號追蹤'}]));
}
async function replyLine(replyToken, messages) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return { skipped:true };
  const body={ replyToken, messages: Array.isArray(messages)?messages:[messages] };
  debugState.lastReply={ at:new Date().toISOString(), body };
  const res=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`},body:JSON.stringify(body)});
  const txt=await res.text();
  if(!res.ok) throw new Error(`LINE Reply API failed ${res.status}: ${txt}`);
  return { ok:true, response:txt };
}
async function safeReply(replyToken, msg, fallback='感謝您的回覆🙂') {
  try { return await replyLine(replyToken,msg); }
  catch(e) { addError(e,{stage:'reply-flex'}); try { return await replyLine(replyToken,textMessage(fallback)); } catch(e2){ addError(e2,{stage:'reply-fallback'}); } }
}
function routeMessage(text, store) {
  const t=String(text||'').trim();
  if(!t || t==='選單' || t==='目錄') return { msg: flex('主選單', bubble('新北市噪音車管理系統',[{type:'text',text:'請選擇功能，或直接輸入月份、行政區、車牌、設備、法規等關鍵字。',wrap:true}], [{label:'成果查詢',action:{type:'uri',label:'成果查詢',uri:DASHBOARD_URL}},{label:'統計查詢',text:'統計查詢',style:'secondary'},{label:'法規中心',text:'法規中心',style:'secondary'}])), fallback:'主選單' };
  if(t==='成果查詢') return { msg: flex('成果查詢', bubble('📊 成果查詢',[{type:'text',text:'請選擇月份或行政區，或開啟成果平台進行完整篩選。',wrap:true}], [{label:'開啟成果平台',action:{type:'uri',label:'成果平台',uri:DASHBOARD_URL}},{label:'統計查詢',text:'統計查詢',style:'secondary'}])), fallback:'成果查詢：請開啟成果平台或輸入「2月份執行成效」、「淡水區執行成效」。' };
  if(t==='外勤回報') return { msg:textMessage(`外勤回報請開啟：\n${FIELD_REPORT_URL}`), fallback:`外勤回報：${FIELD_REPORT_URL}` };
  if(['進度','KPI報表','KPI','計畫進度'].includes(t)) return { msg:resultFlex(store.summary,'全計畫執行成效'), fallback:summaryText(store.summary) };
  if(t==='統計查詢'||t==='統計選單') return { msg:statisticsFlex(store), fallback:'統計查詢：可輸入「2月份執行成效」或「淡水區執行成效」。' };
  if(t==='法規中心') return { msg:lawFlex(), fallback:'法規中心：可輸入「修法」、「法條26」、「新聞」。' };
  if(t==='修法') return { msg:textMessage('🚨 最新修法重點\n最高罰鍰提高至3萬6千元；情節重大或一年內再犯可吊扣牌照。建議持續追蹤環境部公告與地方裁罰作業配套。') };
  if(t.includes('法條')) return { msg:textMessage(lawText(t)) };
  if(t.includes('新聞')) return { msg:textMessage('📰 噪音車新聞摘要\n1. 環境部：持續強化噪音車管制與科技執法。\n2. 噪音車專區：可查詢檢舉、到檢及相關宣導資訊。\n3. 地方政府：持續推動熱區布點與夜間重點管制。') };
  if(t==='設備管理') return { msg:equipmentFlex(store), fallback:equipmentSummary(store) };
  if(t==='設備') return { msg:textMessage(equipmentSummary(store)) };
  if(t==='車號追蹤'||t==='車牌查詢') return { msg:textMessage('🚗 請輸入車牌，例如：車牌 ABC-1234') };
  if(/車牌|[A-Z]{2,3}[- ]?\d{3,4}|\d{3}[- ]?[A-Z]{2,3}/i.test(t)) return { msg:plateReply(store,t), fallback:'車號查詢結果' };
  const m=parseMonth(t); if(m && (t.includes('月')||t.includes('月份'))) { const d=(store.byMonth||{})[String(m)]; if(d) return { msg: resultFlex({...d, goal:store.summary.goal, progressRate:pct(d.sessions, store.summary.goal)}, `${m}月份執行成效`), fallback: summaryText({...d, goal:store.summary.goal}, `${m}月份執行成效`) }; }
  const dist=Object.keys(store.byDistrict||{}).find(x=>t.includes(x)); if(dist){ const d=store.byDistrict[dist]; return { msg: resultFlex({...d, goal:store.summary.goal, progressRate:pct(d.sessions, store.summary.goal)}, `${dist}執行成效`), fallback: summaryText({...d, goal:store.summary.goal}, `${dist}執行成效`) }; }
  return { msg:textMessage('感謝您的回覆🙂') };
}

app.use('/api/line/webhook', express.raw({type:'application/json'}));
app.use(express.json({limit:'20mb'}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,'public')));

app.get('/healthz',(req,res)=>res.json({ok:true,service:'newtaipei-noise-control-system-v16-ultimate', hasToken:!!LINE_CHANNEL_ACCESS_TOKEN, hasSecret:!!LINE_CHANNEL_SECRET}));
app.get('/api/line/test',(req,res)=>res.json({ok:true,service:'newtaipei-noise-control-system-v16-ultimate',message:'LINE BOT OK',hasToken:!!LINE_CHANNEL_ACCESS_TOKEN,hasSecret:!!LINE_CHANNEL_SECRET}));
app.get('/api/line/debug/latest',(req,res)=>res.json({ok:true,debug:debugState}));
app.get('/api/data/summary',(req,res)=>res.json(loadStore()));
app.get('/api/debug/flex/law',(req,res)=>res.json(lawFlex()));
app.get('/api/debug/flex/equipment',(req,res)=>res.json(equipmentFlex(loadStore())));
app.get('/api/debug/flex/kpi',(req,res)=>res.json(resultFlex(loadStore().summary)));

function richMenuSpec(){
  const W=2500,H=1686,margin=70,gap=35,cardW=Math.floor((W-2*margin-3*gap)/4),cardH=525,startY=380;
  const labels=[['成果查詢',{type:'uri',uri:DASHBOARD_URL}],['外勤回報',{type:'uri',uri:FIELD_REPORT_URL}],['車號追蹤',{type:'message',text:'車號追蹤'}],['KPI報表',{type:'message',text:'KPI報表'}],['統計查詢',{type:'message',text:'統計查詢'}],['法規中心',{type:'message',text:'法規中心'}],['設備管理',{type:'message',text:'設備管理'}],['管理中心',{type:'message',text:'管理功能'}]];
  return { size:{width:W,height:H}, selected:true, name:'新北噪音車V16 Ultimate圖文選單', chatBarText:'管理選單', areas: labels.map(([,action],i)=>{const r=Math.floor(i/4),c=i%4; return {bounds:{x:margin+c*(cardW+gap), y:startY+r*(cardH+gap), width:cardW, height:cardH}, action};}) };
}
app.get('/api/line/rich-menu-spec',(req,res)=>res.json({ok:true,image:`${PUBLIC_BASE_URL}/assets/line-rich-menu.jpg`,spec:richMenuSpec()}));
async function lineApi(pathname, options={}){
  const res=await fetch(`https://api.line.me/v2/bot${pathname}`,{...options,headers:{'Authorization':`Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,...(options.headers||{})}});
  const txt=await res.text(); if(!res.ok) throw new Error(`${pathname} failed ${res.status}: ${txt}`); try{return JSON.parse(txt)}catch{return txt}
}
app.post('/api/admin/richmenu', async (req,res)=>{
  try{
    if(!LINE_CHANNEL_ACCESS_TOKEN) return res.status(400).json({ok:false,error:'LINE_CHANNEL_ACCESS_TOKEN not set'});
    const spec=richMenuSpec();
    const created=await lineApi('/richmenu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)});
    const richMenuId=created.richMenuId;
    const img=fs.readFileSync(path.join(__dirname,'public/assets/line-rich-menu.jpg'));
    await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,{method:'POST',headers:{'Authorization':`Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,'Content-Type':'image/jpeg'},body:img});
    await lineApi(`/user/all/richmenu/${richMenuId}`,{method:'POST'});
    res.json({ok:true,richMenuId});
  }catch(e){ addError(e,{stage:'richmenu'}); res.status(500).json({ok:false,error:String(e.message||e)}); }
});

app.post('/api/line/webhook', async (req,res)=>{
  res.status(200).send('OK');
  try{
    const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(JSON.stringify(req.body||{}));
    const sig=req.get('x-line-signature')||'';
    let valid=true;
    if(LINE_CHANNEL_SECRET){ const expected=crypto.createHmac('sha256',LINE_CHANNEL_SECRET).update(raw).digest('base64'); valid=crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
    debugState.lastSignature={at:new Date().toISOString(),valid,hasSignature:!!sig};
    if(!valid) return addError('Invalid LINE signature');
    const payload=JSON.parse(raw.toString('utf8'));
    const store=loadStore();
    for(const ev of payload.events||[]){
      if(ev.type==='message' && ev.message?.type==='text'){
        const text=ev.message.text;
        pushDebug('message',{userId:ev.source?.userId,text});
        const routed=routeMessage(text,store);
        await safeReply(ev.replyToken,routed.msg,routed.fallback||'感謝您的回覆🙂');
      } else if(ev.type==='follow') {
        await safeReply(ev.replyToken, routeMessage('選單',store).msg, '歡迎加入新北市打擊噪音車管理系統。');
      } else pushDebug(ev.type,{event:ev.type});
    }
  }catch(e){ addError(e,{stage:'webhook'}); }
});

app.post('/api/admin/import-performance', upload.single('file'), (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ok:false,error:'no file'});
    const wb=XLSX.readFile(req.file.path);
    const ws=wb.Sheets['執行成效資料'] || wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    const summary={goal:490,sessions:rows.length,traffic:0,exceed:0,accusation:0,inspection:0};
    const byMonth={}, byDistrict={};
    rows.forEach(r=>{ const traffic=Number(r['辨識車流']||0), exceed=Number(r['超標數']||0), acc=Number(r['告發件數']||0), insp=Number(r['通知到檢件數']||0); summary.traffic+=traffic; summary.exceed+=exceed; summary.accusation+=acc; summary.inspection+=insp; const m=String(r['月份']||'').replace('.0',''); const dist=String(r['行政區']||'').trim(); for(const [obj,key] of [[byMonth,m],[byDistrict,dist]]) if(key){ obj[key]=obj[key]||{sessions:0,traffic:0,exceed:0,accusation:0,inspection:0}; obj[key].sessions++; obj[key].traffic+=traffic; obj[key].exceed+=exceed; obj[key].accusation+=acc; obj[key].inspection+=insp; }});
    summary.progressRate=pct(summary.sessions,summary.goal); summary.accusationRate=pct(summary.accusation,summary.exceed); summary.inspectionRate=pct(summary.inspection,summary.exceed); summary.kpi=kpi(summary);
    for(const o of [byMonth,byDistrict]) Object.values(o).forEach(d=>{d.accusationRate=pct(d.accusation,d.exceed); d.inspectionRate=pct(d.inspection,d.exceed); d.kpi=kpi(d)});
    const store=loadStore(); Object.assign(store,{summary,byMonth,byDistrict}); saveStore(store); res.json({ok:true,summary});
  }catch(e){res.status(500).json({ok:false,error:String(e.message||e)});}
});

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
app.listen(PORT,()=>console.log(`New Taipei V16 Ultimate running on :${PORT}`));
