// ============================================================
// ระบบจัดซื้อจัดจ้าง — Google Apps Script Backend
// ============================================================
const CONFIG = {
  SPREADSHEET_ID: '1Q5RMeOxX66tg0db35Fl6e9d9kjdoz2om1I72jTaM-TY',
  SHEETS: {
    USERS:    'Users',
    DEPTS:    'Departments',
    REQUESTS: 'Requests',
    ITEMS:    'Request_Items',
    SCHOOL:   'School_Profile',
    SETTINGS: 'Settings'
  }
};

// ── Entry points ─────────────────────────────────────────────
function doGet(e)  { return handleRequest_(e || { parameter: {} }, 'GET'); }
function doPost(e) { return handleRequest_(e || { parameter: {}, postData: { contents: '' } }, 'POST'); }
function seedSystem() { return jsonOut_(seedSystem_()); }

// ── Router ───────────────────────────────────────────────────
function handleRequest_(e, method) {
  const params   = (e && e.parameter) ? e.parameter : {};
  const action   = params.action   || '';
  const callback = params.callback || '';

  try {
    let p = {};
    if (method === 'POST') {
      p = safeJson_(params.data || '{}');
      if (!Object.keys(p).length && e.postData) p = safeJson_(e.postData.contents || '{}');
    } else {
      p = safeJson_(params.data || '{}');
    }

    let result;
    switch (action) {
      case 'ping':              result = ok_({ time: new Date().toISOString() }); break;
      case 'login':             result = ok_({ user: login_(p.username, p.password) }); break;
      case 'getDashboard':      result = ok_(getDashboard_()); break;
      case 'getSchoolProfile':  result = ok_({ profile: getSchoolProfile_() }); break;
      case 'getSystemSettings': result = ok_({ settings: getSettings_() }); break;
      case 'saveSystemSettings':result = saveSettings_(p); break;
      case 'listRequests':      result = ok_({ requests: listRequests_(p) }); break;
      case 'getRequest':        result = ok_(getRequest_(p)); break;
      case 'saveRequest':       result = saveRequest_(p); break;
      case 'approveRequest':    result = approveRequest_(p); break;
      case 'submitForInspection': result = submitForInspection_(p); break;
      case 'confirmByToken':    result = confirmByToken_(p); break;
      case 'listUsers':         result = ok_({ users: listUsers_() }); break;
      case 'saveUser':          result = saveUser_(p); break;
      case 'deleteUser':        result = deleteUser_(p); break;
      case 'seedSystem':        result = seedSystem_(); break;
      default:                  result = err_('Unknown action: ' + action);
    }
    return out_(result, callback);
  } catch (ex) {
    return out_({ ok: false, message: ex.message || String(ex), action }, callback);
  }
}

// ── Output helpers ───────────────────────────────────────────
function out_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb) return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function jsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ok_(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: true, data };
  return Object.assign({ ok: true }, data);
}
function err_(msg) { return { ok: false, message: msg }; }
function safeJson_(s) { try { return JSON.parse(s || '{}'); } catch(e) { return {}; } }

// ── Sheet helpers ─────────────────────────────────────────────
function getSS_() {
  if (!CONFIG.SPREADSHEET_ID) throw new Error('ไม่พบ Spreadsheet ID');
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name, headers) {
  const ss = getSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  if (headers && sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureHeaders_(name, headers) {
  const sh = getSheet_(name, headers);
  const cols = Math.max(sh.getLastColumn(), headers.length);
  if (cols === 0) return sh;
  const existing = sh.getRange(1, 1, 1, cols).getValues()[0].slice(0, headers.length);
  if (!headers.every((h, i) => existing[i] === h)) {
    if (sh.getLastRow() <= 1) {
      sh.clearContents();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function getRows_(name) {
  const sh = getSheet_(name);
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const hdrs = vals[0];
  return vals.slice(1).filter(r => r.join('') !== '').map(r => {
    const o = {};
    hdrs.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

function replaceRows_(name, keyField, keyVal, newRows) {
  const sh = getSheet_(name);
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return;
  const hdrs = vals[0];
  const ki = hdrs.indexOf(keyField);
  if (ki === -1) throw new Error('ไม่พบ field: ' + keyField);
  const keep = vals.slice(1).filter(r => String(r[ki]) !== String(keyVal) && r.join('') !== '');
  sh.clearContents();
  sh.getRange(1, 1, 1, hdrs.length).setValues([hdrs]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const all = keep.concat((newRows || []).map(o => hdrs.map(h => o[h] !== undefined ? o[h] : '')));
  if (all.length) sh.getRange(2, 1, all.length, hdrs.length).setValues(all);
}

function getSetting_(key, def) {
  const r = getRows_(CONFIG.SHEETS.SETTINGS).find(r => r.key === key);
  return r ? r.value : (def || '');
}

function setSetting_(key, val) {
  const sh = getSheet_(CONFIG.SHEETS.SETTINGS);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(key)) { sh.getRange(i + 1, 2).setValue(val); return; }
  }
  sh.appendRow([key, val]);
}

function nextRequestId_() {
  const no = Number(getSetting_('request_running_no', '1'));
  setSetting_('request_running_no', String(no + 1));
  const yr = new Date().getFullYear() + 543;
  return 'REQ-' + yr + '-' + String(no).padStart(4, '0');
}

// generate เลขที่ใบสั่งซื้อ/จ้าง วิ่งต่อเนื่องไม่รีเซ็ต
function nextPoNo_(procType) {
  const isBuy  = procType !== 'จัดจ้าง';
  const key    = isBuy ? 'po_buy_running_no' : 'po_hire_running_no';
  const prefix = isBuy ? 'ซ.' : 'จ.';
  const yr     = (new Date().getFullYear() + 543);
  const no     = Number(getSetting_(key, '1'));
  setSetting_(key, String(no + 1));
  return prefix + String(no).padStart(2, '0') + '/' + yr;
}

function fmtDate_(d) {
  return Utilities.formatDate(d || new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// ── Seed ─────────────────────────────────────────────────────
function seedSystem_() {
  const REQ_HEADERS = [
    'request_id','created_at','updated_at','request_date',
    'teacher_id','teacher_name','department',
    'proc_type','po_no','scope_of_work',
    'project_name','reason','budget_source','activity_name',
    'doc_no','quote_no','quote_date',
    'vendor_name','vendor_address','vendor_tax_id','vendor_phone',
    'delivery_days','total_amount','total_amount_text',
    'inspector_name','inspector_position','receive_date','invoice_no','invoice_date',
    'late_days','penalty','withholding_tax',
    'status','approved_by','approved_at','notes','inspect_token','teacher_email'
  ];
  const schema = {};
  schema[CONFIG.SHEETS.USERS]    = ['user_id','full_name','position','department','username','password','role','active','email'];
  schema[CONFIG.SHEETS.DEPTS]    = ['dept_id','dept_name','budget_total','color'];
  schema[CONFIG.SHEETS.REQUESTS] = REQ_HEADERS;
  schema[CONFIG.SHEETS.ITEMS]    = ['item_id','request_id','item_name','qty','unit','unit_price','amount','price_source'];
  schema[CONFIG.SHEETS.SCHOOL]   = ['school_name','area_office','school_address','school_phone','school_tax_id','fiscal_year'];
  schema[CONFIG.SHEETS.SETTINGS] = ['key','value'];
  Object.keys(schema).forEach(n => ensureHeaders_(n, schema[n]));

  // Departments
  const dSh = getSheet_(CONFIG.SHEETS.DEPTS);
  if (dSh.getLastRow() === 1) {
    dSh.getRange(2,1,5,4).setValues([
      ['GEN','บริหารทั่วไป',150000,'#2563eb'],
      ['ACA','วิชาการ',200000,'#16a34a'],
      ['BUD','งบประมาณ',120000,'#ea580c'],
      ['PER','บุคคล',80000,'#9333ea'],
      ['STU','กิจการนักเรียน',100000,'#db2777']
    ]);
  }

  // Users — เพิ่ม role inspector
  const uSh = getSheet_(CONFIG.SHEETS.USERS);
  if (uSh.getLastRow() === 1) {
    uSh.getRange(2,1,5,8).setValues([
      ['U001','ครูตัวอย่าง 1','ครู','วิชาการ','teacher1','1234','teacher',true],
      ['U002','ครูตัวอย่าง 2','ครู','บริหารทั่วไป','teacher2','1234','teacher',true],
      ['U003','ครูตัวอย่าง 3','ครู','กิจการนักเรียน','teacher3','1234','teacher',true],
      ['I001','นางอังคนี นุหมุดหวัง','เจ้าหน้าที่พัสดุ','งบประมาณ','inspector1','1234','inspector',true],
      ['A001','ผู้ดูแลระบบ','เจ้าหน้าที่พัสดุ','งบประมาณ','admin','admin123','admin',true]
    ]);
  }

  // School
  const scSh = getSheet_(CONFIG.SHEETS.SCHOOL);
  if (scSh.getLastRow() === 1) {
    scSh.getRange(2,1,1,6).setValues([[
      'โรงเรียนบ้านคลอง 14','สำนักงานเขตพื้นที่การศึกษาประถมศึกษานครนายก',
      'อำเภอองครักษ์ จังหวัดนครนายก','-','-','2568'
    ]]);
  }

  // Settings
  const stSh = getSheet_(CONFIG.SHEETS.SETTINGS);
  if (stSh.getLastRow() === 1) {
    stSh.getRange(2,1,15,2).setValues([
      ['request_running_no','1'],
      ['po_buy_running_no','1'],
      ['po_hire_running_no','1'],
      ['po_fiscal_year', String(new Date().getFullYear()+543)],
      ['procurement_officer_name','นางอังคนี นุหมุดหวัง'],
      ['procurement_officer_position','เจ้าหน้าที่พัสดุ'],
      ['procurement_head_name','นางสาวสุมาลี เซ็ม'],
      ['procurement_head_position','หัวหน้าเจ้าหน้าที่พัสดุ'],
      ['director_name','นางสาวสู่ขวัญ ตลับนาค'],
      ['director_position','ผู้อำนวยการโรงเรียน'],
      ['finance_officer_name',''],
      ['finance_officer_position','เจ้าหน้าที่การเงิน'],
      ['default_delivery_days','7'],
      ['vat_rate','7'],
      ['school_bank_account',''],
      ['school_bank_account_name',''],
      ['school_bank_name',''],
      ['school_bank_branch','']
    ]);
  }

  return { ok: true, message: 'Seed completed' };
}

// ── Actions ───────────────────────────────────────────────────
function login_(username, password) {
  const u = getRows_(CONFIG.SHEETS.USERS).find(u =>
    String(u.username) === String(username) &&
    String(u.password) === String(password) &&
    String(u.active)   !== 'false'
  );
  if (!u) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  return { user_id: u.user_id, full_name: u.full_name, position: u.position, department: u.department, role: u.role, username: u.username, email: u.email || '' };
}

function getSchoolProfile_() { return getRows_(CONFIG.SHEETS.SCHOOL)[0] || {}; }

function getSettings_() {
  const obj = {};
  getRows_(CONFIG.SHEETS.SETTINGS).forEach(r => { obj[r.key] = r.value; });
  return obj;
}

function saveSettings_(p) {
  Object.keys(p || {}).forEach(k => setSetting_(k, p[k]));
  return { ok: true, message: 'บันทึกตั้งค่าเรียบร้อยแล้ว' };
}

function getDashboard_() {
  const depts    = getRows_(CONFIG.SHEETS.DEPTS);
  const requests = getRows_(CONFIG.SHEETS.REQUESTS);

  let totalBudget = 0, usedBudget = 0;
  const dMap = {};

  depts.forEach(d => {
    const t = Number(d.budget_total || 0);
    totalBudget += t;
    dMap[d.dept_name] = { dept_id: d.dept_id, dept_name: d.dept_name, budget_total: t, budget_used: 0, budget_remain: t, color: d.color || '#2563eb', request_count: 0 };
  });

  requests.forEach(r => {
    const amt = Number(r.total_amount || 0);
    usedBudget += amt;
    if (!dMap[r.department]) dMap[r.department] = { dept_id:'', dept_name: r.department, budget_total:0, budget_used:0, budget_remain:0, color:'#64748b', request_count:0 };
    dMap[r.department].budget_used  += amt;
    dMap[r.department].budget_remain = (dMap[r.department].budget_total || 0) - dMap[r.department].budget_used;
    dMap[r.department].request_count += 1;
  });

  // สถิติตามสถานะ
  const statusCount = {};
  requests.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });

  const recent = [...requests].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0,15);

  return {
    summary: { total_budget: totalBudget, used_budget: usedBudget, remain_budget: totalBudget - usedBudget, request_count: requests.length, status_count: statusCount },
    status_count: statusCount,
    departments: Object.values(dMap),
    recent_requests: recent
  };
}

function listRequests_(p) {
  const role   = String(p.role   || '');
  const userId = String(p.user_id || '');
  const status = String(p.status || '');

  let rows = getRows_(CONFIG.SHEETS.REQUESTS).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));

  if (role === 'teacher') rows = rows.filter(r => String(r.teacher_id) === userId);
  if (role === 'inspector') rows = rows.filter(r => ['รออนุมัติ','ตรวจรับแล้ว','เบิกจ่ายแล้ว'].includes(r.status));
  if (status) rows = rows.filter(r => r.status === status);

  return rows;
}

function getRequest_(p) {
  const id = String(p.request_id || '');
  if (!id) throw new Error('ไม่พบ request_id');
  const req = getRows_(CONFIG.SHEETS.REQUESTS).find(r => String(r.request_id) === id);
  if (!req) throw new Error('ไม่พบคำขอซื้อ: ' + id);
  const items = getRows_(CONFIG.SHEETS.ITEMS).filter(i => String(i.request_id) === id);
  return { request: req, items };
}

function saveRequest_(p) {
  const req   = p.request || {};
  const items = p.items   || [];

  const id        = req.request_id || nextRequestId_();
  const createdAt = req.created_at || fmtDate_();
  const procType  = req.proc_type  || 'จัดซื้อ';
  // generate po_no เฉพาะครั้งแรก (ยังไม่มี po_no)
  const poNo = req.po_no || nextPoNo_(procType);

  const row = {
    request_id: id, created_at: createdAt, updated_at: fmtDate_(),
    request_date: req.request_date || '',
    teacher_id:   req.teacher_id   || '',
    teacher_name: req.teacher_name || '',
    department:   req.department   || '',
    proc_type:    procType,
    po_no:        poNo,
    scope_of_work: req.scope_of_work || '',
    project_name: req.project_name || '',
    reason:       req.reason       || '',
    budget_source:req.budget_source|| '',
    activity_name:req.activity_name|| '',
    doc_no:       req.doc_no       || '',
    quote_no:     req.quote_no     || '',
    quote_date:   req.quote_date   || '',
    vendor_name:  req.vendor_name  || '',
    vendor_address:req.vendor_address||'',
    vendor_tax_id: req.vendor_tax_id||'',
    vendor_phone:  req.vendor_phone ||'',
    delivery_days: req.delivery_days||'',
    total_amount:  Number(req.total_amount||0),
    total_amount_text: req.total_amount_text||'',
    inspector_name:    req.inspector_name    ||'',
    inspector_position:req.inspector_position||'',
    receive_date: req.receive_date||'',
    invoice_no:   req.invoice_no  ||'',
    invoice_date: req.invoice_date||'',
    late_days:    req.late_days   ||'0',
    penalty:      Number(req.penalty||0),
    withholding_tax: Number(req.withholding_tax||0),
    status:       req.status      ||'ร่าง',
    approved_by:  req.approved_by ||'',
    approved_at:  req.approved_at ||'',
    notes:        req.notes       ||''
  };

  replaceRows_(CONFIG.SHEETS.REQUESTS, 'request_id', id, [row]);

  const itemRows = items.map((it, i) => ({
    item_id:      id + '-I' + (i+1),
    request_id:   id,
    item_name:    it.item_name   || '',
    qty:          Number(it.qty  || 0),
    unit:         it.unit        || '',
    unit_price:   Number(it.unit_price||0),
    amount:       Number(it.amount    ||0),
    price_source: it.price_source|| ''
  }));
  replaceRows_(CONFIG.SHEETS.ITEMS, 'request_id', id, itemRows);

  return { ok: true, message: 'บันทึกเรียบร้อย', request_id: id, po_no: poNo };
}

// เจ้าหน้าที่ตรวจรับ: อนุมัติ + กรอกข้อมูลตรวจรับ
function approveRequest_(p) {
  const id = String(p.request_id || '');
  if (!id) throw new Error('ไม่พบ request_id');

  const existing = getRows_(CONFIG.SHEETS.REQUESTS).find(r => String(r.request_id) === id);
  if (!existing) throw new Error('ไม่พบคำขอซื้อ');

  const updated = Object.assign({}, existing, {
    updated_at:        fmtDate_(),
    inspector_name:    p.inspector_name     || existing.inspector_name,
    inspector_position:p.inspector_position || existing.inspector_position,
    receive_date:      p.receive_date       || existing.receive_date,
    invoice_no:        p.invoice_no         || existing.invoice_no,
    invoice_date:      p.invoice_date       || existing.invoice_date,
    late_days:         p.late_days          || existing.late_days || '0',
    penalty:           Number(p.penalty     || existing.penalty || 0),
    withholding_tax:   Number(p.withholding_tax || existing.withholding_tax || 0),
    status:            p.status             || 'ตรวจรับแล้ว',
    approved_by:       p.approved_by        || '',
    approved_at:       p.approved_at        || fmtDate_(),
    notes:             p.notes              || existing.notes
  });

  replaceRows_(CONFIG.SHEETS.REQUESTS, 'request_id', id, [updated]);
  return { ok: true, message: 'บันทึกการตรวจรับเรียบร้อย', request_id: id };
}

// ── Email Notification ────────────────────────────────────────

// helper สร้าง HTML email template
function buildEmailHtml_(title, rows, bodyExtra) {
  var rowsHtml = rows.map(function(r) {
    return '<tr><td style="padding:6px 12px;color:#64748b;white-space:nowrap;font-size:14px;">' + r[0] + '</td>' +
           '<td style="padding:6px 12px;font-weight:600;font-size:14px;">' + r[1] + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f0f4f8;font-family:\'Sarabun\',sans-serif;">' +
    '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">' +
    '<div style="background:#1d4ed8;padding:24px 28px;">' +
    '<div style="color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;margin-bottom:4px;">ระบบจัดซื้อจัดจ้าง โรงเรียนบ้านคลอง 14</div>' +
    '<div style="color:#fff;font-size:20px;font-weight:700;">' + title + '</div>' +
    '</div>' +
    '<div style="padding:24px 28px;">' +
    '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;">' +
    rowsHtml + '</table>' +
    (bodyExtra ? '<div style="margin-top:20px;font-size:14px;color:#475569;line-height:1.7;">' + bodyExtra + '</div>' : '') +
    '</div>' +
    '<div style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">' +
    'อีเมล์นี้ส่งจากระบบจัดซื้อจัดจ้างโดยอัตโนมัติ กรุณาอย่าตอบกลับ' +
    '</div></div></body></html>';
}

// helper ส่งอีเมล์ผ่าน GmailApp (ลด spam มากกว่า MailApp)
function sendMail_(to, subject, htmlBody) {
  try {
    GmailApp.sendEmail(to, subject, '', { htmlBody: htmlBody, name: 'ระบบจัดซื้อจัดจ้าง โรงเรียนบ้านคลอง 14' });
  } catch(e) {
    // fallback ถ้า GmailApp ไม่ได้รับสิทธิ์
    try { MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, name: 'ระบบจัดซื้อจัดจ้าง โรงเรียนบ้านคลอง 14' }); }
    catch(e2) { Logger.log('sendMail error: ' + e2.message); }
  }
}

// ครูกด "ส่งตรวจรับ" → เปลี่ยน status + สร้าง token + ส่งอีเมล์ผู้ตรวจรับ
function submitForInspection_(p) {
  const id           = String(p.request_id    || '');
  const teacherEmail = String(p.teacher_email || '');
  if (!id) throw new Error('ไม่พบ request_id');

  const existing = getRows_(CONFIG.SHEETS.REQUESTS).find(r => String(r.request_id) === id);
  if (!existing) throw new Error('ไม่พบคำขอซื้อ');
  if (existing.status !== 'ร่าง') throw new Error('คำขอนี้ถูกส่งแล้ว');

  const token = Utilities.getUuid();
  const updated = Object.assign({}, existing, {
    updated_at:    fmtDate_(),
    status:        'รออนุมัติ',
    inspect_token: token,
    teacher_email: teacherEmail
  });
  replaceRows_(CONFIG.SHEETS.REQUESTS, 'request_id', id, [updated]);

  // หา inspector ที่มี email
  const inspectors = getRows_(CONFIG.SHEETS.USERS).filter(u =>
    String(u.role) === 'inspector' && String(u.active) !== 'false' && u.email
  );
  if (!inspectors.length) return { ok: true, message: 'บันทึกเรียบร้อย แต่ไม่พบอีเมล์ผู้ตรวจรับ', request_id: id };

  const scriptUrl  = ScriptApp.getService().getUrl();
  const confirmUrl = scriptUrl + '?action=confirmByToken&data=' + encodeURIComponent(JSON.stringify({ token }));

  const subject = 'แจ้งรอตรวจรับพัสดุ: ' + (existing.project_name || '') + ' (' + id + ')';
  const html = buildEmailHtml_(
    '📦 มีคำขอซื้อรอตรวจรับ',
    [
      ['เลขที่คำขอ', id],
      ['โครงการ',    existing.project_name || '-'],
      ['ผู้ขอ',      existing.teacher_name || '-'],
      ['ร้าน/บริษัท', existing.vendor_name || '-'],
      ['ยอดรวม',     Number(existing.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:2}) + ' บาท']
    ],
    '<a href="' + confirmUrl + '" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">✅ คลิกเพื่อยืนยันตรวจรับ</a>' +
    '<div style="margin-top:10px;font-size:12px;color:#94a3b8;">(ลิงก์นี้ใช้ได้ครั้งเดียว)</div>'
  );

  inspectors.forEach(function(insp) {
    sendMail_(insp.email, subject, html);
  });

  return { ok: true, message: 'ส่งคำขอและอีเมล์แจ้งผู้ตรวจรับเรียบร้อย', request_id: id };
}

// ผู้ตรวจรับคลิกลิงก์ → ยืนยัน + ส่งอีเมล์กลับครู
function confirmByToken_(p) {
  const token = String(p.token || '');
  if (!token) throw new Error('ไม่พบ token');

  const existing = getRows_(CONFIG.SHEETS.REQUESTS).find(function(r) {
    return String(r.inspect_token) === token;
  });
  if (!existing) throw new Error('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว');
  if (existing.status === 'ตรวจรับแล้ว') {
    return { ok: true, message: 'ตรวจรับแล้วก่อนหน้านี้', request_id: existing.request_id };
  }

  var inspName = p.inspector_name || getSetting_('procurement_officer_name','');
  var inspPos  = p.inspector_position || getSetting_('procurement_officer_position','');
  var recvDate = (p.receive_date || fmtDate_()).split(' ')[0];

  var updated = Object.assign({}, existing, {
    updated_at:         fmtDate_(),
    status:             'ตรวจรับแล้ว',
    inspector_name:     inspName,
    inspector_position: inspPos,
    receive_date:       recvDate,
    approved_by:        inspName,
    approved_at:        fmtDate_(),
    inspect_token:      ''
  });
  replaceRows_(CONFIG.SHEETS.REQUESTS, 'request_id', existing.request_id, [updated]);

  // ส่งอีเมล์กลับครู
  var teacherEmail = String(existing.teacher_email || '');
  if (teacherEmail) {
    var subj = 'ตรวจรับพัสดุเรียบร้อย: ' + (existing.project_name || '') + ' (' + existing.request_id + ')';
    var html = buildEmailHtml_(
      '✅ ตรวจรับพัสดุเรียบร้อยแล้ว',
      [
        ['เลขที่คำขอ',  existing.request_id],
        ['โครงการ',       existing.project_name || '-'],
        ['ยอดรวม',        Number(existing.total_amount||0).toLocaleString('th-TH',{minimumFractionDigits:2}) + ' บาท'],
        ['เลขที่บันทึก',   existing.doc_no       || '-'],
        ['เลขที่ใบเสนอราคา', existing.quote_no   || '-'],
        ['ร้าน/บริษัท',   existing.vendor_name   || '-'],
        ['ตรวจรับโดย',    inspName],
        ['วันที่ตรวจรับ', recvDate]
      ],
      'กรุณาเข้าระบบเพื่อดำเนินการขั้นตอนต่อไป'
    );
    sendMail_(teacherEmail, subj, html);
  }

  return { ok: true, message: 'ยืนยันตรวจรับเรียบร้อย', request_id: existing.request_id };
}

// ── ขอสิทธิ์ใช้งาน MailApp (รันครั้งเดียวใน Apps Script Editor) ──────────
// เปิด Apps Script Editor → เลือกฟังก์ชัน requestMailPermission → กด Run
// ระบบจะถามสิทธิ์ Gmail ให้กดอนุญาต
function requestMailPermission() {
  try {
    // ทดสอบส่งอีเมล์หาตัวเอง เพื่อให้ระบบ trigger การขอสิทธิ์
    const me = Session.getActiveUser().getEmail();
    MailApp.sendEmail({
      to:      me,
      subject: '[ระบบจัดซื้อ] ทดสอบสิทธิ์อีเมล์',
      body:
        'อีเมล์นี้ส่งเพื่อยืนยันว่าระบบได้รับสิทธิ์ส่งอีเมล์เรียบร้อยแล้ว\n\n' +
        'หากได้รับอีเมล์นี้ แสดงว่าการตั้งค่าสำเร็จ\n\n' +
        'ระบบจัดซื้อจัดจ้าง โรงเรียนบ้านคลอง 14'
    });
    Logger.log('✅ ส่งอีเมล์ทดสอบไปที่ ' + me + ' เรียบร้อย สิทธิ์ได้รับการอนุญาตแล้ว');
    return { ok: true, email: me, message: 'สิทธิ์อีเมล์พร้อมใช้งาน' };
  } catch (e) {
    Logger.log('❌ เกิดข้อผิดพลาด: ' + e.message);
    return { ok: false, message: e.message };
  }
}

// ── User Management ───────────────────────────────────────────

function listUsers_() {
  return getRows_(CONFIG.SHEETS.USERS).map(function(u) {
    return {
      user_id:   u.user_id,
      full_name: u.full_name,
      position:  u.position,
      department:u.department,
      username:  u.username,
      email:     u.email || '',
      role:      u.role,
      active:    String(u.active) !== 'false'
    };
    // ไม่ส่ง password กลับไปยัง client
  });
}

function saveUser_(p) {
  var sh     = getSheet_(CONFIG.SHEETS.USERS);
  var vals   = sh.getDataRange().getValues();
  var hdrs   = vals[0];
  var idIdx  = hdrs.indexOf('user_id');
  var isNew  = !p.user_id;

  // validate
  if (!p.full_name) throw new Error('กรุณากรอกชื่อ-นามสกุล');
  if (!p.username)  throw new Error('กรุณากรอก Username');
  if (!p.role)      throw new Error('กรุณาเลือกบทบาท');

  // ตรวจ username ซ้ำ (ยกเว้นตัวเอง)
  var rows = getRows_(CONFIG.SHEETS.USERS);
  var dup = rows.find(function(u) {
    return String(u.username) === String(p.username) && String(u.user_id) !== String(p.user_id||'');
  });
  if (dup) throw new Error('Username "' + p.username + '" ถูกใช้งานแล้ว');

  if (isNew) {
    // สร้าง user_id ใหม่
    var prefix = p.role === 'inspector' ? 'I' : p.role === 'admin' ? 'A' : 'U';
    var existing = rows.filter(function(u) { return String(u.user_id).startsWith(prefix); });
    var nextNo = String(existing.length + 1).padStart(3, '0');
    p.user_id = prefix + nextNo;
    if (!p.password) throw new Error('กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่');
  }

  var existing = rows.find(function(u) { return String(u.user_id) === String(p.user_id); });
  var row = {
    user_id:    p.user_id,
    full_name:  p.full_name,
    position:   p.position   || '',
    department: p.department  || '',
    username:   p.username,
    password:   p.password    || (existing ? existing.password : ''),  // ถ้าไม่ส่งมา ใช้เดิม
    role:       p.role,
    active:     p.active === 'false' || p.active === false ? false : true,
    email:      p.email       || ''
  };

  replaceRows_(CONFIG.SHEETS.USERS, 'user_id', p.user_id, [row]);
  return { ok: true, message: isNew ? 'เพิ่มผู้ใช้เรียบร้อย' : 'บันทึกเรียบร้อย', user_id: p.user_id };
}

function deleteUser_(p) {
  var id = String(p.user_id || '');
  if (!id) throw new Error('ไม่พบ user_id');
  // soft delete — ตั้ง active = false แทนลบจริง
  var rows = getRows_(CONFIG.SHEETS.USERS);
  var u = rows.find(function(r) { return String(r.user_id) === id; });
  if (!u) throw new Error('ไม่พบผู้ใช้: ' + id);
  var updated = Object.assign({}, u, { active: false });
  replaceRows_(CONFIG.SHEETS.USERS, 'user_id', id, [updated]);
  return { ok: true, message: 'ระงับผู้ใช้เรียบร้อย' };
}
