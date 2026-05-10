// ==============================
// Helpers
// ==============================
function esc(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function num(v) {
  return Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function thaiDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}
function thaiYear() { return new Date().getFullYear()+543; }
function amountText(req) { return esc(req.total_amount_text||''); }

// คำนวณวันครบกำหนดส่งมอบ = request_date + delivery_days วัน
function calcDeliveryDue(reqDateStr, deliveryDays) {
  var days = parseInt(deliveryDays, 10) || 0;
  if (!reqDateStr || !days) return { full: '', day: '', monthName: '', year: '' };
  var base = new Date(reqDateStr);
  if (isNaN(base.getTime())) return { full: '', day: '', monthName: '', year: '' };
  var due = new Date(base);
  due.setDate(due.getDate() + days);
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var d  = due.getDate();
  var mn = months[due.getMonth()];
  var yr = due.getFullYear() + 543;
  return { full: d+' '+mn+' '+yr, day: String(d), monthName: mn, year: String(yr) };
}

const GARUDA = 'https://raw.githubusercontent.com/Bk14School/png/refs/heads/main/%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%84%E0%B8%A3%E0%B8%B8%E0%B8%91%203cm.png';

// SVG ครุฑ fallback กรณีโหลดรูปไม่ได้
const GARUDA_SVG = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 180'%3E%3Cstyle%3Epath%7Bfill:%23a0760a%7D circle%7Bfill:%23000%7D%3C/style%3E%3Cellipse cx='80' cy='105' rx='22' ry='32'/%3E%3Cellipse cx='80' cy='67' rx='18' ry='16'/%3E%3Cpath d='M80 73 L90 80 L80 84Z'/%3E%3Cpath d='M65 58 L69 46 L73 55 L77 43 L80 54 L83 43 L87 55 L91 46 L95 58Z'/%3E%3Cpath d='M58 88 C43 75 22 70 4 80 C18 87 36 90 50 95 C41 99 28 101 14 105 C30 107 48 103 58 98 C55 105 49 114 46 124 C58 115 65 104 68 95Z'/%3E%3Cpath d='M102 88 C117 75 138 70 156 80 C142 87 124 90 110 95 C119 99 132 101 146 105 C130 107 112 103 102 98 C105 105 111 114 114 124 C102 115 95 104 92 95Z'/%3E%3Cpath d='M68 136 C63 144 57 152 50 158 C59 154 68 147 72 139Z'/%3E%3Cpath d='M80 138 C80 148 79 159 77 168 C80 161 83 151 83 141Z'/%3E%3Cpath d='M92 136 C97 144 103 152 110 158 C101 154 92 147 88 139Z'/%3E%3Ccircle cx='74' cy='64' r='2.5'/%3E%3Ccircle cx='86' cy='64' r='2.5'/%3E%3C/svg%3E`;

function garudaImg(style) {
  return `<img src="${GARUDA}" style="${style}" alt="ครุฑ" onerror="this.onerror=null;this.src='${GARUDA_SVG}';">`;
}

// เส้นขีดรองรับข้อมูล — เส้นยาวตามข้อมูล + padding เล็กน้อย
function FL(minW, val) {
  if (val && String(val).trim() && String(val).trim() !== '&nbsp;') {
    // มีข้อมูล: แสดงข้อมูลพร้อมเส้นใต้ยาวตามข้อมูล + padding
    return `<span style="display:inline-block;border-bottom:1px solid #000;vertical-align:bottom;padding:0 4px;min-width:${minW||0}px;">${val}</span>`;
  }
  // ไม่มีข้อมูล: แสดงเส้นว่างตาม minWidth
  return `<span style="display:inline-block;min-width:${minW||60}px;border-bottom:1px solid #000;vertical-align:bottom;padding:0 2px;">&nbsp;</span>`;
}

// ข้อมูลในย่อหน้า — มีข้อมูล: แสดงธรรมดา (ไม่มีเส้น), ว่าง: แสดงเส้นให้กรอก
function FD(minW, val) {
  if (val && String(val).trim()) {
    return `<span>${val}</span>`;
  }
  return `<span style="display:inline-block;min-width:${minW||60}px;border-bottom:1px solid #000;vertical-align:bottom;padding:0 2px;">&nbsp;</span>`;
}

// บล็อกลายเซ็น 1 คน กึ่งกลาง
// label = "ลงชื่อ" หรือ "(ลงชื่อ)"
// name  = ชื่อ-นามสกุล (ใส่ในวงเล็บให้อัตโนมัติ)
// role  = ตำแหน่ง (แสดงใต้ชื่อ)
function signBlock(label, name, role) {
  return `<div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;text-align:center;">
    <div>${label} ${FL(200,'')}</div>
    <div>(${esc(name||'')})</div>
    ${role ? `<div>${role}</div>` : ''}
    <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
  </div>`;
}

// ลายเซ็น 2 คอลัมน์
// n1,n2 = ชื่อ-นามสกุล | r1,r2 = ตำแหน่ง
function sign2col(n1, r1, n2, r2) {
  return `<div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div style="text-align:center;">
      <div>ลงชื่อ ${FL(180,'')}</div>
      <div>(${esc(n1||'')})</div>
      ${r1 ? `<div>${r1}</div>` : ''}
      <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
    </div>
    <div style="text-align:center;">
      <div>ลงชื่อ ${FL(180,'')}</div>
      <div>(${esc(n2||'')})</div>
      ${r2 ? `<div>${r2}</div>` : ''}
      <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
    </div>
  </div>`;
}

// หัวบันทึกข้อความ
function memoHeader() {
  return `<div style="position:relative;text-align:center;margin-bottom:4mm;min-height:1.8cm;display:flex;align-items:center;justify-content:center;">
    ${garudaImg('position:absolute;left:0;top:50%;transform:translateY(-50%);height:1.6cm;')}
    <div style="font-size:30px;font-weight:700;">บันทึกข้อความ</div>
  </div>`;
}

// ฟิลด์ส่วนราชการ / ที่ / วันที่  — เส้นใต้ยาวเต็มบรรทัดตามฟอร์มราชการ
function memoFields(sn, reqDate, teeNum) {
  return `<table style="width:100%;border-collapse:collapse;font-size:15px;margin-bottom:3mm;">
    <tr>
      <td style="white-space:nowrap;font-weight:700;padding:3px 8px 3px 0;width:82px;vertical-align:bottom;">ส่วนราชการ</td>
      <td style="border-bottom:1px solid #000;padding:2px 4px;vertical-align:bottom;">โรงเรียน ${sn}</td>
    </tr>
    <tr>
      <td style="white-space:nowrap;font-weight:700;padding:3px 8px 3px 0;vertical-align:bottom;">ที่</td>
      <td style="border-bottom:1px solid #000;padding:2px 4px;width:38%;vertical-align:bottom;">ศธ.${esc(teeNum||'-')}</td>
      <td style="white-space:nowrap;font-weight:700;padding:3px 8px 3px 16px;vertical-align:bottom;">วันที่</td>
      <td style="border-bottom:1px solid #000;padding:2px 4px;vertical-align:bottom;">${reqDate}</td>
    </tr>
  </table>`;
}

// แถวเรื่อง — เส้นใต้ยาวเต็มบรรทัด
function memoRow(label, val) {
  return `<table style="width:100%;border-collapse:collapse;font-size:15px;margin-bottom:3mm;">
    <tr>
      <td style="white-space:nowrap;font-weight:700;padding:2px 8px 2px 0;width:82px;vertical-align:bottom;">${label}</td>
      <td style="border-bottom:1px solid #000;padding:2px 4px;vertical-align:bottom;">${val}</td>
    </tr>
  </table>`;
}

// หัวตารางพัสดุ
function itemTableHead(withPS) {
  return `<thead>
    <tr>
      <th rowspan="2" style="width:42px;">ลำดับที่</th>
      <th rowspan="2">รายละเอียดของวัสดุที่จะซื้อ</th>
      <th rowspan="2" style="width:70px;">จำนวน<br>หน่วย</th>
      ${withPS ? `<th style="width:130px;">( ) ราคามาตรฐาน<br>( ) ราคาที่ได้จากการ<br>สืบจากท้องตลาด<br>(หน่วยละ)</th>` : ''}
      <th colspan="2">จำนวนและวงเงินที่จะขอซื้อครั้งนี้</th>
    </tr>
    <tr>
      ${withPS ? '<th></th>' : ''}
      <th style="width:80px;">หน่วยละ</th>
      <th style="width:90px;">จำนวนเงิน</th>
    </tr>
  </thead>`;
}

// แถวรายการพัสดุ
function itemTableRows(items, startNo, withPS) {
  return items.map((it, i) => {
    const no = it.item_name ? startNo + i + 1 : '';
    const ps = withPS ? `<td style="text-align:center;font-size:13px;">${esc(it.price_source||'')}</td>` : '';
    return `<tr>
      <td style="text-align:center;">${no}</td>
      <td>${esc(it.item_name||'')}</td>
      <td style="text-align:center;">${esc(it.qty||'')}${it.unit ? ' '+esc(it.unit) : ''}</td>
      ${ps}
      <td style="text-align:right;">${it.unit_price ? num(it.unit_price) : ''}</td>
      <td style="text-align:right;">${it.amount ? num(it.amount) : ''}</td>
    </tr>`;
  }).join('');
}

// ==============================
// Main builder
// ==============================
function buildPurchasePrintHtml(req, items, settings, school) {
  const total        = num(req.total_amount||0);
  const totalText    = amountText(req);
  const reqDate      = thaiDateLong(req.request_date||req.created_at||'');
  const sn           = esc(school.school_name||'');
  const areaOffice   = esc(school.area_office||'');
  const schoolAddr   = esc(school.school_address||'');
  const schoolPhone  = esc(school.school_phone||'');
  const schoolTax    = esc(school.school_tax_id||'');
  const yr           = thaiYear();
  const deliveryDays = esc(req.delivery_days||settings.default_delivery_days||'7');
  const deliveryDue  = calcDeliveryDue(req.request_date||req.created_at||'', deliveryDays);
  const docNo        = esc(req.doc_no||'');
  const quoteNo      = esc(req.quote_no||'');
  const quoteDate    = thaiDateLong(req.quote_date||'');
  const poNo         = esc(req.po_no||req.request_id||'');
  const procType     = req.proc_type || 'จัดซื้อ';
  const isBuy        = procType !== 'จัดจ้าง';
  const docTypeName  = isBuy ? 'จัดซื้อ'       : 'จัดจ้าง';
  const poTypeName   = isBuy ? 'ใบสั่งซื้อ'    : 'ใบสั่งจ้าง';
  const recvTypeName = isBuy ? 'ใบตรวจรับพัสดุ' : 'ใบตรวจรับงานจ้าง';
  const vendorLabel  = isBuy ? 'ร้าน/หจก./บริษัท' : 'ผู้รับจ้าง';
  const inspName     = esc(req.inspector_name||'');
  const inspPos      = esc(req.inspector_position||'');
  const receiveDate  = thaiDateLong(req.receive_date||'');
  const invoiceNo    = esc(req.invoice_no||'');
  const invoiceDate  = thaiDateLong(req.invoice_date||'');
  const lateDays     = esc(req.late_days||'0');
  const penalty      = num(req.penalty||0);
  const whtax        = num(req.withholding_tax||0);
  const netPay       = num(Math.max(0, Number(req.total_amount||0) - Number(req.penalty||0) - Number(req.withholding_tax||0)));
  const bankAccount  = esc(settings.school_bank_account||'');
  const bankAccName  = esc(settings.school_bank_account_name||'');
  const bankBankName = esc(settings.school_bank_name||'');
  const bankBranch   = esc(settings.school_bank_branch||'');
  // บัญชีร้านค้า/ผู้รับจ้าง (จากฟอร์ม)
  const vBankAccount  = esc(req.vendor_bank_account    ||'');
  const vBankAccName  = esc(req.vendor_bank_name       ||'');
  const vBankBankName = esc(req.vendor_bank_bank_name  ||'');
  const vBankBranch   = esc(req.vendor_bank_branch     ||'');
  const officerName  = esc(settings.procurement_officer_name||'');
  const officerPos   = esc(settings.procurement_officer_position||'เจ้าหน้าที่พัสดุ');
  const headName     = esc(settings.procurement_head_name||'');
  const headPos      = esc(settings.procurement_head_position||'หัวหน้าเจ้าหน้าที่พัสดุ');
  const dirName      = esc(settings.director_name||'');
  const dirPos       = esc(settings.director_position||'ผู้อำนวยการโรงเรียน');
  const finName      = esc(settings.finance_officer_name||'');

  const allItems     = (items && items.length) ? items : [{}];
  const itemCount    = allItems.filter(i => i.item_name).length || allItems.length;

  // ชื่อ/นามสกุล ผู้ตรวจรับ
  const inspParts     = inspName ? inspName.split(' ') : [];
  const inspFirst     = inspParts[0] || '';
  const inspLast      = inspParts.slice(1).join(' ') || '';

  const CSS = `<style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;}
    body{font-family:'Sarabun',sans-serif;font-size:15px;line-height:1.55;margin:0;padding:0;color:#000;}
    .page{width:210mm;min-height:297mm;padding:10mm 14mm 12mm 14mm;page-break-after:always;position:relative;background:#fff;}
    .page:last-child{page-break-after:auto;}
    .doc-top{text-align:center;font-size:14px;margin-bottom:3mm;}
    table.dt{width:100%;border-collapse:collapse;font-size:14px;}
    table.dt th,table.dt td{border:1px solid #000;padding:5px 6px;vertical-align:middle;}
    table.dt th{text-align:center;font-weight:700;}
    p{margin:3px 0;line-height:1.65;}
    @media print{body{background:#fff;}.page{box-shadow:none;}}
    @media screen{body{background:#e5e7eb;}.page{box-shadow:0 0 0 1px rgba(0,0,0,.08),0 8px 30px rgba(0,0,0,.12);margin:8mm auto;}}
  </style>`;

  let html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>เอกสารจัดซื้อ ${poNo}</title>${CSS}</head><body>`;

  // ══════════════════════════════════════════════
  // หน้า 1: ปกเอกสาร
  // ══════════════════════════════════════════════
  html += `<div class="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div class="doc-top" style="position:absolute;top:10mm;left:0;right:0;">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${garudaImg('height:3cm;margin-bottom:8mm;')}
    <div style="font-size:20px;font-weight:700;margin-bottom:10mm;text-align:center;">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข)<br>วงเงินไม่เกิน 100,000 บาท</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:6mm;width:100%;max-width:160mm;">เอกสารประกอบด้วย</div>
    <ol style="font-size:15px;line-height:2.2;width:100%;max-width:160mm;">
      ${isBuy ? `
      <li>กำหนดคุณลักษณะเฉพาะพัสดุ (TOR)</li>
      <li>บันทึกข้อความรายงานขอซื้อ พร้อมแต่งตั้งผู้ตรวจรับ จำนวน 1 คน</li>
      <li>รายละเอียดแนบท้ายบันทึกข้อความรายงานขอซื้อ</li>
      <li>รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ</li>
      <li>ใบสั่งซื้อ</li>
      <li>ใบส่งของ/ใบกำกับภาษี</li>
      <li>ใบตรวจรับพัสดุ</li>
      <li>บันทึกข้อความรายงานผลการตรวจรับและขออนุมัติเบิกจ่าย</li>
      ` : `
      <li>ขอบเขตของงานจ้าง (TOR)</li>
      <li>บันทึกข้อความรายงานขอจ้าง พร้อมแต่งตั้งผู้ตรวจรับ จำนวน 1 คน</li>
      <li>รายละเอียดแนบท้ายบันทึกข้อความรายงานขอจ้าง</li>
      <li>รายงานผลการพิจารณาและขออนุมัติสั่งจ้าง</li>
      <li>ใบสั่งจ้าง</li>
      <li>ใบส่งมอบงาน/หนังสือส่งมอบงาน</li>
      <li>ใบตรวจรับงานจ้าง</li>
      <li>บันทึกข้อความรายงานผลการตรวจรับและขออนุมัติเบิกจ่าย</li>
      `}
    </ol>
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 2: TOR
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${isBuy ? `
    <div style="text-align:center;font-size:20px;font-weight:700;margin:2mm 0 3mm;">รายละเอียดคุณลักษณะเฉพาะพัสดุ</div>
    <div style="text-align:center;">จัดซื้อ${FL(140,esc(req.project_name||''))}จำนวน${FL(50,String(itemCount))}รายการ</div>
    <div style="margin-top:2mm;">โรงเรียน${FL(200,sn)} สำนักงานเขตพื้นที่การศึกษาประถมศึกษา${areaOffice}</div>
    <div style="margin-top:4mm;font-weight:700;">1.ชื่อโครงการ ซื้อ${FL(320,esc(req.project_name||''))}</div>
    <div style="margin-top:3mm;font-weight:700;">2.รายละเอียดของพัสดุที่ต้องการ</div>
    <table class="dt" style="margin-top:3px;">
      ${itemTableHead(true)}
      <tbody>
        ${itemTableRows(allItems, 0, true)}
        <tr>
          <td colspan="3" style="text-align:center;font-weight:700;">รวมเป็นเงินทั้งสิ้น (${totalText})</td>
          <td></td><td></td>
          <td style="text-align:right;font-weight:700;">${total}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:5mm;font-weight:700;">3. เกณฑ์ที่ใช้ในการพิจารณา</div>
    <div style="margin-left:16px;">เกณฑ์ราคา</div>
    <div style="margin-top:3mm;font-weight:700;">4. ระยะเวลาที่ต้องการใช้พัสดุ</div>
    <div style="margin-left:16px;">ผู้ขายต้องส่งมอบ ภายใน ${deliveryDays} วัน</div>
    <div style="margin-top:3mm;font-weight:700;">5. วงเงินที่ประมาณที่จะซื้อ</div>
    <div style="margin-left:16px;">เป็นเงิน ${FL(140,total)} บาท (${FL(140,totalText)})</div>
    ` : `
    <div style="text-align:center;font-size:20px;font-weight:700;margin:2mm 0 3mm;">ขอบเขตของงาน (Terms of Reference : TOR)</div>
    <div style="text-align:center;">จัดจ้าง${FL(140,esc(req.project_name||''))}จำนวน${FL(50,String(itemCount))}รายการ</div>
    <div style="margin-top:2mm;">โรงเรียน${FL(200,sn)} สำนักงานเขตพื้นที่การศึกษาประถมศึกษา${areaOffice}</div>
    <div style="margin-top:4mm;font-weight:700;">1. ชื่อโครงการ จ้าง${FL(320,esc(req.project_name||''))}</div>
    <div style="margin-top:3mm;font-weight:700;">2. ขอบเขตของงานจ้าง</div>
    ${(req.scope_of_work ? req.scope_of_work.split('\n').filter(l=>l.trim()) : ['']).map((line,i)=>
      `<div style="margin-left:16px;margin-top:2mm;">${i+1 <= 4 ? (i+1)+'. ' : ''}${esc(line)}</div>`
    ).join('')}
    ${Array.from({length: Math.max(0, 4-(req.scope_of_work||'').split('\n').filter(l=>l.trim()).length)}, (_,i)=>
      `<div style="margin-left:16px;margin-top:2mm;">${(req.scope_of_work||'').split('\n').filter(l=>l.trim()).length+i+1}. ${FL(300,'')}</div>`
    ).join('')}
    <div style="margin-top:5mm;font-weight:700;">3. เกณฑ์ที่ใช้ในการพิจารณา</div>
    <div style="margin-left:16px;">เกณฑ์ราคา</div>
    <div style="margin-top:3mm;font-weight:700;">4. ระยะเวลาที่ต้องการใช้พัสดุ</div>
    <div style="margin-left:16px;">ผู้รับจ้างต้องส่งมอบ ภายใน ${deliveryDays} วัน</div>
    <div style="margin-top:3mm;font-weight:700;">5. วงเงินที่ประมาณที่จะจ้าง</div>
    <div style="margin-left:16px;">เป็นเงิน ${FL(140,total)} บาท (${FL(140,totalText)})</div>
    `}
    ${signBlock('ลงชื่อ', req.teacher_name||'', 'ผู้กำหนดรายละเอียดพัสดุ')}
    ${signBlock('ลงชื่อ', dirName, `ผู้อำนวยการโรงเรียน${sn}`)}
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 3: บันทึกข้อความ รายงานขอซื้อ/จ้าง
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${memoHeader()}
    ${memoFields(sn, reqDate, docNo)}
    ${memoRow('เรื่อง', isBuy ? 'รายงานขอซื้อ' : 'รายงานขอจ้าง')}
    <div style="margin-top:6px;">เรียน&nbsp;&nbsp; ผู้อำนวยการโรงเรียน${sn}</div>
    <p style="text-indent:2.5em;margin-top:5px;line-height:1.7;">ด้วย โรงเรียน ${sn} มีความประสงค์${isBuy ? 'จะขอซื้อ' : 'ขอจ้าง'} ${FD(120,esc(req.project_name||''))} เพื่อ ${FD(100,esc(req.objective||req.reason||''))} โดยเบิกจ่ายจากแผนงาน ${FD(80,esc(req.budget_source||''))} โครงการ ${FD(80,esc(req.project_name||''))} กิจกรรมหลัก ${FD(70,esc(req.activity_name||''))} เป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)})</p>
    <p style="text-indent:2.5em;margin-top:4px;line-height:1.7;">งานพัสดุได้ตรวจสอบแล้วเห็นควร${docTypeName}ตามเสนอ และเพื่อให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 56 วรรคหนึ่ง (2) (ข) และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 22 ข้อ 79 ข้อ 25 (5) และกฎกระทรวงกำหนดวงเงินการจัดซื้อจัดจ้างพัสดุโดยวิธีเฉพาะเจาะจง วงเงินการจัดซื้อจัดจ้างที่ไม่ทำข้อตกลงเป็นหนังสือ และวงเงินการจัดซื้อจัดจ้างในการแต่งตั้งผู้ตรวจรับพัสดุ พ.ศ.2560 ข้อ 1 และข้อ 5</p>
    <div style="margin-top:4px;">จึงขอรายงาน${isBuy ? 'ขอซื้อ' : 'ขอจ้าง'} ดังนี้</div>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;font-size:15px;line-height:1.7;">
      <tr><td style="width:24px;vertical-align:top;">1.</td><td>เหตุผลและความจำเป็นที่ต้อง${isBuy ? 'ซื้อ' : 'จ้าง'} ${FD(160,esc(req.reason||''))}</td></tr>
      <tr><td style="vertical-align:top;">2.</td><td>รายละเอียดและ${isBuy ? 'งานที่จะซื้อ' : 'งานที่จะจ้าง'} ${FD(160,esc(req.item_detail||req.project_name||''))}</td></tr>
      <tr><td style="vertical-align:top;">3.</td><td>ราคากลางของทางราชการเป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)})</td></tr>
      <tr><td style="vertical-align:top;">4.</td><td>วงเงินที่จะขอ${isBuy ? 'ซื้อ' : 'จ้าง'}ครั้งนี้ ${FD(0,total)} บาท (${FD(0,totalText)})</td></tr>
      <tr><td style="vertical-align:top;">5.</td><td>กำหนดเวลาทำงาน ${FD(40,deliveryDays)} วัน นับถัดจากวันลงนามในสัญญา</td></tr>
      <tr><td style="vertical-align:top;">6.</td><td>${isBuy ? 'ซื้อ' : 'จ้าง'}โดยวิธีเฉพาะเจาะจง ตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ มาตรา ๕๖ (๒) (ข) เนื่องจากการจัดซื้อจัดจ้างพัสดุที่มีการผลิต จำหน่าย ก่อสร้าง หรือให้เจ้าหน้าที่ทั่วไป และมีวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน ๕๐๐,๐๐๐.- บาท ตามที่กำหนดในกฎกระทรวง</td></tr>
      <tr><td style="vertical-align:top;">7.</td><td>หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้เกณฑ์ราคา</td></tr>
      <tr><td style="vertical-align:top;">8.</td><td>ข้อเสนออื่น ๆ<br><span style="padding-left:1.5em;">8.1 เห็นควรแต่งตั้งผู้ตรวจรับพัสดุตามเสนอ</span></td></tr>
    </table>
    <div style="margin-top:5px;">จึงเรียนมาเพื่อโปรดพิจารณา</div>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;font-size:15px;line-height:1.7;">
      <tr><td style="width:24px;vertical-align:top;">1.</td><td>เห็นชอบในรายงาน${isBuy ? 'ขอซื้อ' : 'ขอจ้าง'}ดังกล่าวข้างต้น</td></tr>
      <tr><td style="vertical-align:top;">2.</td><td>อนุมัติแต่งตั้งผู้ตรวจรับพัสดุ คือ<br>
        <span style="padding-left:1.5em;">2.1. ชื่อ${FD(60,inspFirst)} นามสกุล ${FD(80,inspLast)} ตำแหน่ง${FD(100,inspPos)} ผู้ตรวจรับพัสดุ</span>
      </td></tr>
    </table>
    ${sign2col(officerName, 'เจ้าหน้าที่', headName, 'หัวหน้าเจ้าหน้าที่')}
    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;text-align:center;">
      <div>- อนุมัติ -</div>
      <div>- เห็นชอบ -</div>
      <div style="margin-top:10mm;">
        <div>ลงชื่อ ${FL(220,'')}</div>
        <div>(${dirName})</div>
        <div>ผู้อำนวยการโรงเรียน${sn}</div>
        <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
      </div>
    </div>
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 4: รายละเอียดแนบท้าย
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:1mm;">รายละเอียดแนบท้ายบันทึกข้อความ ที่ ศธ ${FL(60,docNo)}/${FL(50,yr)} ลงวันที่ ${FL(80,reqDate)}</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:1mm;">งาน${docTypeName}${FL(140,esc(req.project_name||''))} จำนวน ${FL(50,String(itemCount))} รายการ</div>
    <div>โรงเรียน${FL(220,sn)}</div>
    <table class="dt" style="margin-top:4px;">
      ${itemTableHead(true)}
      <tbody>
        ${itemTableRows(allItems, 0, true)}
        <tr>
          <td colspan="4" style="text-align:right;">รวม</td>
          <td></td>
          <td style="text-align:right;">${total}</td>
        </tr>
        <tr>
          <td colspan="4" style="text-align:right;">ภาษีมูลค่าเพิ่ม</td>
          <td></td>
          <td style="text-align:right;">-</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:center;font-weight:700;">รวมเป็นเงินทั้งสิ้น (${totalText})</td>
          <td></td><td></td>
          <td style="text-align:right;font-weight:700;">${total}</td>
        </tr>
      </tbody>
    </table>
    ${signBlock('(ลงชื่อ)', officerName, officerPos)}
    ${signBlock('(ลงชื่อ)', headName, headPos)}
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 5: รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ/จ้าง
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${memoHeader()}
    ${memoFields(sn, reqDate, docNo)}
    ${memoRow('เรื่อง', `รายงานผลการพิจารณาและขออนุมัติสั่ง${isBuy ? 'ซื้อ' : 'จ้าง'}`)}
    <div style="margin-top:6px;">เรียน&nbsp;&nbsp; ผู้อำนวยการโรงเรียน${sn}</div>
    <p style="text-indent:2.5em;margin-top:5px;line-height:1.7;">ตามที่ ผู้อำนวยการโรงเรียน${sn} เห็นชอบรายงาน${isBuy ? 'ขอซื้อ' : 'ขอจ้าง'} ${FD(100,esc(req.project_name||''))} เป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)}) ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 24 รายละเอียดดังแนบ</p>
    <p style="text-indent:2.5em;margin-top:4px;line-height:1.7;">ในการนี้ เจ้าหน้าที่ได้เจรจาตกลงราคา กับ ${FD(100,esc(req.vendor_name||''))} ซึ่งมีอาชีพ${isBuy ? 'ขายพัสดุ' : 'รับจ้างทำพัสดุ'}ดังกล่าวแล้ว ปรากฏว่าเสนอราคาเป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)}) ดังนั้นเพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้าง และการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 จึงเห็นควร${docTypeName}จากผู้เสนอราคารายดังกล่าว</p>
    <div style="margin-top:5px;">จึงเรียนมาเพื่อโปรดทราบ และพิจารณา</div>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;font-size:15px;line-height:1.7;">
      <tr><td style="width:24px;vertical-align:top;">1.</td><td>อนุมัติให้สั่ง${isBuy ? 'ซื้อ' : 'จ้าง'} ${FD(80,esc(req.project_name||''))} จาก ${isBuy ? 'ร้าน/หจก./บริษัท' : 'ผู้รับจ้าง'} ${FD(80,esc(req.vendor_name||''))} เป็น${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'} ในวงเงิน ${FD(0,total)} บาท (${FD(0,totalText)}) กำหนดเวลาการส่งมอบภายใน ${FD(0,deliveryDays)} วัน นับถัดจากวันลงนามในสัญญา</td></tr>
    </table>
    ${sign2col(officerName, officerPos, headName, headPos)}
    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;text-align:center;">
      <div>- เห็นชอบ -</div>
      <div>- อนุมัติ -</div>
      <div style="margin-top:10mm;">
        <div>ลงชื่อ ${FL(220,'')}</div>
        <div>(${dirName})</div>
        <div>ตำแหน่ง${dirPos}</div>
        <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
      </div>
    </div>
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 6: ใบสั่งซื้อ/ใบสั่งจ้าง
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${garudaImg('display:block;margin:3mm auto 2mm;height:2cm;')}
    <div style="text-align:center;font-size:28px;font-weight:700;margin-bottom:5mm;">${poTypeName}</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;font-size:14px;line-height:1.9;">
      <div>${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'} ${FL(160,esc(req.vendor_name||''))}</div>
      <div>${poTypeName}เลขที่ ${FL(110,poNo)}</div>
      <div>ที่อยู่ ${FL(160,esc(req.vendor_address||''))}</div>
      <div>วันที่ ${FL(110,reqDate)}</div>
      <div>&nbsp;</div>
      <div>โรงเรียน ${FL(100,sn)}</div>
      <div>โทรศัพท์ ${FL(160,esc(req.vendor_phone||''))}</div>
      <div>ที่อยู่ ${FL(100,schoolAddr)}</div>
      <div>เลขประจำตัวผู้เสียภาษี ${FL(100,esc(req.vendor_tax_id||''))}</div>
      <div>&nbsp;</div>
      <div>เลขที่บัญชีเงินฝากธนาคาร ${FL(90,vBankAccount)}</div>
      <div>เลขประจำตัวผู้เสียภาษี ${FL(90,schoolTax)}</div>
      <div>ชื่อบัญชี ${FL(130,vBankAccName)}</div>
      <div>โทรศัพท์ ${FL(100,schoolPhone)}</div>
      <div>ธนาคาร ${FL(90,vBankBankName)} สาขา ${FL(70,vBankBranch)}</div>
      <div>เลขที่บัญชีธนาคารโรงเรียน ${FL(80,bankAccount)}</div>
    </div>

    <p style="margin-top:4mm;text-indent:48px;">ตามที่ ${isBuy ? 'ร้าน/หจก./บริษัท' : 'ผู้รับจ้าง'} ${FD(80,esc(req.vendor_name||''))} ได้เสนอราคา ตามใบเสนอราคาเลขที่ ${FD(60,quoteNo)} ลงวันที่ ${FD(80,quoteDate)} ไว้ต่อโรงเรียน ${sn} ซึ่งได้รับราคาและตกลง${isBuy ? 'ซื้อ' : 'จ้าง'} ตามรายการดังต่อไปนี้</p>

    <table class="dt" style="margin-top:3px;">
      <thead>
        <tr>
          <th style="width:42px;">ลำดับ</th>
          <th>รายการ</th>
          <th style="width:58px;">จำนวน</th>
          <th style="width:58px;">หน่วย</th>
          <th style="width:90px;">ราคาต่อหน่วย<br>(บาท)</th>
          <th style="width:100px;">จำนวนเงิน<br>(บาท)</th>
        </tr>
      </thead>
      <tbody>
        ${allItems.map((it,i)=>{
          const no = it.item_name ? i+1 : '';
          return `<tr>
            <td style="text-align:center;">${no}</td>
            <td>${esc(it.item_name||'')}</td>
            <td style="text-align:center;">${esc(it.qty||'')}</td>
            <td style="text-align:center;">${esc(it.unit||'')}</td>
            <td style="text-align:right;">${it.unit_price ? num(it.unit_price) : ''}</td>
            <td style="text-align:right;">${it.amount ? num(it.amount) : ''}</td>
          </tr>`;
        }).join('')}
        <tr>
          <td colspan="3" style="text-align:center;">(${totalText})</td>
          <td colspan="2" style="text-align:right;font-weight:700;">รวมทั้งสิ้น</td>
          <td style="text-align:right;font-weight:700;">${total}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:3mm;font-weight:700;">การ${isBuy ? 'สั่งซื้อ' : 'สั่งจ้าง'} อยู่ภายใต้เงื่อนไขต่อไปนี้</div>
    <div>1. กำหนดส่งมอบภายใน ${deliveryDays} วัน/วันทำการ นับถัดจากวันที่${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ได้รับ${poTypeName}</div>
    <div>2. ครบกำหนดส่งมอบวันที่ ${FL(120,deliveryDue.full)}</div>
    <div>3. สถานที่ส่งมอบ โรงเรียน${sn}</div>
    <div>4. ระยะเวลารับประกัน ${FL(80,'')}</div>
    ${isBuy
      ? `<div>5. สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ 0.2 ของราคาสิ่งของที่ยังไม่ได้รับมอบ</div>
         <div>6. โรงเรียน${sn}สงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่าสินค้านั้นมีลักษณะไม่ตรงตามรายการที่ระบุไว้ใน${poTypeName} กรณีนี้ ผู้ขายจะต้องดำเนินการเปลี่ยนใหม่ให้ถูกต้องตาม${poTypeName}ทุกประการ</div>`
      : `<div>5. สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ 0.1 ไม่ต่ำกว่าวันละ 100 บาท นับตั้งแต่วันที่ล่วงเลยกำหนดแล้วเสร็จตาม${poTypeName}จนถึงวันที่งานแล้วเสร็จบริบูรณ์</div>
         <div>6. โรงเรียน${sn}สงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่างานนั้นมีลักษณะไม่ตรงตามรายการที่ระบุไว้ใน${poTypeName} กรณีผู้รับจ้างจะต้องดำเนินการแก้ไขใหม่ให้ถูกต้องตาม${poTypeName}ทุกประการ</div>`
    }

    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="text-align:center;">
        <div>ลงชื่อ ${FL(200,'')} ${isBuy ? 'ผู้สั่งซื้อ' : 'ผู้สั่งจ้าง'}</div>
        <div>(${dirName})</div>
        <div>ตำแหน่ง ${dirPos}${sn}</div>
        <div style="font-size:13px;margin-top:3px;">วันที่ ............../............../..............</div>
      </div>
      <div style="text-align:center;">
        <div>ลงชื่อ ${FL(200,'')} ${isBuy ? 'ผู้รับใบสั่งซื้อ' : 'ผู้รับจ้าง'}</div>
        <div>(${esc(req.vendor_name||'')})</div>
        <div style="font-size:13px;margin-top:3px;">วันที่ ............../............../..............</div>
      </div>
    </div>
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 7: ใบส่งของ/ใบกำกับภาษี (ซื้อ) หรือ ใบส่งมอบงาน (จ้าง)
  // ══════════════════════════════════════════════
  html += `<div class="page" style="${isBuy ? 'display:flex;align-items:center;justify-content:center;' : ''}position:relative;">
    <div style="position:absolute;top:10mm;left:0;right:0;text-align:center;font-size:14px;">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${isBuy
      ? `<div style="font-size:26px;font-weight:700;">ใบส่งของ/ใบกำกับภาษี</div>`
      : `<div style="margin-top:16mm;">
          <div style="text-align:center;font-size:22px;font-weight:700;margin-bottom:6mm;">ใบส่งมอบงาน</div>
          <div style="text-align:right;margin-bottom:2mm;">วันที่ ${FD(0,receiveDate||'')}</div>
          <div style="margin-bottom:3mm;">เรื่อง ส่งมอบงาน${FD(160,esc(req.project_name||''))}</div>
          <div style="margin-bottom:4mm;">เรียน ผู้อำนวยการโรงเรียน${sn}</div>
          <p style="text-indent:2.5em;line-height:1.9;margin-bottom:3mm;">ตามที่โรงเรียน${sn} ได้ตกลง${docTypeName} ${FD(120,esc(req.project_name||''))} กับ ${FD(100,esc(req.vendor_name||''))} ตามสัญญาจ้าง/${poTypeName}เลขที่ ${FD(60,poNo)} ลงวันที่ ${FD(80,reqDate)} เป็นจำนวนเงิน ${FD(0,total)} บาท (${FD(0,totalText)})</p>
          <p style="text-indent:2.5em;line-height:1.9;margin-bottom:3mm;">บัดนี้ ${FD(100,esc(req.vendor_name||''))} ได้ทำการ ${FD(120,esc(req.project_name||''))} เสร็จเรียบร้อยแล้วตามสัญญาจ้าง/${poTypeName}เลขที่ ${FD(60,poNo)} ลงวันที่ ${FD(80,reqDate)} จึงขอเบิกเงินค่าจ้าง จำนวน ${FD(0,total)} บาท (${FD(0,totalText)})</p>
          <div style="text-align:right;margin-top:2mm;">ขอแสดงความนับถือ</div>
          <div style="page-break-inside:avoid;break-inside:avoid;padding-top:16mm;text-align:center;">
            <div>ลงชื่อ ${FL(200,'')}&nbsp;&nbsp;&nbsp;&nbsp;ผู้รับจ้าง</div>
            <div style="margin-top:4px;">(${esc(req.vendor_name||'')})</div>
            <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
          </div>
        </div>`
    }
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 10: ใบตรวจรับพัสดุ
  // ══════════════════════════════════════════════
  // แยกวันที่รับของเป็น วัน/เดือน/ปี — ใช้ raw date string ไม่ใช่ thaiDateLong
  const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const recvRaw  = req.receive_date || '';
  const recvD    = recvRaw ? new Date(recvRaw + (recvRaw.length === 10 ? 'T00:00:00' : '')) : null;
  const recvDay   = recvD && !isNaN(recvD) ? String(recvD.getDate()) : '';
  const recvMonth = recvD && !isNaN(recvD) ? thMonths[recvD.getMonth()] : '';
  const recvYear  = recvD && !isNaN(recvD) ? String(recvD.getFullYear()+543) : '';

  html += `<div class="page">
    <div style="text-align:center;font-size:13px;margin-bottom:4mm;">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    <div style="text-align:center;font-size:26px;font-weight:700;margin:4mm 0 2mm;">${recvTypeName}</div>
    <div style="text-align:center;font-size:13px;margin-bottom:6mm;">ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175</div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:2mm;">
      <span>เขียนที่&nbsp;${esc(sn)}</span>
    </div>
    <div style="text-align:center;margin-bottom:6mm;">
      วันที่ ${FD(40,recvDay)} &nbsp; เดือน ${FD(80,recvMonth)} &nbsp; พ.ศ. ${FD(60,recvYear)}
    </div>

    <p style="line-height:1.9;margin-bottom:3mm;">
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ตามที่ โรงเรียน ${esc(sn)} ได้${docTypeName} ${FD(80,esc(req.project_name||''))} จาก
      ${isBuy ? 'ร้าน/หจก./บริษัท' : 'ผู้รับจ้าง'} ${FD(100,esc(req.vendor_name||''))} ตามสัญญา${isBuy ? 'ซื้อ' : 'จ้าง'}/${poTypeName}
      เลขที่ ${FD(40,poNo)}/${yr} ลงวันที่ ${FD(80,reqDate)}
      เป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)})
      กำหนดส่งมอบภายใน ${FD(30,deliveryDays)} วัน
      (วันที่ ${FD(30,deliveryDue.day)} เดือน ${FD(80,deliveryDue.monthName)} พ.ศ.${FD(50,deliveryDue.year)})
    </p>

    <p style="line-height:1.9;margin-bottom:3mm;">
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;บัดนี้ ${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ได้ส่งมอบ${isBuy ? 'พัสดุ' : 'งาน'}ดังกล่าวเป็นการถูกต้องเรียบร้อยแล้ว
      ${isBuy
        ? `ตามใบส่งของ/ใบกำกับภาษี เลขที่ ${FD(60,invoiceNo)} ลงวันที่ ${FD(80,invoiceDate)}`
        : `ตามใบส่งมอบงาน/หนังสือส่งมอบงาน ลงวันที่ ${FD(80,invoiceDate)}`
      }
    </p>

    <p style="line-height:1.9;margin-bottom:3mm;">การ${isBuy ? 'ซื้อ' : 'จ้าง'}รายนี้ได้แก้ไขเปลี่ยนแปลงคือ ${FL(260,'')}</p>

    <p style="line-height:1.9;margin-bottom:3mm;">
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ผู้ตรวจรับพัสดุได้ตรวจรับงาน เมื่อวันที่ ${FD(0,receiveDate)}
      แล้วปรากฏว่า${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ส่งมอบ${isBuy ? 'พัสดุ' : 'งาน'}เสร็จเรียบร้อยถูกต้องตามสัญญา${isBuy ? 'ซื้อ' : 'จ้าง'}/${poTypeName} ทุกประการ
      เมื่อวันที่ ${FD(0,receiveDate)} โดยส่งมอบ${isBuy ? 'พัสดุ' : 'งาน'}เกินกำหนดจำนวน ${FD(30,lateDays)} วัน
      คิดค่าปรับร้อยละ ${isBuy ? '0.20' : '0.10'} ของราคาสิ่งของที่ยังไม่ส่งมอบ${isBuy ? '' : ' ไม่ต่ำกว่าวันละ 100 บาท'}
      ค่าปรับเป็นเงินทั้งสิ้น ${FD(0,penalty)} บาท
      จึงออกหนังสือสำคัญฉบับนี้ให้ไว้ ณ วันที่ ${FD(0,receiveDate||'')}
      ${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ควรได้รับเงินเป็นจำนวนทั้งสิ้น ${FD(0,total)} บาท (${FD(0,totalText)})
      ตามสัญญา${isBuy ? 'ซื้อ' : 'จ้าง'}/${poTypeName}
    </p>

    <p style="line-height:1.9;margin-bottom:3mm;">
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;จึงขอเสนอรายงานต่อ ผู้อำนวยการโรงเรียน${esc(sn)}
      เพื่อโปรดทราบ ตามนัยข้อ 175 (4) แห่งระเบียบกระทรวงการคลัง
      ว่าด้วยการจัดซื้อจัดจ้างและบริหารพัสดุภาครัฐ พ.ศ. 2560
    </p>

    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;text-align:center;">
      <div>ลงชื่อ ${FL(220,'')}&nbsp;&nbsp;&nbsp;&nbsp;ผู้ตรวจรับพัสดุ</div>
      <div style="margin-top:4px;">(${inspName ? esc(inspName) : FL(160,'')})</div>
      <div style="font-size:13px;margin-top:3px;">${recvDay ? recvDay + '/' + recvMonth + '/' + recvYear : '............../............../..............'}</div>
    </div>
  </div>`;

  // ══════════════════════════════════════════════
  // หน้า 8: บันทึกข้อความ รายงานผลการตรวจรับและขออนุมัติเบิกจ่าย
  // ══════════════════════════════════════════════
  html += `<div class="page">
    <div class="doc-top">การ${docTypeName}โดยวิธีเฉพาะเจาะจง มาตรา 56 (2) (ข) วงเงินไม่เกิน 100,000 บาท</div>
    ${memoHeader()}
    ${memoFields(sn, reqDate, docNo)}
    ${memoRow('เรื่อง','รายงานผลการตรวจรับพัสดุและอนุมัติจ่ายเงิน')}
    <div style="margin-top:6px;">เรียน&nbsp;&nbsp; ผู้อำนวยการโรงเรียน${sn}</div>
    <p style="text-indent:2.5em;margin-top:5px;line-height:1.7;">ตามที่ โรงเรียน ${sn} ได้${docTypeName} ${FD(80,esc(req.project_name||''))} จาก ${isBuy ? 'ร้าน/หจก./บริษัท' : 'ผู้รับจ้าง'} ${FD(80,esc(req.vendor_name||''))} เป็นเงิน ${FD(0,total)} บาท (${FD(0,totalText)}) ตามสัญญา${isBuy ? 'ซื้อ' : 'จ้าง'}/${poTypeName} เลขที่ ${FD(0,poNo)}/${yr} ลงวันที่${FD(80,reqDate)} ครบกำหนดส่งมอบภายใน ${FD(0,deliveryDays)} วัน (วันที่ ${FD(0,deliveryDue.full)}) นั้น</p>
    <p style="text-indent:2.5em;margin-top:4px;line-height:1.7;">บัดนี้ ${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ได้ส่งมอบ${isBuy ? 'พัสดุ' : 'งาน'}ถูกต้องครบถ้วนแล้ว เมื่อวันที่ ${FD(80,receiveDate)} ตาม${isBuy ? 'ใบส่งของ/ใบกำกับภาษี' : 'ใบส่งมอบงาน/หนังสือส่งมอบงาน'} ลงวันที่ ${FD(80,invoiceDate)} และผู้ตรวจรับพัสดุได้ทำการตรวจรับ${isBuy ? 'พัสดุ' : 'งาน'}เมื่อวันที่ ${FD(80,receiveDate)} ไว้เป็นการถูกต้องครบถ้วนแล้ว ดังหลักฐานที่แนบ ปรากฏว่า ${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ได้ส่งมอบ${isBuy ? 'พัสดุ' : 'งาน'}เกินกำหนดการส่งมอบ เป็นเวลา ${FD(40,lateDays)} วัน คิดค่าปรับในอัตราร้อยละ ${isBuy ? '๐.20' : '๐.10'} ของราคาสิ่งของที่ยังไม่ส่งมอบ${isBuy ? '' : ' ไม่ต่ำกว่าวันละ 100 บาท'} คิดเป็นเงินค่าปรับทั้งสิ้น ${FD(0,penalty)} บาท เห็นควรเบิกจ่ายเงินให้แก่${isBuy ? 'ผู้ขาย' : 'ผู้รับจ้าง'}ตามข้อตกลง โดยมีรายละเอียด ดังนี้</p>
    <div style="margin-top:4px;">จึงเรียนมาเพื่อโปรด</div>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;font-size:15px;line-height:1.7;">
      <tr><td style="width:28px;vertical-align:top;">๑.</td><td>ทราบผลการตรวจรับงานตามนัยข้อ 175 (4) แห่งระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ.2560</td></tr>
      <tr><td style="vertical-align:top;">๒.</td><td>อนุมัติจ่ายเงินให้แก่ ร้าน/หจก./บริษัท ${FD(80,esc(req.vendor_name||''))} เป็นเงิน ${FD(0,netPay)} บาท (${FD(0,totalText)}) รายละเอียดดังนี้
        <table style="border-collapse:collapse;font-size:14px;margin:4px 0 0 16px;">
          <tr><td style="padding:1px 8px 1px 0;min-width:200px;">มูลค่าสินค้าหรือบริการ</td><td style="text-align:right;min-width:80px;">${total}</td><td style="padding-left:4px;">บาท</td></tr>
          <tr><td>บวก ภาษีมูลค่าเพิ่ม</td><td style="text-align:right;">-</td><td style="padding-left:4px;">บาท</td></tr>
          <tr><td>จำนวนเงินที่ขอเบิกทั้งสิ้น</td><td style="text-align:right;">${total}</td><td style="padding-left:4px;">บาท</td></tr>
          <tr><td>หัก ภาษีเงินได้</td><td style="text-align:right;">${whtax}</td><td style="padding-left:4px;">บาท</td></tr>
          <tr><td>ค่าปรับ</td><td style="text-align:right;">${penalty}</td><td style="padding-left:4px;">บาท</td></tr>
          <tr style="font-weight:700;border-top:1px solid #000;"><td>คงเหลือจ่ายจริง เป็นเงิน</td><td style="text-align:right;">${netPay}</td><td style="padding-left:4px;">บาท (${totalText})</td></tr>
        </table>
      </td></tr>
    </table>
    <div style="margin-top:5px;">จึงเรียนมาเพื่อโปรดทราบ</div>
    <table style="width:100%;border-collapse:collapse;margin-top:2px;font-size:15px;line-height:1.7;">
      <tr><td style="width:28px;vertical-align:top;">1.</td><td>ทราบผลการตรวจรับ</td></tr>
      <tr><td style="vertical-align:top;">2.</td><td>อนุมัติจ่ายเงิน &nbsp; จำนวน ${FD(0,netPay)} บาท<br>
        <span style="padding-left:1em;">โดยหักภาษีเงินได้ &nbsp; จำนวน ${FD(0,whtax)} บาท</span>
      </td></tr>
    </table>
    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;display:flex;flex-direction:row;gap:8px;align-items:start;">
      <div style="width:50%;text-align:center;">
        <div>ลงชื่อ ${FL(180,'')}</div>
        <div>(${finName || FL(140,'')})</div>
        <div>เจ้าหน้าที่การเงิน</div>
        <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
      </div>
      <div style="padding-left:16px;line-height:2.2;">
        <div>1. ทราบ</div>
        <div>2. อนุมัติ</div>
      </div>
    </div>
    <div style="page-break-inside:avoid;break-inside:avoid;padding-top:20mm;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="text-align:center;">
        <div>ลงชื่อ ${FL(180,'')}</div>
        <div>(${FL(160,'')})</div>
        <div>รอง.ผอ.ร.ร.</div>
        <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
      </div>
      <div style="text-align:center;">
        <div>ลงชื่อ ${FL(180,'')}</div>
        <div>(${dirName})</div>
        <div>${dirPos}${sn}</div>
        <div style="font-size:13px;margin-top:3px;">............../............../..............</div>
      </div>
    </div>
  </div>`;

  html += `</body></html>`;
  return html;
}
