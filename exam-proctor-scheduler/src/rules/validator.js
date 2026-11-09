/**
 * ตัวตรวจสอบกฎแบบรวมศูนย์ (Unified Schedule Validator)
 * ตามข้อกำหนด 9:
 * "ตัวตรวจกฎ (rules) ต้องแยกจาก solver และใช้ซ้ำได้ทั้งตอนจัดอัตโนมัติและตอนแก้ด้วยมือ
 * เพื่อให้พฤติกรรมตรงกันเสมอ"
 */

import {
  checkH1_ProctorTimeOverlap,
  checkH2_RoomOverlapAndCapacity,
  checkH3_QuotaLimits,
  checkH4_Unavailability,
  checkH5_RequiredProctorsAndChief,
  checkH6_RestPeriodBetweenSessions,
  checkH7_SpecialRoomNeeds,
  checkH8_ReserveProctors
} from './hard-constraints.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - ผ่านทุกข้อ (ไม่มี error) หรือไม่
 * @property {import('./hard-constraints.js').RuleViolation[]} violations - รายการละเมิดกฎทั้งหมด
 * @property {number} errorCount - จำนวนข้อผิดพลาดร้ายแรง (hard constraints)
 * @property {number} warningCount - จำนวนคำเตือน
 * @property {Map<string, string[]>} assignmentViolations - แมป assignmentId -> ข้อความแจ้งเตือน
 * @property {Map<string, string[]>} proctorViolations - แมป proctorId -> ข้อความแจ้งเตือน
 */

/**
 * ตรวจสอบความถูกต้องของตารางทั้งหมด
 * @param {Object} params
 * @param {import('../data/models.js').ProctorAssignment[]} params.assignments
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').Unavailability[]} params.unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} [params.settings]
 * @returns {ValidationResult}
 */
export function validateSchedule({
  assignments,
  allocations,
  sessions,
  proctors,
  rooms,
  unavailabilities = [],
  settings
}) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // รันตัวตรวจ H1 ถึง H8 ทั้งหมด
  const h1 = checkH1_ProctorTimeOverlap(assignments, sessionMap, proctorMap, settings);
  const h2 = checkH2_RoomOverlapAndCapacity(allocations, sessionMap, roomMap, settings);
  const h3 = checkH3_QuotaLimits(assignments, sessionMap, proctorMap, settings);
  const h4 = checkH4_Unavailability(assignments, sessionMap, proctorMap, unavailabilities, settings);
  const h5 = checkH5_RequiredProctorsAndChief(allocations, assignments, proctorMap, settings);
  const h6 = checkH6_RestPeriodBetweenSessions(assignments, sessionMap, proctorMap, settings);
  const h7 = checkH7_SpecialRoomNeeds(allocations, roomMap, settings);
  const h8 = checkH8_ReserveProctors(assignments, sessionMap, proctorMap, settings);

  const allViolations = [
    ...h1, ...h2, ...h3, ...h4,
    ...h5, ...h6, ...h7, ...h8
  ];

  const errorCount = allViolations.filter(v => v.severity === 'error').length;
  const warningCount = allViolations.filter(v => v.severity === 'warning').length;

  // ทำดัชนีแมปเพื่อนำไปไฮไลต์บนหน้า UI (สีแดง/ส้ม)
  const assignmentViolations = new Map();
  const proctorViolations = new Map();

  for (const v of allViolations) {
    if (v.details) {
      if (v.details.assignmentId1) {
        addMapItem(assignmentViolations, v.details.assignmentId1, v.message);
      }
      if (v.details.assignmentId2) {
        addMapItem(assignmentViolations, v.details.assignmentId2, v.message);
      }
      if (v.details.assignmentId) {
        addMapItem(assignmentViolations, v.details.assignmentId, v.message);
      }
      if (v.details.proctorId) {
        addMapItem(proctorViolations, v.details.proctorId, v.message);
      }
    }
  }

  return {
    isValid: errorCount === 0,
    violations: allViolations,
    errorCount,
    warningCount,
    assignmentViolations,
    proctorViolations
  };
}

function addMapItem(map, key, val) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(val);
}

/**
 * ตรวจสอบผู้คุมเฉพาะคนว่าสามารถรับงานใน slot นี้ได้หรือไม่ (ใช้สำหรับหน้า manual edit และ solver)
 * @param {Object} params
 * @param {string} params.proctorId
 * @param {string} params.sessionId
 * @param {string} params.allocationId
 * @param {'chief'|'proctor'|'reserve'} params.role
 * @param {import('../data/models.js').ProctorAssignment[]} params.currentAssignments
 * @param {Map<string, import('../data/models.js').ExamSession>} params.sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} params.proctorMap
 * @param {import('../data/models.js').Unavailability[]} params.unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canProctorTakeSlot({
  proctorId,
  sessionId,
  allocationId,
  role,
  currentAssignments,
  sessionMap,
  proctorMap,
  unavailabilities,
  settings
}) {
  const proctor = proctorMap.get(proctorId);
  if (!proctor || !proctor.isActive) {
    return { allowed: false, reason: 'ผู้คุมไม่มีอยู่ในระบบหรือสถานะไม่พร้อมใช้งาน' };
  }

  // กฎ H5 / ELMS ข้อ 4: ถ้าบทบาทเป็นหัวหน้าห้อง (chief) ต้องมีระดับ chief หรือเป็นอาจารย์ (สายวิชาการ)
  if (role === 'chief' && proctor.level !== 'chief' && proctor.proctorType !== 'faculty') {
    return { allowed: false, reason: 'ผู้คุมท่านนี้เป็นระดับผู้ช่วย (assistant) ไม่สามารถรับบทบาทหัวหน้าห้องได้' };
  }

  const targetSession = sessionMap.get(sessionId);
  if (!targetSession) {
    return { allowed: false, reason: 'ไม่พบข้อมูลรอบสอบ' };
  }

  // กฎวันสะดวกเฉพาะเจาะจง (Explicit Dates Availability)
  if (settings?.hardConstraints?.h4_enforce_explicit_dates && Array.isArray(proctor.availableDates) && proctor.availableDates.length > 0) {
    if (!proctor.availableDates.includes(targetSession.date)) {
      return {
        allowed: false,
        reason: `ผู้คุมระบุสะดวกเฉพาะวันที่ ${proctor.availableDates.join(', ')} (รอบนี้เป็นวันที่ ${targetSession.date})`
      };
    }
  }

  // ตรวจโควต้ารวมของโครงการ (Project Quota)
  const assignedCount = currentAssignments.filter(a => a.proctorId === proctorId && a.id !== 'TEMP_TEST').length;
  const projectLimit = proctor.projectQuota !== undefined ? proctor.projectQuota : (settings?.hardConstraints?.h3_project_quota_default ?? 6);
  if (assignedCount >= projectLimit) {
    return {
      allowed: false,
      reason: `ผู้คุมได้รับมอบหมายครบโควต้าโครงการแล้ว (${assignedCount}/${projectLimit} รอบ)`
    };
  }

  // ตรวจโควต้าต่อวัน (Daily Quota)
  const sameDayAssigns = currentAssignments.filter(a => {
    if (a.proctorId !== proctorId || a.id === 'TEMP_TEST') return false;
    const s = sessionMap.get(a.sessionId);
    return s && s.date === targetSession.date;
  });
  const dailyLimit = proctor.dailyQuota !== undefined ? proctor.dailyQuota : (settings?.hardConstraints?.h3_daily_quota_default ?? 2);
  if (sameDayAssigns.length >= dailyLimit) {
    return {
      allowed: false,
      reason: `ผู้คุมได้รับมอบหมายครบโควต้าต่อวันในวันที่ ${targetSession.date} แล้ว (${sameDayAssigns.length}/${dailyLimit} รอบ)`
    };
  }

  // กฎวันละ 1 รอบ (SINGLE_PER_DAY)
  if (settings?.hardConstraints?.h4_enforce_session_patterns && proctor.sessionPattern === 'SINGLE_PER_DAY' && sameDayAssigns.length >= 1) {
    return {
      allowed: false,
      reason: `ผู้คุมมีเงื่อนไขขอปฏิบัติหน้าที่วันละ 1 รอบเท่านั้น (SINGLE_PER_DAY)`
    };
  }

  // จำลอง assignment ชั่วคราวเพื่อตรวจกฎ
  const tempAssign = {
    id: 'TEMP_TEST',
    allocationId: allocationId || 'TEMP_ALLOC',
    sessionId,
    proctorId,
    role,
    status: 'draft',
    source: 'manual',
    reason: 'manual candidate check'
  };

  const testAssignments = [...currentAssignments.filter(a => a.id !== tempAssign.id), tempAssign];

  // 1. ตรวจ H1 ซ้อนเวลา
  const h1 = checkH1_ProctorTimeOverlap(testAssignments, sessionMap, proctorMap, settings);
  const h1Violated = h1.find(v => v.details && (v.details.assignmentId1 === 'TEMP_TEST' || v.details.assignmentId2 === 'TEMP_TEST'));
  if (h1Violated) {
    return { allowed: false, reason: h1Violated.message };
  }

  // 2. ตรวจ H4 ไม่ว่าง
  const h4 = checkH4_Unavailability(testAssignments, sessionMap, proctorMap, unavailabilities, settings);
  const h4Violated = h4.find(v => v.details && v.details.assignmentId === 'TEMP_TEST');
  if (h4Violated) {
    return { allowed: false, reason: h4Violated.message };
  }

  // 3. ตรวจ H3 โควต้า
  const h3 = checkH3_QuotaLimits(testAssignments, sessionMap, proctorMap, settings);
  const h3Violated = h3.find(v => v.details && v.details.proctorId === proctorId);
  if (h3Violated) {
    return { allowed: false, reason: h3Violated.message };
  }

  // 4. ตรวจ H6 เวลาพัก
  const h6 = checkH6_RestPeriodBetweenSessions(testAssignments, sessionMap, proctorMap, settings);
  const h6Violated = h6.find(v => v.details && v.details.proctorId === proctorId);
  if (h6Violated) {
    return { allowed: false, reason: h6Violated.message };
  }

  // 5. ตรวจ H8 ผู้คุมสำรองห้ามเป็นผู้คุมหลักในรอบเดียวกัน
  const h8 = checkH8_ReserveProctors(testAssignments, sessionMap, proctorMap, settings);
  const h8Violated = h8.find(v => v.details && v.details.proctorId === proctorId && v.details.sessionId === sessionId);
  if (h8Violated) {
    return { allowed: false, reason: h8Violated.message };
  }

  return { allowed: true };
}
