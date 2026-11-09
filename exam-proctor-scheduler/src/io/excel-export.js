/**
 * โมดูลส่งออก Excel (.xlsx) หลายชีต (Multi-sheet Excel Exporter)
 * ตามข้อกำหนด 7.10:
 * "ส่งออก Excel (.xlsx) หลายชีต:
 *  1. ตารางรวม
 *  2. รายคน
 *  3. รายห้อง
 *  4. สรุปภาระงาน"
 */

import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';

/**
 * สร้างไฟล์ Excel แบบ XML Spreadsheet 2003 ที่รองรับหลายชีต และเปิดใน Microsoft Excel ได้ทันที 100%
 * รองรับภาษาไทย UTF-8 สมบูรณ์แบบ
 * @param {Object} params
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 */
export function exportExcelWorkbook({ assignments, sessions, proctors, rooms, allocations }) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // --- ชีต 1: ตารางรวม (Overview) ---
  const sheet1Rows = [];
  sheet1Rows.push(['รหัสรอบสอบ', 'ชื่อรอบการสอบ', 'วันที่', 'เวลาสอบ', 'ห้องสอบ', 'อาคาร/ชั้น', 'บทบาท', 'รหัสผู้คุม', 'ชื่อ-สกุล', 'สังกัด', 'ประเภท', 'สถานะ']);

  for (const a of assignments) {
    const s = sessionMap.get(a.sessionId);
    const p = proctorMap.get(a.proctorId);
    const r = a.roomId ? roomMap.get(a.roomId) : null;

    sheet1Rows.push([
      s ? s.id : a.sessionId,
      s ? s.name : '-',
      s ? formatThaiDate(s.date) : '-',
      s ? formatThaiTimeRange(s.startTime, s.endTime) : '-',
      r ? r.name : (a.role === 'reserve' ? 'ผู้คุมสำรอง (ไม่ประจำห้อง)' : '-'),
      r ? `${r.building} ชั้น ${r.floor}` : '-',
      a.role === 'chief' ? 'หัวหน้าห้อง' : (a.role === 'reserve' ? 'สำรอง' : 'ผู้คุมร่วม'),
      p ? p.id : a.proctorId,
      p ? `${p.firstName} ${p.lastName}` : a.proctorId,
      p ? p.department : '-',
      p ? (p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่') : '-',
      a.status === 'locked' ? 'ล็อกแล้ว' : (a.status === 'confirmed' ? 'ยืนยัน' : 'ร่าง')
    ]);
  }

  // --- ชีต 2: รายบุคคล (Personal Schedule) ---
  const sheet2Rows = [];
  sheet2Rows.push(['รหัสผู้คุม', 'ชื่อ-สกุล', 'สังกัด', 'วันที่', 'เวลาสอบ', 'ห้องสอบ', 'บทบาท', 'สถานะ']);

  const sortedByProctor = [...assignments].sort((a, b) => a.proctorId.localeCompare(b.proctorId));
  for (const a of sortedByProctor) {
    const s = sessionMap.get(a.sessionId);
    const p = proctorMap.get(a.proctorId);
    const r = a.roomId ? roomMap.get(a.roomId) : null;

    sheet2Rows.push([
      p ? p.id : a.proctorId,
      p ? `${p.firstName} ${p.lastName}` : a.proctorId,
      p ? p.department : '-',
      s ? formatThaiDate(s.date) : '-',
      s ? formatThaiTimeRange(s.startTime, s.endTime) : '-',
      r ? r.name : (a.role === 'reserve' ? 'สำรอง (รอเรียก)' : '-'),
      a.role === 'chief' ? 'หัวหน้าห้อง' : (a.role === 'reserve' ? 'สำรอง' : 'ผู้คุมร่วม'),
      a.status === 'locked' ? 'ล็อก' : 'ปกติ'
    ]);
  }

  // --- ชีต 3: รายห้อง (Room-by-Room) ---
  const sheet3Rows = [];
  sheet3Rows.push(['รหัสห้อง', 'ชื่อห้อง', 'อาคาร', 'รอบการสอบ', 'วันที่', 'เวลา', 'ผู้คุมในห้อง', 'จำนวนผู้เข้าสอบ']);

  for (const r of rooms) {
    const roomAllocs = allocations.filter(al => al.roomId === r.id);
    for (const alloc of roomAllocs) {
      const s = sessionMap.get(alloc.sessionId);
      const roomAssigns = assignments.filter(a => a.allocationId === alloc.id);
      const proctorNames = roomAssigns.map(a => {
        const p = proctorMap.get(a.proctorId);
        const roleLabel = a.role === 'chief' ? '(หัวหน้า)' : '';
        return p ? `${p.firstName} ${p.lastName} ${roleLabel}` : a.proctorId;
      }).join(', ');

      sheet3Rows.push([
        r.id,
        r.name,
        r.building,
        s ? s.name : alloc.sessionId,
        s ? formatThaiDate(s.date) : '-',
        s ? formatThaiTimeRange(s.startTime, s.endTime) : '-',
        proctorNames || '(ยังไม่มีผู้คุม)',
        alloc.examineesInRoom
      ]);
    }
  }

  // --- ชีต 4: สรุปภาระงาน (Workload Summary) ---
  const sheet4Rows = [];
  sheet4Rows.push(['รหัสผู้คุม', 'ชื่อ-สกุล', 'สังกัด', 'ประเภท', 'ระดับ', 'รอบที่จัดจริง', 'โควต้าต่อโครงการ', 'ชั่วโมงคุมสอบสะสม (ชม.)', 'สถานะภาระงาน']);

  for (const p of proctors) {
    const pAssigns = assignments.filter(a => a.proctorId === p.id);
    let totalMinutes = 0;
    for (const a of pAssigns) {
      const s = sessionMap.get(a.sessionId);
      if (s) {
        const start = new Date(s.startTime).getTime() - (s.prepMinutes || 0) * 60000;
        const end = new Date(s.endTime).getTime() + (s.wrapMinutes || 0) * 60000;
        totalMinutes += Math.round((end - start) / 60000);
      }
    }
    const totalHours = (totalMinutes / 60).toFixed(1);
    const quota = p.projectQuota || 6;
    let loadStatus = 'ปกติ';
    if (pAssigns.length === 0) loadStatus = 'ไม่มีงาน';
    else if (pAssigns.length >= quota) loadStatus = 'เต็มโควต้า';
    else if (pAssigns.length >= quota - 1) loadStatus = 'ใกล้เต็มโควต้า';

    sheet4Rows.push([
      p.id,
      `${p.firstName} ${p.lastName}`,
      p.department,
      p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่',
      p.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย',
      pAssigns.length,
      quota,
      totalHours,
      loadStatus
    ]);
  }

  // สร้างไฟล์ XML Workbook
  const xmlContent = generateExcelXML([
    { name: 'ตารางรวมทุกห้อง', rows: sheet1Rows },
    { name: 'ตารางรายบุคคล', rows: sheet2Rows },
    { name: 'ตารางรายห้อง', rows: sheet3Rows },
    { name: 'สรุปภาระงานผู้คุม', rows: sheet4Rows }
  ]);

  downloadFile(xmlContent, `ตารางผู้คุมสอบ_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
}

/**
 * แปลงชุดข้อมูลตารางหลายชีตเป็น Microsoft XML Spreadsheet
 */
function generateExcelXML(sheets) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Sarabun" x:CharSet="222" ss:Size="11"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Sarabun" x:CharSet="222" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
`;

  for (const sheet of sheets) {
    xml += ` <Worksheet ss:Name="${sheet.name.replace(/[\\/?*:[\]]/g, '')}">\n  <Table ss:DefaultRowHeight="20">\n`;
    for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
      const row = sheet.rows[rIdx];
      const style = rIdx === 0 ? ' ss:StyleID="Header"' : ' ss:StyleID="Cell"';
      xml += `   <Row${style}>\n`;
      for (const cell of row) {
        const safeVal = String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `    <Cell><Data ss:Type="String">${safeVal}</Data></Cell>\n`;
      }
      xml += `   </Row>\n`;
    }
    xml += `  </Table>\n </Worksheet>\n`;
  }

  xml += `</Workbook>`;
  return xml;
}

function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: `${contentType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
