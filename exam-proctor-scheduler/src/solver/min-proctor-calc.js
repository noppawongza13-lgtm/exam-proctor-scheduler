/**
 * เครื่องคำนวณจำนวนผู้คุมขั้นต่ำ (Minimum Proctor Calculator)
 * ตามข้อกำหนด 6.2:
 * "ใช้ binary search หาจำนวนคนน้อยที่สุดที่จัดได้ภายใต้กติกาปัจจุบัน
 * แสดงผลเป็นข้อความอ่านง่าย พร้อมแนะนำทางเลือก"
 */

import { solveSchedule } from './greedy-solver.js';
import { checkFeasibility } from '../rules/feasibility.js';

/**
 * @typedef {Object} MinProctorResult
 * @property {number} minProctorsNeeded - จำนวนผู้คุมขั้นต่ำที่สามารถจัดสำเร็จได้จริง
 * @property {number} currentProctorsCount - จำนวนผู้คุมที่มีอยู่ในปัจจุบัน
 * @property {number} theoreticalLowerBound - ขีดจำกัดล่างตามทฤษฎี (ความจุทางคณิตศาสตร์)
 * @property {boolean} canSolveWithCurrent - ปัจจุบันจัดได้หรือไม่
 * @property {string} explanation - คำอธิบายภาษาไทยแบบอ่านง่าย
 * @property {string[]} recommendations - ทางเลือกปรับปรุง (เพิ่มคน/เพิ่มโควต้า/ลดผู้คุม/กระจายรอบ)
 * @property {Array<{ count: number, solved: boolean, reason?: string }>} searchHistory - บันทึกขั้นตอน Binary Search
 */

/**
 * คำนวณจำนวนผู้คุมขั้นต่ำโดยใช้ Binary Search
 * @param {Object} params
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Room[]} params.rooms
 * @param {import('../data/models.js').Unavailability[]} params.unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @returns {MinProctorResult}
 */
export function calculateMinimumProctors({
  allocations,
  sessions,
  proctors,
  rooms,
  unavailabilities = [],
  settings
}) {
  const feas = checkFeasibility({ allocations, sessions, proctors, unavailabilities, settings });

  // ขีดจำกัดล่างทางทฤษฎี (Theoretical Lower Bound)
  // คำนวณจากจำนวน slot สูงสุดในรอบใดรอบหนึ่งที่มีห้องสอบพร้อมกันมากที่สุด
  const threshold3 = settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;
  const reservePerSession = settings.hardConstraints.h8_reserve_proctors_per_session;
  const sessionSlots = new Map();

  for (const alloc of allocations) {
    const examinees = alloc.examineesInRoom || 0;
    const need = examinees >= threshold3 ? 3 : (examinees > threshold2 ? 2 : 1);
    sessionSlots.set(alloc.sessionId, (sessionSlots.get(alloc.sessionId) || 0) + need);
  }

  let maxSingleSessionSlots = 0;
  for (const [sId, count] of sessionSlots.entries()) {
    const totalInSlot = count + reservePerSession;
    if (totalInSlot > maxSingleSessionSlots) {
      maxSingleSessionSlots = totalInSlot;
    }
  }

  // ผู้คุมอย่างน้อยที่สุดต้องไม่ต่ำกว่าจำนวนที่ต้องใช้พร้อมกันใน 1 รอบสอบ (เพราะคนเดียวอยู่ 2 ห้องไม่ได้ - H1)
  const defaultProjectQuota = settings.hardConstraints.h3_project_quota_default || 6;
  const theoreticalLowerBound = Math.max(
    maxSingleSessionSlots,
    Math.ceil(feas.totalSlotsNeeded / defaultProjectQuota)
  );

  // เรียงลำดับผู้คุมตามความยืดหยุ่น:
  // ให้หัวหน้าห้อง (chief) และคนที่มี unavailability น้อย อยู่ลำดับต้นๆ
  const sortedProctors = [...proctors].sort((a, b) => {
    if (a.level === 'chief' && b.level !== 'chief') return -1;
    if (a.level !== 'chief' && b.level === 'chief') return 1;
    return (b.projectQuota || 6) - (a.projectQuota || 6);
  });

  const searchHistory = [];

  // ทดสอบฟังก์ชันย่อยว่า ถ้าใช้ N คนแรก จะจัดสำเร็จหรือไม่
  function testWithN(n) {
    const subset = sortedProctors.slice(0, n);
    // ปรับ settings timeout สั้นลงในการค้นหาเพื่อความรวดเร็ว
    const fastSettings = {
      ...settings,
      solver: { ...settings.solver, timeoutMs: 3000, maxBacktrackDepth: 100 }
    };

    const res = solveSchedule({
      allocations,
      sessions,
      proctors: subset,
      rooms,
      unavailabilities,
      settings: fastSettings
    });

    searchHistory.push({
      count: n,
      solved: res.success,
      reason: res.success ? 'จัดสำเร็จสมบูรณ์' : (res.errorMessage || 'ผู้คุมไม่พอ')
    });

    return res.success;
  }

  // 1. ตรวจสอบจำนวนปัจจุบันก่อน
  const currentCount = proctors.length;
  const canSolveWithCurrent = testWithN(currentCount);

  let low = theoreticalLowerBound;
  let high = currentCount;
  let foundMin = currentCount;

  if (canSolveWithCurrent) {
    // Binary Search หาจุดต่ำสุด
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const ok = testWithN(mid);

      if (ok) {
        foundMin = mid;
        high = mid - 1; // ลองหาจำนวนที่น้อยลงไปอีก
      } else {
        low = mid + 1;  // ต้องเพิ่มจำนวนคน
      }
    }
  } else {
    // ปัจจุบันจัดไม่ได้ ต้องค้นหาขึ้นไปอีกว่าต้องการกี่คน
    let extendHigh = currentCount + 30;
    foundMin = extendHigh;
  }

  // สร้างข้อความอธิบายและคำแนะนำภาษาไทย
  let explanation = '';
  const recommendations = [];

  if (canSolveWithCurrent) {
    const surplus = currentCount - foundMin;
    explanation = `ภายใต้กติกาและรอบสอบปัจจุบัน ระบบต้องการผู้คุมอย่างน้อย **${foundMin} คน** จึงจะจัดตารางได้สำเร็จโดยไม่ละเมิดกฎใดๆ (ปัจจุบันมี ${currentCount} คน มีส่วนเผื่อสำรอง ${surplus} คน)`;

    if (surplus > 0) {
      recommendations.push(`สามารถลดภาระงานให้ผู้คุมบางท่าน หรือให้ผู้คุม ${surplus} คนหมุนเวียนไปปฏิบัติงานภารกิจอื่นได้`);
    } else {
      recommendations.push(`จำนวนผู้คุมปัจจุบัน (${currentCount} คน) อยู่ในระดับพอดีเป๊ะ หากมีใครลาป่วยอาจจัดไม่ลงตัว ควรมีสำรองเพิ่มอย่างน้อย 3-5 คน`);
    }
  } else {
    explanation = `ผู้คุมที่มีอยู่ในระบบปัจจุบัน (${currentCount} คน) **ไม่เพียงพอ** ที่จะจัดให้ลงตัวภายใต้ข้อกำหนด (ต้องการอย่างน้อยประมาณ ${foundMin} คน)`;
    recommendations.push(`ทางเลือกที่ 1: เพิ่มจำนวนผู้คุมอีกอย่างน้อย ${foundMin - currentCount} คน (โดยต้องมีระดับหัวหน้าห้องด้วย)`);
    recommendations.push(`ทางเลือกที่ 2: ปรับเพิ่มโควต้ารอบต่อวันของผู้คุมจาก 2 เป็น 3 รอบในหน้าตั้งค่า`);
    recommendations.push(`ทางเลือกที่ 3: ปรับลดเกณฑ์ผู้คุมต่อห้อง เช่น ห้อง ≤ 35 คนใช้ผู้คุม 1 คน`);
    recommendations.push(`ทางเลือกที่ 4: กระจายรอบสอบไม่ให้จัดห้องพร้อมกันมากเกินไปในรอบเดียว`);
  }

  return {
    minProctorsNeeded: foundMin,
    currentProctorsCount: currentCount,
    theoreticalLowerBound,
    canSolveWithCurrent,
    explanation,
    recommendations,
    searchHistory
  };
}
