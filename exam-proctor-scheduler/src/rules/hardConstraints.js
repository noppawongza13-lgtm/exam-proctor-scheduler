/**
 * hardConstraints.js — ตัวตรวจ Hard Constraints (H1-H8)
 * แยกจาก solver ใช้ซ้ำได้ทั้งตอนจัดอัตโนมัติและตอนแก้ด้วยมือ
 * 
 * แต่ละ constraint เป็นฟังก์ชันที่รับ context แล้วคืน violations
 * 
 * @module rules/hardConstraints
 */

import { getEffectiveTime, requiredProctors } from '../data/models.js';
import { isTimeOverlap, diffMinutes, diffHours, isSameDay, toDate } from '../utils/dateUtils.js';
import { loadSettings } from '../config/settings.js';

/**
 * @typedef {Object} RuleContext
 * @property {import('../data/models.js').Room[]} rooms
 * @property {import('../data/models.js').Proctor[]} proctors
 * @property {import('../data/models.js').ExamSession[]} sessions
 * @property {import('../data/models.js').RoomAllocation[]} allocations
 * @property {import('../data/models.js').ProctorAssignment[]} assignments
 * @property {import('../data/models.js').Unavailability[]} unavailabilities
 * @property {Object} settings
 */

/**
 * @typedef {Object} Violation
 * @property {string} rule - รหัสกฎ (H1, H2, ...)
 * @property {string} ruleName - ชื่อกฎภาษาไทย
 * @property {string} message - คำอธิบายการละเมิด
 * @property {'error'} severity - ความรุนแรง (hard = error เสมอ)
 * @property {string[]} [entityIds] - ID ที่เกี่ยวข้อง
 */

// ====================================================================
// H1: ผู้คุมหนึ่งคนอยู่ได้หนึ่งห้องในช่วงเวลาที่ทับซ้อนกัน
// ====================================================================

/**
 * ตรวจ H1: ผู้คุมซ้ำในช่วงเวลาเดียวกัน
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH1_ProctorTimeConflict(ctx) {
  const violations = [];
  const { assignments, allocations, sessions } = ctx;

  // สร้าง map ของ allocation → session (เพื่อดึงเวลาเร็ว)
  const allocMap = new Map(allocations.map(a => [a.id, a]));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  // จัดกลุ่ม assignments ตาม proctor
  const byProctor = new Map();
  for (const asn of assignments) {
    if (asn.role === 'สำรอง') continue; // สำรองไม่ผูกกับห้อง
    if (!byProctor.has(asn.proctorId)) byProctor.set(asn.proctorId, []);
    byProctor.get(asn.proctorId).push(asn);
  }

  for (const [proctorId, proctorAssignments] of byProctor) {
    for (let i = 0; i < proctorAssignments.length; i++) {
      for (let j = i + 1; j < proctorAssignments.length; j++) {
        const a1 = proctorAssignments[i];
        const a2 = proctorAssignments[j];

        const alloc1 = allocMap.get(a1.allocationId);
        const alloc2 = allocMap.get(a2.allocationId);
        if (!alloc1 || !alloc2) continue;

        const session1 = sessionMap.get(alloc1.sessionId);
        const session2 = sessionMap.get(alloc2.sessionId);
        if (!session1 || !session2) continue;

        // ใช้เวลา effective (รวม prep + wrap)
        const t1 = getEffectiveTime(session1);
        const t2 = getEffectiveTime(session2);

        if (isTimeOverlap(t1.effectiveStart, t1.effectiveEnd, t2.effectiveStart, t2.effectiveEnd)) {
          const proctor = ctx.proctors.find(p => p.id === proctorId);
          const name = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;
          violations.push({
            rule: 'H1',
            ruleName: 'ผู้คุมซ้ำในช่วงเวลาเดียวกัน',
            message: `${name} ถูกจัดในห้องที่ทับซ้อนเวลากัน: "${session1.name}" และ "${session2.name}" (รวมเวลาเตรียมและเวลาหลังสอบ)`,
            severity: 'error',
            entityIds: [a1.id, a2.id, proctorId],
          });
        }
      }
    }
  }
  return violations;
}

// ====================================================================
// H2: ห้องหนึ่งห้องใช้ได้หนึ่งรอบในช่วงเวลาที่ทับซ้อนกัน
//     + จำนวนผู้เข้าสอบไม่เกินความจุ
// ====================================================================

/**
 * ตรวจ H2: ห้องซ้ำรอบ + เกินความจุ
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH2_RoomConflictAndCapacity(ctx) {
  const violations = [];
  const { allocations, sessions, rooms } = ctx;
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // จัดกลุ่ม allocations ตามห้อง
  const byRoom = new Map();
  for (const alloc of allocations) {
    if (!byRoom.has(alloc.roomId)) byRoom.set(alloc.roomId, []);
    byRoom.get(alloc.roomId).push(alloc);
  }

  for (const [roomId, roomAllocations] of byRoom) {
    const room = roomMap.get(roomId);

    // ตรวจเวลาซ้อน
    for (let i = 0; i < roomAllocations.length; i++) {
      for (let j = i + 1; j < roomAllocations.length; j++) {
        const s1 = sessionMap.get(roomAllocations[i].sessionId);
        const s2 = sessionMap.get(roomAllocations[j].sessionId);
        if (!s1 || !s2) continue;

        const t1 = getEffectiveTime(s1);
        const t2 = getEffectiveTime(s2);

        if (isTimeOverlap(t1.effectiveStart, t1.effectiveEnd, t2.effectiveStart, t2.effectiveEnd)) {
          violations.push({
            rule: 'H2',
            ruleName: 'ห้องซ้ำในช่วงเวลาเดียวกัน',
            message: `ห้อง ${room?.name || roomId} ถูกใช้ซ้อนกัน: "${s1.name}" และ "${s2.name}"`,
            severity: 'error',
            entityIds: [roomAllocations[i].id, roomAllocations[j].id],
          });
        }
      }

      // ตรวจความจุ
      if (room && roomAllocations[i].examinees > room.capacity) {
        const s = sessionMap.get(roomAllocations[i].sessionId);
        violations.push({
          rule: 'H2',
          ruleName: 'จำนวนผู้เข้าสอบเกินความจุห้อง',
          message: `ห้อง ${room.name} มีผู้เข้าสอบ ${roomAllocations[i].examinees} คน เกินความจุ ${room.capacity} คน (${s?.name || ''})`,
          severity: 'error',
          entityIds: [roomAllocations[i].id],
        });
      }
    }
  }
  return violations;
}

// ====================================================================
// H3: ไม่เกินโควต้าทุกระดับ
// ====================================================================

/**
 * ตรวจ H3: โควต้าทุกระดับ
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH3_QuotaExceeded(ctx) {
  const violations = [];
  const { assignments, allocations, sessions, proctors } = ctx;
  const allocMap = new Map(allocations.map(a => [a.id, a]));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  for (const proctor of proctors) {
    if (!proctor.active) continue;

    const proctorAssignments = assignments.filter(
      a => a.proctorId === proctor.id && a.role !== 'สำรอง'
    );

    // === โควต้าต่อวัน ===
    const byDay = new Map();
    let totalHours = 0;

    for (const asn of proctorAssignments) {
      const alloc = allocMap.get(asn.allocationId);
      if (!alloc) continue;
      const session = sessionMap.get(alloc.sessionId);
      if (!session) continue;

      // นับรอบต่อวัน
      const day = session.date;
      byDay.set(day, (byDay.get(day) || 0) + 1);

      // นับชั่วโมงสะสม
      const hours = diffHours(session.startTime, session.endTime)
        + session.prepMinutes / 60
        + session.wrapMinutes / 60;
      totalHours += hours;
    }

    const name = `${proctor.firstName} ${proctor.lastName}`;

    // ตรวจโควต้าต่อวัน
    for (const [day, count] of byDay) {
      if (count > proctor.quotaPerDay) {
        violations.push({
          rule: 'H3',
          ruleName: 'เกินโควต้าต่อวัน',
          message: `${name} ถูกจัดรอบ ${count} รอบในวันที่ ${day} เกินโควต้า ${proctor.quotaPerDay} รอบ/วัน`,
          severity: 'error',
          entityIds: [proctor.id],
        });
      }
    }

    // ตรวจโควต้าต่อโครงการ
    if (proctorAssignments.length > proctor.quotaPerProject) {
      violations.push({
        rule: 'H3',
        ruleName: 'เกินโควต้าต่อโครงการ',
        message: `${name} ถูกจัด ${proctorAssignments.length} รอบ เกินโควต้า ${proctor.quotaPerProject} รอบ/โครงการ`,
        severity: 'error',
        entityIds: [proctor.id],
      });
    }

    // ตรวจชั่วโมงสูงสุด
    if (totalHours > proctor.maxHours) {
      violations.push({
        rule: 'H3',
        ruleName: 'เกินชั่วโมงสูงสุด',
        message: `${name} มีชั่วโมงรวม ${totalHours.toFixed(1)} ชม. เกินขีดจำกัด ${proctor.maxHours} ชม.`,
        severity: 'error',
        entityIds: [proctor.id],
      });
    }
  }
  return violations;
}

// ====================================================================
// H4: ไม่จัดคนในช่วง Unavailability
// ====================================================================

/**
 * ตรวจ H4: จัดคนในช่วงไม่ว่าง
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH4_UnavailabilityConflict(ctx) {
  const violations = [];
  const { assignments, allocations, sessions, proctors, unavailabilities } = ctx;
  const allocMap = new Map(allocations.map(a => [a.id, a]));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  for (const asn of assignments) {
    const alloc = allocMap.get(asn.allocationId);
    if (!alloc) continue;
    const session = sessionMap.get(alloc.sessionId);
    if (!session) continue;

    const { effectiveStart, effectiveEnd } = getEffectiveTime(session);

    // หาช่วงไม่ว่างของผู้คุมคนนี้
    const proctorUnavail = unavailabilities.filter(u => u.proctorId === asn.proctorId);

    for (const unav of proctorUnavail) {
      if (isTimeOverlap(effectiveStart, effectiveEnd, unav.startTime, unav.endTime)) {
        const proctor = proctors.find(p => p.id === asn.proctorId);
        const name = proctor ? `${proctor.firstName} ${proctor.lastName}` : asn.proctorId;
        violations.push({
          rule: 'H4',
          ruleName: 'จัดคนในช่วงไม่ว่าง',
          message: `${name} ถูกจัดในรอบ "${session.name}" แต่แจ้งไม่ว่างในช่วงนั้น${unav.reason ? ` (${unav.reason})` : ''}`,
          severity: 'error',
          entityIds: [asn.id, unav.id, asn.proctorId],
        });
      }
    }
  }
  return violations;
}

// ====================================================================
// H5: ทุกห้องมีผู้คุมครบ + มีหัวหน้าห้อง
// ====================================================================

/**
 * ตรวจ H5: ผู้คุมครบและมีหัวหน้าห้อง
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH5_ProctorCompleteness(ctx) {
  const violations = [];
  const { assignments, allocations, sessions, rooms, proctors, settings: s } = ctx;
  const settings = s || loadSettings();
  const sessionMap = new Map(sessions.map(se => [se.id, se]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  for (const alloc of allocations) {
    const session = sessionMap.get(alloc.sessionId);
    const room = roomMap.get(alloc.roomId);
    if (!session || !room) continue;

    // assignments สำหรับ allocation นี้ (ไม่รวมสำรอง)
    const roomAssignments = assignments.filter(
      a => a.allocationId === alloc.id && a.role !== 'สำรอง'
    );

    const required = requiredProctors(alloc.examinees, settings.proctorsPerRoom);
    const actual = roomAssignments.length;

    if (actual < required) {
      violations.push({
        rule: 'H5',
        ruleName: 'ผู้คุมไม่ครบ',
        message: `ห้อง ${room.name} รอบ "${session.name}" มีผู้คุม ${actual}/${required} คน (ผู้เข้าสอบ ${alloc.examinees} คน)`,
        severity: 'error',
        entityIds: [alloc.id],
      });
    }

    // ตรวจว่ามีหัวหน้าห้อง
    const hasHead = roomAssignments.some(a => a.role === 'หัวหน้าห้อง');
    if (actual > 0 && !hasHead) {
      violations.push({
        rule: 'H5',
        ruleName: 'ไม่มีหัวหน้าห้อง',
        message: `ห้อง ${room.name} รอบ "${session.name}" ไม่มีหัวหน้าห้อง (ต้องมี 1 คนที่เป็นระดับผู้คุมหลัก)`,
        severity: 'error',
        entityIds: [alloc.id],
      });
    }

    // ตรวจว่าหัวหน้าห้องเป็นระดับ head
    for (const asn of roomAssignments) {
      if (asn.role === 'หัวหน้าห้อง') {
        const proctor = proctors.find(p => p.id === asn.proctorId);
        if (proctor && proctor.level !== 'head') {
          violations.push({
            rule: 'H5',
            ruleName: 'หัวหน้าห้องไม่มีคุณสมบัติ',
            message: `${proctor.firstName} ${proctor.lastName} เป็นระดับ "ผู้ช่วยเท่านั้น" ไม่สามารถเป็นหัวหน้าห้องได้`,
            severity: 'error',
            entityIds: [asn.id, proctor.id],
          });
        }
      }
    }
  }
  return violations;
}

// ====================================================================
// H6: เวลาพักระหว่างรอบติดกัน ≥ 30 นาที
// ====================================================================

/**
 * ตรวจ H6: เวลาพักขั้นต่ำ
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH6_MinBreak(ctx) {
  const violations = [];
  const { assignments, allocations, sessions, proctors, settings: s } = ctx;
  const settings = s || loadSettings();
  const allocMap = new Map(allocations.map(a => [a.id, a]));
  const sessionMap = new Map(sessions.map(se => [se.id, se]));

  // จัดกลุ่มตามผู้คุม
  const byProctor = new Map();
  for (const asn of assignments) {
    if (asn.role === 'สำรอง') continue;
    if (!byProctor.has(asn.proctorId)) byProctor.set(asn.proctorId, []);
    byProctor.get(asn.proctorId).push(asn);
  }

  for (const [proctorId, proctorAssignments] of byProctor) {
    // ดึงเวลา effective ของแต่ละ assignment
    const withTime = proctorAssignments
      .map(asn => {
        const alloc = allocMap.get(asn.allocationId);
        if (!alloc) return null;
        const session = sessionMap.get(alloc.sessionId);
        if (!session) return null;
        const { effectiveStart, effectiveEnd } = getEffectiveTime(session);
        return { asn, session, effectiveStart, effectiveEnd };
      })
      .filter(Boolean)
      .sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime());

    // ตรวจช่วงพักระหว่างรอบติดกัน
    for (let i = 0; i < withTime.length - 1; i++) {
      const current = withTime[i];
      const next = withTime[i + 1];

      // ต้องเป็นวันเดียวกัน
      if (!isSameDay(current.effectiveStart, next.effectiveStart)) continue;

      const breakMinutes = diffMinutes(current.effectiveEnd, next.effectiveStart);

      if (breakMinutes < settings.minBreakMinutes && breakMinutes >= 0) {
        const proctor = proctors.find(p => p.id === proctorId);
        const name = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;
        violations.push({
          rule: 'H6',
          ruleName: 'เวลาพักไม่พอ',
          message: `${name} มีเวลาพักเพียง ${Math.round(breakMinutes)} นาที ระหว่างรอบ "${current.session.name}" กับ "${next.session.name}" (ต้องพักอย่างน้อย ${settings.minBreakMinutes} นาที)`,
          severity: 'error',
          entityIds: [current.asn.id, next.asn.id, proctorId],
        });
      }
    }
  }
  return violations;
}

// ====================================================================
// H7: ห้องที่มีความต้องการพิเศษต้องจัดห้องที่รองรับ
// ====================================================================

/**
 * ตรวจ H7: ห้องพิเศษ
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH7_SpecialNeedsRoom(ctx) {
  const violations = [];
  const { allocations, rooms, sessions } = ctx;
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  for (const alloc of allocations) {
    const room = roomMap.get(alloc.roomId);
    const session = sessionMap.get(alloc.sessionId);
    if (!room || !session) continue;

    for (const need of alloc.specialNeeds) {
      if (need === 'accessible' && !room.accessible) {
        violations.push({
          rule: 'H7',
          ruleName: 'ห้องไม่รองรับผู้พิการ',
          message: `ห้อง ${room.name} รอบ "${session.name}" ต้องการห้องรองรับผู้พิการ แต่ห้องนี้ไม่รองรับ`,
          severity: 'error',
          entityIds: [alloc.id, room.id],
        });
      }
      if ((need === 'computer' || ctx.settings?.hardConstraints?.h7_require_all_computer_rooms) && room.type !== 'computer' && room.roomType !== 'computer') {
        violations.push({
          rule: 'H7',
          ruleName: 'ห้องไม่ใช่ห้องคอมพิวเตอร์',
          message: `การจัดสอบบนระบบคอมพิวเตอร์ (CBT) ห้อง ${room.name} รอบ "${session.name}" ต้องการห้องคอมพิวเตอร์ แต่ห้องนี้เป็นห้องปกติ`,
          severity: 'error',
          entityIds: [alloc.id, room.id],
        });
      }
    }
  }
  return violations;
}

// ====================================================================
// H8: ผู้คุมสำรอง ≥ 2 คนต่อ session
// ====================================================================

/**
 * ตรวจ H8: ผู้คุมสำรอง
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkH8_ReserveProctors(ctx) {
  const violations = [];
  const { assignments, allocations, sessions, settings: s } = ctx;
  const settings = s || loadSettings();
  const sessionMap = new Map(sessions.map(se => [se.id, se]));

  // จัดกลุ่ม allocations ตาม session
  const allocBySession = new Map();
  for (const alloc of allocations) {
    if (!allocBySession.has(alloc.sessionId)) allocBySession.set(alloc.sessionId, []);
    allocBySession.get(alloc.sessionId).push(alloc);
  }

  for (const [sessionId, sessionAllocations] of allocBySession) {
    const session = sessionMap.get(sessionId);
    if (!session) continue;

    // หา allocation IDs ของ session นี้
    const allocIds = new Set(sessionAllocations.map(a => a.id));

    // นับผู้คุมสำรองใน session นี้
    const reserves = assignments.filter(
      a => allocIds.has(a.allocationId) && a.role === 'สำรอง'
    );

    // ตรวจจำนวนสำรอง
    // หมายเหตุ: สำรองผูกกับ session ผ่าน allocation ใดก็ได้ของ session นั้น
    // ใน solver จะสร้าง "virtual allocation" สำหรับสำรอง
    const reserveAssignments = assignments.filter(
      a => a.role === 'สำรอง'
    );

    // จัดกลุ่มสำรองตาม session
    const reserveBySession = new Map();
    for (const ra of reserveAssignments) {
      const alloc = allocations.find(al => al.id === ra.allocationId);
      if (!alloc) continue;
      if (!reserveBySession.has(alloc.sessionId)) reserveBySession.set(alloc.sessionId, []);
      reserveBySession.get(alloc.sessionId).push(ra);
    }

    const sessionReserves = reserveBySession.get(sessionId) || [];

    if (sessionReserves.length < settings.reservePerSession) {
      violations.push({
        rule: 'H8',
        ruleName: 'ผู้คุมสำรองไม่พอ',
        message: `รอบ "${session.name}" มีผู้คุมสำรอง ${sessionReserves.length}/${settings.reservePerSession} คน`,
        severity: 'error',
        entityIds: [sessionId],
      });
    }

    // ตรวจว่าสำรองไม่ซ้ำกับผู้คุมหลักในรอบเดียวกัน
    const mainProctorIds = new Set(
      assignments
        .filter(a => allocIds.has(a.allocationId) && a.role !== 'สำรอง')
        .map(a => a.proctorId)
    );

    for (const reserve of sessionReserves) {
      if (mainProctorIds.has(reserve.proctorId)) {
        const proctor = ctx.proctors.find(p => p.id === reserve.proctorId);
        const name = proctor ? `${proctor.firstName} ${proctor.lastName}` : reserve.proctorId;
        violations.push({
          rule: 'H8',
          ruleName: 'สำรองซ้ำกับผู้คุมหลัก',
          message: `${name} เป็นทั้งผู้คุมหลักและสำรองในรอบ "${session.name}"`,
          severity: 'error',
          entityIds: [reserve.id, reserve.proctorId],
        });
      }
    }
  }
  return violations;
}

// ====================================================================
// รวมทุก Hard Constraints
// ====================================================================

/** รายการ constraint ทั้งหมดพร้อมชื่อ */
export const HARD_CONSTRAINTS = [
  { id: 'H1', name: 'ผู้คุมซ้ำในเวลาเดียวกัน', check: checkH1_ProctorTimeConflict },
  { id: 'H2', name: 'ห้องซ้ำ/เกินความจุ', check: checkH2_RoomConflictAndCapacity },
  { id: 'H3', name: 'เกินโควต้า', check: checkH3_QuotaExceeded },
  { id: 'H4', name: 'จัดคนช่วงไม่ว่าง', check: checkH4_UnavailabilityConflict },
  { id: 'H5', name: 'ผู้คุมไม่ครบ/ไม่มีหัวหน้า', check: checkH5_ProctorCompleteness },
  { id: 'H6', name: 'เวลาพักไม่พอ', check: checkH6_MinBreak },
  { id: 'H7', name: 'ห้องพิเศษไม่ตรง', check: checkH7_SpecialNeedsRoom },
  { id: 'H8', name: 'สำรองไม่พอ', check: checkH8_ReserveProctors },
];

/**
 * ตรวจ Hard Constraints ทั้งหมด
 * @param {RuleContext} ctx
 * @returns {Violation[]}
 */
export function checkAllHardConstraints(ctx) {
  const violations = [];
  for (const constraint of HARD_CONSTRAINTS) {
    violations.push(...constraint.check(ctx));
  }
  return violations;
}

/**
 * ตรวจ Hard Constraint เดียว สำหรับ assignment ใหม่
 * (ใช้ตอนแก้ด้วยมือ — ตรวจเฉพาะ assignment ที่เปลี่ยน)
 * @param {RuleContext} ctx
 * @param {string} assignmentId - ID ของ assignment ที่เปลี่ยน
 * @returns {Violation[]}
 */
export function checkHardConstraintsForAssignment(ctx, assignmentId) {
  // ตรวจทั้งหมดแล้วกรองเฉพาะที่เกี่ยวข้อง
  const all = checkAllHardConstraints(ctx);
  return all.filter(v => v.entityIds && v.entityIds.includes(assignmentId));
}
