import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEED_PATH = path.join(__dirname, 'data', 'seed-data.json');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Wayne0118';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(24).toString('hex');
const ANNUAL_GOAL = Number(process.env.ANNUAL_GOAL || 490);
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_PATH)) {
  fs.copyFileSync(SEED_PATH, STORE_PATH);
}

const upload = multer({ dest: path.join(DATA_DIR, 'uploads'), limits: { fileSize: 25 * 1024 * 1024 } });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

app.use(express.json({ limit: '8mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const sessions = new Map();

function readStore() {
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const data = JSON.parse(raw);
  data.records ||= [];
  data.fieldReports ||= [];
  data.settings ||= {};
  return data;
}

function writeStore(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').filter(Boolean).map(part => {
    const idx = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, idx).trim()), decodeURIComponent(part.slice(idx + 1).trim())];
  }));
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.noise_admin_token;
  if (token && sessions.has(token)) return next();
  return res.status(401).json({ ok: false, message: '未登入或登入逾時' });
}

function number(v, fallback = 0) {
  const n = Number(String(v ?? '').replace(/[,，%]/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function norm(s) { return String(s ?? '').trim(); }
function monthFromDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d.getMonth() + 1 : number(String(dateStr).match(/\d{1,2}/)?.[0], 0);
}
function recordDayKey(r) { return `${r.date || ''}_${r.sessionNo || r.id || ''}`; }

function filterRecords(records, query = {}) {
  const month = number(query.month, 0);
  const district = norm(query.district);
  const timePeriod = norm(query.timePeriod);
  const plate = norm(query.plate || query.plateNo).toUpperCase();
  const keyword = norm(query.keyword).toLowerCase();
  return records.filter(r => {
    if (month && Number(r.month || monthFromDate(r.date)) !== month) return false;
    if (district && district !== '全部' && r.district !== district) return false;
    if (timePeriod && timePeriod !== '全部' && r.timePeriod !== timePeriod) return false;
    if (plate && !norm(r.plateNo).toUpperCase().includes(plate)) return false;
    if (keyword) {
      const hay = [r.district, r.road, r.location, r.sessionNo, r.machineNo, r.plateNo, r.notes].join(' ').toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });
}

function groupBy(records, key, reducer) {
  const map = new Map();
  for (const r of records) {
    const k = key(r) || '未分類';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([name, rows]) => reducer(name, rows));
}

function summarizeRows(rows) {
  const sessions = new Set(rows.map(recordDayKey)).size;
  const detectCount = rows.reduce((a, r) => a + number(r.detectCount), 0);
  const exceedCount = rows.reduce((a, r) => a + number(r.exceedCount), 0);
  const citationCount = rows.reduce((a, r) => a + number(r.citationCount), 0);
  const inspectionCount = rows.reduce((a, r) => a + number(r.inspectionCount), 0);
  const monitorHours = rows.reduce((a, r) => a + number(r.monitorHours), 0);
  const caseCount = citationCount + inspectionCount;
  return {
    sessions, detectCount, exceedCount, citationCount, inspectionCount, caseCount, monitorHours,
    citationRate: exceedCount ? citationCount / exceedCount : 0,
    inspectionRate: exceedCount ? inspectionCount / exceedCount : 0,
    exceedRate: detectCount ? exceedCount / detectCount : 0,
    kpi: sessions ? caseCount / sessions : 0
  };
}

function computeStats(query = {}) {
  const store = readStore();
  const records = filterRecords(store.records, query);
  const base = summarizeRows(records);
  const completed = new Set(store.records.map(recordDayKey)).size;
  const goal = number(store.settings?.annualGoal, ANNUAL_GOAL);
  const remaining = Math.max(goal - completed, 0);
  const progressRate = goal ? completed / goal : 0;
  const monthly = groupBy(records, r => `${Number(r.month || monthFromDate(r.date))}月`, (name, rows) => ({ name, ...summarizeRows(rows) }))
    .sort((a, b) => number(a.name) - number(b.name));
  const districts = groupBy(records, r => r.district, (name, rows) => ({ name, ...summarizeRows(rows) }))
    .sort((a, b) => b.caseCount - a.caseCount);
  const timePeriods = groupBy(records, r => r.timePeriod, (name, rows) => ({ name, ...summarizeRows(rows) }))
    .sort((a, b) => b.caseCount - a.caseCount);
  const plates = groupBy(records.filter(r => r.plateNo), r => norm(r.plateNo).toUpperCase(), (plateNo, rows) => {
    const s = summarizeRows(rows);
    return {
      plateNo,
      records: rows.length,
      repeatOffender: rows.length >= 2 || s.caseCount >= 2,
      maxDbOver: Math.max(...rows.map(r => number(r.dbOver, 0))),
      maxDbMeasured: Math.max(...rows.map(r => number(r.dbMeasured, 0))),
      lastDate: rows.map(r => r.date).sort().at(-1),
      districts: [...new Set(rows.map(r => r.district).filter(Boolean))].join('、'),
      ...s
    };
  }).sort((a, b) => b.maxDbOver - a.maxDbOver || b.records - a.records);
  return { updatedAt: store.updatedAt, goal, completed, remaining, progressRate, filters: query, total: base, monthly, districts, timePeriods, plates, recent: records.slice(-30).reverse() };
}

function firstOf(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return '';
}

function normalizeImportedRow(row, index) {
  const dateRaw = firstOf(row, ['date', '日期', '執行日期', '監測日期']);
  let date = norm(dateRaw);
  if (typeof dateRaw === 'number') {
    const parsed = xlsx.SSF.parse_date_code(dateRaw);
    if (parsed) date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const d = new Date(date);
  const month = Number.isFinite(d.getTime()) ? d.getMonth() + 1 : number(firstOf(row, ['month', '月份']), 0);
  const standard = number(firstOf(row, ['noiseStandard', '噪音標準', '標準值']), 86);
  const measured = number(firstOf(row, ['dbMeasured', '量測分貝', '最高分貝', '噪音值']), 0);
  return {
    id: norm(firstOf(row, ['id', 'ID'])) || `I${Date.now()}_${index}`,
    date: date || new Date().toISOString().slice(0, 10),
    year: number(firstOf(row, ['year', '年度']), 115),
    month: month || new Date().getMonth() + 1,
    district: norm(firstOf(row, ['district', '行政區', '區域'])) || '未分類',
    road: norm(firstOf(row, ['road', '路段', '道路'])) || '',
    location: norm(firstOf(row, ['location', '地點', '執勤地點', '設置地址'])) || '',
    timePeriod: norm(firstOf(row, ['timePeriod', '時段'])) || '未分類',
    startTime: norm(firstOf(row, ['startTime', '開始時間'])) || '',
    endTime: norm(firstOf(row, ['endTime', '結束時間'])) || '',
    sessionNo: norm(firstOf(row, ['sessionNo', '場次', '執行場次'])) || '',
    machineNo: norm(firstOf(row, ['machineNo', '機台編號', '機號'])) || '',
    plateNo: norm(firstOf(row, ['plateNo', '車牌號碼', '車號', '車牌'])).toUpperCase(),
    noiseStandard: standard,
    dbMeasured: measured,
    dbOver: number(firstOf(row, ['dbOver', '超標分貝', '超標值']), Math.max(0, measured - standard)),
    detectCount: number(firstOf(row, ['detectCount', '辨識量', '車流辨識量', '偵測件數']), 0),
    exceedCount: number(firstOf(row, ['exceedCount', '超標件數', '超標數']), 0),
    citationCount: number(firstOf(row, ['citationCount', '告發件數', '告發數']), 0),
    inspectionCount: number(firstOf(row, ['inspectionCount', '通知到檢件數', '通檢件數', '通檢數']), 0),
    monitorHours: number(firstOf(row, ['monitorHours', '監測時數', '監測小時']), 4),
    lat: number(firstOf(row, ['lat', '緯度']), 0),
    lng: number(firstOf(row, ['lng', '經度']), 0),
    status: norm(firstOf(row, ['status', '狀態'])) || '已完成',
    source: 'import',
    notes: norm(firstOf(row, ['notes', '備註', '說明']))
  };
}

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'newtaipei-noise-control-system' }));
app.get('/api/meta', (_req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    updatedAt: store.updatedAt,
    baseUrl: PUBLIC_BASE_URL,
    settings: { ...store.settings, annualGoal: number(store.settings?.annualGoal, ANNUAL_GOAL) },
    districts: [...new Set(store.records.map(r => r.district).filter(Boolean))].sort(),
    months: [...new Set(store.records.map(r => Number(r.month || monthFromDate(r.date))).filter(Boolean))].sort((a,b)=>a-b),
    timePeriods: [...new Set(store.records.map(r => r.timePeriod).filter(Boolean))]
  });
});
app.get('/api/stats', (req, res) => res.json({ ok: true, data: computeStats(req.query) }));
app.get('/api/records', (req, res) => {
  const store = readStore();
  const rows = filterRecords(store.records, req.query).slice(0, number(req.query.limit, 500));
  res.json({ ok: true, rows });
});
app.get('/api/plate/:plateNo', (req, res) => {
  const plate = norm(req.params.plateNo).toUpperCase();
  const stats = computeStats({ plate });
  res.json({ ok: true, plateNo: plate, profile: stats.plates.find(p => p.plateNo === plate) || null, records: stats.recent });
});

app.post('/api/field-reports', (req, res) => {
  const store = readStore();
  const body = req.body || {};
  const report = {
    id: `F${Date.now()}`,
    createdAt: new Date().toISOString(),
    date: norm(body.date) || new Date().toISOString().slice(0, 10),
    district: norm(body.district),
    location: norm(body.location),
    sessionNo: norm(body.sessionNo),
    machineNo: norm(body.machineNo),
    reportType: norm(body.reportType) || '外勤回報',
    speedLimit: number(body.speedLimit, 50),
    noiseStandard: number(body.noiseStandard, 86),
    calibrationValue: number(body.calibrationValue, 0),
    lat: number(body.lat, 0),
    lng: number(body.lng, 0),
    staff: '',
    notes: norm(body.notes)
  };
  store.fieldReports.push(report);
  if (body.syncToRecord === 'on' || body.syncToRecord === true) {
    store.records.push({
      id: `FR${Date.now()}`,
      date: report.date,
      year: new Date(report.date).getFullYear() - 1911,
      month: new Date(report.date).getMonth() + 1,
      district: report.district,
      road: '',
      location: report.location,
      timePeriod: norm(body.timePeriod) || '未分類',
      startTime: norm(body.startTime),
      endTime: norm(body.endTime),
      sessionNo: report.sessionNo,
      machineNo: report.machineNo,
      plateNo: norm(body.plateNo).toUpperCase(),
      noiseStandard: report.noiseStandard,
      dbMeasured: number(body.dbMeasured, 0),
      dbOver: Math.max(0, number(body.dbMeasured, 0) - report.noiseStandard),
      detectCount: number(body.detectCount, 0),
      exceedCount: number(body.exceedCount, 0),
      citationCount: number(body.citationCount, 0),
      inspectionCount: number(body.inspectionCount, 0),
      monitorHours: number(body.monitorHours, 4),
      lat: report.lat,
      lng: report.lng,
      status: '外勤回報',
      source: 'field',
      notes: report.notes
    });
  }
  writeStore(store);
  res.json({ ok: true, report });
});

app.post('/api/admin/login', (req, res) => {
  if (norm(req.body?.password) !== ADMIN_PASSWORD) return res.status(403).json({ ok: false, message: '密碼錯誤' });
  const token = crypto.createHmac('sha256', SESSION_SECRET).update(`${Date.now()}-${Math.random()}`).digest('hex');
  sessions.set(token, { createdAt: Date.now() });
  res.setHeader('Set-Cookie', `noise_admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = parseCookies(req.headers.cookie || '').noise_admin_token;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'noise_admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/store', requireAdmin, (_req, res) => res.json({ ok: true, store: readStore() }));
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const store = readStore();
  store.settings = { ...store.settings, ...req.body };
  if (req.body.annualGoal) store.settings.annualGoal = number(req.body.annualGoal, ANNUAL_GOAL);
  writeStore(store);
  res.json({ ok: true, settings: store.settings });
});
app.post('/api/admin/import', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: '未收到檔案' });
  const mode = req.body.mode || 'append';
  const workbook = xlsx.readFile(req.file.path, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const imported = rows.map(normalizeImportedRow).filter(r => r.date || r.district || r.location);
  const store = readStore();
  if (mode === 'replace') store.records = imported;
  else store.records.push(...imported);
  writeStore(store);
  fs.unlink(req.file.path, () => {});
  res.json({ ok: true, count: imported.length, mode });
});
app.delete('/api/admin/reset', requireAdmin, (_req, res) => {
  fs.copyFileSync(SEED_PATH, STORE_PATH);
  res.json({ ok: true, message: '已還原範例資料' });
});
app.get('/api/admin/export.xlsx', requireAdmin, (_req, res) => {
  const store = readStore();
  const stats = computeStats({});
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(store.records), '成果資料');
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(store.fieldReports), '外勤回報');
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet([
    { 指標: '年度目標', 數值: stats.goal },
    { 指標: '已完成場次', 數值: stats.completed },
    { 指標: '待執行場次', 數值: stats.remaining },
    { 指標: '達成率', 數值: `${(stats.progressRate*100).toFixed(1)}%` },
    { 指標: '告發件數', 數值: stats.total.citationCount },
    { 指標: '通知到檢件數', 數值: stats.total.inspectionCount },
    { 指標: 'KPI成效', 數值: stats.total.kpi.toFixed(2) }
  ]), 'KPI摘要');
  const out = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="newtaipei-noise-master.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(out);
});

function verifyLineSignature(req) {
  if (!LINE_SECRET) return true;
  const signature = req.headers['x-line-signature'];
  if (!signature || !req.rawBody) return false;
  const hmac = crypto.createHmac('sha256', LINE_SECRET).update(req.rawBody).digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getLineMenuFlex() {
  const links = [
    ['成果查詢', `${PUBLIC_BASE_URL}/dashboard.html`, '#0068ff'],
    ['外勤回報', `${PUBLIC_BASE_URL}/field-report.html`, '#00a884'],
    ['車號追蹤', `${PUBLIC_BASE_URL}/plate.html`, '#ff8a00'],
    ['KPI報表', `${PUBLIC_BASE_URL}/dashboard.html#kpi`, '#6f4be6'],
    ['管理後台', `${PUBLIC_BASE_URL}/admin.html`, '#0d4e94'],
    ['操作說明', `${PUBLIC_BASE_URL}/line-bot.html`, '#54606f']
  ];
  return {
    type: 'flex',
    altText: '新北市打擊噪音車管理計畫操作選單',
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', contents: [
        { type: 'text', text: '新北市打擊噪音車管理計畫', weight: 'bold', size: 'lg', color: '#ffffff' },
        { type: 'text', text: '成果查詢・外勤回報・KPI管理', size: 'sm', color: '#d9ecff' }
      ], backgroundColor: '#063a82' },
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: links.map(([label, uri, color]) => ({
        type: 'button', style: 'primary', color, height: 'sm', action: { type: 'uri', label, uri }
      })) }
    }
  };
}

function parseLineCommand(text = '') {
  const t = text.trim();
  const monthMatch = t.match(/(\d{1,2})\s*月/);
  const districtMatch = t.match(/([\u4e00-\u9fa5]{2,3}區)/);
  const plateMatch = t.match(/(?:車牌|車號|plate)\s*[:：]?\s*([A-Z0-9-]{3,12})/i) || t.match(/\b([A-Z]{2,4}-?\d{3,4})\b/i);
  return {
    wantsMenu: /選單|menu|平台|功能/.test(t),
    wantsProgress: /進度|達成|剩餘/.test(t),
    wantsStats: /成效|統計|KPI|告發|通檢|執行/.test(t) || Boolean(monthMatch || districtMatch),
    month: monthMatch ? Number(monthMatch[1]) : undefined,
    district: districtMatch ? districtMatch[1] : undefined,
    plate: plateMatch ? plateMatch[1].toUpperCase().replace(/([A-Z]+)(\d+)/, '$1-$2') : undefined
  };
}

function formatStatsForLine(query) {
  const stats = computeStats(query);
  const label = [query.month ? `${query.month}月` : '', query.district || '', query.plate ? `車號 ${query.plate}` : ''].filter(Boolean).join('｜') || '全計畫';
  const plateLine = query.plate && stats.plates[0] ? `\n車號追蹤：${stats.plates[0].plateNo}\n累犯判定：${stats.plates[0].repeatOffender ? '是' : '否'}｜最高超標：${stats.plates[0].maxDbOver.toFixed(1)} dB` : '';
  return `【${label} 執行成效】\n已完成：${stats.completed}/${stats.goal}場（${(stats.progressRate*100).toFixed(1)}%）\n查詢筆數：${stats.recent.length}筆\n執行場次：${stats.total.sessions}場\n車流辨識：${stats.total.detectCount.toLocaleString()}件\n超標件數：${stats.total.exceedCount.toLocaleString()}件\n告發件數：${stats.total.citationCount.toLocaleString()}件\n通知到檢：${stats.total.inspectionCount.toLocaleString()}件\n告發率：${(stats.total.citationRate*100).toFixed(1)}%\n通檢率：${(stats.total.inspectionRate*100).toFixed(1)}%\nKPI成效：${stats.total.kpi.toFixed(2)}${plateLine}\n\n開啟平台：${PUBLIC_BASE_URL}/dashboard.html`;
}

async function replyLine(replyToken, messages) {
  if (!LINE_TOKEN || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: Array.isArray(messages) ? messages : [messages] })
  });
}

app.post('/api/line/webhook', async (req, res) => {
  if (!verifyLineSignature(req)) return res.status(401).json({ ok: false, message: 'LINE signature invalid' });
  const events = req.body?.events || [];
  res.json({ ok: true });
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const cmd = parseLineCommand(event.message.text || '');
    try {
      if (cmd.wantsMenu) await replyLine(event.replyToken, getLineMenuFlex());
      else if (cmd.plate) await replyLine(event.replyToken, { type: 'text', text: formatStatsForLine({ plate: cmd.plate }) });
      else if (cmd.wantsStats || cmd.wantsProgress) await replyLine(event.replyToken, { type: 'text', text: formatStatsForLine({ month: cmd.month, district: cmd.district }) });
      else await replyLine(event.replyToken, { type: 'text', text: '可輸入：選單、進度、2月份執行成效、淡水區執行成效、車牌 ABC-1234。' });
    } catch (error) {
      console.error('LINE reply failed', error);
    }
  }
});

app.get('/api/line/rich-menu-spec', (_req, res) => {
  res.json({ ok: true, image: `${PUBLIC_BASE_URL}/assets/line-rich-menu.jpg`, spec: buildRichMenuSpec(PUBLIC_BASE_URL) });
});

function buildRichMenuSpec(base) {
  const W = 2500, H = 1686, header = 280, margin = 70, gap = 34;
  const tw = Math.floor((W - 2*margin - 2*gap) / 3);
  const th = Math.floor((H - header - 2*margin - gap) / 2);
  const urls = ['/dashboard.html','/field-report.html','/plate.html','/dashboard.html#kpi','/admin.html','/line-bot.html'];
  const areas = urls.map((u,i)=>{
    const c=i%3, r=Math.floor(i/3);
    return { bounds:{ x: margin + c*(tw+gap), y: header + margin + r*(th+gap), width: tw, height: th }, action:{ type:'uri', uri: `${base}${u}` } };
  });
  return { size: { width: W, height: H }, selected: true, name: '新北噪音車管理選單', chatBarText: '管理選單', areas };
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: err.message || 'server error' });
});

app.listen(PORT, () => {
  console.log(`New Taipei noise control system running on :${PORT}`);
  console.log(`PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`);
});
