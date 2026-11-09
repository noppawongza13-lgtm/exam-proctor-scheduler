/**
 * ยูทิลิตี้จัดการและจัดรูปแบบวันเวลาภาษาไทย (พ.ศ. และเวลา 24 ชม.)
 * เขตเวลา Asia/Bangkok (+07:00)
 */

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const THAI_DAYS_FULL = [
  'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'
];

/**
 * จัดรูปแบบวันที่เป็นภาษาไทย พ.ศ. เช่น "24 ต.ค. 2569"
 * @param {string|Date} dateInput 
 * @param {boolean} fullMonth 
 * @returns {string}
 */
export function formatThaiDate(dateInput, fullMonth = false) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  const day = d.getDate();
  const month = fullMonth ? THAI_MONTHS_FULL[d.getMonth()] : THAI_MONTHS_SHORT[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  return `${day} ${month} ${yearBE}`;
}

/**
 * จัดรูปแบบเวลา 24 ชม. เช่น "09:00 น." หรือ "09:00 - 12:00 น."
 * @param {string|Date} dateInput 
 * @returns {string}
 */
export function formatThaiTime(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} น.`;
}

/**
 * จัดรูปแบบช่วงเวลา เช่น "09:00 - 12:00 น."
 * @param {string|Date} startInput 
 * @param {string|Date} endInput 
 * @returns {string}
 */
export function formatThaiTimeRange(startInput, endInput) {
  if (!startInput || !endInput) return '-';
  const s = new Date(startInput);
  const e = new Date(endInput);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '-';

  const sH = String(s.getHours()).padStart(2, '0');
  const sM = String(s.getMinutes()).padStart(2, '0');
  const eH = String(e.getHours()).padStart(2, '0');
  const eM = String(e.getMinutes()).padStart(2, '0');

  return `${sH}:${sM} - ${eH}:${eM} น.`;
}

/**
 * จัดรูปแบบวันเวลาเต็ม เช่น "วันเสาร์ที่ 24 ต.ค. 2569 เวลา 09:00 - 12:00 น."
 * @param {string|Date} startInput 
 * @param {string|Date} endInput 
 * @returns {string}
 */
export function formatThaiDateTimeRange(startInput, endInput) {
  if (!startInput) return '-';
  const s = new Date(startInput);
  if (isNaN(s.getTime())) return '-';

  const dayOfWeek = THAI_DAYS_FULL[s.getDay()];
  const dateStr = formatThaiDate(s);
  const timeRange = endInput ? formatThaiTimeRange(startInput, endInput) : formatThaiTime(startInput);

  return `${dayOfWeek}ที่ ${dateStr} เวลา ${timeRange}`;
}

/**
 * แปลงสตริง วันที่ (YYYY-MM-DD) และเวลา (HH:mm) ให้เป็น ISO 8601 (เขตเวลาไทย +07:00)
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr HH:mm
 * @returns {string}
 */
export function toBangkokISO(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+07:00`;
}

/**
 * คำนวณความต่างเวลาเป็นนาที
 * @param {string|Date} start 
 * @param {string|Date} end 
 * @returns {number}
 */
export function diffMinutes(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / 60000);
}

/**
 * ตรวจสอบว่าช่วงเวลา 2 ช่วงทับซ้อนกันหรือไม่ (Interval Overlap)
 * @param {string|Date} start1 
 * @param {string|Date} end1 
 * @param {string|Date} start2 
 * @param {string|Date} end2 
 * @returns {boolean}
 */
export function isOverlapping(start1, end1, start2, end2) {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
}
