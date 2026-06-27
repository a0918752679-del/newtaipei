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
const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'https://noise115.zeabur.app').replace(/\/$/, '');
const FIELD_REPORT_URL = (process.env.FIELD_REPORT_URL || 'https://out115.zeabur.app').replace(/\/$/, '');
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
// LINE 原生操作狀態：記錄外勤回報、車號查詢、管理登入等對話流程。
const lineStates = new Map();

function readStore() {
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const data = JSON.parse(raw);
  data.records ||= [];
  data.fieldReports ||= [];
  data.equipment ||= [];
  data.lineUsers ||= [];
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

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'newtaipei-noise-control-system-v10-enterprise' }));
app.get('/api/meta', (_req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    updatedAt: store.updatedAt,
    baseUrl: PUBLIC_BASE_URL,
    dashboardUrl: DASHBOARD_URL,
    fieldReportUrl: FIELD_REPORT_URL,
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

function normalizeDateInput(v) {
  if (!v && v !== 0) return '';
  if (typeof v === 'number') {
    const parsed = xlsx.SSF.parse_date_code(v);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
  }
  const raw = String(v).trim();
  if (!raw) return '';
  const minguo = raw.match(/^(\d{2,3})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (minguo) return `${Number(minguo[1])+1911}-${String(minguo[2]).padStart(2,'0')}-${String(minguo[3]).padStart(2,'0')}`;
  const m = raw.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  return raw;
}

function normalizeEquipmentRow(row, index) {
  const equipmentId = norm(firstOf(row, ['equipmentId','設備','設備編號','機台','機台編號','機號','machineNo','儀器編號'])) || `EQ${String(index+1).padStart(3,'0')}`;
  return {
    equipmentId,
    machineNo: equipmentId,
    name: norm(firstOf(row, ['name','設備名稱','名稱'])) || '聲音照相設備',
    location: norm(firstOf(row, ['location','地點','設置地點','行政區'])) || '',
    centralComparisonDate: normalizeDateInput(firstOf(row, ['centralComparisonDate','比測日期','中央比測','比測','比測驗證日期'])),
    noiseMeterDate: normalizeDateInput(firstOf(row, ['noiseMeterDate','噪音計','噪音計檢定','噪音計檢定日期','檢定日期'])),
    anemometerDate: normalizeDateInput(firstOf(row, ['anemometerDate','風速計','風速計檢定','風速計檢定日期'])),
    owner: norm(firstOf(row, ['owner','保管人','負責人'])) || '',
    notes: norm(firstOf(row, ['notes','備註','說明'])) || '',
    source: 'equipment-import'
  };
}

function defaultEquipmentFromRecords(store) {
  const ids = [...new Set((store.records || []).map(r => r.machineNo).filter(Boolean))].sort();
  const base = ['2025-07-10','2025-12-15','2026-05-18','2026-06-10','2024-12-20','2026-01-05','2026-04-21','2026-06-01'];
  return ids.map((id, i) => ({
    equipmentId: id,
    machineNo: id,
    name: '移動式聲音照相設備',
    location: '',
    centralComparisonDate: base[(i+2)%base.length],
    noiseMeterDate: base[i%base.length],
    anemometerDate: base[(i+1)%base.length],
    owner: '',
    notes: '由成果資料自動建立，可於設備管理表覆蓋。',
    source: 'auto-seed'
  }));
}

function addYears(dateStr, years) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  const todayTW = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  todayTW.setHours(0,0,0,0);
  return Math.ceil((d - todayTW) / 86400000);
}
function dueItem(label, date, years) {
  const dueDate = addYears(date, years);
  const days = dueDate ? daysUntil(dueDate) : null;
  let level = 'unknown', icon = '⚪', status = '未建檔';
  if (days !== null) {
    if (days < 0) { level='red'; icon='🔴'; status=`已逾期${Math.abs(days)}天`; }
    else if (days <= 30) { level='yellow'; icon='🟡'; status=`剩餘${days}天`; }
    else { level='green'; icon='🟢'; status=`剩餘${days}天`; }
  }
  return { label, lastDate: date || '-', dueDate: dueDate || '-', days, level, icon, status, years };
}
function analyzeEquipment(e) {
  const items = [
    dueItem('中央比測', e.centralComparisonDate, 2),
    dueItem('噪音計檢定', e.noiseMeterDate, 1),
    dueItem('風速計檢定', e.anemometerDate, 1)
  ];
  const rank = { red:3, yellow:2, unknown:1, green:0 };
  const worst = items.reduce((a,b)=>rank[b.level]>rank[a.level]?b:a, items[0]);
  return { ...e, items, level: worst.level, icon: worst.icon, status: worst.status, priorityItem: worst.label, priorityDueDate: worst.dueDate };
}
function getEquipmentList() {
  const store = readStore();
  const list = (store.equipment && store.equipment.length ? store.equipment : defaultEquipmentFromRecords(store)).map(analyzeEquipment);
  const rank = { red:0, yellow:1, unknown:2, green:3 };
  return list.sort((a,b)=>rank[a.level]-rank[b.level] || (a.priorityDueDate||'9999').localeCompare(b.priorityDueDate||'9999'));
}
function equipmentSummary() {
  const list = getEquipmentList();
  return {
    total: list.length,
    green: list.filter(x=>x.level==='green').length,
    yellow: list.filter(x=>x.level==='yellow').length,
    red: list.filter(x=>x.level==='red').length,
    unknown: list.filter(x=>x.level==='unknown').length,
    alerts: list.filter(x=>['red','yellow'].includes(x.level))
  };
}
function rememberLineUser(userId) {
  if (!userId || userId === 'unknown') return;
  const store = readStore();
  store.lineUsers ||= [];
  if (!store.lineUsers.includes(userId)) {
    store.lineUsers.push(userId);
    writeStore(store);
  }
}

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

app.post('/api/admin/equipment/import', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: '未收到設備管理檔案' });
  const workbook = xlsx.readFile(req.file.path, { cellDates: false });
  const sheetName = workbook.SheetNames.find(n => /設備|儀器|檢定|比測/.test(n)) || workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const equipment = rows.map(normalizeEquipmentRow).filter(e => e.equipmentId);
  const store = readStore();
  store.equipment = equipment;
  writeStore(store);
  fs.unlink(req.file.path, () => {});
  res.json({ ok: true, sheetName, count: equipment.length, message: `已匯入設備管理資料 ${equipment.length} 筆` });
});

app.get('/api/equipment', (_req, res) => res.json({ ok: true, data: { summary: equipmentSummary(), list: getEquipmentList() } }));

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

async function lineApi(pathname, options = {}) {
  if (!LINE_TOKEN) throw new Error('LINE_CHANNEL_ACCESS_TOKEN 未設定，無法呼叫 LINE API');
  const res = await fetch(`https://api.line.me${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const message = data.message || data.raw || `LINE API error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function createAndSetDefaultRichMenu() {
  const spec = buildRichMenuSpec(PUBLIC_BASE_URL);
  spec.name = '新北噪音車V10企業版圖文選單';

  // 先建立新的 Rich Menu
  const created = await lineApi('/v2/bot/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec)
  });
  const richMenuId = created.richMenuId;

  // 上傳圖文選單圖片
  const imagePath = path.join(__dirname, 'public', 'assets', 'line-rich-menu.jpg');
  if (!fs.existsSync(imagePath)) throw new Error('找不到 public/assets/line-rich-menu.jpg');
  const image = fs.readFileSync(imagePath);
  await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LINE_TOKEN}`, 'Content-Type': 'image/jpeg' },
    body: image
  }).then(async res => {
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Rich Menu 圖片上傳失敗：${res.status}`);
    }
  });

  // 設為全體好友預設 Rich Menu
  await lineApi(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST' });
  return { richMenuId, spec, image: `${PUBLIC_BASE_URL}/assets/line-rich-menu.jpg` };
}

async function getRichMenuStatus() {
  const result = { hasToken: Boolean(LINE_TOKEN), defaultRichMenuId: null, richMenus: [] };
  if (!LINE_TOKEN) return result;
  try {
    const def = await lineApi('/v2/bot/user/all/richmenu');
    result.defaultRichMenuId = def.richMenuId || null;
  } catch (e) {
    result.defaultRichMenuId = null;
  }
  try {
    const list = await lineApi('/v2/bot/richmenu/list');
    result.richMenus = list.richmenus || [];
  } catch (e) {
    result.richMenus = [];
  }
  return result;
}

function verifyLineSignature(req) {
  if (!LINE_SECRET) return true;
  const signature = req.headers['x-line-signature'];
  if (!signature || !req.rawBody) return false;
  const hmac = crypto.createHmac('sha256', LINE_SECRET).update(req.rawBody).digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}


function flexButton(label, text, color = '#0b62d6') {
  return { type: 'button', style: 'primary', color, height: 'sm', action: { type: 'message', label, text } };
}

function flexUriButton(label, uri, color = '#0b62d6') {
  return { type: 'button', style: 'primary', color, height: 'sm', action: { type: 'uri', label, uri } };
}

function iconText(icon, title, subtitle) {
  return { type:'box', layout:'horizontal', spacing:'md', alignItems:'center', contents:[
    { type:'box', layout:'vertical', width:'44px', height:'44px', cornerRadius:'12px', backgroundColor:'#e8f1ff', justifyContent:'center', alignItems:'center', contents:[{ type:'text', text:icon, size:'xl', align:'center' }]},
    { type:'box', layout:'vertical', flex:1, contents:[
      { type:'text', text:title, weight:'bold', size:'md', color:'#092b5f' },
      { type:'text', text:subtitle, size:'xs', color:'#6b7788', wrap:true }
    ]}
  ]};
}

function getLineHomeFlex() {
  return {
    type: 'flex',
    altText: '新北市打擊噪音車管理系統主選單',
    contents: {
      type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#073b82', paddingAll:'18px', contents: [
        { type: 'text', text: '🚦 新北市打擊噪音車管理系統', weight: 'bold', size: 'lg', color: '#ffffff' },
        { type: 'text', text: '請直接點選下方功能，我會協助你快速查詢或回報。', size: 'sm', color: '#d9ecff', wrap: true }
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll:'16px', contents: [
        iconText('📊', '成果查詢系統', '開啟成果平台，查看完整圖表與條件篩選。'),
        flexUriButton('開啟成果查詢', DASHBOARD_URL),
        iconText('📝', '外勤回報平台', '前線人員填寫場次、機台、照片與座標。'),
        flexUriButton('開啟外勤回報', FIELD_REPORT_URL, '#009b72'),
        { type:'separator', margin:'md' },
        { type:'box', layout:'horizontal', spacing:'sm', contents: [
          flexButton('📈 KPI報表', 'KPI報表', '#2549b8'),
          flexButton('📅 月份/行政區', '統計選單', '#6f4be6')
        ]},
        { type:'box', layout:'horizontal', spacing:'sm', contents: [
          flexButton('🚗 車號查詢', '車號查詢', '#f58a00'),
          flexButton('⚙ 管理功能', '管理功能', '#54606f')
        ]},
        { type: 'text', text: '也可以直接輸入：2月份執行成效、淡水區執行成效、車牌 ABC-1234。', size: 'xs', color: '#7b8794', wrap: true, margin:'md' }
      ]}
    }
  };
}

function quickReply(items) {
  return { items: items.slice(0, 13).map(([label, text]) => ({ type: 'action', action: { type: 'message', label, text } })) };
}


function getStatsSelectFlex() {
  return {
    type:'flex', altText:'月份與行政區統計選單', contents:{
      type:'bubble', size:'mega',
      header:{ type:'box', layout:'vertical', backgroundColor:'#6f4be6', paddingAll:'18px', contents:[
        { type:'text', text:'📅 統計查詢', color:'#ffffff', weight:'bold', size:'lg' },
        { type:'text', text:'可選月份、行政區或時段，快速取得執行成果。', color:'#efe8ff', size:'sm', wrap:true }
      ]},
      body:{ type:'box', layout:'vertical', spacing:'md', paddingAll:'16px', contents:[
        iconText('📅','月份統計','查看各月份執行場次、告發、通知到檢與 KPI。'),
        flexButton('選擇月份', '月份統計', '#2549b8'),
        iconText('🏙','行政區統計','查看各行政區成果排行與治理成效。'),
        flexButton('選擇行政區', '行政區統計', '#6f4be6'),
        iconText('🌙','時段統計','掌握日間、夜間與敏感時段成效。'),
        flexButton('查看時段統計', '時段統計', '#f58a00')
      ]}
    }
  };
}

function getResultsMenuText() {
  return {
    type: 'flex',
    altText: '成果查詢選單',
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#073b82', paddingAll:'18px', contents:[
        { type:'text', text:'📊 成果查詢', color:'#ffffff', weight:'bold', size:'lg' },
        { type:'text', text:'完整儀表板可開啟平台；常用統計可直接在 LINE 內查。', color:'#d9ecff', size:'sm', wrap:true }
      ]},
      body: { type:'box', layout:'vertical', spacing:'md', paddingAll:'16px', contents:[
        iconText('🖥','成果平台','開啟圖表、地圖與完整篩選介面。'),
        flexUriButton('開啟成果查詢系統', DASHBOARD_URL),
        { type:'separator', margin:'md' },
        { type:'box', layout:'horizontal', spacing:'sm', contents:[flexButton('📌 進度', '進度', '#2549b8'), flexButton('📈 KPI', 'KPI報表', '#2549b8')]},
        { type:'box', layout:'horizontal', spacing:'sm', contents:[flexButton('📅 月份', '月份統計', '#6f4be6'), flexButton('🏙 行政區', '行政區統計', '#6f4be6')]},
        { type:'box', layout:'horizontal', spacing:'sm', contents:[flexButton('🌙 時段', '時段統計', '#f58a00'), flexButton('🚗 車號', '車號查詢', '#f58a00')]}
      ]}
    }
  };
}

function formatProgressCard(query = {}) {
  const stats = computeStats(query);
  const title = [query.month ? `${query.month}月` : '', query.district || '', query.timePeriod || ''].filter(Boolean).join('｜') || '全計畫';
  return {
    type: 'flex', altText: `${title}執行成效`,
    contents: {
      type: 'bubble', size: 'mega',
      header: { type:'box', layout:'vertical', backgroundColor:'#073b82', contents:[
        { type:'text', text:`${title} 執行成效`, weight:'bold', color:'#ffffff', size:'lg' },
        { type:'text', text:`更新：${(stats.updatedAt || '').slice(0,10) || '即時資料'}`, color:'#d9ecff', size:'xs' }
      ]},
      body: { type:'box', layout:'vertical', spacing:'sm', contents:[
        { type:'text', text:`年度進度：${stats.completed}/${stats.goal}場（${(stats.progressRate*100).toFixed(1)}%）`, weight:'bold', size:'md', color:'#092b5f' },
        { type:'separator', margin:'sm' },
        ...[
          ['執行場次', `${stats.total.sessions}場`], ['車流辨識', `${stats.total.detectCount.toLocaleString()}件`],
          ['超標件數', `${stats.total.exceedCount.toLocaleString()}件`], ['告發件數', `${stats.total.citationCount.toLocaleString()}件`],
          ['通知到檢', `${stats.total.inspectionCount.toLocaleString()}件`], ['告發率', `${(stats.total.citationRate*100).toFixed(1)}%`],
          ['通檢率', `${(stats.total.inspectionRate*100).toFixed(1)}%`], ['KPI成效', stats.total.kpi.toFixed(2)]
        ].map(([k,v]) => ({ type:'box', layout:'horizontal', contents:[
          { type:'text', text:k, color:'#516070', size:'sm', flex:3 }, { type:'text', text:v, color:'#0b2f6b', size:'sm', weight:'bold', align:'end', flex:4 }
        ]}))
      ]},
      footer: { type:'box', layout:'vertical', spacing:'sm', contents:[
        flexButton('查詢月份', '月份統計'), flexButton('查詢行政區', '行政區統計', '#6f4be6')
      ]}
    }
  };
}

function formatRankingText(type = 'district') {
  const stats = computeStats({});
  const list = type === 'month' ? stats.monthly : type === 'time' ? stats.timePeriods : stats.districts;
  const title = type === 'month' ? '月份統計排行' : type === 'time' ? '時段統計排行' : '行政區統計排行';
  const lines = list.slice(0, 8).map((x, i) => `${i+1}. ${x.name}｜${x.sessions}場｜告發${x.citationCount}｜通檢${x.inspectionCount}｜KPI ${x.kpi.toFixed(2)}`);
  return `📊 ${title}\n${lines.join('\n') || '目前尚無資料'}\n\n需要單一月份或行政區，請直接點選下方選單或輸入「淡水區執行成效」。`;
}

function formatPlateText(plate) {
  const p = norm(plate).toUpperCase();
  const stats = computeStats({ plate: p });
  const profile = stats.plates.find(x => x.plateNo === p) || stats.plates[0];
  if (!profile) return `查無車號 ${p} 的紀錄。可輸入完整車牌，例如 ABC-1234。`;
  return `【車號追蹤】\n車號：${profile.plateNo}\n累犯判定：${profile.repeatOffender ? '是' : '否'}\n紀錄筆數：${profile.records}筆\n最高量測：${profile.maxDbMeasured.toFixed(1)} dB\n最高超標：${profile.maxDbOver.toFixed(1)} dB\n告發件數：${profile.citationCount}\n通知到檢：${profile.inspectionCount}\n出現行政區：${profile.districts || '未分類'}\n最近日期：${profile.lastDate || '-'}`;
}

function parseLineCommand(text = '') {
  const t = text.trim();
  const monthMatch = t.match(/(\d{1,2})\s*月/);
  const districtMatch = t.match(/([\u4e00-\u9fa5]{2,3}區)/);
  const plateMatch = t.match(/(?:車牌|車號|plate)\s*[:：]?\s*([A-Z0-9-]{3,12})/i) || t.match(/\b([A-Z]{2,4}-?\d{3,4})\b/i);
  return {
    wantsMenu: /選單|menu|平台|功能|首頁|主選單/.test(t),
    wantsResultsMenu: /成果查詢/.test(t),
    wantsFieldStart: /開始回報|外勤回報|回報場次/.test(t),
    wantsFieldLine: /LINE填報|簡易填報|對話回報/.test(t),
    wantsAdmin: /管理功能|管理登入|後台管理/.test(t),
    wantsProgress: /進度|達成|剩餘/.test(t),
    wantsKpi: /KPI|kpi|告發率|通檢率/.test(t),
    wantsMonthMenu: /月份統計|月分統計|月份查詢/.test(t),
    wantsDistrictMenu: /行政區統計|行政區查詢/.test(t),
    wantsTimeMenu: /時段統計|時段查詢/.test(t),
    wantsPlateStart: /車號查詢|車牌查詢|車號追蹤|車牌追蹤/.test(t),
    wantsStats: /成效|統計|告發|通檢|執行/.test(t) || Boolean(monthMatch || districtMatch),
    month: monthMatch ? Number(monthMatch[1]) : undefined,
    district: districtMatch ? districtMatch[1] : undefined,
    plate: plateMatch ? plateMatch[1].toUpperCase().replace(/([A-Z]+)(\d+)/, '$1-$2') : undefined
  };
}

const fieldSteps = [
  ['date', '請輸入日期（例：115/06/27）'],
  ['sessionNo', '請輸入場次編號（例：S201）'],
  ['machineNo', '請輸入機台編號（例：OE_ZB004）'],
  ['calibrationValue', '請輸入校正值（例：93.9）'],
  ['district', '請輸入行政區（例：淡水區）'],
  ['location', '請輸入執勤地點'],
  ['latlng', '請輸入座標（例：25.1865425,121.4332440），不知道可輸入「略過」'],
  ['notes', '請輸入備註，沒有請輸入「無」']
];

function getFieldReportMenu() {
  return { type:'flex', altText:'外勤回報', contents:{ type:'bubble', size:'mega',
    header:{type:'box', layout:'vertical', backgroundColor:'#009b72', paddingAll:'18px', contents:[
      {type:'text', text:'📝 外勤回報', color:'#ffffff', weight:'bold', size:'lg'},
      {type:'text', text:'請依現場狀況選擇回報方式。', color:'#dbfff5', size:'sm'}
    ]},
    body:{type:'box', layout:'vertical', spacing:'md', paddingAll:'16px', contents:[
      iconText('📷','完整回報平台','適合上傳架設照片、告示牌照片、座標與完整欄位。'),
      flexUriButton('開啟外勤回報平台', FIELD_REPORT_URL, '#009b72'),
      iconText('💬','LINE 簡易填報','適合先快速登錄場次，後續可由後台補件。'),
      flexButton('開始 LINE 簡易填報', 'LINE填報', '#2549b8'),
      {type:'text', text:'提醒：正式照片與佐證資料，建議仍使用外勤回報平台補齊。', size:'xs', color:'#7b8794', wrap:true}
    ]}
  } };
}

function startFieldReport(userId) {
  lineStates.set(userId, { mode: 'field', step: 0, data: {} });
  return { type:'text', text:`已開始 LINE 簡易外勤回報。\n請依序回覆欄位即可，我會一步一步協助建立紀錄。\n\n${fieldSteps[0][1]}\n\n若要改用照片與完整欄位，請輸入「外勤回報」開啟正式平台。` };
}

function handleFieldReport(userId, text) {
  const state = lineStates.get(userId);
  const [key] = fieldSteps[state.step];
  if (!['取消', '中止'].includes(text.trim())) {
    if (key === 'latlng' && text !== '略過') {
      const [lat, lng] = text.split(/[,，]/).map(v => number(v, 0));
      state.data.lat = lat; state.data.lng = lng;
    } else if (text !== '略過') {
      state.data[key] = text.trim();
    }
  } else {
    lineStates.delete(userId);
    return { type:'text', text:'已取消外勤回報。' };
  }
  state.step += 1;
  if (state.step < fieldSteps.length) {
    lineStates.set(userId, state);
    return { type:'text', text: fieldSteps[state.step][1] };
  }
  state.mode = 'field_confirm';
  lineStates.set(userId, state);
  const d = state.data;
  return { type:'text', text:`請確認本次回報：\n日期：${d.date || '-'}\n場次：${d.sessionNo || '-'}\n機台：${d.machineNo || '-'}\n校正值：${d.calibrationValue || '-'}\n行政區：${d.district || '-'}\n地點：${d.location || '-'}\n座標：${d.lat || '-'},${d.lng || '-'}\n備註：${d.notes || '-'}\n\n請回覆「確認送出」或「取消」。`, quickReply: quickReply([['確認送出','確認送出'], ['取消','取消']]) };
}

function confirmFieldReport(userId, text) {
  const state = lineStates.get(userId);
  if (!/確認送出|送出|確認/.test(text)) {
    lineStates.delete(userId);
    return { type:'text', text:'已取消外勤回報。' };
  }
  const store = readStore();
  const d = state.data;
  const report = {
    id: `LINE${Date.now()}`, createdAt: new Date().toISOString(), date: d.date || new Date().toISOString().slice(0,10),
    district: d.district || '', location: d.location || '', sessionNo: d.sessionNo || '', machineNo: d.machineNo || '',
    reportType: 'LINE外勤回報', speedLimit: 50, noiseStandard: 86, calibrationValue: number(d.calibrationValue, 0),
    lat: number(d.lat,0), lng: number(d.lng,0), staff: userId, notes: d.notes || ''
  };
  store.fieldReports.push(report);
  writeStore(store);
  lineStates.delete(userId);
  return { type:'text', text:`✅ 已收到外勤回報，辛苦了。\n回報編號：${report.id}\n場次：${report.sessionNo || '-'}\n行政區：${report.district || '-'}\n\n後續可由管理功能匯出或補登完整資料。` };
}

function adminMenuText() {
  return { type:'text', text:'⚙ 管理功能請選擇：\n需要匯出或調整資料時，可進入後台操作。', quickReply: quickReply([
    ['匯出Excel','匯出Excel'], ['今日回報','今日回報'], ['平台後台','平台後台'], ['成果查詢','成果查詢']
  ]) };
}


function formatStatsForLine(query) {
  const stats = computeStats(query);
  const label = [query.month ? `${query.month}月` : '', query.district || '', query.plate ? `車號 ${query.plate}` : ''].filter(Boolean).join('｜') || '全計畫';
  const plateLine = query.plate && stats.plates[0] ? `\n🚗 車號追蹤：${stats.plates[0].plateNo}\n🔁 累犯判定：${stats.plates[0].repeatOffender ? '是' : '否'}｜最高超標：${stats.plates[0].maxDbOver.toFixed(1)} dB` : '';
  return `📊【${label} 執行成效】\n已完成：${stats.completed}/${stats.goal}場（${(stats.progressRate*100).toFixed(1)}%）\n查詢筆數：${stats.recent.length}筆\n\n📍 執行場次：${stats.total.sessions}場\n🚘 車流辨識：${stats.total.detectCount.toLocaleString()}件\n🔊 超標件數：${stats.total.exceedCount.toLocaleString()}件\n⚖️ 告發件數：${stats.total.citationCount.toLocaleString()}件\n📄 通知到檢：${stats.total.inspectionCount.toLocaleString()}件\n\n📈 告發率：${(stats.total.citationRate*100).toFixed(1)}%\n📋 通檢率：${(stats.total.inspectionRate*100).toFixed(1)}%\n🎯 KPI成效：${stats.total.kpi.toFixed(2)}${plateLine}\n\n我也可以協助查「月份統計」或「行政區統計」。`;
}


const lawSources = {
  moenvRevision: 'https://air.moenv.gov.tw/News/news.aspx?ID=6442',
  moenvLaw: 'https://oaout.moenv.gov.tw/law/LawContent.aspx?id=FL015471',
  lawMoj: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0030001',
  noiseCar: 'https://noisecar.moenv.gov.tw/',
  cnaSearch: 'https://www.cna.com.tw/search/hysearchws.aspx?q=%E5%99%AA%E9%9F%B3%E8%BB%8A',
  nera: 'https://www.nera.gov.tw/zh-tw/testvehicle/2.html'
};
const lawArticles = {
  11: '第11條\n機動車輛、民用航空器所發出之聲音，不得超過機動車輛、民用航空器噪音管制標準；其標準，由中央主管機關會同交通部定之。機動車輛供國內使用者，應符合前項噪音管制標準，始得進口、製造及使用。使用中機動車輛、民用航空器噪音管制項目、程序、限制、檢驗人員資格及其他應遵行事項之辦法，由中央主管機關會同交通部定之。',
  13: '第13條\n人民得向主管機關檢舉使用中機動車輛噪音妨害安寧情形。經主管機關通知檢驗者，車輛所有人或使用人應於指定期限內至指定地點接受檢驗。',
  26: '第26條\n機動車輛發出超過噪音管制標準之聲音者，處機動車輛所有人或使用人新臺幣3,600元以上36,000元以下罰鍰，並通知限期改善；屆期仍未完成改善者，按次處罰。情節重大者，得移請公路監理機關吊扣牌照至改善完成後發還；一年內再犯者，得吊扣牌照六個月。',
  28: '第28條\n不依第13條規定檢驗，或經檢驗不符合管制標準者，處機動車輛所有人或使用人新臺幣3,600元以上36,000元以下罰鍰，並通知限期改善；屆期仍未完成改善者，按次處罰。'
};

function lawButton(label, text, color = '#0b62d6') { return flexButton(label, text, color); }
function getLawCenterFlex() {
  return { type:'flex', altText:'法規中心與噪音車新聞', contents:{ type:'carousel', contents:[
    { type:'bubble', size:'mega', header:{type:'box', layout:'vertical', backgroundColor:'#c2272d', paddingAll:'18px', contents:[{type:'text', text:'🚨 最新修法', color:'#fff', weight:'bold', size:'lg'}, {type:'text', text:'噪音管制法車輛噪音罰則強化', color:'#ffe5e5', size:'sm'}]}, body:{type:'box', layout:'vertical', spacing:'md', contents:[
      {type:'text', text:'✔ 最高罰鍰提高至 3萬6千元\n✔ 情節重大可吊扣牌照\n✔ 一年內再犯可吊扣牌照六個月', wrap:true, size:'md', color:'#092b5f'},
      {type:'text', text:'輸入「修法」可看修法重點與舊法/新法差異。', size:'xs', color:'#6b7788', wrap:true}
    ]}, footer:{type:'box', layout:'vertical', spacing:'sm', contents:[lawButton('查看修法重點','修法','#c2272d'), flexUriButton('環境部公告', lawSources.moenvRevision, '#54606f')] }},
    { type:'bubble', size:'mega', header:{type:'box', layout:'vertical', backgroundColor:'#073b82', paddingAll:'18px', contents:[{type:'text', text:'📖 常用法條', color:'#fff', weight:'bold', size:'lg'}, {type:'text', text:'新北噪音車執法常查條文', color:'#d9ecff', size:'sm'}]}, body:{type:'box', layout:'vertical', spacing:'sm', contents:[
      iconText('11','第11條','車輛噪音標準'), iconText('13','第13條','通知到檢'), iconText('26','第26條','裁罰規定'), iconText('28','第28條','未依通知檢驗')
    ]}, footer:{type:'box', layout:'vertical', spacing:'sm', contents:[lawButton('查第26條','法條26','#073b82'), lawButton('查第28條','法條28','#073b82')] }},
    { type:'bubble', size:'mega', header:{type:'box', layout:'vertical', backgroundColor:'#6f4be6', paddingAll:'18px', contents:[{type:'text', text:'🧭 修法重點', color:'#fff', weight:'bold', size:'lg'}, {type:'text', text:'快速掌握政策風險與執法重點', color:'#efe8ff', size:'sm'}]}, body:{type:'box', layout:'vertical', spacing:'md', contents:[
      {type:'text', text:'輸入「修法」即可查看：\n✓ 修法原因\n✓ 修法日期\n✓ 修法重點\n✓ 舊法 vs 新法', wrap:true, size:'md', color:'#092b5f'}
    ]}, footer:{type:'box', layout:'vertical', contents:[lawButton('查看修法', '修法', '#6f4be6')]}},
    { type:'bubble', size:'mega', header:{type:'box', layout:'vertical', backgroundColor:'#009b72', paddingAll:'18px', contents:[{type:'text', text:'📰 噪音車新聞', color:'#fff', weight:'bold', size:'lg'}, {type:'text', text:'環境部、噪音車專區、中央社', color:'#dbfff5', size:'sm'}]}, body:{type:'box', layout:'vertical', spacing:'sm', contents:[
      iconText('新','新北/地方治理','科技執法與陳情趨勢'), iconText('環','環境部','法規、政策與聲音照相'), iconText('院','國環院','檢測機構、比測與技術資料')
    ]}, footer:{type:'box', layout:'vertical', spacing:'sm', contents:[lawButton('今日新聞摘要','噪音車新聞','#009b72'), flexUriButton('噪音車專區', lawSources.noiseCar, '#54606f')] }}
  ] }};
}
function getLawArticleText(articleNo) {
  const t = lawArticles[articleNo];
  if (!t) return '目前支援查詢：法條11、法條13、法條26、法條28。';
  return `📖 噪音管制法 ${articleNo}條\n\n${t}\n\n資料來源：環境部法規查詢、全國法規資料庫。`;
}
function getRevisionText() {
  return '🚨 噪音管制法最新修法重點\n\n修法目的：提高車輛噪音違規處罰強度，壓制非法改裝與高噪音擾民。\n\n重點整理：\n1. 車輛噪音違規罰鍰提高至新臺幣3,600元至36,000元。\n2. 情節重大者，可移請監理機關吊扣牌照至改善完成。\n3. 一年內再犯者，可吊扣牌照六個月。\n4. 未依通知檢驗或檢驗不合格，亦適用3,600元至36,000元罰鍰。\n\n舊法 vs 新法：\n舊法偏重罰鍰與限期改善；新法增加吊扣牌照工具，對累犯與重大違規更有嚇阻性。';
}
function getNoiseNewsText() {
  return `📰 噪音車新聞與政策來源\n\n我目前可提供新聞入口與重點摘要。正式每日自動新聞推播，建議搭配 n8n 每日排程更新。\n\n建議追蹤來源：\n1. 環境部最新消息\n${lawSources.moenvRevision}\n\n2. 環境部噪音車專區\n${lawSources.noiseCar}\n\n3. 中央社噪音車搜尋\n${lawSources.cnaSearch}\n\n4. 國環院檢測機構查詢\n${lawSources.nera}`;
}

function getEquipmentDashboardFlex() {
  const summary = equipmentSummary();
  const alerts = summary.alerts.slice(0, 5);
  return { type:'flex', altText:'設備管理提醒', contents:{ type:'bubble', size:'mega',
    header:{ type:'box', layout:'vertical', backgroundColor:'#1f6f8b', paddingAll:'18px', contents:[
      { type:'text', text:'🔧 設備管理', color:'#fff', weight:'bold', size:'lg' },
      { type:'text', text:'比測、噪音計檢定、風速計檢定到期提醒', color:'#d8f7ff', size:'sm', wrap:true }
    ]},
    body:{ type:'box', layout:'vertical', spacing:'md', paddingAll:'16px', contents:[
      { type:'box', layout:'horizontal', spacing:'sm', contents:[
        { type:'box', layout:'vertical', backgroundColor:'#e8fff3', cornerRadius:'12px', paddingAll:'12px', contents:[{type:'text', text:'🟢 正常', size:'sm', weight:'bold'}, {type:'text', text:String(summary.green), size:'xxl', weight:'bold', color:'#009b72'}]},
        { type:'box', layout:'vertical', backgroundColor:'#fff8dc', cornerRadius:'12px', paddingAll:'12px', contents:[{type:'text', text:'🟡 30天內', size:'sm', weight:'bold'}, {type:'text', text:String(summary.yellow), size:'xxl', weight:'bold', color:'#c98a00'}]},
        { type:'box', layout:'vertical', backgroundColor:'#ffecec', cornerRadius:'12px', paddingAll:'12px', contents:[{type:'text', text:'🔴 已逾期', size:'sm', weight:'bold'}, {type:'text', text:String(summary.red), size:'xxl', weight:'bold', color:'#c2272d'}]}
      ]},
      { type:'separator' },
      ...(alerts.length ? alerts.map(e => iconText(e.icon, `${e.equipmentId}｜${e.priorityItem}`, `${e.status}｜到期日 ${e.priorityDueDate}`)) : [iconText('🟢','目前無到期警示','全部設備維持正常。')]),
      { type:'text', text:'提醒規則：中央比測2年、噪音計檢定1年、風速計檢定1年；30天內亮黃燈，逾期亮紅燈。', size:'xs', color:'#6b7788', wrap:true }
    ]},
    footer:{ type:'box', layout:'vertical', spacing:'sm', contents:[flexButton('查看設備清單','設備清單','#1f6f8b'), flexButton('推播今日提醒','設備提醒推播','#c2272d')] }
  }};
}
function getEquipmentListText() {
  const list = getEquipmentList().slice(0, 12);
  const lines = list.map(e => `${e.icon} ${e.equipmentId}｜${e.priorityItem}｜${e.status}｜${e.priorityDueDate}`).join('\n');
  return `📋 設備清單\n${lines || '目前尚無設備資料'}\n\n輸入「設備 OE_ZB004」可查看單一機台完整檢定狀態。`;
}
function formatEquipmentDetailText(machineNo) {
  const key = norm(machineNo).toUpperCase();
  const e = getEquipmentList().find(x => x.equipmentId.toUpperCase() === key || x.machineNo.toUpperCase() === key);
  if (!e) return `查無設備 ${key}。可輸入「設備清單」查看目前建檔設備。`;
  const lines = e.items.map(i => `${i.icon} ${i.label}\n上次日期：${i.lastDate}\n下次期限：${i.dueDate}\n狀態：${i.status}`).join('\n\n');
  return `🔧 設備：${e.equipmentId}\n狀態：${e.icon} ${e.status}\n地點：${e.location || '-'}\n\n${lines}\n\n建議：${e.level==='red'?'已逾期，請立即安排送檢/比測。':e.level==='yellow'?'30天內到期，建議先排程送檢。':'目前正常，持續追蹤即可。'}`;
}
function equipmentReminderText() {
  const summary = equipmentSummary();
  const alerts = summary.alerts;
  if (!alerts.length) return `🔔 今日設備提醒\n\n🟢 目前沒有 30 天內到期或逾期設備。\n\n設備總數：${summary.total}`;
  return `🔔 今日設備提醒\n\n${alerts.slice(0,10).map(e => `${e.icon} ${e.equipmentId}\n${e.priorityItem}\n${e.status}\n到期日：${e.priorityDueDate}`).join('\n────────\n')}\n\n設備總數：${summary.total}\n🟢正常 ${summary.green}｜🟡30天內 ${summary.yellow}｜🔴逾期 ${summary.red}`;
}
async function pushLine(to, messages) {
  if (!LINE_TOKEN || !to) return;
  await fetch('https://api.line.me/v2/bot/message/push', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${LINE_TOKEN}` }, body: JSON.stringify({ to, messages: Array.isArray(messages) ? messages : [messages] }) });
}
async function pushEquipmentReminders() {
  const store = readStore();
  const ids = [...new Set([...(store.lineUsers||[]), ...(process.env.LINE_PUSH_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean)])];
  const msg = { type:'text', text: equipmentReminderText() };
  for (const id of ids) await pushLine(id, msg);
  return ids.length;
}
let lastReminderDate = '';
setInterval(async () => {
  try {
    const tw = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Taipei' }));
    const day = tw.toISOString().slice(0,10);
    if (tw.getHours() === 8 && tw.getMinutes() < 15 && lastReminderDate !== day) {
      lastReminderDate = day;
      await pushEquipmentReminders();
    }
  } catch (e) { console.error('daily equipment reminder failed', e); }
}, 5 * 60 * 1000);

async function replyLine(replyToken, messages) {
  if (!LINE_TOKEN || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: Array.isArray(messages) ? messages : [messages] })
  });
}

app.get('/api/line/webhook', (_req, res) => res.status(405).send('LINE webhook endpoint is ready. Use POST from LINE Messaging API.'));

app.post('/api/line/webhook', async (req, res) => {
  if (!verifyLineSignature(req)) return res.status(401).json({ ok: false, message: 'LINE signature invalid' });
  const events = req.body?.events || [];
  res.json({ ok: true });
  for (const event of events) {
    if (event.type !== 'message') continue;
    if (event.message?.type !== 'text') {
      try { await replyLine(event.replyToken, { type:'text', text:'感謝您的回覆🙂' }); } catch(e) { console.error(e); }
      continue;
    }
    const userId = event.source?.userId || 'unknown';
    rememberLineUser(userId);
    const text = event.message.text || '';
    const state = lineStates.get(userId);
    try {
      if (state?.mode === 'field') { await replyLine(event.replyToken, handleFieldReport(userId, text)); continue; }
      if (state?.mode === 'field_confirm') { await replyLine(event.replyToken, confirmFieldReport(userId, text)); continue; }
      if (state?.mode === 'plate_wait') { lineStates.delete(userId); await replyLine(event.replyToken, { type:'text', text: formatPlateText(text) }); continue; }
      if (state?.mode === 'admin_wait') {
        lineStates.delete(userId);
        await replyLine(event.replyToken, norm(text) === ADMIN_PASSWORD ? adminMenuText() : { type:'text', text:'密碼錯誤，請重新輸入「管理登入」。' });
        continue;
      }

      const cmd = parseLineCommand(text);
      if (/法規中心|法規查詢|法規專區|法律中心|噪音管制法/.test(text)) await replyLine(event.replyToken, getLawCenterFlex());
      else if (/最新修法|修法重點|修法/.test(text)) await replyLine(event.replyToken, { type:'text', text:getRevisionText() });
      else if (/法條\s*(11|13|26|28)/.test(text)) await replyLine(event.replyToken, { type:'text', text:getLawArticleText(text.match(/法條\s*(11|13|26|28)/)[1]) });
      else if (/噪音車新聞|今日新聞|新聞/.test(text)) await replyLine(event.replyToken, { type:'text', text:getNoiseNewsText() });
      else if (/設備管理|設備查詢|設備提醒|設備儀表板|設備$/.test(text)) await replyLine(event.replyToken, getEquipmentDashboardFlex());
      else if (/設備清單|設備列表/.test(text)) await replyLine(event.replyToken, { type:'text', text:getEquipmentListText() });
      else if (/設備提醒推播|推播今日提醒/.test(text)) { const n = await pushEquipmentReminders(); await replyLine(event.replyToken, { type:'text', text:`已發送設備提醒給 ${n} 位已互動使用者。` }); }
      else if (/設備\s*([A-Za-z0-9_\-]+)/.test(text)) await replyLine(event.replyToken, { type:'text', text:formatEquipmentDetailText(text.match(/設備\s*([A-Za-z0-9_\-]+)/)[1]) });
      else if (cmd.wantsMenu) await replyLine(event.replyToken, getLineHomeFlex());
      else if (cmd.wantsResultsMenu) await replyLine(event.replyToken, getResultsMenuText());
      else if (/統計選單|月份行政區|月份\/行政區/.test(text)) await replyLine(event.replyToken, getStatsSelectFlex());
      else if (cmd.wantsFieldLine) await replyLine(event.replyToken, startFieldReport(userId));
      else if (cmd.wantsFieldStart) await replyLine(event.replyToken, getFieldReportMenu());
      else if (cmd.wantsAdmin) { lineStates.set(userId, { mode:'admin_wait' }); await replyLine(event.replyToken, { type:'text', text:'🔐 請輸入管理密碼。' }); }
      else if (/匯出Excel/.test(text)) await replyLine(event.replyToken, { type:'text', text:`Excel匯出需管理登入後下載：${PUBLIC_BASE_URL}/admin.html` });
      else if (/開啟成果系統|成果系統連結|成果平台/.test(text)) await replyLine(event.replyToken, { type:'flex', altText:'開啟成果查詢系統', contents:{ type:'bubble', body:{ type:'box', layout:'vertical', spacing:'md', contents:[{type:'text', text:'成果查詢系統', weight:'bold', size:'lg', color:'#092b5f'}, {type:'text', text:'點選下方按鈕開啟成果查詢平台。', size:'sm', color:'#516070'}]}, footer:{ type:'box', layout:'vertical', contents:[flexUriButton('開啟成果查詢', DASHBOARD_URL)] } } });
      else if (/開啟外勤回報|外勤回報連結|外勤平台/.test(text)) await replyLine(event.replyToken, { type:'flex', altText:'開啟外勤回報平台', contents:{ type:'bubble', body:{ type:'box', layout:'vertical', spacing:'md', contents:[{type:'text', text:'外勤回報平台', weight:'bold', size:'lg', color:'#092b5f'}, {type:'text', text:'點選下方按鈕開啟外勤回報表單。', size:'sm', color:'#516070'}]}, footer:{ type:'box', layout:'vertical', contents:[flexUriButton('開啟外勤回報', FIELD_REPORT_URL, '#009b72')] } } });
      else if (/平台後台/.test(text)) await replyLine(event.replyToken, { type:'text', text:`管理後台：${PUBLIC_BASE_URL}/admin.html` });
      else if (cmd.wantsMonthMenu) await replyLine(event.replyToken, { type:'text', text:'📅 請選擇要查詢的月份，我會整理場次、告發、通檢與 KPI 給你。', quickReply: quickReply(Array.from({length:12},(_,i)=>[`${i+1}月`, `${i+1}月份執行成效`])) });
      else if (cmd.wantsDistrictMenu) {
        const districts = computeStats({}).districts.map(d=>d.name).slice(0,12);
        await replyLine(event.replyToken, { type:'text', text:'🏙 請選擇行政區，我會回覆該區執行成果與 KPI。', quickReply: quickReply(districts.map(d=>[d, `${d}執行成效`])) });
      }
      else if (cmd.wantsTimeMenu) await replyLine(event.replyToken, { type:'text', text: formatRankingText('time') });
      else if (cmd.wantsPlateStart) { lineStates.set(userId, { mode:'plate_wait' }); await replyLine(event.replyToken, { type:'text', text:'🚗 請輸入車牌號碼，例如 ABC-1234。\n我會協助查詢累犯、最高超標與案件紀錄。' }); }
      else if (cmd.plate) await replyLine(event.replyToken, { type: 'text', text: formatPlateText(cmd.plate) });
      else if (cmd.wantsKpi || cmd.wantsProgress) await replyLine(event.replyToken, formatProgressCard({ month: cmd.month, district: cmd.district }));
      else if (cmd.wantsStats) await replyLine(event.replyToken, { type: 'text', text: formatStatsForLine({ month: cmd.month, district: cmd.district }) });
      else await replyLine(event.replyToken, { type: 'text', text: '感謝您的回覆🙂' });
    } catch (error) {
      console.error('LINE reply failed', error);
    }
  }
});



app.post('/api/admin/line/push/equipment-reminder', requireAdmin, async (_req, res) => {
  try {
    const count = await pushEquipmentReminders();
    res.json({ ok:true, count, message:`已推播設備提醒給 ${count} 位已互動使用者` });
  } catch (error) { res.status(500).json({ ok:false, message:error.message }); }
});

app.get('/api/admin/line/rich-menu/status', requireAdmin, async (_req, res) => {
  try {
    res.json({ ok: true, ...(await getRichMenuStatus()), dashboardUrl: DASHBOARD_URL, fieldReportUrl: FIELD_REPORT_URL, publicBaseUrl: PUBLIC_BASE_URL });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/admin/line/rich-menu/setup', requireAdmin, async (_req, res) => {
  try {
    const result = await createAndSetDefaultRichMenu();
    res.json({ ok: true, message: 'LINE Rich Menu 已建立並設為預設選單', ...result });
  } catch (error) {
    console.error('Rich Menu setup failed', error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.delete('/api/admin/line/rich-menu/default', requireAdmin, async (_req, res) => {
  try {
    await lineApi('/v2/bot/user/all/richmenu', { method: 'DELETE' });
    res.json({ ok: true, message: '已取消預設 Rich Menu' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/line/rich-menu-spec', (_req, res) => {
  res.json({ ok: true, image: `${PUBLIC_BASE_URL}/assets/line-rich-menu.jpg`, spec: buildRichMenuSpec(PUBLIC_BASE_URL) });
});

function buildRichMenuSpec(_base) {
  const W = 2500, H = 1686, header = 230, margin = 54, gap = 28;
  const cols = 4, rows = 2;
  const tw = Math.floor((W - 2*margin - (cols-1)*gap) / cols);
  const th = Math.floor((H - header - 2*margin - (rows-1)*gap) / rows);
  const actions = [
    { type:'uri', uri:DASHBOARD_URL },
    { type:'uri', uri:FIELD_REPORT_URL },
    { type:'message', text:'車號查詢' },
    { type:'message', text:'KPI報表' },
    { type:'message', text:'統計選單' },
    { type:'message', text:'法規中心' },
    { type:'message', text:'設備管理' },
    { type:'message', text:'管理功能' }
  ];
  const areas = actions.map((action,i)=>{
    const c=i%cols, r=Math.floor(i/cols);
    return { bounds:{ x: margin + c*(tw+gap), y: header + margin + r*(th+gap), width: tw, height: th }, action };
  });
  return { size: { width: W, height: H }, selected: true, name: '新北噪音車V10企業版圖文選單', chatBarText: '管理選單', areas };
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: err.message || 'server error' });
});

app.listen(PORT, () => {
  console.log(`New Taipei noise control system running on :${PORT}`);
  console.log(`PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`);
});
