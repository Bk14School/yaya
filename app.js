// ============================================================
// ระบบจัดซื้อจัดจ้าง — Frontend Logic
// ============================================================
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxpTckV1QF5ngK1ohpj3tsozfbJmT_JFJGYz45XK564wf6S_I04xx-alDnvNAk1e6_ajA/exec';

const App = {
  user: null,
  schoolProfile: {},
  systemSettings: {},
  requests: [],
  currentId: null,
  currentReq: null,
  currentItems: []
};

// ── DOM helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = el => { const e = typeof el==='string'?$(el):el; if(e) e.style.display=''; };
const hide = el => { const e = typeof el==='string'?$(el):el; if(e) e.style.display='none'; };
const val  = id => $(id)?.value?.trim() || '';
const setVal = (id, v) => { if($(id)) $(id).value = v || ''; };

function escHtml(s) {
  return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

// ── Format helpers ────────────────────────────────────────────
function fmtMoney(n) {
  return Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtInt(n) { return Number(n||0).toLocaleString('th-TH'); }

function thaiDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  const m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()+543}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function numberToThai(num) {
  num = Number(num||0);
  if (!num) return 'ศูนย์บาทถ้วน';
  const n = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const d = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
  function read(s) {
    let r='';
    s = String(parseInt(s,10));
    const len = s.length;
    for(let i=0;i<len;i++){
      const dg=Number(s[i]), pos=len-i-1;
      if(!dg) continue;
      // หลักสิบ
      if(pos===1){
        if(dg===1) { r+='สิบ'; continue; }
        if(dg===2) { r+='ยี่สิบ'; continue; }
        r+=n[dg]+'สิบ'; continue;
      }
      // หลักหน่วย: เอ็ดใช้เฉพาะเมื่อมีหลักสิบ (ตัวเลขก่อนหน้า pos==1) ด้วย
      if(pos===0 && dg===1 && len>1 && Number(s[i-1])>0) { r+='เอ็ด'; continue; }
      r+=n[dg]+d[pos];
    }
    return r;
  }
  const [ip,dp] = num.toFixed(2).split('.');
  let txt = ip.length>6 ? read(ip.slice(0,-6))+'ล้าน'+read(ip.slice(-6)) : read(ip);
  txt += 'บาท';
  txt += Number(dp)===0 ? 'ถ้วน' : read(dp)+'สตางค์';
  return txt;
}

// ── Status badge ──────────────────────────────────────────────
function statusBadge(s) {
  const map = {
    'ร่าง':        'background:#f1f5f9;color:#475569;',
    'รออนุมัติ':   'background:#fef9c3;color:#854d0e;',
    'ตรวจรับแล้ว': 'background:#dcfce7;color:#166534;',
    'เบิกจ่ายแล้ว':'background:#dbeafe;color:#1e40af;'
  };
  const style = map[s] || 'background:#f1f5f9;color:#475569;';
  return `<span style="${style}padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">${escHtml(s)}</span>`;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type='info') {
  const box = $('toastBox');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `toast-item toast-${type}`;
  div.textContent = msg;
  box.appendChild(div);
  setTimeout(()=>div.classList.add('show'), 10);
  setTimeout(()=>{ div.classList.remove('show'); setTimeout(()=>div.remove(),250); }, 3000);
}

// ── Loading ───────────────────────────────────────────────────
function setLoading(on, msg='กำลังโหลด...') {
  const el = $('globalLoading');
  if (!el) return;
  if (on) { el.innerHTML = `<div class="loading-card">${escHtml(msg)}</div>`; show(el); }
  else hide(el);
}

// ── Local storage ─────────────────────────────────────────────
const saveUserLocal = u => localStorage.setItem('pur_user', JSON.stringify(u));
const loadUser   = () => { try { return JSON.parse(localStorage.getItem('pur_user')||'null'); } catch{ return null; } };
const clearUser  = () => localStorage.removeItem('pur_user');

// ── API (JSONP for GET, fetch for POST) ───────────────────────
function apiGet(action, payload={}) {
  return new Promise((resolve, reject) => {
    const cb = '__cb_' + Date.now() + '_' + Math.floor(Math.random()*1e5);
    const sc = document.createElement('script');
    let done = false;
    window[cb] = res => { done=true; cleanup(); resolve(res); };
    sc.onerror = () => { cleanup(); reject(new Error('API error: '+action)); };
    function cleanup() { try{delete window[cb];}catch{} if(sc.parentNode) sc.parentNode.removeChild(sc); }
    const qs = new URLSearchParams({ action, callback: cb, data: JSON.stringify(payload) });
    sc.src = WEB_APP_URL + '?' + qs;
    setTimeout(()=>{ if(!done){ cleanup(); reject(new Error('Timeout: '+action)); } }, 18000);
    document.body.appendChild(sc);
  });
}

async function apiPost(action, payload={}) {
  const body = new URLSearchParams({ action, data: JSON.stringify(payload) });
  const res = await fetch(WEB_APP_URL, { method:'POST', body });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const api = (action, payload={}, method='GET') =>
  method==='POST' ? apiPost(action,payload) : apiGet(action,payload);

// ── View control ──────────────────────────────────────────────
function showView(name) {
  // ── รองรับ layout sidebar ใหม่ (index.html มี appShell + viewLogin แยกกัน) ──
  const loginEl  = document.getElementById('viewLogin');
  const shellEl  = document.getElementById('appShell');
  const hasSidebar = !!shellEl;

  if (hasSidebar) {
    if (name === 'Login') {
      if (loginEl) loginEl.style.display = 'block';
      if (shellEl) shellEl.style.display = 'none';
    } else {
      if (loginEl) loginEl.style.display = 'none';
      if (shellEl) shellEl.style.display = 'grid';
      // สลับ active class ระหว่าง view
      ['viewPublic','viewTeacher','viewInspector','viewAdmin'].forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.remove('active');
      });
      const target = document.getElementById('view' + name);
      if (target) target.classList.add('active');
      // topbar title
      const titles = {Public:'ภาพรวมระบบ', Teacher:'คำขอซื้อ', Inspector:'รายการตรวจรับ', Admin:'จัดการระบบ'};
      const titleEl = document.getElementById('topbarTitle');
      if (titleEl) titleEl.textContent = titles[name] || '';
      // sidebar nav active
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      const navMap = {Public:'navPublic', Teacher:'navTeacherNew', Inspector:'navInspector', Admin:'navAdminList'};
      const navId = navMap[name];
      if (navId) { const el = document.getElementById(navId); if (el) el.classList.add('active'); }
    }
  } else {
    // fallback: layout เดิม (ถ้าไม่มี sidebar)
    ['viewPublic','viewLogin','viewTeacher','viewInspector','viewAdmin'].forEach(v => hide(v));
    show('view' + name);
  }
  updateTopbar();
}

function updateTopbar() {
  const u = App.user;
  const hasSidebar = !!document.getElementById('appShell');

  if (hasSidebar) {
    // ── sidebar layout ── อัปเดต user pill และ nav items
    const footerEl = document.getElementById('sidebarUserFooter');
    const authEl   = document.getElementById('sidebarAuthSection');
    const logoutEl = document.getElementById('sidebarLogoutSection');
    // ซ่อน nav ที่ต้อง role ทุกตัวก่อน
    ['navTeacherNew','navTeacherList','navInspector','navAdminList','navAdminDash','navAdminSettings']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    if (u) {
      if (footerEl) footerEl.style.display = 'block';
      if (authEl)   authEl.style.display   = 'none';
      if (logoutEl) logoutEl.style.display  = 'block';
      const nm = document.getElementById('sidebarUserName');
      const rl = document.getElementById('sidebarUserRole');
      const av = document.getElementById('sidebarUserAvatar');
      if (nm) nm.textContent = u.full_name;
      if (rl) rl.textContent = u.role==='admin'?'แอดมิน':u.role==='inspector'?'เจ้าหน้าที่ตรวจรับ':'ครู';
      if (av) av.textContent = (u.full_name||'U')[0];
      // แสดง nav ตาม role
      if (u.role === 'teacher') {
        ['navTeacherNew','navTeacherList'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display=''; });
      } else if (u.role === 'inspector') {
        const el = document.getElementById('navInspector'); if (el) el.style.display = '';
      } else if (u.role === 'admin') {
        ['navAdminList','navAdminDash','navAdminSettings'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display=''; });
      }
    } else {
      if (footerEl) footerEl.style.display = 'none';
      if (authEl)   authEl.style.display   = 'block';
      if (logoutEl) logoutEl.style.display  = 'none';
    }
  } else {
    // ── fallback: layout เดิม ──
    if (u) {
      if($('topUserName')) $('topUserName').textContent = u.full_name;
      if($('topUserRole')) $('topUserRole').textContent = u.role==='admin'?'แอดมิน':u.role==='inspector'?'เจ้าหน้าที่ตรวจรับ':'ครู';
      show('topUserInfo'); hide('btnLogin'); show('btnLogout');
      if($('adminNav')) u.role==='admin'?show('adminNav'):hide('adminNav');
    } else {
      hide('topUserInfo'); show('btnLogin'); hide('btnLogout');
      if($('adminNav')) hide('adminNav');
    }
  }
}

// ── Init ──────────────────────────────────────────────────────
async function initApp() {
  App.user = loadUser();
  updateTopbar();

  setLoading(true, 'กำลังโหลดข้อมูล...');
  try {
    const [sp, st] = await Promise.all([api('getSchoolProfile'), api('getSystemSettings')]);
    if (sp.ok) { App.schoolProfile = sp.profile||{}; bindSchoolToUI(); }
    if (st.ok) App.systemSettings = st.settings||{};
  } catch(e){ console.error(e); }
  finally { setLoading(false); }

  if (App.user) {
    await afterLogin();
  } else {
    showView('Public');
    await loadPublicDashboard();
  }

  bindEvents();
}

async function afterLogin() {
  const u = App.user;
  if (!u) return;
  if (u.role === 'inspector') {
    showView('Inspector');
    await loadInspectorList();
  } else if (u.role === 'admin') {
    showView('Admin');
    bindSettingsForm();
    await loadAdminList();
  } else {
    showView('Teacher');
    prepareTeacherForm();
    await loadMyRequests();
  }
}

// ── School profile ────────────────────────────────────────────
function bindSchoolToUI() {
  const p = App.schoolProfile;
  ['schoolName','schoolAreaOffice','schoolAddress','schoolPhone','schoolTaxId','schoolFiscalYear'].forEach(id => {
    const key = id.replace('school','').replace(/^./,c=>c.toLowerCase());
    const map = { Name:'school_name', AreaOffice:'area_office', Address:'school_address', Phone:'school_phone', TaxId:'school_tax_id', FiscalYear:'fiscal_year' };
    const suffix = id.replace('school','');
    if ($(id)) $(id).textContent = p[map[suffix]||''] || '-';
  });
}

// ── Public dashboard ──────────────────────────────────────────
async function loadPublicDashboard() {
  try {
    const res = await api('getDashboard');
    if (!res.ok) return;
    renderSummaryCards(res.summary||{}, res.status_count||{});
    renderDeptTable(res.departments||[]);
    renderRecentTable(res.recent_requests||[]);
  } catch(e){ console.error(e); }
}

function renderSummaryCards(s, sc) {
  sc = sc || s.status_count || {};
  setEl('sumTotal',  fmtMoney(s.total_budget));
  setEl('sumUsed',   fmtMoney(s.used_budget));
  setEl('sumRemain', fmtMoney(s.remain_budget));
  setEl('sumCount',  fmtInt(s.request_count));
  setEl('sumDraft',    fmtInt(sc['ร่าง']||0));
  setEl('sumPending',  fmtInt(sc['รออนุมัติ']||0));
  setEl('sumReceived', fmtInt(sc['ตรวจรับแล้ว']||0));
  setEl('sumPaid',     fmtInt(sc['เบิกจ่ายแล้ว']||0));

  // ── progress bars (layout ใหม่) ──
  const total  = Number(s.total_budget||1);
  const used   = Number(s.used_budget||0);
  const remain = Number(s.remain_budget||0);
  const usedPct   = Math.min(100,(used/total*100)).toFixed(1);
  const remainPct = Math.min(100,(remain/total*100)).toFixed(1);
  const fillUsed   = $('fillUsed');   if(fillUsed)   fillUsed.style.width   = usedPct+'%';
  const fillRemain = $('fillRemain'); if(fillRemain) fillRemain.style.width = remainPct+'%';
  setEl('sumUsedPct',   usedPct+'% ของงบรวม');
  setEl('sumRemainPct', remainPct+'% ยังใช้ได้');
}

function setEl(id, txt) { if($(id)) $(id).textContent = txt; }

function renderDeptTable(rows) {
  // ── layout ใหม่ (sidebar) ──────────────────────────────────
  // deptBarList = horizontal bar list, deptDonut = donut chart
  const DEPT_COLORS_APP = ['#1d4ed8','#15803d','#b45309','#7c3aed','#be185d','#0e7490','#c2410c'];

  const barEl = $('deptBarList');
  if (barEl) {
    if (!rows.length) {
      barEl.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:16px;font-size:13px;">ไม่มีข้อมูล</div>';
    } else {
      const max = Math.max(...rows.map(d => Number(d.budget_total)||0), 1);
      barEl.innerHTML = rows.filter(d => Number(d.budget_total)>0).map((d,i) => {
        const pct = ((Number(d.budget_total)/max)*100).toFixed(0);
        const color = DEPT_COLORS_APP[i % DEPT_COLORS_APP.length];
        return `<div class="dept-row">
          <div class="dept-dot" style="background:${color};"></div>
          <div class="dept-name">${escHtml(d.dept_name)}</div>
          <div class="dept-track"><div class="dept-fill" style="width:${pct}%;background:${color};"></div></div>
          <div class="dept-num">${Number(d.budget_total).toLocaleString('th-TH',{minimumFractionDigits:0})}</div>
        </div>`;
      }).join('');
    }
    // build donut ถ้า Chart.js โหลดเสร็จแล้ว
    if (rows.length && typeof Chart !== 'undefined' && typeof buildDonut === 'function') {
      buildDonut('deptDonut','deptLegend', rows);
      buildDonut('adminDeptDonut','adminDeptLegend', rows);
    } else if (rows.length) {
      // เก็บ cache ไว้ให้ Chart.js callback ดึงไปใช้เมื่อโหลดเสร็จ
      window._cachedDepts = rows;
    }
    return; // layout ใหม่จัดการแล้ว
  }

  // ── layout เดิม (deptTableBody) ───────────────────────────
  const el = $('deptTableBody');
  if (!el) return;
  if (!rows.length) { el.innerHTML='<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">ไม่มีข้อมูล</td></tr>'; return; }
  el.innerHTML = rows.map(r=>`
    <tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escHtml(r.color||'#64748b')};margin-right:6px;"></span>${escHtml(r.dept_name)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_total)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_used)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_remain)}</td>
      <td style="text-align:center;">${fmtInt(r.request_count)}</td>
    </tr>`).join('');
}

function renderRecentTable(rows) {
  const chipMap = {'ร่าง':'chip-draft','รออนุมัติ':'chip-pending','ตรวจรับแล้ว':'chip-received','เบิกจ่ายแล้ว':'chip-paid'};

  // ── layout ใหม่ (recentList) ───────────────────────────────
  const newEl = $('recentList');
  if (newEl) {
    if (!rows.length) {
      newEl.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px;">ยังไม่มีรายการ</div>';
      return;
    }
    newEl.innerHTML = rows.slice(0,10).map(r => `
      <div class="recent-item">
        <div class="req-id">${escHtml(r.request_id||'')}</div>
        <div class="req-name">${escHtml(r.project_name||'-')}</div>
        <div class="req-amt">${fmtMoney(r.total_amount)}</div>
        <span class="chip ${chipMap[r.status]||'chip-draft'}">${escHtml(r.status||'')}</span>
        ${r.status!=='ร่าง'?`<button class="btn-action btn-print" onclick="printById('${escHtml(r.request_id||'')}')">🖨️</button>`:''}
      </div>`).join('');
    return;
  }

  // ── layout เดิม (recentTableBody) ─────────────────────────
  const el = $('recentTableBody');
  if (!el) return;
  if (!rows.length) { el.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">ยังไม่มีรายการ</td></tr>'; return; }
  el.innerHTML = rows.map(r=>`
    <tr>
      <td style="font-size:13px;color:#64748b;">${escHtml((r.created_at||'').split(' ')[0])}</td>
      <td>${escHtml(r.teacher_name||'')}</td>
      <td>${escHtml(r.project_name||'')}</td>
      <td style="text-align:right;">${fmtMoney(r.total_amount)}</td>
      <td>${escHtml(r.vendor_name||'-')}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="text-align:center;">${r.status!=='ร่าง'?`<button class="btn-action btn-print" onclick="printById('${escHtml(r.request_id||'')}')">🖨️ พิมพ์</button>`:'-'}</td>
    </tr>`).join('');
}

// ── Login / Logout ────────────────────────────────────────────
async function handleLogin(ev) {
  ev.preventDefault();
  const username = val('loginUser'), password = val('loginPass');
  if (!username||!password) { toast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน','error'); return; }
  setLoading(true,'กำลังเข้าสู่ระบบ...');
  try {
    const res = await api('login',{username,password});
    if (!res.ok) throw new Error(res.message||'เข้าสู่ระบบไม่สำเร็จ');
    App.user = res.user;
    saveUserLocal(App.user);
    if($('loginForm')) $('loginForm').reset();
    toast('ยินดีต้อนรับ '+App.user.full_name,'success');
    await afterLogin();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

function handleLogout() {
  App.user=null; clearUser();
  App.currentId=null; App.currentReq=null; App.currentItems=[];
  showView('Public');
  loadPublicDashboard();
  toast('ออกจากระบบแล้ว');
}

// ── Teacher view ──────────────────────────────────────────────
function prepareTeacherForm() {
  setVal('reqDate', todayISO());
  setVal('reqTeacher', App.user?.full_name||'');
  setVal('reqDept', App.user?.department||'');
  setVal('reqDelivery', App.systemSettings.default_delivery_days||'7');
  setVal('reqStatus','ร่าง');
  setVal('reqId','');
  setVal('reqPoNo','');
  if ($('reqProcType')) {
    $('reqProcType').value = 'จัดซื้อ';
    $('reqProcType').addEventListener('change', () => {
      const isHire = $('reqProcType').value === 'จัดจ้าง';
      if ($('fieldScopeOfWork')) $('fieldScopeOfWork').style.display = isHire ? '' : 'none';
    });
  }
  setVal('reqDocNo','');
  setVal('reqProject','');
  setVal('reqReason','');
  setVal('reqBudgetSource','');
  setVal('reqActivity','');
  setVal('reqVendor','');
  setVal('reqVendorAddr','');
  setVal('reqVendorTax','');
  setVal('reqVendorPhone','');
  setVal('reqQuoteNo','');
  setVal('reqQuoteDate','');
  clearItemsTable();
  addItemRow();
  calcTotal();
}

async function loadMyRequests() {
  try {
    const res = await api('listRequests',{ user_id: App.user.user_id, role: App.user.role });
    if (!res.ok) throw new Error(res.message);
    App.requests = res.requests||[];
    renderMyRequests(App.requests);
  } catch(e){ console.error(e); }
}

function renderMyRequests(rows) {
  const el = $('myReqBody');
  if (!el) return;
  if (!rows.length) { el.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">ยังไม่มีรายการคำขอซื้อ</td></tr>'; return; }
  el.innerHTML = rows.map(r=>`
    <tr>
      <td style="font-size:13px;font-weight:600;color:#2563eb;">${escHtml(r.request_id||'')}</td>
      <td style="font-size:13px;color:#64748b;">${escHtml((r.request_date||r.created_at||'').split(' ')[0])}</td>
      <td>${escHtml(r.project_name||'')}</td>
      <td style="text-align:right;">${fmtMoney(r.total_amount)}</td>
      <td>${escHtml(r.vendor_name||'-')}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="text-align:center;">
        <button class="btn-action" onclick="openRequest('${escHtml(r.request_id||'')}')">เปิด</button>
        ${r.status==='ร่าง'?`<button class="btn-action btn-send" onclick="submitRequest('${escHtml(r.request_id||'')}')">ส่ง</button>`:''}
      </td>
    </tr>`).join('');
}

async function openRequest(id) {
  if (!id) return;
  setLoading(true,'กำลังโหลด...');
  try {
    const res = await api('getRequest',{request_id:id});
    if (!res.ok) throw new Error(res.message);
    App.currentId  = id;
    App.currentReq = res.request||{};
    App.currentItems = res.items||[];
    bindReqToForm(App.currentReq, App.currentItems);
    // เลื่อนไปที่ฟอร์ม
    $('reqFormSection')?.scrollIntoView({behavior:'smooth'});
    toast('โหลดคำขอซื้อเรียบร้อย','success');
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

function bindReqToForm(req, items) {
  const fields = ['request_id','request_date','teacher_name','department','project_name','reason',
    'budget_source','activity_name','vendor_name','vendor_address','vendor_tax_id','vendor_phone',
    'delivery_days','status','doc_no','quote_no','quote_date','po_no'];
  const ids    = ['reqId','reqDate','reqTeacher','reqDept','reqProject','reqReason',
    'reqBudgetSource','reqActivity','reqVendor','reqVendorAddr','reqVendorTax','reqVendorPhone',
    'reqDelivery','reqStatus','reqDocNo','reqQuoteNo','reqQuoteDate','reqPoNo'];
  fields.forEach((f,i) => setVal(ids[i], req[f]||''));
  if ($('reqProcType')) $('reqProcType').value = req.proc_type || 'จัดซื้อ';
  setVal('reqScopeOfWork', req.scope_of_work || '');
  const isHire = (req.proc_type || 'จัดซื้อ') === 'จัดจ้าง';
  if ($('fieldScopeOfWork')) $('fieldScopeOfWork').style.display = isHire ? '' : 'none';

  clearItemsTable();
  (items||[]).forEach(it => addItemRow(it));
  if (!(items||[]).length) addItemRow();
  calcTotal();
}

async function saveRequestForm() {
  if (!App.user) { toast('กรุณาเข้าสู่ระบบก่อน','error'); return; }
  const totalAmt = calcTotal();
  const req = {
    proc_type:     $('reqProcType')?.value || 'จัดซื้อ',
    po_no:         val('reqPoNo'),
    scope_of_work: $('reqScopeOfWork')?.value || '',
    request_id:    val('reqId'),
    request_date:  val('reqDate'),
    teacher_id:    App.user.user_id,
    teacher_name:  val('reqTeacher'),
    department:    val('reqDept'),
    project_name:  val('reqProject'),
    reason:        val('reqReason'),
    budget_source: val('reqBudgetSource'),
    activity_name: val('reqActivity'),
    vendor_name:   val('reqVendor'),
    vendor_address:val('reqVendorAddr'),
    vendor_tax_id: val('reqVendorTax'),
    vendor_phone:  val('reqVendorPhone'),
    delivery_days: val('reqDelivery'),
    doc_no:        val('reqDocNo'),
    quote_no:      val('reqQuoteNo'),
    quote_date:    val('reqQuoteDate'),
    total_amount:  totalAmt,
    total_amount_text: numberToThai(totalAmt),
    status:        val('reqStatus')||'ร่าง',
    created_at:    App.currentReq?.created_at||''
  };

  if (!req.project_name) { toast('กรุณากรอกชื่อโครงการ','error'); return; }

  const items = getItemsFromTable();
  if (!items.length) { toast('กรุณาเพิ่มรายการพัสดุ','error'); return; }

  setLoading(true,'กำลังบันทึก...');
  try {
    const res = await api('saveRequest',{request:req,items},'POST');
    if (!res.ok) throw new Error(res.message);
    setVal('reqId', res.request_id);
    setVal('reqPoNo', res.po_no || '');
    App.currentId = res.request_id;
    App.currentReq = {...req, request_id: res.request_id};
    App.currentItems = items;
    toast('บันทึกเรียบร้อยแล้ว','success');
    await loadMyRequests();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

async function submitRequest(id) {
  if (!id && !(id=val('reqId'))) { toast('กรุณาบันทึกก่อน','error'); return; }
  if (!confirm('ส่งคำขอซื้อเพื่อรอตรวจรับ? ระบบจะส่งอีเมล์แจ้งผู้ตรวจรับโดยอัตโนมัติ')) return;

  const teacherEmail = App.user?.email || '';
  if (!teacherEmail) {
    toast('ไม่พบอีเมล์ของท่านในระบบ กรุณาให้ Admin เพิ่มอีเมล์ก่อน','error');
    return;
  }

  setLoading(true,'กำลังส่งคำขอและแจ้งผู้ตรวจรับ...');
  try {
    const r = await api('submitForInspection', { request_id: id, teacher_email: teacherEmail }, 'POST');
    if (!r.ok) throw new Error(r.message);
    toast('ส่งคำขอเรียบร้อย ผู้ตรวจรับได้รับอีเมล์แล้ว 📧','success');
    if (App.currentId === id && App.currentReq) {
      App.currentReq = { ...App.currentReq, status: 'รออนุมัติ' };
      setVal('reqStatus','รออนุมัติ');
    }
    await loadMyRequests();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

async function printRequest() {
  const id = val('reqId') || App.currentId;
  if (!id) { toast('กรุณาบันทึกก่อนพิมพ์','error'); return; }
  // เปิด popup ก่อน fetch เพื่อป้องกัน popup blocker
  const w = window.open('','_blank');
  if (!w) { toast('กรุณาอนุญาต popup ในเบราว์เซอร์','error'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:20px;">กำลังเตรียมเอกสาร...</body></html>');
  setLoading(true,'กำลังเตรียมเอกสาร...');
  try {
    const res = await api('getRequest',{request_id:id});
    if (!res.ok) throw new Error(res.message);
    const html = buildPurchasePrintHtml(res.request, res.items, App.systemSettings, App.schoolProfile);
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>{ w.focus(); w.print(); },600);
  } catch(e){ w.close(); toast(e.message,'error'); }
  finally { setLoading(false); }
}

// ── Items table ───────────────────────────────────────────────
function clearItemsTable() {
  const b = $('itemsBody');
  if (b) b.innerHTML = '';
}

function addItemRow(item={}) {
  const b = $('itemsBody');
  if (!b) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="tbl-input item_name" value="${escHtml(item.item_name||'')}" placeholder="ชื่อรายการ"></td>
    <td><input type="number" class="tbl-input qty" value="${escHtml(item.qty||'')}" min="0" step="1" style="text-align:right;"></td>
    <td><input type="text" class="tbl-input unit" value="${escHtml(item.unit||'')}" placeholder="หน่วย"></td>
    <td><input type="number" class="tbl-input unit_price" value="${escHtml(item.unit_price||'')}" min="0" step="0.01" style="text-align:right;"></td>
    <td><input type="number" class="tbl-input amount" value="${escHtml(item.amount||'')}" readonly style="text-align:right;background:#f8fafc;"></td>
    <td>
      <select class="tbl-input price_source">
        <option value="">-- เลือก --</option>
        <option value="ราคามาตรฐาน" ${item.price_source==='ราคามาตรฐาน'?'selected':''}>ราคามาตรฐาน</option>
        <option value="สืบจากท้องตลาด" ${item.price_source==='สืบจากท้องตลาด'?'selected':''}>สืบจากท้องตลาด</option>
      </select>
    </td>
    <td style="text-align:center;"><button type="button" class="btn-del" onclick="if(confirm('ลบรายการนี้?'))this.closest('tr').remove(),calcTotal();">✕</button></td>`;
  const q=tr.querySelector('.qty'), p=tr.querySelector('.unit_price'), a=tr.querySelector('.amount');
  const calc=()=>{ a.value=(Number(q.value||0)*Number(p.value||0)).toFixed(2); calcTotal(); };
  q.addEventListener('input',calc); p.addEventListener('input',calc);
  b.appendChild(tr);
}

function calcTotal() {
  let t=0;
  document.querySelectorAll('#itemsBody .amount').forEach(a=>{ t+=Number(a.value||0); });
  if($('totalDisplay')) $('totalDisplay').textContent = fmtMoney(t);
  if($('totalText'))    $('totalText').textContent    = numberToThai(t);
  return t;
}

function getItemsFromTable() {
  const items=[];
  document.querySelectorAll('#itemsBody tr').forEach(tr=>{
    const name=tr.querySelector('.item_name')?.value.trim()||'';
    const qty =Number(tr.querySelector('.qty')?.value||0);
    const unit=tr.querySelector('.unit')?.value.trim()||'';
    const up  =Number(tr.querySelector('.unit_price')?.value||0);
    const amt =Number(tr.querySelector('.amount')?.value||0);
    const ps  =tr.querySelector('.price_source')?.value||'';
    if (!name && !qty && !up) return;
    items.push({ item_name:name, qty, unit, unit_price:up, amount:amt, price_source:ps });
  });
  return items;
}

function resetForm() {
  App.currentId=null; App.currentReq=null; App.currentItems=[];
  prepareTeacherForm();
}

// ── Inspector view ────────────────────────────────────────────
async function loadInspectorList() {
  try {
    const res = await api('listRequests',{ role:'inspector' });
    if (!res.ok) throw new Error(res.message);
    App._inspRows = res.requests||[];
    renderInspectorList(App._inspRows);
  } catch(e){ toast(e.message,'error'); }
}

function renderInspectorList(rows) {
  const el = $('inspectorListBody');
  if (!el) return;
  // apply filter
  const q = ($('inspSearchInput')?.value||'').toLowerCase();
  const s = $('inspStatusFilter')?.value||'';
  const filtered = rows.filter(r => {
    const matchQ = !q || (r.request_id||'').toLowerCase().includes(q) ||
      (r.teacher_name||'').toLowerCase().includes(q) ||
      (r.project_name||'').toLowerCase().includes(q) ||
      (r.vendor_name||'').toLowerCase().includes(q);
    const matchS = !s || r.status === s;
    return matchQ && matchS;
  });
  if (!filtered.length) { el.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">ไม่พบรายการ</td></tr>'; return; }
  el.innerHTML = filtered.map(r=>`
    <tr>
      <td style="font-size:13px;font-weight:600;color:#2563eb;">${escHtml(r.request_id||'')}</td>
      <td style="font-size:13px;color:#64748b;">${escHtml((r.request_date||r.created_at||'').split(' ')[0])}</td>
      <td>${escHtml(r.teacher_name||'')}</td>
      <td>${escHtml(r.project_name||'')}</td>
      <td style="text-align:right;">${fmtMoney(r.total_amount)}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="text-align:center;">
        <button class="btn-action" onclick="openInspectForm('${escHtml(r.request_id||'')}')">ตรวจรับ/ดู</button>
        ${r.status!=='ร่าง'?`<button class="btn-action btn-print" onclick="printById('${escHtml(r.request_id||'')}')">พิมพ์</button>`:''}
      </td>
    </tr>`).join('');
}

async function openInspectForm(id) {
  setLoading(true,'กำลังโหลด...');
  try {
    const res = await api('getRequest',{request_id:id});
    if (!res.ok) throw new Error(res.message);
    App.currentId    = id;
    App.currentReq   = res.request||{};
    App.currentItems = res.items||[];
    const req = App.currentReq;

    // ── chip สถานะ ──
    const chipEl = $('inspStatusChip');
    if (chipEl) {
      const chipMap = {'ร่าง':'chip-draft','รออนุมัติ':'chip-pending','ตรวจรับแล้ว':'chip-received','เบิกจ่ายแล้ว':'chip-paid'};
      chipEl.className = 'chip ' + (chipMap[req.status]||'chip-draft');
      chipEl.textContent = req.status||'-';
    }

    // ── bind header ──
    setEl('inspReqId', req.request_id||'');
    setEl('inspAmount', fmtMoney(req.total_amount));

    // ── bind ข้อมูลครู (แก้ไขได้) ──
    setVal('inspEditDate',        (req.request_date||'').split('T')[0]||'');
    setVal('inspEditTeacher',     req.teacher_name||'');
    setVal('inspEditDept',        req.department||'');
    setVal('inspEditDocNo',       req.doc_no||'');
    setVal('inspEditProject',     req.project_name||'');
    setVal('inspEditDelivery',    req.delivery_days||'7');
    setVal('inspEditReason',      req.reason||'');
    setVal('inspEditBudgetSource',req.budget_source||'');
    setVal('inspEditActivity',    req.activity_name||'');
    setVal('inspEditVendor',      req.vendor_name||'');
    setVal('inspEditVendorPhone', req.vendor_phone||'');
    setVal('inspEditVendorTax',   req.vendor_tax_id||'');
    setVal('inspEditVendorAddr',  req.vendor_address||'');
    setVal('inspEditQuoteNo',     req.quote_no||'');
    setVal('inspEditQuoteDate',   (req.quote_date||'').split('T')[0]||'');

    // ── ตารางรายการพัสดุ editable ──
    const tbody = $('inspItemsBody');
    if (tbody) {
      tbody.innerHTML = '';
      const items = App.currentItems||[];
      if (items.length) items.forEach(it => inspAddItemRow(it));
      else inspAddItemRow();
    }
    inspCalcTotal();

    // ── bind ข้อมูลตรวจรับ ──
    // ชื่อ: ใช้ที่บันทึกไว้ก่อน ถ้าไม่มีดึงจาก login
    const defaultName = req.inspector_name || (App.user ? App.user.full_name : '');
    // ตำแหน่ง: ใช้ที่บันทึกไว้ก่อน → position จาก user → ดึงชื่อโรงเรียนจาก profile
    const schoolName  = App.schoolProfile && App.schoolProfile.school_name
                        ? 'ครูโรงเรียน' + App.schoolProfile.school_name
                        : 'ครูโรงเรียนบ้านคลอง 14';
    const defaultPos  = req.inspector_position || (App.user ? App.user.position : '') || schoolName;
    setVal('inspName',     defaultName);
    setVal('inspPosition', defaultPos);
    setVal('inspReceive',        (req.receive_date||'').split('T')[0]||'');
    setVal('inspInvNo',          req.invoice_no||'');
    setVal('inspInvDate',        (req.invoice_date||'').split('T')[0]||'');
    setVal('inspLateDays',       req.late_days||'0');
    setVal('inspPenalty',        req.penalty||'0');
    setVal('inspWithholdingTax', req.withholding_tax||'0');
    setVal('inspNotes',          req.notes||'');
    setVal('inspNewStatus',      req.status||'ตรวจรับแล้ว');

    // auto-calc penalty
    const lateDaysEl = $('inspLateDays');
    const penaltyEl  = $('inspPenalty');
    if (lateDaysEl && penaltyEl) {
      lateDaysEl.oninput = () => {
        const days  = Number(lateDaysEl.value||0);
        const total = Number(App.currentReq?.total_amount||0);
        if (days > 0 && total > 0) penaltyEl.value = (days * 0.002 * total).toFixed(2);
      };
    }

    show('inspectFormPanel');
    $('inspectFormPanel')?.scrollIntoView({behavior:'smooth'});
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

// ── ตาราง items editable สำหรับผู้ตรวจรับ ────────────────────
function inspAddItemRow(item={}) {
  const tbody = $('inspItemsBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid #f1f5f9';
  const psOpts = ['','ราคามาตรฐาน','สืบจากท้องตลาด'].map(v =>
    `<option value="${v}" ${item.price_source===v?'selected':''}>${v||'-- เลือก --'}</option>`).join('');
  tr.innerHTML = `
    <td style="padding:4px 6px;"><input type="text" class="tbl-input insp-name" value="${escHtml(item.item_name||'')}" placeholder="ชื่อรายการ" style="width:100%;border:none;background:transparent;font-size:13px;padding:4px;"></td>
    <td style="padding:4px 6px;"><input type="number" class="tbl-input insp-qty" value="${escHtml(String(item.qty||''))}" min="0" step="1" style="width:100%;border:none;background:transparent;font-size:13px;text-align:right;padding:4px;"></td>
    <td style="padding:4px 6px;"><input type="text" class="tbl-input insp-unit" value="${escHtml(item.unit||'')}" placeholder="หน่วย" style="width:100%;border:none;background:transparent;font-size:13px;padding:4px;"></td>
    <td style="padding:4px 6px;"><input type="number" class="tbl-input insp-price" value="${escHtml(String(item.unit_price||''))}" min="0" step="0.01" style="width:100%;border:none;background:transparent;font-size:13px;text-align:right;padding:4px;"></td>
    <td style="padding:4px 6px;"><select class="tbl-input insp-ps" style="width:100%;border:none;background:transparent;font-size:12px;padding:2px;">${psOpts}</select></td>
    <td style="padding:4px 6px;text-align:right;font-size:13px;font-weight:600;" class="insp-amt">${item.amount ? fmtMoney(item.amount) : ''}</td>
    <td style="padding:4px 6px;text-align:center;"><button type="button" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;" onclick="if(confirm('ลบรายการนี้?')){this.closest('tr').remove();inspCalcTotal();}">✕</button></td>`;
  const q = tr.querySelector('.insp-qty'), p = tr.querySelector('.insp-price'), a = tr.querySelector('.insp-amt');
  const calc = () => {
    const amt = (Number(q.value||0) * Number(p.value||0));
    a.textContent = amt ? fmtMoney(amt) : '';
    inspCalcTotal();
  };
  q.addEventListener('input', calc); p.addEventListener('input', calc);
  // focus style
  tr.querySelectorAll('.tbl-input').forEach(el => {
    el.addEventListener('focus', () => el.style.outline = '2px solid #2563eb');
    el.addEventListener('blur',  () => el.style.outline = '');
  });
  tbody.appendChild(tr);
}

function inspCalcTotal() {
  let total = 0;
  document.querySelectorAll('#inspItemsBody tr').forEach(tr => {
    const q = tr.querySelector('.insp-qty');
    const p = tr.querySelector('.insp-price');
    total += Number(q?.value||0) * Number(p?.value||0);
  });
  const el = $('inspAmount');
  if (el) el.textContent = fmtMoney(total);
  return total;
}

function inspGetItemsFromTable() {
  const items = [];
  document.querySelectorAll('#inspItemsBody tr').forEach((tr, i) => {
    const name  = tr.querySelector('.insp-name')?.value.trim()||'';
    const qty   = Number(tr.querySelector('.insp-qty')?.value||0);
    const unit  = tr.querySelector('.insp-unit')?.value.trim()||'';
    const price = Number(tr.querySelector('.insp-price')?.value||0);
    const amt   = qty * price;
    const ps    = tr.querySelector('.insp-ps')?.value||'';
    if (!name && !qty && !price) return;
    items.push({ item_id: `${App.currentId}-I${i+1}`, request_id: App.currentId, item_name: name, qty, unit, unit_price: price, amount: amt, price_source: ps });
  });
  return items;
}

// บันทึกการแก้ไขข้อมูลครูและรายการพัสดุโดยผู้ตรวจรับ
async function saveInspectEdit() {
  if (!App.currentId) { toast('กรุณาเลือกคำขอซื้อก่อน','error'); return; }
  const req = App.currentReq || {};
  const newItems = inspGetItemsFromTable();
  const totalAmt = newItems.reduce((s, it) => s + (it.amount||0), 0);
  const updated = {
    ...req,
    request_date:   val('inspEditDate')         || req.request_date,
    teacher_name:   val('inspEditTeacher')       || req.teacher_name,
    department:     val('inspEditDept')          || req.department,
    doc_no:         val('inspEditDocNo')         || req.doc_no,
    project_name:   val('inspEditProject')       || req.project_name,
    delivery_days:  val('inspEditDelivery')      || req.delivery_days,
    reason:         val('inspEditReason')        || req.reason,
    budget_source:  val('inspEditBudgetSource')  || req.budget_source,
    activity_name:  val('inspEditActivity')      || req.activity_name,
    vendor_name:    val('inspEditVendor')        || req.vendor_name,
    vendor_phone:   val('inspEditVendorPhone')   || req.vendor_phone,
    vendor_tax_id:  val('inspEditVendorTax')     || req.vendor_tax_id,
    vendor_address: val('inspEditVendorAddr')    || req.vendor_address,
    quote_no:       val('inspEditQuoteNo')       || req.quote_no,
    quote_date:     val('inspEditQuoteDate')     || req.quote_date,
    total_amount:   totalAmt,
    total_amount_text: typeof numberToThai === 'function' ? numberToThai(totalAmt) : req.total_amount_text,
  };
  setLoading(true,'กำลังบันทึก...');
  try {
    const res = await api('saveRequest',{request: updated, items: newItems},'POST');
    if (!res.ok) throw new Error(res.message);
    App.currentReq   = updated;
    App.currentItems = newItems;
    // อัปเดตยอดรวมใน header
    setEl('inspAmount', fmtMoney(totalAmt));
    toast('บันทึกการแก้ไขข้อมูลเรียบร้อย','success');
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

async function saveInspect() {
  if (!App.currentId) { toast('กรุณาเลือกคำขอซื้อก่อน','error'); return; }
  const p = {
    request_id:         App.currentId,
    inspector_name:     val('inspName'),
    inspector_position: val('inspPosition'),
    receive_date:       val('inspReceive'),
    invoice_no:         val('inspInvNo'),
    invoice_date:       val('inspInvDate'),
    late_days:          val('inspLateDays')||'0',
    penalty:            val('inspPenalty')||'0',
    withholding_tax:    val('inspWithholdingTax')||'0',
    notes:              val('inspNotes'),
    status:             val('inspNewStatus')||'ตรวจรับแล้ว',
    approved_by:        App.user.full_name,
    approved_at:        new Date().toISOString()
  };
  if (!p.inspector_name) { toast('กรุณากรอกชื่อผู้ตรวจรับ','error'); return; }
  setLoading(true,'กำลังบันทึก...');
  try {
    const res = await api('approveRequest',p,'POST');
    if (!res.ok) throw new Error(res.message);
    toast('บันทึกการตรวจรับเรียบร้อย','success');
    App.currentReq = {...App.currentReq, ...p};
    await loadInspectorList();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

async function printById(id) {
  const w = window.open('','_blank');
  if (!w) { toast('กรุณาอนุญาต popup ในเบราว์เซอร์','error'); return; }
  w.document.write('<html><body style="font-family:sans-serif;padding:20px;">กำลังเตรียมเอกสาร...</body></html>');
  setLoading(true,'กำลังเตรียมเอกสาร...');
  try {
    const res = await api('getRequest',{request_id:id});
    if (!res.ok) throw new Error(res.message);
    const html = buildPurchasePrintHtml(res.request, res.items, App.systemSettings, App.schoolProfile);
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>{ w.focus(); w.print(); },600);
  } catch(e){ w.close(); toast(e.message,'error'); }
  finally { setLoading(false); }
}

function renderAdminDashboard(summary, statusCount, departments) {
  const s  = summary    || {};
  const sc = statusCount || {};
  const setA = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
  setA('adminSumTotal',  fmtMoney(s.total_budget));
  setA('adminSumUsed',   fmtMoney(s.used_budget));
  setA('adminSumRemain', fmtMoney(s.remain_budget));
  setA('adminSumCount',  fmtInt(s.request_count));
  const el = document.getElementById('adminDeptTableBody');
  if (!el) return;
  if (!departments || !departments.length) { el.innerHTML='<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">ไม่มีข้อมูล</td></tr>'; return; }
  el.innerHTML = departments.map(r=>`
    <tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escHtml(r.color||'#64748b')};margin-right:6px;"></span>${escHtml(r.dept_name)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_total)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_used)}</td>
      <td style="text-align:right;">${fmtMoney(r.budget_remain)}</td>
      <td style="text-align:center;">${fmtInt(r.request_count)}</td>
    </tr>`).join('');
}

// ── Admin view ────────────────────────────────────────────────
async function loadAdminList() {
  try {
    const res = await api('listRequests',{ role:'admin' });
    if (!res.ok) throw new Error(res.message);
    App._adminRows = res.requests||[];
    renderAdminList(App._adminRows);
    const db = await api('getDashboard');
    if (db.ok) { renderAdminDashboard(db.summary||{}, db.status_count||{}, db.departments||[]); }
  } catch(e){ console.error(e); }
}

function renderAdminList(rows) {
  const el = $('adminListBody');
  if (!el) return;
  const q = ($('adminSearchInput')?.value||'').toLowerCase();
  const s = $('adminStatusFilter')?.value||'';
  const filtered = rows.filter(r => {
    const matchQ = !q || (r.request_id||'').toLowerCase().includes(q) ||
      (r.teacher_name||'').toLowerCase().includes(q) ||
      (r.project_name||'').toLowerCase().includes(q) ||
      (r.vendor_name||'').toLowerCase().includes(q);
    const matchS = !s || r.status === s;
    return matchQ && matchS;
  });
  if (!filtered.length) { el.innerHTML='<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">ไม่พบรายการ</td></tr>'; return; }
  el.innerHTML = filtered.map(r=>`
    <tr>
      <td style="font-size:13px;font-weight:600;color:#2563eb;">${escHtml(r.request_id||'')}</td>
      <td style="font-size:13px;color:#64748b;">${escHtml((r.request_date||r.created_at||'').split(' ')[0])}</td>
      <td>${escHtml(r.teacher_name||'')}</td>
      <td>${escHtml(r.project_name||'')}</td>
      <td style="text-align:right;">${fmtMoney(r.total_amount)}</td>
      <td>${escHtml(r.vendor_name||'-')}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="text-align:center;">
        <button class="btn-action btn-print" onclick="printById('${escHtml(r.request_id||'')}')">พิมพ์</button>
      </td>
    </tr>`).join('');
}

function bindSettingsForm() {
  const s = App.systemSettings;
  ['procurement_officer_name','procurement_officer_position','procurement_head_name','procurement_head_position',
   'director_name','director_position','finance_officer_name','finance_officer_position',
   'default_delivery_days','vat_rate',
   'school_bank_account','school_bank_account_name','school_bank_name','school_bank_branch'].forEach(id => { if($(id)) $(id).value = s[id]||''; });
}

async function saveSettings() {
  const payload = {};
  ['procurement_officer_name','procurement_officer_position','procurement_head_name','procurement_head_position',
   'director_name','director_position','finance_officer_name','finance_officer_position',
   'default_delivery_days','vat_rate',
   'school_bank_account','school_bank_account_name','school_bank_name','school_bank_branch'].forEach(id => { if($(id)) payload[id]=$(id).value; });
  setLoading(true,'กำลังบันทึก...');
  try {
    const res = await api('saveSystemSettings',payload,'POST');
    if (!res.ok) throw new Error(res.message);
    App.systemSettings = {...App.systemSettings,...payload};
    toast('บันทึกตั้งค่าเรียบร้อย','success');
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

// ── User Management (Admin) ───────────────────────────────────
let _allUsers = [];

async function loadUserList() {
  const el = $('userListBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px;">กำลังโหลด...</td></tr>';
  try {
    const res = await api('listUsers');
    if (!res.ok) throw new Error(res.message);
    _allUsers = res.users || [];
    renderUserList(_allUsers);
  } catch(e) { toast(e.message, 'error'); }
}

function renderUserList(users) {
  const el = $('userListBody');
  if (!el) return;
  const roleLabel = { teacher:'ครู', inspector:'ผู้ตรวจรับ', admin:'แอดมิน' };
  if (!users.length) {
    el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px;">ไม่มีผู้ใช้</td></tr>';
    return;
  }
  el.innerHTML = users.map(u => `
    <tr style="opacity:${u.active?'1':'.45'}">
      <td style="font-size:12px;color:#64748b;">${escHtml(u.user_id)}</td>
      <td style="font-weight:600;">${escHtml(u.full_name)}</td>
      <td style="font-size:13px;">${escHtml(u.position||'-')}</td>
      <td style="font-size:13px;">${escHtml(u.department||'-')}</td>
      <td style="font-size:13px;font-family:monospace;">${escHtml(u.username)}</td>
      <td style="font-size:13px;color:#2563eb;">${escHtml(u.email||'-')}</td>
      <td><span style="padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${u.role==='admin'?'#f5f3ff;color:#7c3aed':u.role==='inspector'?'#fef9c3;color:#854d0e':'#eff6ff;color:#1d4ed8'};">${escHtml(roleLabel[u.role]||u.role)}</span></td>
      <td style="text-align:center;"><span style="font-size:12px;${u.active?'color:#16a34a':'color:#dc2626'}">${u.active?'✅ ใช้งาน':'⛔ ระงับ'}</span></td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn-action" onclick="openUserModal(${JSON.stringify(u).replaceAll('"','&quot;')})">แก้ไข</button>
        ${u.active ? `<button class="btn-action" style="color:#dc2626;" onclick="deleteUser('${escHtml(u.user_id)}','${escHtml(u.full_name)}')">ระงับ</button>` : ''}
      </td>
    </tr>`).join('');
}

function openUserModal(u) {
  const modal = $('userModal');
  if (!modal) return;
  const isEdit = !!u;
  $('userModalTitle').textContent = isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่';
  $('uPassHint').textContent = isEdit ? '(เว้นว่างเพื่อไม่เปลี่ยน)' : '(จำเป็น)';
  setVal('uId',       isEdit ? u.user_id   : '');
  setVal('uName',     isEdit ? u.full_name : '');
  setVal('uPosition', isEdit ? u.position  : '');
  setVal('uDept',     isEdit ? u.department: '');
  setVal('uUsername', isEdit ? u.username  : '');
  setVal('uPassword', '');
  setVal('uEmail',    isEdit ? u.email     : '');
  if ($('uRole'))   $('uRole').value   = isEdit ? u.role               : 'teacher';
  if ($('uActive')) $('uActive').value = isEdit ? String(u.active)     : 'true';
  modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = $('userModal');
  if (modal) modal.style.display = 'none';
}

async function saveUser() {
  const payload = {
    user_id:    val('uId'),
    full_name:  val('uName'),
    position:   val('uPosition'),
    department: val('uDept'),
    username:   val('uUsername'),
    password:   $('uPassword')?.value || '',
    email:      val('uEmail'),
    role:       $('uRole')?.value   || 'teacher',
    active:     $('uActive')?.value || 'true'
  };
  if (!payload.full_name) { toast('กรุณากรอกชื่อ-นามสกุล','error'); return; }
  if (!payload.username)  { toast('กรุณากรอก Username','error'); return; }
  setLoading(true,'กำลังบันทึก...');
  try {
    const res = await api('saveUser', payload, 'POST');
    if (!res.ok) throw new Error(res.message);
    toast(res.message || 'บันทึกเรียบร้อย','success');
    closeUserModal();
    await loadUserList();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

async function deleteUser(id, name) {
  if (!confirm(`ระงับการใช้งานของ "${name}"?\n(ข้อมูลยังคงอยู่ สามารถเปิดใช้งานได้ภายหลัง)`)) return;
  setLoading(true,'กำลังดำเนินการ...');
  try {
    const res = await api('deleteUser', { user_id: id }, 'POST');
    if (!res.ok) throw new Error(res.message);
    toast('ระงับผู้ใช้เรียบร้อย','success');
    await loadUserList();
  } catch(e){ toast(e.message,'error'); }
  finally { setLoading(false); }
}

// ── Event bindings ────────────────────────────────────────────
function bindEvents() {
  $('btnLogin')?.addEventListener('click', ()=>showView('Login'));
  $('btnLogout')?.addEventListener('click', handleLogout);
  $('btnBackHome')?.addEventListener('click', ()=>{ showView('Public'); loadPublicDashboard(); });

  $('loginForm')?.addEventListener('submit', handleLogin);

  // Teacher
  $('btnAddItem')?.addEventListener('click', ()=>addItemRow());
  $('btnSaveReq')?.addEventListener('click', saveRequestForm);
  $('btnSubmitReq')?.addEventListener('click', ()=>submitRequest(val('reqId')));
  $('btnPrintReq')?.addEventListener('click', printRequest);
  $('btnResetReq')?.addEventListener('click', resetForm);
  $('btnRefreshMyList')?.addEventListener('click', loadMyRequests);

  // Inspector
  $('btnSaveInspect')?.addEventListener('click', saveInspect);
  $('btnPrintInspect')?.addEventListener('click', ()=>printById(App.currentId));
  $('btnRefreshInspect')?.addEventListener('click', loadInspectorList);

  // Inspector search/filter
  $('inspSearchInput')?.addEventListener('input', ()=>renderInspectorList(App._inspRows||[]));
  $('inspStatusFilter')?.addEventListener('change', ()=>renderInspectorList(App._inspRows||[]));

  // Admin search/filter
  $('adminSearchInput')?.addEventListener('input', ()=>renderAdminList(App._adminRows||[]));
  $('adminStatusFilter')?.addEventListener('change', ()=>renderAdminList(App._adminRows||[]));

  // Admin
  $('btnSaveSettings')?.addEventListener('click', saveSettings);
  $('btnRefreshAdmin')?.addEventListener('click', loadAdminList);
}

document.addEventListener('DOMContentLoaded', initApp);