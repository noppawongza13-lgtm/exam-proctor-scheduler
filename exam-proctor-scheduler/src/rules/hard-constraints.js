/**
 * ตัวตรวจกฎข้อบังคับเด็ดขาด (Hard Constraints H1 - H8)
 * ตามข้อกำหนด 5: "ห้ามละเมิดเด็ดขาด"
 * ข้อความ error ทุกจุดเป็นภาษาไทยที่เข้าใจง่ายและแนะนำวิธีแก้ไข
 */

import { isOverlapping, diffMinutes, formatThaiTimeRange, formatThaiDate } from '../utils/thai-date.js';
import { getSessionDutyTime } from '../data/models.js';

/**
 * @typedef {Object} RuleViolation
 * @property {string} ruleCode - รหัสกฎ เช่น 'H1', 'H2', ...
 * @property {string} ruleName - ชื่อกฎ
 * @property {string} severity - 'error' | 'warning'
 * @property {string} message - ข้อความอธิบายภาษาไทย
 * @property {string} suggestion - คำแนะนำวิธีแก้ไข
 * @property {Object} details - ข้อมูลที่เกี่ยวข้อง
 */

/**
 * ตรวจสอบกฎ H1: ผู้คุมหนึ่งคนอยู่ได้หนึ่งห้องในช่วงเวลาที่ทับซ้อนกัน โดยนับรวมเวลา prep และ wrap
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH1_ProctorTimeOverlap(assignments, sessionMap, proctorMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h1_enforce_no_time_overlap) return violations;

  // จัดกลุ่ม assignment ตาม proctorId
  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    if (proctorAssigns.length <= 1) continue;

    for (let i = 0; i < proctorAssigns.length; i++) {
      for (let j = i + 1; j < proctorAssigns.length; j++) {
        const a1 = proctorAssigns[i];
        const a2 = proctorAssigns[j];

        const s1 = sessionMap.get(a1.sessionId);
        const s2 = sessionMap.get(a2.sessionId);
        if (!s1 || !s2) continue;

        const duty1 = getSessionDutyTime(s1);
        const duty2 = getSessionDutyTime(s2);

        // ตรวจสอบการทับซ้อนของเวลาปฏิบัติงานจริง (รวม prep/wrap)
        if (isOverlapping(duty1.dutyStart, duty1.dutyEnd, duty2.dutyStart, duty2.dutyEnd)) {
          const proctor = proctorMap.get(proctorId);
          const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;

          violations.push({
            ruleCode: 'H1',
            ruleName: 'เวลาปฏิบัติงานทับซ้อนกัน',
            severity: 'error',
            message: `ผู้คุม ${pName} ถูกจัดในรอบ "${s1.name}" (${formatThaiTimeRange(duty1.dutyStart, duty1.dutyEnd)}) และรอบ "${s2.name}" (${formatThaiTimeRange(duty2.dutyStart, duty2.dutyEnd)}) ซึ่งมีเวลาปฏิบัติงานทับซ้อนกัน`,
            suggestion: `กรุณาเปลี่ยนตัวผู้คุมคนใดคนหนึ่งออกจากรอบ "${s1.name}" หรือ "${s2.name}" โดยเลือกผู้คุมคนอื่นที่ว่างในช่วงเวลาดังกล่าว`,
            details: { proctorId, assignmentId1: a1.id, assignmentId2: a2.id, session1: s1.id, session2: s2.id }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H2: ห้องหนึ่งห้องใช้ได้หนึ่งรอบในช่วงเวลาที่ทับซ้อนกัน และจำนวนผู้เข้าสอบต้องไม่เกินความจุ
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Room>} roomMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH2_RoomOverlapAndCapacity(allocations, sessionMap, roomMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h2_enforce_room_capacity_and_overlap) return violations;

  // ตรวจสอบความจุของแต่ละ allocation
  for (const alloc of allocations) {
    const room = roomMap.get(alloc.roomId);
    if (!room) continue;

    if (alloc.examineesInRoom > room.capacity) {
      violations.push({
        ruleCode: 'H2',
        ruleName: 'จำนวนผู้เข้าสอบเกินความจุห้อง',
        severity: 'error',
        message: `ห้อง ${room.name} (${room.building}) มีผู้เข้าสอบ ${alloc.examineesInRoom} คน เกินความจุสูงสุดที่รับได้ (${room.capacity} ที่นั่ง)`,
        suggestion: `กรุณาย้ายผู้เข้าสอบบางส่วนไปห้องอื่น หรือเปลี่ยนไปใช้ห้องที่มีขนาดความจุใหญ่กว่านี้`,
        details: { allocationId: alloc.id, roomId: room.id, examinees: alloc.examineesInRoom, capacity: room.capacity }
      });
    }
  }

  // ตรวจสอบการใช้ห้องซ้อนเวลา
  const byRoom = new Map();
  for (const alloc of allocations) {
    if (!byRoom.has(alloc.roomId)) byRoom.set(alloc.roomId, []);
    byRoom.get(alloc.roomId).push(alloc);
  }

  for (const [roomId, roomAllocs] of byRoom.entries()) {
    if (roomAllocs.length <= 1) continue;

    for (let i = 0; i < roomAllocs.length; i++) {
      for (let j = i + 1; j < roomAllocs.length; j++) {
        const al1 = roomAllocs[i];
        const al2 = roomAllocs[j];
        const s1 = sessionMap.get(al1.sessionId);
        const s2 = sessionMap.get(al2.sessionId);
        if (!s1 || !s2) continue;

        if (isOverlapping(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
          const room = roomMap.get(roomId);
          const rName = room ? room.name : roomId;

          violations.push({
            ruleCode: 'H2',
            ruleName: 'ห้องสอบถูกใช้งานซ้อนเวลา',
            severity: 'error',
            message: `ห้อง ${rName} ถูกจัดใช้งานพร้อมกันในรอบ "${s1.name}" และรอบ "${s2.name}"`,
            suggestion: `กรุณาเปลี่ยนห้องสอบของหนึ่งในรอบดังกล่าวเป็นห้องอื่นที่ยังว่าง`,
            details: { roomId, allocation1: al1.id, allocation2: al2.id }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H3: ไม่เกินโควต้าทุกระดับ (ต่อวัน / ต่อโครงการ / ชั่วโมงสะสม)
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH3_QuotaLimits(assignments, sessionMap, proctorMap, settings) {
  const violations = [];

  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    const proctor = proctorMap.get(proctorId);
    if (!proctor) continue;

    const dailyLimit = proctor.dailyQuota || settings.hardConstraints.h3_daily_quota_default;
    const projectLimit = proctor.projectQuota !== undefined ? proctor.projectQuota : settings.hardConstraints.h3_project_quota_default;
    const maxHours = proctor.maxHours || settings.hardConstraints.h3_max_hours_default;

    // กฎข้อกำหนด ELMS: กรณีโควต้า <= 0 หรือ null ห้ามจัดลงรอบสอบเด็ดขาด
    if (projectLimit <= 0) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'ไม่มีโควต้าปฏิบัติงาน',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีโควต้า = 0 หรือไม่ประสงค์ปฏิบัติหน้าที่ แต่ถูกจัดลงรอบสอบ`,
        suggestion: `กรุณานำผู้คุมท่านนี้ออกจากตารางสอบเนื่องจากไม่มีโควต้า`,
        details: { proctorId, projectLimit }
      });
    }

    // 1. ตรวจโควต้ารวมทั้งโครงการ
    if (proctorAssigns.length > projectLimit) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'เกินโควต้าต่อโครงการ',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ถูกจัดไปแล้ว ${proctorAssigns.length} รอบ ซึ่งเกินโควต้าสูงสุดของโครงการ (${projectLimit} รอบ)`,
        suggestion: `กรุณาลดจำนวนรอบของผู้คุมท่านนี้ลง หรือปรับเพิ่มโควต้าโครงการในหน้าตั้งค่าหากจำเป็น`,
        details: { proctorId, assignedCount: proctorAssigns.length, projectLimit }
      });
    }

    // 2. ตรวจโควต้ารายวันและชั่วโมงรวม
    const byDate = new Map();
    let totalDutyMinutes = 0;

    for (const a of proctorAssigns) {
      const s = sessionMap.get(a.sessionId);
      if (!s) continue;

      // กฎข้อกำหนด ELMS ข้อ 2: เคารพวันที่ระบุสะดวกเฉพาะเจาะจง (Explicit Dates Availability)
      if (settings.hardConstraints.h4_enforce_explicit_dates && proctor.availableDates && proctor.availableDates.length > 0) {
        if (!proctor.availableDates.includes(s.date)) {
          violations.push({
            ruleCode: 'H3',
            ruleName: 'จัดงานในวันที่ไม่ระบุสะดวก',
            severity: 'error',
            message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ระบุวันสะดวกเฉพาะวันที่ ${proctor.availableDates.join(', ')} แต่ถูกจัดในวันที่ ${formatThaiDate(s.date)}`,
            suggestion: `กรุณาย้ายงานให้ตรงกับวันที่ผู้คุมระบุความพร้อมไว้`,
            details: { proctorId, date: s.date, availableDates: proctor.availableDates }
          });
        }
      }

      const dateStr = s.date;
      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr).push(a);

      const duty = getSessionDutyTime(s);
      totalDutyMinutes += duty.durationMinutes;
    }

    // ตรวจแต่ละวัน
    for (const [dateStr, dayAssigns] of byDate.entries()) {
      // กฎข้อกำหนด ELMS ข้อ 3: SINGLE_PER_DAY ห้ามจัดเกิน 1 รอบในวันเดียวกัน
      if (settings.hardConstraints.h4_enforce_session_patterns && proctor.sessionPattern === 'SINGLE_PER_DAY' && dayAssigns.length > 1) {
        violations.push({
          ruleCode: 'H3',
          ruleName: 'ละเมิดเงื่อนไขวันละหนึ่งรอบ (SINGLE_PER_DAY)',
          severity: 'error',
          message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีเงื่อนไขปฏิบัติหน้าที่วันละ 1 รอบเท่านั้น แต่ถูกจัด ${dayAssigns.length} รอบในวันที่ ${formatThaiDate(dateStr)}`,
          suggestion: `กรุณาลดภาระงานในวันนี้ให้เหลือ 1 รอบตามความประสงค์`,
          details: { proctorId, date: dateStr, dayCount: dayAssigns.length }
        });
      }

      if (dayAssigns.length > dailyLimit) {
        violations.push({
          ruleCode: 'H3',
          ruleName: 'เกินโควต้าต่อวัน',
          severity: 'error',
          message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ถูกจัดในวันที่ ${formatThaiDate(dateStr)} จำนวน ${dayAssigns.length} รอบ ซึ่งเกินโควต้าต่อวัน (${dailyLimit} รอบ)`,
          suggestion: `กรุณาย้ายงานในวันที่ ${formatThaiDate(dateStr)} ไปให้ผู้คุมท่านอื่นที่ยังมีโควต้าว่างในวันดังกล่าว`,
          details: { proctorId, date: dateStr, dayCount: dayAssigns.length, dailyLimit }
        });
      }
    }

    // ตรวจชั่วโมงสะสม
    const totalDutyHours = totalDutyMinutes / 60;
    if (totalDutyHours > maxHours) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'เกินชั่วโมงปฏิบัติงานสูงสุด',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีชั่วโมงคุมสอบสะสม ${totalDutyHours.toFixed(1)} ชม. ซึ่งเกินเพดานที่กำหนด (${maxHours} ชม.)`,
        suggestion: `กรุณาสลับรอบสอบบางรอบให้ผู้คุมท่านอื่น เพื่อรักษาสมดุลภาระงานตามเพดานชั่วโมง`,
        details: { proctorId, totalDutyHours, maxHours }
      });
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H4: ไม่จัดคนในช่วง Unavailability
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {import('../data/models.js').Unavailability[]} unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH4_Unavailability(assignments, sessionMap, proctorMap, unavailabilities, settings) {
  const violations = [];
  if (!settings.hardConstraints.h4_enforce_unavailability) return violations;

  const unavailMap = new Map();
  for (const u of unavailabilities) {
    if (!unavailMap.has(u.proctorId)) unavailMap.set(u.proctorId, []);
    unavailMap.get(u.proctorId).push(u);
  }

  for (const a of assignments) {
    const unavails = unavailMap.get(a.proctorId);
    if (!unavails || unavails.length === 0) continue;

    const session = sessionMap.get(a.sessionId);
    if (!session) continue;
    const duty = getSessionDutyTime(session);

    for (const u of unavails) {
      if (isOverlapping(duty.dutyStart, duty.dutyEnd, u.startTime, u.endTime)) {
        const proctor = proctorMap.get(a.proctorId);
        const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : a.proctorId;
        const reasonText = u.reason ? ` (เหตุผล: ${u.reason})` : '';

        violations.push({
          ruleCode: 'H4',
          ruleName: 'จัดงานในช่วงที่ผู้คุมแจ้งไม่ว่าง',
          severity: 'error',
          message: `ผู้คุม ${pName} ถูกจัดในรอบ "${session.name}" ซึ่งตรงกับช่วงเวลาที่แจ้งไม่ว่างไว้${reasonText}`,
          suggestion: `กรุณาเปลี่ยนตัวผู้คุมในรอบนี้ เนื่องจากผู้คุมได้แจ้งติดภารกิจล่วงหน้าไว้แล้ว`,
          details: { proctorId: a.proctorId, assignmentId: a.id, unavailabilityId: u.id, sessionId: session.id }
        });
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H5: ทุกห้องมีผู้คุมครบตามเกณฑ์ และต้องมีหัวหน้าห้อง 1 คนที่มีระดับ 'chief'
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH5_RequiredProctorsAndChief(allocations, assignments, proctorMap, settings) {
  const violations = [];

  const byAlloc = new Map();
  for (const a of assignments) {
    if (a.role === 'reserve') continue; // ข้ามผู้คุมสำรอง
    if (!byAlloc.has(a.allocationId)) byAlloc.set(a.allocationId, []);
    byAlloc.get(a.allocationId).push(a);
  }

  const threshold3 = settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;

  for (const alloc of allocations) {
    const assigned = byAlloc.get(alloc.id) || [];
    const examinees = alloc.examineesInRoom || 0;
    const requiredCount = examinees >= threshold3 ? 3 : (examinees > threshold2 ? 2 : 1);

    // 1. ตรวจจำนวนผู้คุมตามเกณฑ์ความจุห้อง (40-60 ที่นั่ง = 2 คน, 80 ที่นั่ง = 3 คน)
    if (assigned.length < requiredCount) {
      violations.push({
        ruleCode: 'H5',
        ruleName: 'จำนวนผู้คุมไม่ครบตามเกณฑ์',
        severity: 'error',
        message: `ห้องสอบ (รหัส ${alloc.roomId}) มีผู้เข้าสอบ ${examinees} คน ต้องการผู้คุม ${requiredCount} คน (ตามระเบียบศูนย์สอบ 520 ที่นั่ง) แต่ปัจจุบันจัดไว้เพียง ${assigned.length} คน (ขาด ${requiredCount - assigned.length} คน)`,
        suggestion: `กรุณาเพิ่มผู้คุมสอบให้ครบ ${requiredCount} คน โดยเลือกจากผู้คุมที่มีเวลาว่างในรอบนี้`,
        details: { allocationId: alloc.id, roomId: alloc.roomId, required: requiredCount, actual: assigned.length }
      });
    }

    // 2. ตรวจว่าต้องมีหัวหน้าห้อง (chief / academic lead) 1 คน
    if (settings.hardConstraints.h5_require_chief_proctor && assigned.length > 0) {
      const chiefAssignments = assigned.filter(a => {
        const p = proctorMap.get(a.proctorId);
        return p && (p.level === 'chief' || p.proctorType === 'faculty');
      });

      if (chiefAssignments.length === 0) {
        violations.push({
          ruleCode: 'H5',
          ruleName: 'ไม่มีหัวหน้าห้องสอบที่มีคุณสมบัติ',
          severity: 'error',
          message: `ห้องสอบ (รหัส ${alloc.roomId}) ยังไม่มีหัวหน้าห้องสอบที่มีคุณสมบัติ (ต้องเป็นอาจารย์หรือระดับ Chief อย่างน้อย 1 คน)`,
          suggestion: `กรุณากำหนดให้อาจารย์หรือผู้คุมระดับ chief ปฏิบัติหน้าที่หัวหน้าห้อง 1 ท่าน`,
          details: { allocationId: alloc.id, roomId: alloc.roomId }
        });
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H6: ผู้คุมที่ทำงานสองรอบติดกันต้องมีเวลาพักอย่างน้อย 30 นาที
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH6_RestPeriodBetweenSessions(assignments, sessionMap, proctorMap, settings) {
  const violations = [];
  const minRest = settings.hardConstraints.h6_min_rest_minutes_between_sessions;

  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    if (proctorAssigns.length <= 1) continue;

    // ดึงเวลาหน้าที่ของแต่ละ assignment แล้วเรียงตามเวลาเริ่ม
    const duties = proctorAssigns.map(a => {
      const s = sessionMap.get(a.sessionId);
      if (!s) return null;
      return { assign: a, session: s, duty: getSessionDutyTime(s) };
    }).filter(Boolean).sort((x, y) => new Date(x.duty.dutyStart).getTime() - new Date(y.duty.dutyStart).getTime());

    for (let i = 0; i < duties.length - 1; i++) {
      const current = duties[i];
      const next = duties[i + 1];

      // ตรวจสอบเฉพาะในวันเดียวกัน
      if (current.session.date === next.session.date) {
        const restMinutes = diffMinutes(current.duty.dutyEnd, next.duty.dutyStart);

        if (restMinutes >= 0 && restMinutes < minRest) {
          const proctor = proctorMap.get(proctorId);
          const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;

          violations.push({
            ruleCode: 'H6',
            ruleName: 'เวลาพักระหว่างรอบสอบไม่เพียงพอ',
            severity: 'error',
            message: `ผู้คุม ${pName} มีเวลาพักระหว่างรอบ "${current.session.name}" และ "${next.session.name}" เพียง ${restMinutes} นาที (กำหนดขั้นต่ำ ${minRest} นาที)`,
            suggestion: `กรุณาสลับรอบของผู้คุมท่านนี้เพื่อให้มีเวลาพักอย่างน้อย ${minRest} นาที หรือจัดผู้คุมคนอื่นมาแทนในรอบใดรอบหนึ่ง`,
            details: { proctorId, restMinutes, requiredRest: minRest, session1: current.session.id, session2: next.session.id }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H7: ห้องที่มีความต้องการพิเศษ (ผู้พิการ/คอมพิวเตอร์) ต้องจัดห้องที่รองรับ
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {Map<string, import('../data/models.js').Room>} roomMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH7_SpecialRoomNeeds(allocations, roomMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h7_enforce_special_room_needs) return violations;

  const requireAllComputer = settings.hardConstraints.h7_require_all_computer_rooms ?? true;

  for (const alloc of allocations) {
    const room = roomMap.get(alloc.roomId);
    if (!room) continue;

    const needsComputer = requireAllComputer || alloc.specialNeeds === 'computer' || alloc.specialNeeds === 'both';
    if (needsComputer && room.roomType !== 'computer') {
      violations.push({
        ruleCode: 'H7',
        ruleName: 'ห้องสอบไม่ตรงกับความต้องการพิเศษ (คอมพิวเตอร์)',
        severity: 'error',
        message: `การจัดสอบบนระบบคอมพิวเตอร์ (CBT) รอบ ${alloc.sessionId} ต้องการห้องปฏิบัติการคอมพิวเตอร์ แต่ห้อง ${room.name} เป็นห้องเรียนปกติ`,
        suggestion: `กรุณาเปลี่ยนไปจัดในห้องปฏิบัติการคอมพิวเตอร์ที่มีเครื่องพร้อมใช้งาน`,
        details: { allocationId: alloc.id, roomId: room.id, required: 'computer', actual: room.roomType }
      });
    }

    const needsDisabled = alloc.specialNeeds === 'disabled' || alloc.specialNeeds === 'both';
    if (needsDisabled && !room.accessibleForDisabled) {
      violations.push({
        ruleCode: 'H7',
        ruleName: 'ห้องสอบไม่รองรับผู้พิการ',
        severity: 'error',
        message: `การจัดสรรรอบ ${alloc.sessionId} มีผู้สอบที่ต้องการสิ่งอำนวยความสะดวกสำหรับผู้พิการ แต่ห้อง ${room.name} (ชั้น ${room.floor}) ไม่รองรับ`,
        suggestion: `กรุณาเปลี่ยนไปใช้ห้องชั้นล่างหรือห้องที่รองรับทางลาด/ลิฟต์สำหรับคนพิการ`,
        details: { allocationId: alloc.id, roomId: room.id, required: 'disabled_accessible' }
      });
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H8: ผู้คุมสำรอง (reserve) ต่อรอบ ต้องไม่ถูกใช้เป็นผู้คุมหลักในรอบเดียวกัน
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
export function checkH8_ReserveProctors(assignments, sessionMap, proctorMap, settings) {
  const violations = [];

  const bySession = new Map();
  for (const a of assignments) {
    if (!bySession.has(a.sessionId)) bySession.set(a.sessionId, []);
    bySession.get(a.sessionId).push(a);
  }

  for (const [sessionId, sessionAssigns] of bySession.entries()) {
    const session = sessionMap.get(sessionId);
    const sessionName = session ? session.name : sessionId;

    const mainProctors = new Set();
    const reserveProctors = new Set();

    for (const a of sessionAssigns) {
      if (a.role === 'reserve') {
        reserveProctors.add(a.proctorId);
      } else {
        mainProctors.add(a.proctorId);
      }
    }

    // ตรวจว่ามีคนซ้ำระหว่าง main และ reserve หรือไม่
    for (const rId of reserveProctors) {
      if (mainProctors.has(rId)) {
        const proctor = proctorMap.get(rId);
        const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : rId;

        violations.push({
          ruleCode: 'H8',
          ruleName: 'ผู้คุมสำรองถูกจัดเป็นผู้คุมหลักในรอบเดียวกัน',
          severity: 'error',
          message: `ผู้คุม ${pName} ถูกจัดเป็นทั้ง "ผู้คุมหลัก" และ "ผู้คุมสำรอง" ในรอบ "${sessionName}"`,
          suggestion: `กรุณาเลือกผู้คุมสำรองคนอื่นที่ไม่ได้คุมห้องใดๆ ในรอบนี้`,
          details: { proctorId: rId, sessionId }
        });
      }
    }
  }

  return violations;
}
