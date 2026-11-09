/**
 * โครงสร้างข้อมูลหลัก (Data Models)
 * ตามข้อกำหนด 3.1 - 3.9
 * ข้อมูลเวลาเก็บเป็น ISO 8601 (เขตเวลา Asia/Bangkok +07:00)
 */

/**
 * @typedef {'normal'|'computer'} RoomType
 * 
 * @typedef {Object} Room
 * @property {string} id - รหัสห้อง (เช่น R01, R02)
 * @property {string} name - ชื่อห้องสอบ (เช่น ห้อง 201, ห้อง LAB-1)
 * @property {string} building - ชื่ออาคาร (เช่น อาคารเรียนรวม 1)
 * @property {number} floor - ชั้น
 * @property {number} capacity - ความจุผู้เข้าสอบสูงสุด
 * @property {RoomType} roomType - ประเภทห้อง ('normal' | 'computer')
 * @property {boolean} accessibleForDisabled - รองรับผู้พิการ (bool)
 * @property {boolean} isActive - สถานะพร้อมใช้
 */

/**
 * @typedef {'faculty'|'staff'} ProctorType ประเภทผู้คุม: อาจารย์ หรือ เจ้าหน้าที่
 * @typedef {'chief'|'assistant'} ProctorLevel ระดับ: ผู้คุมหลักได้ (chief) หรือ ผู้ช่วยเท่านั้น (assistant)
 * @typedef {'core'|'reserve'} StaffPool กลุ่มบุคลากร: หลัก (core) หรือ สำรอง (reserve)
 * @typedef {'FULL_DAY_PAIRED'|'SINGLE_PER_DAY'|'ANY'} SessionPattern รูปแบบกะการทำงาน
 * 
 * @typedef {Object} Proctor
 * @property {string} id - รหัสผู้คุม (เช่น P001, P002)
 * @property {string} firstName - ชื่อ
 * @property {string} lastName - นามสกุล
 * @property {string} [academicTitle] - คำนำหน้าชื่อทางวิชาการ (ศ.ดร., ผศ.ดร., อ.ดร., อาจารย์, ฯลฯ)
 * @property {number} [seniorityRank] - ระดับความอาวุโส (10: ศ., 9: รศ., 8: ผศ., 7: อ., 5: ชำนาญการพิเศษ, 4: ชำนาญการ, 3: ปฏิบัติการ)
 * @property {StaffPool} [pool] - กลุ่มบุคลากร ('core' | 'reserve')
 * @property {SessionPattern} [sessionPattern] - รูปแบบกะการทำงาน ('FULL_DAY_PAIRED' | 'SINGLE_PER_DAY' | 'ANY')
 * @property {string[]} [availableDates] - วันที่ระบุสะดวกเฉพาะเจาะจง (ถ้าไม่ระบุคือได้ทุกวัน)
 * @property {boolean} [keepSameRoom] - ประสงค์คุมห้องเดิมตลอดวัน
 * @property {ProctorType} proctorType - อาจารย์ (faculty) หรือ เจ้าหน้าที่ (staff)
 * @property {string} department - คณะ/สำนัก/สังกัด
 * @property {string} email - อีเมลติดต่อ
 * @property {string} phone - เบอร์โทรศัพท์
 * @property {number} dailyQuota - โควต้ารอบสูงสุดต่อวัน
 * @property {number} projectQuota - โควต้ารอบสูงสุดต่อทั้งโครงการ
 * @property {number} maxHours - ชั่วโมงสะสมสูงสุด
 * @property {boolean} isActive - สถานะการใช้งาน
 * @property {ProctorLevel} level - chief (หัวหน้าห้องได้) หรือ assistant (ผู้ช่วย)
 */

/**
 * @typedef {Object} Unavailability
 * @property {string} id - รหัสรายการ
 * @property {string} proctorId - รหัสผู้คุม
 * @property {string} startTime - เวลาเริ่มต้น (ISO 8601)
 * @property {string} endTime - เวลาสิ้นสุด (ISO 8601)
 * @property {string} [reason] - เหตุผล (ไม่บังคับ)
 */

/**
 * @typedef {Object} ExamSession
 * @property {string} id - รหัสรอบสอบ (เช่น S01, S02)
 * @property {string} name - ชื่อวิชา/รอบการสอบ
 * @property {string} date - วันที่จัดสอบ (YYYY-MM-DD)
 * @property {string} startTime - เวลาเริ่มสอบจริง (ISO 8601)
 * @property {string} endTime - เวลาสิ้นสุดการสอบ (ISO 8601)
 * @property {number} totalExaminees - จำนวนผู้เข้าสอบรวมทุกห้องในรอบนี้
 * @property {number} prepMinutes - เวลาที่ผู้คุมต้องมาก่อนสอบ (นาที)
 * @property {number} wrapMinutes - เวลาที่ผู้คุมต้องอยู่หลังสอบเสร็จ (นาที)
 * @property {string} organization - หน่วยงานเจ้าของข้อสอบ/การจัดสอบ
 */

/**
 * @typedef {Object} RoomAllocation
 * @property {string} id - รหัสการจัดสรรห้อง (เช่น A01_R01)
 * @property {string} sessionId - รหัสรอบสอบ
 * @property {string} roomId - รหัสห้อง
 * @property {number} examineesInRoom - จำนวนผู้เข้าสอบในห้องนี้
 * @property {'none'|'computer'|'disabled'} specialNeeds - ความต้องการพิเศษของห้อง
 */

/**
 * @typedef {'chief'|'proctor'|'reserve'} AssignmentRole บทบาทผู้คุม
 * @typedef {'draft'|'confirmed'|'locked'} AssignmentStatus สถานะ
 * @typedef {'auto'|'manual'} AssignmentSource ที่มาของการจัด
 * 
 * @typedef {Object} ProctorAssignment
 * @property {string} id - รหัสการมอบหมาย
 * @property {string} allocationId - รหัส RoomAllocation หรือ 'RESERVE_' + sessionId
 * @property {string} sessionId - รหัสรอบสอบ
 * @property {string} [roomId] - รหัสห้อง (ถ้าเป็น reserve อาจไม่มี)
 * @property {string} proctorId - รหัสผู้คุม
 * @property {AssignmentRole} role - chief (หัวหน้าห้อง), proctor (ผู้คุมร่วม), reserve (สำรอง)
 * @property {AssignmentStatus} status - draft, confirmed, locked
 * @property {AssignmentSource} source - auto, manual
 * @property {string} reason - คำอธิบายสั้นๆ ทำไมจัดคนนี้ (ตามข้อกำหนด 6.5)
 */

/**
 * @typedef {'draft'|'review'|'published'} ScheduleStatus
 * 
 * @typedef {Object} ScheduleVersion
 * @property {string} id - รหัสเวอร์ชัน
 * @property {number} versionNumber - ลำดับเวอร์ชัน (1, 2, 3...)
 * @property {string} createdAt - วันเวลาที่สร้าง (ISO 8601)
 * @property {ScheduleStatus} scheduleStatus - สถานะตาราง
 * @property {string} note - บันทึกช่วยจำ
 * @property {ProctorAssignment[]} assignments - รายการผู้คุมทั้งหมดในเวอร์ชันนี้
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id - รหัสบันทึก
 * @property {string} timestamp - วันเวลาที่ทำรายการ (ISO 8601)
 * @property {string} actor - ชื่อผู้ทำรายการ
 * @property {string} action - การกระทำ (เช่น 'CREATE_SCHEDULE', 'MANUAL_OVERRIDE', 'CHANGE_STATUS')
 * @property {string} entityType - ประเภทข้อมูล (เช่น 'ASSIGNMENT', 'SCHEDULE_VERSION')
 * @property {string} entityId - รหัสข้อมูลที่ถูกเปลี่ยน
 * @property {any} beforeValue - ค่าเดิม
 * @property {any} afterValue - ค่าใหม่
 * @property {string} reason - เหตุผลประกอบ
 */

/**
 * คำนวณช่วงเวลาปฏิบัติงานจริงของผู้คุมในรอบสอบ (รวมเวลา prep และ wrap)
 * @param {ExamSession} session 
 * @returns {{ dutyStart: string, dutyEnd: string, durationMinutes: number }}
 */
export function getSessionDutyTime(session) {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);

  const dutyStart = new Date(start.getTime() - (session.prepMinutes || 0) * 60000);
  const dutyEnd = new Date(end.getTime() + (session.wrapMinutes || 0) * 60000);

  const durationMinutes = Math.round((dutyEnd.getTime() - dutyStart.getTime()) / 60000);

  return {
    dutyStart: dutyStart.toISOString(),
    dutyEnd: dutyEnd.toISOString(),
    durationMinutes
  };
}

/**
 * คำนวณจำนวนผู้คุมสอบที่ต้องมีประจำห้องตามเกณฑ์มาตรฐานศูนย์สอบ 520 ที่นั่ง (H5)
 * ห้องทั่วไป (< 70 ที่นั่ง) = 2 คน (หัวหน้า 1, กรรมการร่วม 1)
 * ห้องขนาดใหญ่ (>= 70 ที่นั่ง เช่น 17201 ความจุ 80) = 3 คน (หัวหน้า 1, กรรมการร่วม 2)
 * @param {RoomAllocation} allocation
 * @param {typeof import('./settings.js').DEFAULT_SETTINGS} [settings]
 * @returns {number} 1, 2 หรือ 3 คน
 */
export function getRequiredProctorCount(allocation, settings) {
  const examinees = (allocation && allocation.examineesInRoom) || 0;
  const t3 = (settings && settings.hardConstraints && settings.hardConstraints.h5_examinee_threshold_for_three_proctors) ?? 70;
  const t2 = (settings && settings.hardConstraints && settings.hardConstraints.h5_examinee_threshold_for_two_proctors) ?? 30;

  if (examinees >= t3) return 3;
  if (examinees > t2) return 2;
  return 1;
}

/**
 * คำนวณดัชนีความเป็นธรรม Jain's Fairness Index (J)
 * J = (sum(x_i))^2 / (n * sum(x_i^2))
 * เป้าหมายศูนย์สอบ ELMS: J >= 0.85
 * @param {number[]} workloads 
 * @returns {number} 0.0 - 1.0
 */
export function calculateJainsFairnessIndex(workloads) {
  if (!workloads || workloads.length === 0) return 1.0;
  const n = workloads.length;
  const sum = workloads.reduce((acc, x) => acc + x, 0);
  if (sum === 0) return 1.0;
  const sumSquares = workloads.reduce((acc, x) => acc + x * x, 0);
  if (sumSquares === 0) return 1.0;
  return (sum * sum) / (n * sumSquares);
}
