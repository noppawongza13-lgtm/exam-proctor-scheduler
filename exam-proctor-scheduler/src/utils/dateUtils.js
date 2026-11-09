/**
 * dateUtils.js — ฟังก์ชันจัดการวันที่และเวลา
 * แสดงผลเป็นรูปแบบไทย (วัน/เดือน/ปี พ.ศ. เวลา 24 ชม.)
 * เก็บข้อมูลเป็น ISO 8601 (Asia/Bangkok)
 * 
 * @module utils/dateUtils
 */

const BANGKOK_TZ = 'Asia/Bangkok';

/** ชื่อเดือนภาษาไทย */
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/** ชื่อเดือนย่อภาษาไทย */
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
  'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
  'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/** ชื่อวันภาษาไทย */
const THAI_DAYS = [
  'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ',
  'พฤหัสบดี', 'ศุกร์', 'เสาร์'
];

/**
 * แปลง Date เป็นวันที่ไทย พ.ศ.
 * @param {Date|string} date
 * @param {Object} [options]
 * @param {boolean} [options.showDay] - แสดงชื่อวัน
 * @param {boolean} [options.shortMonth] - ใช้ชื่อเดือนย่อ
 * @param {boolean} [options.showTime] - แสดงเวลา
 * @returns {string}
 */
export function formatThaiDate(date, options = {}) {
  const d = toDate(date);
  const { showDay = false, shortMonth = false, showTime = false } = options;

  const day = d.getDate();
  const month = shortMonth ? THAI_MONTHS_SHORT[d.getMonth()] : THAI_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543; // แปลงเป็น พ.ศ.

  let result = '';
  if (showDay) {
    result += `วัน${THAI_DAYS[d.getDay()]}ที่ `;
  }
  result += `${day} ${month} ${year}`;
  if (showTime) {
    result += ` ${formatThaiTime(d)}`;
  }
  return result;
}

/**
 * แปลง Date เป็นวันที่ไทยแบบสั้น dd/mm/yyyy (พ.ศ.)
 * @param {Date|string} date
 * @returns {string}
 */
export function formatThaiDateShort(date) {
  const d = toDate(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/**
 * แปลง Date เป็นเวลา 24 ชม. (HH:MM)
 * @param {Date|string} date
 * @returns {string}
 */
export function formatThaiTime(date) {
  const d = toDate(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} น.`;
}

/**
 * แปลง Date เป็นเวลา 24 ชม. ไม่มี "น." (HH:MM)
 * @param {Date|string} date
 * @returns {string}
 */
export function formatTime24(date) {
  const d = toDate(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * สร้าง ISO 8601 string ด้วย timezone Asia/Bangkok
 * @param {Date} date
 * @returns {string}
 */
export function toISOBangkok(date) {
  // คำนวณ offset ของ Bangkok (+07:00)
  const offset = '+07:00';
  const d = toDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
}

/**
 * แปลงวันที่จาก string (YYYY-MM-DD) กับเวลา (HH:MM) เป็น Date object
 * @param {string} dateStr - วันที่ "2024-03-15"
 * @param {string} timeStr - เวลา "09:00"
 * @returns {Date}
 */
export function combineDateAndTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
}

/**
 * เพิ่มนาทีให้ Date
 * @param {Date|string} date
 * @param {number} minutes
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  const d = toDate(date);
  return new Date(d.getTime() + minutes * 60 * 1000);
}

/**
 * ลบนาทีจาก Date
 * @param {Date|string} date
 * @param {number} minutes
 * @returns {Date}
 */
export function subtractMinutes(date, minutes) {
  return addMinutes(date, -minutes);
}

/**
 * คำนวณจำนวนนาทีระหว่างสองเวลา
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {number}
 */
export function diffMinutes(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  return (e.getTime() - s.getTime()) / (60 * 1000);
}

/**
 * คำนวณจำนวนชั่วโมงระหว่างสองเวลา
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {number}
 */
export function diffHours(start, end) {
  return diffMinutes(start, end) / 60;
}

/**
 * ตรวจว่า 2 ช่วงเวลาทับซ้อนกันหรือไม่
 * @param {Date|string} start1
 * @param {Date|string} end1
 * @param {Date|string} start2
 * @param {Date|string} end2
 * @returns {boolean}
 */
export function isTimeOverlap(start1, end1, start2, end2) {
  const s1 = toDate(start1).getTime();
  const e1 = toDate(end1).getTime();
  const s2 = toDate(start2).getTime();
  const e2 = toDate(end2).getTime();
  // ทับซ้อนเมื่อช่วงหนึ่งเริ่มก่อนอีกช่วงจบ
  return s1 < e2 && s2 < e1;
}

/**
 * ตรวจว่าวันที่เป็นวันเดียวกัน
 * @param {Date|string} date1
 * @param {Date|string} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * ดึงวันที่ในรูปแบบ YYYY-MM-DD จาก Date
 * @param {Date|string} date
 * @returns {string}
 */
export function toDateString(date) {
  const d = toDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * แปลง input เป็น Date object
 * @param {Date|string|number} input
 * @returns {Date}
 */
export function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'string' || typeof input === 'number') return new Date(input);
  throw new Error(`ไม่สามารถแปลงเป็นวันที่ได้: ${input}`);
}

/**
 * ดึงรายการวันที่ไม่ซ้ำจาก sessions
 * @param {Array<{date: string}>} sessions
 * @returns {string[]} - วันที่ (YYYY-MM-DD) เรียงลำดับ
 */
export function getUniqueDates(sessions) {
  const dates = new Set(sessions.map(s => s.date));
  return [...dates].sort();
}

/**
 * ดึงเวลาปัจจุบันในรูปแบบ ISO Bangkok
 * @returns {string}
 */
export function nowISO() {
  return toISOBangkok(new Date());
}
