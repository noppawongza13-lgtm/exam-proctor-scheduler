/**
 * ตัวตรวจความเป็นไปได้เบื้องต้น (Feasibility Pre-check)
 * ตามข้อกำหนด 6.1:
 * "คำนวณความต้องการรวม (slot-ที่ต้องใช้) เทียบกับความจุรวมของผู้คุม
 * ถ้าเป็นไปไม่ได้ให้หยุดและรายงานทันที"
 */

/**
 * @typedef {Object} FeasibilityReport
 * @property {boolean} isFeasible - เป็นไปได้ในเบื้องต้นหรือไม่
 * @property {number} totalSlotsNeeded - จำนวน slot ผู้คุมที่ต้องใช้ทั้งหมด
 * @property {number} totalChiefSlotsNeeded - จำนวน slot หัวหน้าห้อง (chief) ที่ต้องใช้
 * @property {number} totalReserveSlotsNeeded - จำนวน slot ผู้คุมสำรองที่ต้องใช้
 * @property {number} totalProctorCapacity - ความจุรวมสูงสุดของผู้คุมทั้งหมด (ตามโควต้า)
 * @property {number} totalChiefCapacity - ความจุรวมของผู้คุมระดับหัวหน้าห้อง
 * @property {string[]} bottlenecks - รายการคอขวดที่ตรวจพบ (ถ้ามี)
 * @property {string} summary - สรุปผลการตรวจภาษาไทย
 * @property {string[]} recommendations - คำแนะนำทางเลือก (เพิ่มคน / เพิ่มโควต้า / กระจายรอบ)
 */

/**
 * ตรวจความเป็นไปได้เบื้องต้นก่อนเริ่มรัน Solver
 * @param {Object} params
 * @param {import('../data/models.js').RoomAllocation[]} params.allocations
 * @param {import('../data/models.js').ExamSession[]} params.sessions
 * @param {import('../data/models.js').Proctor[]} params.proctors
 * @param {import('../data/models.js').Unavailability[]} params.unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @returns {FeasibilityReport}
 */
export function checkFeasibility({
  allocations,
  sessions,
  proctors,
  unavailabilities = [],
  settings
}) {
  const activeProctors = proctors.filter(p => p.isActive);
  const chiefProctors = activeProctors.filter(p => p.level === 'chief');

  // 1. คำนวณความต้องการผู้คุมรวม (Slots Needed) ตามเกณฑ์ศูนย์สอบ ELMS อาคาร 17
  const threshold3 = settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;
  let totalMainSlots = 0;
  let totalChiefSlots = 0;

  for (const alloc of allocations) {
    const examinees = alloc.examineesInRoom || 0;
    const need = examinees >= threshold3 ? 3 : (examinees > threshold2 ? 2 : 1);
    totalMainSlots += need;
    totalChiefSlots += 1; // ทุกห้องต้องการหัวหน้าห้อง 1 คน
  }

  const reservePerSession = settings.hardConstraints.h8_reserve_proctors_per_session;
  const totalReserveSlots = sessions.length * reservePerSession;
  const totalSlotsNeeded = totalMainSlots + totalReserveSlots;

  // 2. คำนวณความจุรวมของผู้คุมทั้งหมด (Capacity)
  let totalProctorCapacity = 0;
  let totalChiefCapacity = 0;

  for (const p of activeProctors) {
    const quota = p.projectQuota || settings.hardConstraints.h3_project_quota_default;
    totalProctorCapacity += quota;
    if (p.level === 'chief') {
      totalChiefCapacity += quota;
    }
  }

  // 3. วิเคราะห์คอขวดและข้อจำกัดรายวัน (Daily Bottlenecks)
  const bottlenecks = [];
  const recommendations = [];

  // เช็คคอขวด 1: ความจุรวมทั้งโครงการ
  if (totalProctorCapacity < totalSlotsNeeded) {
    const deficit = totalSlotsNeeded - totalProctorCapacity;
    bottlenecks.push(`ความจุรวมของผู้คุมทั้งหมด (${totalProctorCapacity} slot) น้อยกว่าจำนวนที่ต้องใช้จริง (${totalSlotsNeeded} slot) ขาดอยู่ ${deficit} slot`);
  }

  // เช็คคอขวด 2: ความจุหัวหน้าห้อง (Chief)
  if (totalChiefCapacity < totalChiefSlots) {
    const chiefDeficit = totalChiefSlots - totalChiefCapacity;
    bottlenecks.push(`จำนวนผู้คุมระดับ "หัวหน้าห้อง (chief)" ไม่เพียงพอ: ต้องการ ${totalChiefSlots} slot แต่มีความจุเพียง ${totalChiefCapacity} slot (ขาด ${chiefDeficit} slot)`);
    recommendations.push(`ปรับเพิ่มระดับผู้คุมที่มีประสบการณ์จาก "ผู้ช่วย (assistant)" ให้เป็น "หัวหน้าห้อง (chief)" อย่างน้อย ${Math.ceil(chiefDeficit / 4)} คน`);
  }

  // เช็คคอขวด 3: รายวัน (Daily Check)
  const sessionByDate = new Map();
  for (const s of sessions) {
    if (!sessionByDate.has(s.date)) sessionByDate.set(s.date, []);
    sessionByDate.get(s.date).push(s);
  }

  for (const [dateStr, daySessions] of sessionByDate.entries()) {
    // หา allocations ในวันนี้
    const daySessionIds = new Set(daySessions.map(s => s.id));
    let daySlotsNeeded = 0;
    for (const alloc of allocations) {
      if (daySessionIds.has(alloc.sessionId)) {
        const ex = alloc.examineesInRoom || 0;
        daySlotsNeeded += (ex >= threshold3 ? 3 : (ex > threshold2 ? 2 : 1));
      }
    }
    daySlotsNeeded += daySessions.length * reservePerSession;

    // คำนวณความจุในวันนี้ (คำนึงถึง daily quota)
    let dayCapacity = 0;
    for (const p of activeProctors) {
      dayCapacity += (p.dailyQuota || settings.hardConstraints.h3_daily_quota_default);
    }

    if (dayCapacity < daySlotsNeeded) {
      bottlenecks.push(`ในวันที่ ${dateStr} ต้องการผู้คุม ${daySlotsNeeded} slot แต่ความจุรายวันรวมมีเพียง ${dayCapacity} slot (ขาด ${daySlotsNeeded - dayCapacity} slot)`);
    }
  }

  // สร้างคำแนะนำแก้ไขปัญหา
  const isFeasible = bottlenecks.length === 0;

  if (!isFeasible) {
    recommendations.push(`เพิ่มจำนวนผู้คุมสอบในระบบอีกอย่างน้อย ${Math.ceil((totalSlotsNeeded - totalProctorCapacity) / 4) + 2} คน`);
    recommendations.push(`ปรับเพิ่มโควต้าต่อโครงการ (Project Quota) ของผู้คุมปัจจุบันในหน้าตั้งค่า`);
    recommendations.push(`ลดจำนวนผู้คุมสำรองต่อรอบจาก ${reservePerSession} คน เหลือ 1 คน`);
    recommendations.push(`ปรับเกณฑ์จำนวนผู้เข้าสอบต่อห้องเพื่อใช้ผู้คุม 1 คน (ปัจจุบัน > ${threshold2} คน ใช้ 2 คน)`);
  }

  let summary = '';
  if (isFeasible) {
    const surplus = totalProctorCapacity - totalSlotsNeeded;
    summary = `✅ ผ่านการตรวจเบื้องต้น: ตารางมีความเป็นไปได้ (ต้องการ ${totalSlotsNeeded} slot, ความจุรวม ${totalProctorCapacity} slot, สำรองคงเหลือ ${surplus} slot)`;
  } else {
    summary = `❌ ไม่สามารถจัดตารางได้: ตรวจพบคอขวดทรัพยากร ${bottlenecks.length} จุด กรุณาปรับแก้ตามคำแนะนำก่อนจัดตาราง`;
  }

  return {
    isFeasible,
    totalSlotsNeeded,
    totalChiefSlotsNeeded: totalChiefSlots,
    totalReserveSlotsNeeded: totalReserveSlots,
    totalProctorCapacity,
    totalChiefCapacity,
    bottlenecks,
    summary,
    recommendations
  };
}
