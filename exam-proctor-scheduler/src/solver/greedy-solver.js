/**
 * อัลกอริทึมจัดตารางอัตโนมัติ (Greedy Most-Constrained-First with Backtracking)
 * ตามข้อกำหนด 6:
 * - 6.3 Most-constrained-first + soft score + backtracking
 * - 6.4 Deterministic อิง seed
 * - 6.5 บันทึกเหตุผลภาษาไทย
 * - 6.6 รายงานข้อผิดพลาดพร้อมทางแก้ที่คำนวณจริง
 * - 6.7 เคารพ assignment ที่ล็อกไว้
 */

import { PRNG } from '../utils/prng.js';
import { canProctorTakeSlot } from '../rules/validator.js';
import { calculateCandidateScore } from './scorer.js';
import { generateAssignmentReason } from './explain.js';
import { checkFeasibility } from '../rules/feasibility.js';
import { validateSchedule } from '../rules/validator.js';
import { calculateJainsFairnessIndex } from '../data/models.js';

/**
 * @typedef {Object} SolverSlot
 * @property {string} slotId
 * @property {string} sessionId
 * @property {string} [allocationId]
 * @property {string} [roomId]
 * @property {'chief'|'proctor'|'reserve'} role
 * @property {number} [orderIndex] - ลำดับในห้องสอบ (1: หัวหน้าห้อง, 2: กรรมการร่วม 1, 3: กรรมการร่วม 2)
 * @property {number} difficultyScore - คะแนนความยาก ยิ่งสูงยิ่งจัดก่อน
 * @property {import('../data/models.js').ProctorAssignment} [lockedAssignment]
 */

/**
 * @typedef {Object} SolverResult
 * @property {boolean} success - จัดสำเร็จครบทุก slot หรือไม่
 * @property {import('../data/models.js').ProctorAssignment[]} assignments - ผลการจัด
 * @property {number} durationMs - เวลาที่ใช้ (มิลลิวินาที)
 * @property {number} backtracks - จำนวนครั้งที่ backtrack
 * @property {number} qualityScore - คะแนนคุณภาพเฉลี่ย (0 - 100)
 * @property {number} standardDeviation - SD ภาระงาน
 * @property {number} [jainsFairnessIndex] - ค่าดัชนีความเป็นธรรม Jain's Index
 * @property {number} [leadFacultyRatio] - สัดส่วนหัวหน้าห้องที่เป็นอาจารย์
 * @property {Array<any>} [unfilledSlots] - รายการตำแหน่งที่ขาดแคลน
 * @property {string} [errorMessage] - ข้อความอธิบายหากจัดไม่สำเร็จ
 * @property {Object} [diagnostic] - รายละเอียดจุดที่ติดขัด
 */

/**
 * รัน Solver จัดตารางผู้คุมสอบ
 * @param {Object} params
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').Unavailability[]} params.unavailabilities
 * @param {import('../data/models.js').ProctorAssignment[]} [params.lockedAssignments=[]]
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @param {function(number):void} [params.onProgress] - callback แจ้ง % ความคืบหน้า
 * @returns {SolverResult}
 */
export function solveSchedule({
  allocations,
  sessions,
  proctors,
  rooms,
  unavailabilities = [],
  lockedAssignments = [],
  settings,
  onProgress
}) {
  const startTime = Date.now();
  const prng = new PRNG(settings.project.seed || 42);

  // 1. Feasibility Pre-check
  const feas = checkFeasibility({ allocations, sessions, proctors, unavailabilities, settings });
  if (!feas.isFeasible) {
    return {
      success: false,
      assignments: lockedAssignments,
      durationMs: Date.now() - startTime,
      backtracks: 0,
      qualityScore: 0,
      standardDeviation: 0,
      errorMessage: `ไม่ผ่านการตรวจเบื้องต้น: ${feas.bottlenecks[0]}`,
      diagnostic: {
        feasibility: feas,
        suggestions: feas.recommendations
      }
    };
  }

  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const proctorMap = new Map(proctors.map(p => [p.id, p]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // แผนที่ locked assignments
  const lockedSlotMap = new Map();
  for (const la of lockedAssignments) {
    if (la.status === 'locked') {
      const suffix = la.orderIndex === 3 ? '_2' : '';
      const key = la.role === 'reserve' ? `reserve_${la.sessionId}_${la.proctorId}` : `${la.allocationId}_${la.role}${suffix}`;
      lockedSlotMap.set(key, la);
    }
  }

  // 2. สร้างรายการ Slots ทั้งหมดที่ต้องจัด
  /** @type {SolverSlot[]} */
  const slots = [];
  const threshold3 = settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;
  let slotCounter = 1;

  for (const alloc of allocations) {
    const session = sessionMap.get(alloc.sessionId);
    const room = roomMap.get(alloc.roomId);
    if (!session || !room) continue;

    // คำนวณความยากของ allocation นี้ (most-constrained)
    let baseDifficulty = 10;
    if (alloc.specialNeeds === 'computer') baseDifficulty += 20;
    if (alloc.specialNeeds === 'disabled') baseDifficulty += 25;
    if (alloc.examineesInRoom >= threshold3) baseDifficulty += 35;
    else if (alloc.examineesInRoom > threshold2) baseDifficulty += 15;

    // Slot 1: หัวหน้าห้อง (Chief / Lead Proctor - orderIndex 1) - จัดลำดับความสำคัญสูงสุด
    const chiefKey = `${alloc.id}_chief`;
    const lockedChief = lockedSlotMap.get(chiefKey);
    slots.push({
      slotId: `slot_${slotCounter++}`,
      sessionId: alloc.sessionId,
      allocationId: alloc.id,
      roomId: alloc.roomId,
      role: 'chief',
      orderIndex: 1,
      difficultyScore: baseDifficulty + 50, // chief ยากกว่าเพราะมีคนน้อย
      lockedAssignment: lockedChief
    });

    // Slot 2: ผู้คุมร่วมคนที่ 1 (Co-Proctor 1 - orderIndex 2)
    if (alloc.examineesInRoom > threshold2) {
      const proctorKey = `${alloc.id}_proctor`;
      const lockedProctor = lockedSlotMap.get(proctorKey);
      slots.push({
        slotId: `slot_${slotCounter++}`,
        sessionId: alloc.sessionId,
        allocationId: alloc.id,
        roomId: alloc.roomId,
        role: 'proctor',
        orderIndex: 2,
        difficultyScore: baseDifficulty + 20,
        lockedAssignment: lockedProctor
      });
    }

    // Slot 3: ผู้คุมร่วมคนที่ 2 (Co-Proctor 2 - orderIndex 3 สำหรับห้องใหญ่ >= 70 ที่นั่ง เช่น 17201)
    if (alloc.examineesInRoom >= threshold3) {
      const proctorKey2 = `${alloc.id}_proctor_2`;
      const lockedProctor2 = lockedSlotMap.get(proctorKey2);
      slots.push({
        slotId: `slot_${slotCounter++}`,
        sessionId: alloc.sessionId,
        allocationId: alloc.id,
        roomId: alloc.roomId,
        role: 'proctor',
        orderIndex: 3,
        difficultyScore: baseDifficulty + 25,
        lockedAssignment: lockedProctor2
      });
    }
  }

  // ผู้คุมสำรองต่อรอบ (Reserve slots)
  const reserveCount = settings.hardConstraints.h8_reserve_proctors_per_session;
  for (const session of sessions) {
    for (let rIdx = 0; rIdx < reserveCount; rIdx++) {
      slots.push({
        slotId: `slot_reserve_${session.id}_${rIdx + 1}`,
        sessionId: session.id,
        allocationId: `RESERVE_${session.id}`,
        roomId: undefined,
        role: 'reserve',
        difficultyScore: 5, // จัดสำรองทีหลัง main
        lockedAssignment: undefined
      });
    }
  }

  // เรียง slots ตาม Most-Constrained-First (difficultyScore จากมากไปน้อย)
  // แต่ถ้ามี locked slot ให้อยู่หน้าสุด
  slots.sort((a, b) => {
    if (a.lockedAssignment && !b.lockedAssignment) return -1;
    if (!a.lockedAssignment && b.lockedAssignment) return 1;
    return b.difficultyScore - a.difficultyScore;
  });

  // 3. เริ่มกระบวนการค้นหาด้วย Backtracking
  /** @type {import('../data/models.js').ProctorAssignment[]} */
  const assignedList = [];
  const proctorCounts = new Map();
  const proctorWorkedDates = new Map();
  const proctorDateRooms = new Map();

  // ใส่ locked assignments เข้าสู่ state เริ่มต้น
  for (const slot of slots) {
    if (slot.lockedAssignment) {
      const la = slot.lockedAssignment;
      assignedList.push(la);
      proctorCounts.set(la.proctorId, (proctorCounts.get(la.proctorId) || 0) + 1);

      const sess = sessionMap.get(la.sessionId);
      if (sess) {
        if (!proctorWorkedDates.has(la.proctorId)) proctorWorkedDates.set(la.proctorId, new Set());
        proctorWorkedDates.get(la.proctorId).add(sess.date);

        if (la.roomId) {
          if (!proctorDateRooms.has(la.proctorId)) proctorDateRooms.set(la.proctorId, new Map());
          proctorDateRooms.get(la.proctorId).set(sess.date, la.roomId);
        }
      }
    }
  }

  let backtrackCount = 0;
  const timeoutMs = settings.solver.timeoutMs || 30000;
  const maxBacktrack = settings.solver.maxBacktrackDepth || 500;

  /**
   * Recursive backtrack search
   * @param {number} slotIndex 
   * @returns {boolean}
   */
  function backtrack(slotIndex) {
    // ตรวจขีดจำกัดเวลา (timeout)
    if (Date.now() - startTime > timeoutMs) {
      return false;
    }

    if (slotIndex >= slots.length) {
      return true; // สำเร็จครบทุก slot!
    }

    if (onProgress && slotIndex % 5 === 0) {
      onProgress(Math.round((slotIndex / slots.length) * 100));
    }

    const currentSlot = slots[slotIndex];

    // ถ้า slot นี้ถูกล็อกไว้แล้ว ข้ามไป slot ถัดไป
    if (currentSlot.lockedAssignment) {
      return backtrack(slotIndex + 1);
    }

    const session = sessionMap.get(currentSlot.sessionId);
    const allocation = currentSlot.allocationId ? allocations.find(a => a.id === currentSlot.allocationId) : null;

    // 1. หา Candidate ผู้คุมที่ผ่าน Hard Constraints ทุกข้อ
    /** @type {Array<{ proctor: import('../data/models.js').Proctor, score: number, breakdown: any }>} */
    const candidates = [];

    // หาผู้คุมคนอื่นที่อยู่ในห้องเดียวกันแล้ว (เพื่อคิดคะแนน S5 จับคู่อาจารย์+จนท.)
    const roomPartners = assignedList
      .filter(a => a.allocationId === currentSlot.allocationId && a.role !== currentSlot.role)
      .map(a => proctorMap.get(a.proctorId))
      .filter(Boolean);

    for (const p of proctors) {
      if (!p.isActive) continue;

      // ตรวจสอบ hard constraint
      const check = canProctorTakeSlot({
        proctorId: p.id,
        sessionId: currentSlot.sessionId,
        allocationId: currentSlot.allocationId,
        role: currentSlot.role,
        currentAssignments: assignedList,
        sessionMap,
        proctorMap,
        unavailabilities,
        settings
      });

      if (check.allowed) {
        // คำนวณ soft score พื้นฐาน
        const { totalScore, breakdown } = calculateCandidateScore({
          proctor: p,
          session,
          allocation,
          roomPartners,
          proctorAssignmentCounts: proctorCounts,
          proctorWorkedDates,
          proctorDateRooms,
          isDirectlyConsecutive: false,
          totalSessions: sessions.length,
          totalProctors: proctors.length,
          settings
        });

        // === กฎเกณฑ์อัลกอริธึมจัดสรร 5 ลำดับความสำคัญ (ELMS 5-Priority Intelligent Engine) ===
        let priorityBonus = 0;

        // กฎข้อที่ 1: นำคนที่โควต้าน้อยจัดลงก่อน (Lower Quota First)
        // คนที่มีโควตาน้อย มีโอกาสจัดยากกว่า จึงให้บุคลากรโควตาน้อยได้รับสิทธิ์ก่อน
        const pQuota = p.projectQuota !== undefined ? p.projectQuota : 6;
        priorityBonus += Math.max(0, (6 - pQuota) * 5);

        // กฎข้อที่ 2: คนที่ระบุวันลงชัดเจนก่อน (Explicit Date Availability First)
        if (p.availableDates && p.availableDates.length > 0 && p.availableDates.includes(session.date)) {
          priorityBonus += 22; // ให้สิทธิ์คนระบุวันจำเพาะเจาะจงก่อน
        }

        // กฎข้อที่ 3: จัดตามเงื่อนไขรายบุคคลก่อนจึงใช้เงื่อนไขหลัก (Individual Preference Priority)
        const datesWorked = proctorWorkedDates.get(p.id);
        const hasWorkedToday = datesWorked && datesWorked.has(session.date);
        if (p.sessionPattern === 'FULL_DAY_PAIRED' && hasWorkedToday) {
          priorityBonus += 35; // ชอบคุมแบบคู่เช้า-บ่ายวันเดียวกัน
          const lastRoom = proctorDateRooms.get(p.id)?.get(session.date);
          if (p.keepSameRoom && lastRoom === currentSlot.roomId) {
            priorityBonus += 30; // โบนัสให้อยู่ห้องเดิมตลอดทั้งวัน (Room Continuity)
          }
        }

        // กฎข้อที่ 4: กำหนดให้อาจารย์เป็นหลัก 1 คนทุกห้อง (Mandatory Academic Lead Proctor)
        if (currentSlot.role === 'chief') {
          if (p.proctorType === 'faculty') {
            priorityBonus += 70; // อาจารย์มีสิทธิ์หัวหน้าห้องเป็นอันดับแรก
            // เรียงลำดับตามความอาวุโส (Seniority Ranking: ศ. 10 > รศ. 9 > ผศ. 8 > อาจารย์ 7)
            priorityBonus += (p.seniorityRank || 7) * 3;
            // กระจายอาจารย์ข้ามวัน (Academic Lead Balancing): เกลี่ยให้เท่ากันทุกวันสอบ
            const myCount = proctorCounts.get(p.id) || 0;
            priorityBonus -= myCount * 6;
          } else {
            // กฎข้อที่ 5: Fallback ให้สายสนับสนุนอาวุโสทำหน้าที่แทนเฉพาะกรณีจำเป็น
            priorityBonus -= 35;
            priorityBonus += (p.seniorityRank || 3) * 2;
          }
        }

        // กฎข้อที่ 5: สถาปัตยกรรมกลุ่มบุคลากร (Core Pool มาก่อน Reserve Pool)
        if (p.pool === 'reserve') {
          priorityBonus -= 30; // กลุ่มสำรองสงวนไว้เติมเต็มช่องว่างกรณีขาดแคลน
        }

        // กฎเกณฑ์เจ้าหน้าที่ศูนย์คอมพิวเตอร์: ส่วนใหญ่จะไม่เกิน 3 คนต่อรอบตามบรีฟ
        const isComputerCenter = p.department && p.department.includes('คอมพิวเตอร์');
        if (isComputerCenter) {
          const compStaffInSession = assignedList.filter(a => {
            if (a.sessionId !== currentSlot.sessionId) return false;
            const proc = proctorMap.get(a.proctorId);
            return proc && proc.department && proc.department.includes('คอมพิวเตอร์');
          }).length;
          if (compStaffInSession >= 3) {
            priorityBonus -= 25; // กระจายให้คณะอื่นและเกลี่ยไม่ให้เกิน 3 คนต่อรอบ
          }
        }

        // สุ่มเล็กน้อยกรณีคะแนนเสมอกัน (deterministic ด้วย seed)
        const tieBreaker = prng.next() * 0.01;
        candidates.push({ proctor: p, score: totalScore + priorityBonus + tieBreaker, breakdown });
      }
    }

    // ถ้าไม่มีใครผ่านเกณฑ์เลย ต้อง backtrack
    if (candidates.length === 0) {
      backtrackCount++;
      return false;
    }

    // เรียง candidate ตามคะแนน soft สูงสุด (มากไปน้อย)
    candidates.sort((a, b) => b.score - a.score);

    // ลองเลือกทีละคน
    for (const cand of candidates) {
      const p = cand.proctor;

      // สร้าง assignment
      const reason = generateAssignmentReason({
        proctor: p,
        candidatePoolSize: candidates.length,
        score: cand.score,
        breakdown: cand.breakdown,
        role: currentSlot.role,
        isLocked: false
      });

      const newAssignment = {
        id: `assign_${currentSlot.sessionId}_${p.id}_${Date.now()}_${prng.nextInt(100, 999)}`,
        allocationId: currentSlot.allocationId || `RESERVE_${currentSlot.sessionId}`,
        sessionId: currentSlot.sessionId,
        roomId: currentSlot.roomId,
        proctorId: p.id,
        role: currentSlot.role,
        orderIndex: currentSlot.orderIndex || (currentSlot.role === 'chief' ? 1 : 2),
        status: 'draft',
        source: 'auto',
        reason
      };

      // Push state
      assignedList.push(newAssignment);
      proctorCounts.set(p.id, (proctorCounts.get(p.id) || 0) + 1);

      if (!proctorWorkedDates.has(p.id)) proctorWorkedDates.set(p.id, new Set());
      proctorWorkedDates.get(p.id).add(session.date);

      if (currentSlot.roomId) {
        if (!proctorDateRooms.has(p.id)) proctorDateRooms.set(p.id, new Map());
        proctorDateRooms.get(p.id).set(session.date, currentSlot.roomId);
      }

      // ไปยัง slot ถัดไป
      const solved = backtrack(slotIndex + 1);
      if (solved) return true;

      // ถ้าไม่สำเร็จ ย้อน state คืน (undo / pop state)
      assignedList.pop();
      proctorCounts.set(p.id, (proctorCounts.get(p.id) || 1) - 1);
      if (backtrackCount > maxBacktrack) return false;
    }

    backtrackCount++;
    return false;
  }

  // เรียก backtrack เริ่มต้นจาก slot 0
  const isComplete = backtrack(0);
  const durationMs = Date.now() - startTime;

  if (onProgress) onProgress(100);

  // คำนวณ SD และสถิติภาระงาน
  const countsArray = proctors.map(p => proctorCounts.get(p.id) || 0);
  const meanWorkload = countsArray.reduce((a, b) => a + b, 0) / Math.max(1, countsArray.length);
  const variance = countsArray.reduce((sum, c) => sum + Math.pow(c - meanWorkload, 2), 0) / Math.max(1, countsArray.length);
  const standardDeviation = Math.sqrt(variance);

  // คำนวณดัชนีความเป็นธรรม Jain's Fairness Index (J >= 0.85)
  const jainsFairnessIndex = Number(calculateJainsFairnessIndex(countsArray).toFixed(3));

  // คำนวณสัดส่วนหัวหน้าห้องที่เป็นอาจารย์ (Lead Faculty Ratio)
  const chiefAssignments = assignedList.filter(a => a.role === 'chief');
  const facultyChiefCount = chiefAssignments.filter(a => {
    const p = proctorMap.get(a.proctorId);
    return p && p.proctorType === 'faculty';
  }).length;
  const leadFacultyRatio = chiefAssignments.length > 0 ? Number((facultyChiefCount / chiefAssignments.length).toFixed(3)) : 1.0;

  // รายการตำแหน่งที่ขาดแคลน (Unfilled Slots)
  const filledSlotKeys = new Set(assignedList.map(a => `${a.sessionId}_${a.allocationId}_${a.role}`));
  const unfilledSlots = slots.filter(s => {
    const key = `${s.sessionId}_${s.allocationId}_${s.role}`;
    return !filledSlotKeys.has(key);
  }).map(s => {
    const sess = sessionMap.get(s.sessionId);
    const rm = roomMap.get(s.roomId);
    return {
      slotId: s.slotId,
      sessionId: s.sessionId,
      sessionName: sess ? sess.name : s.sessionId,
      sessionDate: sess ? sess.date : '',
      roomId: s.roomId,
      roomName: rm ? (rm.name || rm.id) : (s.role === 'reserve' ? 'ผู้คุมสำรอง' : '-'),
      role: s.role,
      roleName: s.role === 'chief' ? 'หัวหน้าห้องสอบ' : (s.role === 'reserve' ? 'ผู้คุมสำรอง' : 'กรรมการร่วมคุมสอบ'),
      orderIndex: s.orderIndex || (s.role === 'chief' ? 1 : 2)
    };
  });

  // คำนวณคุณภาพคะแนน (0-100)
  // SD ยิ่งต่ำ คุณภาพยิ่งสูง
  const qualityScore = Math.max(20, Math.min(100, Math.round(100 - (standardDeviation * 12))));

  // ตรวจสอบขั้นสุดท้ายด้วย unified validator
  const validation = validateSchedule({
    assignments: assignedList,
    allocations,
    sessions,
    proctors,
    rooms,
    unavailabilities,
    settings
  });

  if (!isComplete || !validation.isValid) {
    // วิเคราะห์จุดที่ขาดตามข้อกำหนด 6.6
    const missingSlots = slots.length - assignedList.length;
    return {
      success: false,
      assignments: assignedList,
      durationMs,
      backtracks: backtrackCount,
      qualityScore,
      standardDeviation,
      jainsFairnessIndex,
      leadFacultyRatio,
      facultyChiefCount,
      totalChiefSlots: chiefAssignments.length,
      unfilledSlots,
      errorMessage: `ไม่สามารถจัดให้ครบทุกห้องได้ (ขาดผู้คุมอีก ${missingSlots} ตำแหน่ง จากการค้นหา ${backtrackCount} ครั้ง)`,
      diagnostic: {
        missingSlots,
        totalSlots: slots.length,
        validationViolations: validation.violations,
        recommendation: `ลองเพิ่มจำนวนผู้คุมในระบบ หรือปรับเพิ่มโควต้าต่อวันในหน้าตั้งค่า`
      }
    };
  }

  return {
    success: true,
    assignments: assignedList,
    durationMs,
    backtracks: backtrackCount,
    qualityScore,
    standardDeviation,
    jainsFairnessIndex,
    leadFacultyRatio,
    facultyChiefCount,
    totalChiefSlots: chiefAssignments.length,
    unfilledSlots: []
  };
}
