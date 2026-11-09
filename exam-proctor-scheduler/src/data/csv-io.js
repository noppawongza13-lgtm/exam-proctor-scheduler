/**
 * โมดูลนำเข้าและส่งออก CSV พร้อมรองรับภาษาไทย UTF-8 with BOM
 * เพื่อให้ Microsoft Excel เปิดไฟล์ภาษาไทยได้ถูกต้อง 100% ไม่เพี้ยน
 */

const UTF8_BOM = '\uFEFF';

/**
 * แปลง array of objects เป็น CSV string พร้อม UTF-8 BOM
 * @param {Array<Object>} rows 
 * @param {Array<{ key: string, label: string }>} columns 
 * @returns {string}
 */
export function exportToCSV(rows, columns) {
  const headerLine = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(row => {
    return columns.map(col => {
      const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return UTF8_BOM + [headerLine, ...rowLines].join('\r\n');
}

/**
 * ดาวน์โหลด CSV เป็นไฟล์ในเบราว์เซอร์
 * @param {string} csvContent 
 * @param {string} filename 
 */
export function triggerCSVDownload(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * แยกวิเคราะห์ (parse) CSV string เป็น Array of Objects
 * @param {string} csvText 
 * @returns {Array<Object<string, string>>}
 */
export function parseCSV(csvText) {
  if (!csvText) return [];
  // ลบ BOM ถ้ามี
  let cleanText = csvText.startsWith(UTF8_BOM) ? csvText.slice(1) : csvText;

  const lines = [];
  let currentLine = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // ข้าม quote ตัวที่สอง
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentVal.trim());
      if (currentLine.some(c => c !== '')) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentLine.length > 0) {
    currentLine.push(currentVal.trim());
    if (currentLine.some(c => c !== '')) {
      lines.push(currentLine);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0];
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = lines[i][j] !== undefined ? lines[i][j] : '';
    }
    results.push(row);
  }

  return results;
}

/**
 * แม่แบบและคำอธิบายคอลัมน์ของแต่ละตาราง
 */
export const CSV_TEMPLATES = {
  proctors: {
    filename: 'proctors_template.csv',
    columns: [
      { key: 'id', label: 'รหัสผู้คุม (เช่น P001)' },
      { key: 'firstName', label: 'ชื่อ' },
      { key: 'lastName', label: 'นามสกุล' },
      { key: 'proctorType', label: 'ประเภท (faculty=อาจารย์ / staff=เจ้าหน้าที่)' },
      { key: 'level', label: 'ระดับ (chief=หัวหน้าห้อง / assistant=ผู้ช่วย)' },
      { key: 'department', label: 'สังกัด/คณะ' },
      { key: 'email', label: 'อีเมล' },
      { key: 'phone', label: 'เบอร์โทร' },
      { key: 'dailyQuota', label: 'โควต้าต่อวัน (รอบ)' },
      { key: 'projectQuota', label: 'โควต้าทั้งโครงการ (รอบ)' },
      { key: 'maxHours', label: 'ชั่วโมงสูงสุด' },
    ],
    sampleData: [
      {
        id: 'P001',
        firstName: 'กิตติศักดิ์',
        lastName: 'เจริญสุข',
        proctorType: 'faculty',
        level: 'chief',
        department: 'คณะวิทยาศาสตร์และเทคโนโลยี',
        email: 'proctor_1@univ-exam.ac.th',
        phone: '081-234-5678',
        dailyQuota: '2',
        projectQuota: '6',
        maxHours: '18.0',
      },
      {
        id: 'P002',
        firstName: 'ขวัญชัย',
        lastName: 'พัฒนาวงศ์',
        proctorType: 'staff',
        level: 'assistant',
        department: 'กองบริหารงานวิชาการ',
        email: 'proctor_2@univ-exam.ac.th',
        phone: '089-876-5432',
        dailyQuota: '2',
        projectQuota: '6',
        maxHours: '18.0',
      }
    ]
  },

  rooms: {
    filename: 'rooms_template.csv',
    columns: [
      { key: 'id', label: 'รหัสห้อง (เช่น R01)' },
      { key: 'name', label: 'ชื่อห้อง' },
      { key: 'building', label: 'อาคาร' },
      { key: 'floor', label: 'ชั้น' },
      { key: 'capacity', label: 'ความจุ (คน)' },
      { key: 'roomType', label: 'ประเภท (normal=ปกติ / computer=คอมพิวเตอร์)' },
      { key: 'accessibleForDisabled', label: 'รองรับผู้พิการ (true/false)' },
      { key: 'isActive', label: 'พร้อมใช้ (true/false)' },
    ],
    sampleData: [
      {
        id: 'R01',
        name: 'ห้องปฏิบัติการคอมพิวเตอร์ LAB 101',
        building: 'อาคารเรียนรวม 1',
        floor: '1',
        capacity: '35',
        roomType: 'computer',
        accessibleForDisabled: 'true',
        isActive: 'true',
      },
      {
        id: 'R02',
        name: 'ห้องปฏิบัติการคอมพิวเตอร์ LAB 201',
        building: 'อาคารเรียนรวม 1',
        floor: '2',
        capacity: '30',
        roomType: 'computer',
        accessibleForDisabled: 'false',
        isActive: 'true',
      }
    ]
  },

  unavailabilities: {
    filename: 'unavailability_template.csv',
    columns: [
      { key: 'proctorId', label: 'รหัสผู้คุม' },
      { key: 'startTime', label: 'เวลาเริ่ม (ISO 8601 เช่น 2026-10-24T08:30:00+07:00)' },
      { key: 'endTime', label: 'เวลาสิ้นสุด (ISO 8601 เช่น 2026-10-24T11:30:00+07:00)' },
      { key: 'reason', label: 'เหตุผล' },
    ],
    sampleData: [
      {
        proctorId: 'P001',
        startTime: '2026-10-24T08:30:00+07:00',
        endTime: '2026-10-24T11:30:00+07:00',
        reason: 'ติดสอนชดเชยวิชาเอก'
      }
    ]
  }
};
