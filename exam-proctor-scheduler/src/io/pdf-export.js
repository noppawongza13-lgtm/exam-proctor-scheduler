/**
 * โมดูลส่งออก PDF และใบลงนามผู้คุมสอบ (PDF & Sign-off Sheet Exporter)
 * ตามข้อกำหนด 7.10:
 * "ส่งออก PDF สำหรับพิมพ์ ใช้ฟอนต์ไทย Sarabun ให้แสดงถูกต้อง
 *  มีใบลงนามผู้คุมสอบ (รายห้อง/รายรอบ) พร้อมช่องลายมือชื่อและเวลามา-กลับ"
 */

import { formatThaiDate, formatThaiTimeRange, formatThaiTime } from '../utils/thai-date.js';
import { getSessionDutyTime } from '../data/models.js';

/**
 * เปิดหน้าต่างใบลงนามผู้คุมสอบพร้อมพิมพ์ (Printable Sign-off Sheets)
 * @param {Object} params
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 */
export function openPrintableSignoffSheets({ assignments, sessions, proctors, rooms, allocations, settings }) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // สร้าง HTML Document สำหรับพิมพ์
  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบลงนามและบัญชีรายชื่อผู้คุมสอบ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #1e293b;
      background: #f8fafc;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 20px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 0;
        box-shadow: none;
        page-break-after: always;
      }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
    }
    .header h2 { margin: 0 0 6px 0; font-size: 17pt; font-weight: 700; }
    .header h3 { margin: 0 0 6px 0; font-size: 14pt; font-weight: 600; color: #334155; }
    .header p { margin: 0; font-size: 12pt; color: #475569; }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #475569;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #e2e8f0;
      font-weight: 600;
      text-align: center;
      font-size: 12pt;
    }
    td.center { text-align: center; }
    .sig-cell {
      height: 48px;
      vertical-align: bottom;
      text-align: center;
      color: #94a3b8;
      font-size: 10pt;
    }
    .notes-section {
      margin-top: 24px;
      border: 1px dashed #94a3b8;
      padding: 12px;
      border-radius: 4px;
      font-size: 11pt;
    }
    .sign-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 36px;
      padding-right: 20px;
      font-size: 12pt;
      text-align: center;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #1e40af;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .btn-print {
      background: #22c55e;
      color: white;
      border: none;
      padding: 8px 20px;
      font-size: 14pt;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <div style="font-size: 14pt; font-weight: 600;">🖨️ แสดงตัวอย่างเอกสารสำหรับพิมพ์ / บันทึกเป็น PDF</div>
    <button class="btn-print" onclick="window.print()">กดพิมพ์หน้านี้ (Print / Save as PDF)</button>
  </div>
`;

  // สร้างใบลงนามแยกตามรอบสอบและห้อง
  for (const session of sessions) {
    const duty = getSessionDutyTime(session);
    const sessionAllocs = allocations.filter(al => al.sessionId === session.id);

    for (const alloc of sessionAllocs) {
      const room = roomMap.get(alloc.roomId);
      const roomAssigns = assignments.filter(a => a.allocationId === alloc.id);

      html += `
  <div class="page-sheet">
    <div class="header">
      <h2>ใบลงนามปฏิบัติหน้าที่ผู้คุมสอบ</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${settings.project.name} (${settings.project.clientOrganization})</p>
    </div>

    <div class="meta-box">
      <div><strong>การสอบ:</strong> ${session.name}</div>
      <div><strong>วันที่:</strong> ${formatThaiDate(session.date, true)}</div>
      <div><strong>เวลาสอบจริง:</strong> ${formatThaiTimeRange(session.startTime, session.endTime)}</div>
      <div><strong>เวลาปฏิบัติงาน:</strong> ${formatThaiTimeRange(duty.dutyStart, duty.dutyEnd)}</div>
      <div><strong>ห้องสอบ:</strong> ${room ? room.name : alloc.roomId} (${room ? room.building : ''})</div>
      <div><strong>จำนวนผู้เข้าสอบในห้อง:</strong> ${alloc.examineesInRoom} คน</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 8%;">ลำดับ</th>
          <th style="width: 15%;">บทบาท</th>
          <th style="width: 25%;">ชื่อ - นามสกุล</th>
          <th style="width: 20%;">สังกัด / คณะ</th>
          <th style="width: 12%;">เวลามา</th>
          <th style="width: 12%;">เวลากลับ</th>
          <th style="width: 18%;">ลายมือชื่อ</th>
        </tr>
      </thead>
      <tbody>
`;

      if (roomAssigns.length === 0) {
        html += `<tr><td colspan="7" class="center" style="padding: 20px; color: #ef4444;">-- ยังไม่ได้จัดผู้คุมสอบในห้องนี้ --</td></tr>`;
      } else {
        // เรียงให้ chief อยู่ลำดับแรก
        const sorted = [...roomAssigns].sort((x, y) => (x.role === 'chief' ? -1 : 1));
        sorted.forEach((a, idx) => {
          const p = proctorMap.get(a.proctorId);
          const roleBadge = a.role === 'chief' ? 'หัวหน้าห้องสอบ' : 'ผู้คุมร่วม';
          html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center"><strong>${roleBadge}</strong></td>
          <td>${p ? `${p.firstName} ${p.lastName}` : a.proctorId}</td>
          <td>${p ? p.department : '-'}</td>
          <td class="center">.... : ....</td>
          <td class="center">.... : ....</td>
          <td class="sig-cell">ลงชื่อ ...............................</td>
        </tr>`;
        });
      }

      html += `
      </tbody>
    </table>

    <div class="notes-section">
      <strong>ข้อปฏิบัติสำหรับผู้คุมสอบ:</strong><br>
      1. กรุณามารายงานตัวและรับแบบทดสอบก่อนเวลาสอบอย่างน้อย ${session.prepMinutes} นาที (${formatThaiTime(duty.dutyStart)})<br>
      2. ตรวจสอบบัตรประจำตัวผู้เข้าสอบ และห้ามนำอุปกรณ์สื่อสารทุกชนิดเข้าห้องสอบโดยเด็ดขาด<br>
      3. เมื่อหมดเวลาสอบ กรุณานับจำนวนกระดาษคำตอบให้ครบถ้วนก่อนปล่อยผู้เข้าสอบ และส่งคืน ณ กองกลาง
    </div>

    <div class="sign-footer">
      <div>
        ลงชื่อ ..............................................................<br>
        (..............................................................)<br>
        หัวหน้ากองอำนวยการประสานงานสอบ
      </div>
    </div>
  </div>`;
    }

    // สร้างใบรายชื่อผู้คุมสำรองประจำรอบ
    const reserves = assignments.filter(a => a.sessionId === session.id && a.role === 'reserve');
    if (reserves.length > 0) {
      html += `
  <div class="page-sheet">
    <div class="header">
      <h2>บัญชีรายชื่อผู้คุมสอบสำรอง (Reserve Proctors)</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${session.name} | วันที่ ${formatThaiDate(session.date, true)} (${formatThaiTimeRange(session.startTime, session.endTime)})</p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 8%;">ลำดับ</th>
          <th style="width: 25%;">ชื่อ - นามสกุล</th>
          <th style="width: 22%;">สังกัด / คณะ</th>
          <th style="width: 15%;">เบอร์โทรศัพท์</th>
          <th style="width: 15%;">เวลามาถึง</th>
          <th style="width: 15%;">ลายมือชื่อ</th>
        </tr>
      </thead>
      <tbody>
`;
      reserves.forEach((r, idx) => {
        const p = proctorMap.get(r.proctorId);
        html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${p ? `${p.firstName} ${p.lastName}` : r.proctorId}</td>
          <td>${p ? p.department : '-'}</td>
          <td class="center">${p ? p.phone : '-'}</td>
          <td class="center">.... : ....</td>
          <td class="sig-cell">ลงชื่อ .......................</td>
        </tr>`;
      });
      html += `
      </tbody>
    </table>
    <div class="notes-section" style="margin-top: 30px;">
      * ผู้คุมสอบสำรองกรุณาพร้อมปฏิบัติหน้าที่ ณ ห้องกองกลาง หากมีห้องสอบใดเกิดเหตุขัดข้อง ผู้ประสานงานจะมอบหมายให้เข้าปฏิบัติหน้าที่แทนทันที
    </div>
  </div>`;
    }
  }

  html += `
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * เปิดหน้าต่างใบแจ้งตารางปฏิบัติหน้าที่คุมสอบเฉพาะบุคคล (Personal Duty Schedule & Sign-off Sheet)
 * @param {Object} params
 * @param {import('../data/models.js').Proctor} params.proctor
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 */
export function openPersonalDutySheet({ proctor, assignments, sessions, rooms, settings }) {
  if (!proctor) return;
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // ดึงเฉพาะรอบสอบของ proctor คนนี้
  const myAssigns = assignments.filter(a => a.proctorId === proctor.id);

  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ตารางปฏิบัติหน้าที่คุมสอบ - ${proctor.firstName} ${proctor.lastName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #1e293b;
      background: #f8fafc;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 24px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
      .no-print { display: none !important; }
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
    }
    .header h2 { margin: 0 0 6px 0; font-size: 17pt; font-weight: 700; }
    .header h3 { margin: 0 0 6px 0; font-size: 14pt; font-weight: 600; color: #334155; }
    .header p { margin: 0; font-size: 12pt; color: #475569; }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 18px;
      font-size: 12pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #475569;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #e2e8f0;
      font-weight: 600;
      text-align: center;
      font-size: 12pt;
    }
    td.center { text-align: center; }
    .notes-section {
      margin-top: 24px;
      border: 1px dashed #94a3b8;
      padding: 12px;
      border-radius: 4px;
      font-size: 11pt;
    }
    .sign-footer {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      text-align: center;
      font-size: 12pt;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
    }
    .btn-print {
      background: #22c55e;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12pt;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-print:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <div style="font-size: 14pt; font-weight: 600;">🖨️ ตารางคุมสอบส่วนบุคคล: ${proctor.firstName} ${proctor.lastName}</div>
    <button class="btn-print" onclick="window.print()">กดพิมพ์หน้านี้ (Print / Save as PDF)</button>
  </div>

  <div class="page-sheet">
    <div class="header">
      <h2>ใบแจ้งตารางและคำสั่งปฏิบัติหน้าที่คุมสอบ (รายบุคคล)</h2>
      <h3>${settings.project.universityName}</h3>
      <p>${settings.project.name} (${settings.project.clientOrganization})</p>
    </div>

    <div class="meta-box">
      <div><strong>ชื่อ - สกุล:</strong> ${proctor.firstName} ${proctor.lastName}</div>
      <div><strong>รหัสผู้คุมสอบ:</strong> ${proctor.id}</div>
      <div><strong>สังกัด / ส่วนงาน:</strong> ${proctor.department || '-'}</div>
      <div><strong>ประเภท:</strong> ${proctor.role === 'teacher' ? 'อาจารย์ / ผู้คุมหลัก' : 'เจ้าหน้าที่ / ผู้คุมสอบ'}</div>
      <div><strong>เบอร์โทรศัพท์:</strong> ${proctor.phone || '-'}</div>
      <div><strong>อีเมล:</strong> ${proctor.email || '-'}</div>
    </div>

    <div style="font-weight: 600; font-size: 13pt; margin-bottom: 6px;">
      📋 รายการรอบสอบและห้องที่ได้รับมอบหมาย (รวม ${myAssigns.length} รอบ):
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 6%;">ลำดับ</th>
          <th style="width: 14%;">วันที่</th>
          <th style="width: 22%;">เวลาปฏิบัติงาน</th>
          <th style="width: 24%;">วิชา / การสอบ</th>
          <th style="width: 18%;">ห้องสอบ / อาคาร</th>
          <th style="width: 16%;">หน้าที่</th>
        </tr>
      </thead>
      <tbody>
`;

  if (myAssigns.length === 0) {
    html += `<tr><td colspan="6" class="center" style="padding: 24px; color: #64748b;">-- ยังไม่มีรอบสอบที่ได้รับมอบหมายในขณะนี้ --</td></tr>`;
  } else {
    // เรียงตามเวลาเริ่มสอบ
    const sorted = [...myAssigns].sort((a, b) => {
      const sa = sessionMap.get(a.sessionId);
      const sb = sessionMap.get(b.sessionId);
      if (!sa || !sb) return 0;
      return new Date(sa.startTime) - new Date(sb.startTime);
    });

    sorted.forEach((a, idx) => {
      const s = sessionMap.get(a.sessionId);
      const r = roomMap.get(a.roomId);
      if (!s) return;
      const duty = getSessionDutyTime(s);
      const roleText = a.role === 'chief' ? 'หัวหน้าห้องสอบ' : (a.role === 'reserve' ? 'ผู้คุมสอบสำรอง' : 'ผู้ช่วยคุมสอบ');
      const roomText = a.role === 'reserve' ? 'ห้องกองกลาง' : (r ? `${r.name} (${r.building})` : a.roomId);

      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center">${formatThaiDate(s.date)}</td>
          <td class="center">
            <strong>${formatThaiTimeRange(duty.dutyStart, duty.dutyEnd)}</strong><br>
            <span style="font-size: 10pt; color: #475569;">(เวลาสอบ: ${formatThaiTimeRange(s.startTime, s.endTime)})</span>
          </td>
          <td><strong>${s.name}</strong></td>
          <td class="center">${roomText}</td>
          <td class="center"><strong>${roleText}</strong></td>
        </tr>`;
    });
  }

  html += `
      </tbody>
    </table>

    <div class="notes-section">
      <strong>คำชี้แจงและแนวปฏิบัติสำหรับกรรมการคุมสอบ:</strong><br>
      1. กรุณาเข้ารายงานตัวและรับอุปกรณ์การสอบก่อนเริ่มเวลาสอบจริงอย่างน้อย 30 นาที ณ กองอำนวยการประสานงานสอบ<br>
      2. หากมีเหตุจำเป็นสุดวิสัยไม่สามารถมาปฏิบัติหน้าที่ได้ กรุณาติดต่อกองกลางล่วงหน้าเพื่อจัดผู้คุมสอบสำรองเข้าแทน<br>
      3. ปฏิบัติตามระเบียบการจัดสอบและรักษาความลับของข้อสอบอย่างเคร่งครัด
    </div>

    <div class="sign-footer">
      <div>
        ลงชื่อ ..............................................................<br>
        ( ${proctor.firstName} ${proctor.lastName} )<br>
        ผู้ปฏิบัติหน้าที่คุมสอบ
      </div>
      <div>
        ลงชื่อ ..............................................................<br>
        (..............................................................)<br>
        หัวหน้ากองอำนวยการประสานงานสอบ
      </div>
    </div>
  </div>
</body>
</html>`;

  renderAndPrintHTML(html);
}

/**
 * ฟังก์ชันเปิดหน้าต่างและสั่งพิมพ์เอกสารอย่างปลอดภัย (ป้องกัน about:blank#blocked ใน Chrome)
 * @param {string} html 
 */
function renderAndPrintHTML(html) {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
      printViaHiddenIframe(html);
    }
  } catch (e) {
    printViaHiddenIframe(html);
  }
}

/**
 * สำรอง: พิมพ์ผ่าน iframe ซ่อนในหน้าเดิมกรณีบราวเซอร์บล็อกป๊อปอัป
 * @param {string} html 
 */
function printViaHiddenIframe(html) {
  let iframe = document.getElementById('print-service-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-service-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }
  const frameDoc = iframe.contentWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 250);
}

/**
 * สร้าง HTML Diagram ของผังห้องสอบ (Seating Chart Diagram) สำหรับแสดงใน UI หรือพิมพ์ PDF
 * @param {import('../data/models.js').Room} room
 * @returns {string}
 */
export function renderSeatingPlanInnerDiagram(room) {
  const isFrontBoth = room.doorPosition === 'front-both';
  const isRightSide = room.doorPosition === 'right-side-two' || room.doorPosition === 'right-side';
  const isLeftSide = room.doorPosition === 'left-side-two' || room.doorPosition === 'left-side';

  let desksHtml = '';

  if (room.layoutType === 'trapezoid-rows' && room.rows) {
    // ห้องสโลปใหญ่ 80 ที่นั่ง (ห้อง 17201 - ห้องประชุมหงส์พันธ์)
    desksHtml = `
      <div class="trapezoid-rows-wrapper" style="display: flex; flex-direction: column; gap: 7px; align-items: center; width: 100%; margin-top: 12px;">
        ${room.rows.map(r => `
          <div class="trapezoid-row" style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
            <div class="trapezoid-row-label" style="font-size: 11px; color: #64748b; width: 44px; text-align: right; font-weight: 600; white-space: nowrap;">แถวที่ ${r.rowNum}</div>
            <div style="display: flex; gap: 3px;">
              ${r.left.map(s => `<div class="seat-cell seat-cell-compact" title="ที่นั่งสอบ ${s}">${s}</div>`).join('')}
            </div>
            <div class="trapezoid-aisle" style="font-size: 10.5px; color: #94a3b8; padding: 0 4px; font-weight: 500; white-space: nowrap;">ทางเดิน</div>
            <div style="display: flex; gap: 3px;">
              ${r.right.map(s => `<div class="seat-cell seat-cell-compact" title="ที่นั่งสอบ ${s}">${s}</div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if ((room.layoutType === 'grid-rows' || room.layoutType === 'staggered-rows') && room.rows) {
    // ห้องแถวแนวนอน เช่น ห้อง 6 (สับหว่าง 40 ที่นั่ง) หรือ ห้อง 7 (5 แถว 40 ที่นั่ง)
    desksHtml = `
      <div style="display: flex; flex-direction: column; gap: 9px; align-items: center; width: 100%; margin-top: 14px;">
        ${room.rows.map(r => `
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
            <div style="font-size: 11px; color: #64748b; width: 55px; text-align: right; font-weight: 600;">แถวที่ ${r.rowNum} ➜</div>
            ${r.left ? `
              <div style="display: flex; gap: 4px;">
                ${r.left.map(s => `<div class="seat-cell" title="ที่นั่งสอบ ${s}">${s}</div>`).join('')}
              </div>
            ` : `
              <div style="display: flex; gap: 4px; visibility: hidden;" aria-hidden="true">
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
              </div>
            `}
            <div style="font-size: 12px; color: #94a3b8; padding: 0 4px;">➜</div>
            ${r.right ? `
              <div style="display: flex; gap: 4px;">
                ${r.right.map(s => `<div class="seat-cell" title="ที่นั่งสอบ ${s}">${s}</div>`).join('')}
              </div>
            ` : `
              <div style="display: flex; gap: 4px; visibility: hidden;" aria-hidden="true">
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
                <div class="seat-cell">000</div>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `;
  } else if (room.blocks) {
    // คอลัมน์บล็อก (ห้อง 1, 2, 3, 4, 6, 8, 9)
    desksHtml = `
      <div style="display: flex; justify-content: center; gap: 20px; width: 100%; margin-top: 14px; flex-wrap: wrap;">
        ${room.blocks.map(block => `
          <div style="display: flex; flex-direction: column; align-items: center; border: 1px dashed #cbd5e1; padding: 8px 10px; border-radius: 6px; background: rgba(248,250,252,0.6);">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 6px; font-weight: 600;">${block.name}</div>
            <div style="display: flex; gap: 4px;">
              ${block.columns.map((col, cIdx) => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <span style="font-size: 10px; color: #64748b; line-height: 1;">⬇️</span>
                  ${col.map(s => `<div class="seat-cell" title="ที่นั่งสอบ ${s}">${s}</div>`).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Fallback Grid
    desksHtml = `<div style="text-align: center; padding: 20px; color: #64748b;">(ที่นั่งสอบ ${room.seatStart || 1} ถึง ${room.seatEnd || room.capacity})</div>`;
  }

  return `
    <div class="seating-plan-room-box">
      <!-- Front Wall (จอโปรเจคเตอร์ & ประตูทางเข้า/ออก ตามสภาพจริง) -->
      <div class="room-wall-front" style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 40px; padding: 6px 12px;">
        ${isFrontBoth ? `<div class="door-badge door-left" style="position: absolute; left: 10px;">🚪 ประตูทางเข้า/ออก (ซ้าย)</div>` : ''}
        ${isLeftSide ? `<div class="door-badge door-left" style="position: absolute; left: 10px;">🚪 ประตูทางเข้า/ออก (ฝั่งซ้าย)</div>` : ''}
        <div class="projector-screen-badge">
          📽️ จอโปรเจคเตอร์
        </div>
        ${isFrontBoth ? `<div class="door-badge door-right" style="position: absolute; right: 10px;">🚪 ประตูทางเข้า/ออก (ขวา)</div>` : ''}
        ${isRightSide ? `<div class="door-badge door-right" style="position: absolute; right: 10px; background: #fffbeb; border-color: #f59e0b; color: #b45309; font-weight: 700;">🚪 ประตูทางเข้า/ออก (ฝั่งขวา)</div>` : ''}
      </div>

      <!-- Main Room Area with Full-Width Desks Container -->
      <div class="room-main-area" style="padding: 12px 6px; width: 100%; display: flex; justify-content: center;">
        <div class="room-desks-container" style="width: 100%; overflow-x: auto; display: flex; justify-content: center;">
          ${desksHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบจริง (Door Signs & Seating Charts & Regulations)
 * ตามภาพถ่ายหน้าห้องสอบจริงของ สำนักงาน ก.พ. / มหาวิทยาลัย:
 * 1. ป้ายหัวห้องสอบตัวโต (ห้องสอบที่ X, เลขที่นั่งสอบที่ Y - Z)
 * 2. แผนผังห้องสอบ (Seating Plan แสดงโต๊ะและเลขที่นั่ง)
 * 3. ป้ายห้ามนำเข้าห้องสอบ (สำนักงาน ก.พ.)
 * 4. ป้ายสิ่งที่อนุญาตให้นำเข้าห้องสอบได้ (สำนักงาน ก.พ.)
 * @param {Object} params
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @param {string} [params.targetRoomId] - พิมพ์เฉพาะห้องที่ระบุ หรือทั้งหมด
 */
export function openPrintableDoorSignsAndSeatingPlan({ rooms, sessions, settings, targetRoomId = null }) {
  const targetRooms = targetRoomId 
    ? rooms.filter(r => r.id === targetRoomId)
    : rooms.filter(r => r.isActive !== false);

  if (targetRooms.length === 0) {
    alert('ไม่พบห้องสอบที่ต้องการพิมพ์');
    return;
  }

  let html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งสอบ (สำนักงาน ก.พ.)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Sarabun', sans-serif;
    }
    body {
      margin: 0;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 13pt;
      line-height: 1.4;
    }
    .page-sheet {
      background: white;
      padding: 30px;
      margin: 20px auto;
      max-width: 210mm;
      min-height: 297mm;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      page-break-after: always;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    @media print {
      body { background: white; }
      .page-sheet {
        margin: 0;
        padding: 20px;
        box-shadow: none;
        page-break-after: always;
      }
      .no-print { display: none !important; }
    }

    /* แผ่นที่ 1: ป้ายหัวห้องสอบขนาดใหญ่ (Room Header Sign) */
    .door-sign-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      padding: 40px 20px;
    }
    .door-sign-room-title {
      font-size: 58pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -1px;
      margin-bottom: 50px;
      line-height: 1.1;
    }
    .door-sign-seat-range {
      font-size: 42pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .door-sign-meta {
      margin-top: 70px;
      font-size: 15pt;
      color: #475569;
      font-weight: 600;
    }

    /* แผ่นที่ 2: แผนผังห้องสอบ (Room Seating Plan) */
    .plan-header {
      text-align: center;
      margin-bottom: 12px;
    }
    .plan-header h2 {
      margin: 0;
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
    }
    .plan-header p {
      margin: 3px 0 0 0;
      font-size: 12pt;
      color: #475569;
      font-weight: 600;
    }
    .seating-plan-room-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .room-wall-front {
      border-bottom: 2px solid #334155;
      padding-bottom: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      position: relative;
    }
    .projector-screen-badge {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      padding: 4px 16px;
      font-size: 11pt;
      font-weight: 700;
      color: #1e293b;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .door-badge {
      font-size: 9.5pt;
      color: #475569;
      font-weight: 600;
      border: 1px dashed #94a3b8;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f8fafc;
      white-space: nowrap;
    }
    .room-main-area {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .side-doors {
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      height: 70%;
      padding: 0 4px;
    }
    .room-desks-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .seat-cell {
      width: 32px;
      height: 22px;
      border: 1px solid #1e293b;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      border-radius: 2px;
    }
    .seat-cell.seat-cell-compact {
      width: 25px;
      height: 20px;
      font-size: 8.5pt;
    }

    /* แผ่นที่ 3 & 4: ป้ายระเบียบ ก.พ. (ห้ามนำเข้า / สิ่งที่อนุญาต) */
    .reg-poster {
      border: 3px solid #dc2626;
      border-radius: 12px;
      padding: 24px;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
    }
    .reg-poster.allowed {
      border-color: #16a34a;
    }
    .reg-title-box {
      border: 2px solid #dc2626;
      border-radius: 8px;
      padding: 10px 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .reg-poster.allowed .reg-title-box {
      border-color: #16a34a;
    }
    .reg-title-box h1 {
      margin: 0;
      font-size: 30pt;
      font-weight: 800;
      color: #dc2626;
      letter-spacing: 0.5px;
    }
    .reg-poster.allowed .reg-title-box h1 {
      color: #16a34a;
    }
    .reg-body-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
      align-items: center;
      flex: 1;
    }
    .reg-icon-box {
      border: 2px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
    }
    .reg-cross-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .reg-desc-text {
      font-size: 15.5pt;
      line-height: 1.6;
      color: #1e293b;
      font-weight: 600;
    }
    .reg-allowed-list {
      font-size: 16pt;
      line-height: 1.8;
      color: #0f172a;
      font-weight: 700;
      padding-left: 0;
      list-style-type: none;
    }
    .reg-allowed-list li {
      margin-bottom: 12px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .ocsc-badge {
      position: absolute;
      bottom: 20px;
      right: 24px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12pt;
      font-weight: 700;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 12px; right: 12px; background: white; padding: 12px 18px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; display: flex; gap: 10px; align-items: center;">
    <span style="font-weight: 700; font-size: 14px;">🪧 เอกสารพร้อมพิมพ์ (${targetRooms.length} ห้อง)</span>
    <button onclick="window.print()" style="padding: 8px 16px; background: #7c3aed; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px;">🖨️ สั่งพิมพ์เอกสารทั้งหมด</button>
  </div>
`;

  // วนลูปสร้างเอกสารของแต่ละห้อง (แผ่นที่ 1: ป้ายหัวห้อง, แผ่นที่ 2: แผนผังที่นั่งสอบ)
  targetRooms.forEach(room => {
    // แผ่นที่ 1: ป้ายหัวห้องสอบตัวโต
    html += `
  <div class="page-sheet">
    <div class="door-sign-container">
      <div class="door-sign-room-title">
        ห้องสอบที่ ${room.roomNumber || room.id.replace('R', '')}
      </div>
      <div class="door-sign-seat-range">
        เลขที่นั่งสอบที่ ${room.seatStart || 1} - ${room.seatEnd || room.capacity}
      </div>
      <div class="door-sign-meta">
        ${room.name} • ${room.building} (ชั้น ${room.floor}) • ความจุ ${room.capacity} ที่นั่ง
      </div>
    </div>
  </div>
`;

    // แผ่นที่ 2: แผนผังห้องสอบ (Seating Plan)
    html += `
  <div class="page-sheet">
    <div class="plan-header">
      <h2>แผนผังห้องสอบที่ ${room.roomNumber || room.id.replace('R', '')} (ห้อง ${room.roomCode || room.name})</h2>
      <p>จำนวน ${room.capacity} ที่นั่ง เริ่มที่ ${room.seatStart || 1} ถึง ${room.seatEnd || room.capacity}</p>
    </div>
    ${renderSeatingPlanInnerDiagram(room)}
    <div style="margin-top: 10px; font-size: 10.5pt; color: #64748b; text-align: center;">
      * หมายเหตุ: กรรมการคุมสอบกรุณาตรวจสอบผู้เข้าสอบให้นั่งตรงตามเลขที่นั่งสอบที่กำหนดไว้ในผังห้องสอบนี้
    </div>
  </div>
`;
  });

  // แผ่นที่ 3: ป้ายห้ามนำเข้าห้องสอบ (สำนักงาน ก.พ.)
  html += `
  <div class="page-sheet">
    <div class="reg-poster">
      <div class="reg-title-box">
        <h1>ห้ามนำเข้าห้องสอบ</h1>
      </div>
      <div class="reg-body-grid">
        <div class="reg-icon-box">
          <svg class="reg-cross-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="100" stroke="#dc2626" stroke-width="3" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="#dc2626" stroke-width="3" />
          </svg>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center; font-size: 12pt; font-weight: 700; color: #475569; position: relative; z-index: 1;">
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📱 โทรศัพท์มือถือ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">⌚ นาฬิกาทุกชนิด</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📷 กล้องถ่ายภาพ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">🎙️ เครื่องบันทึกเสียง</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">🧮 เครื่องคำนวณ</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📚 หนังสือ / ตำรา</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">👜 กระเป๋า / เป้</div>
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">📻 วิทยุสื่อสาร</div>
          </div>
        </div>
        <div>
          <div class="reg-desc-text">
            เครื่องมือสื่อสาร เครื่องบันทึกภาพ<br>
            เครื่องบันทึกเสียง อุปกรณ์ที่ใช้คำนวณได้<br>
            อุปกรณ์อิเล็กทรอนิกส์ นาฬิกาทุกชนิด<br>
            รวมทั้งเอกสาร ตำรา หนังสือ<br>
            บันทึกข้อความ กระเป๋า หรืออุปกรณ์อื่นใด<br>
            นอกเหนือจากที่กำหนดในระเบียบฯ
          </div>
        </div>
      </div>
      <div class="ocsc-badge">
        🏛️ สำนักงาน ก.พ. (Office of the Civil Service Commission)
      </div>
    </div>
  </div>
`;

  // แผ่นที่ 4: ป้ายสิ่งที่อนุญาตให้นำเข้าห้องสอบได้ (สำนักงาน ก.พ.)
  html += `
  <div class="page-sheet">
    <div class="reg-poster allowed">
      <div class="reg-title-box">
        <h1>สิ่งที่อนุญาตให้นำเข้าห้องสอบได้</h1>
      </div>
      <div class="reg-body-grid">
        <div style="display: flex; flex-direction: column; gap: 10px; background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🪪 บัตรประจำตัวประชาชน
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 📄 บัตรประจำตัวสอบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🏷️ บัตรหมายเลขที่นั่งสอบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> ✏️ ปากกา ดินสอ ยางลบ
          </div>
          <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #86efac; font-weight: 700; color: #166534;">
            <span style="color: #16a34a; font-size: 18pt;">✔️</span> 🔑 กุญแจตู้เก็บของ (ถ้ามี)
          </div>
        </div>
        <div>
          <ol class="reg-allowed-list">
            <li><span>1.</span> <div><strong>บัตรประจำตัวประชาชน</strong><br><span style="font-size: 13pt; font-weight: 500; color: #475569;">หรือบัตรอื่นตามระเบียบฯ</span></div></li>
            <li><span>2.</span> <div><strong>บัตรประจำตัวสอบ</strong></div></li>
            <li><span>3.</span> <div><strong>บัตรหมายเลขที่นั่งสอบ</strong></div></li>
            <li><span>4.</span> <div><strong>ปากกา ดินสอ ยางลบ</strong> <span style="font-size: 13pt; font-weight: 500; color: #475569;">(สำหรับทด)</span></div></li>
            <li><span>5.</span> <div><strong>กุญแจตู้เก็บของ</strong> <span style="font-size: 13pt; font-weight: 500; color: #475569;">(ถ้ามี)</span></div></li>
          </ol>
        </div>
      </div>
      <div class="ocsc-badge" style="background: #dcfce7; border-color: #22c55e; color: #166534;">
        🏛️ สำนักงาน ก.พ. (Office of the Civil Service Commission)
      </div>
    </div>
  </div>
`;

  html += `
</body>
</html>`;

  renderAndPrintHTML(html);
}

