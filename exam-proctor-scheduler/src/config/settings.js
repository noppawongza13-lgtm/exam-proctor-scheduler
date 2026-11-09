/**
 * settings.js — ค่ากฎและการตั้งค่าทั้งหมดของระบบ
 * ห้ามฝังตัวเลขในโค้ดโดยตรง ให้อ้างอิงจากไฟล์นี้เท่านั้น
 * 
 * @module config/settings
 */

/** @type {import('./settingsTypes').Settings} */
export const DEFAULT_SETTINGS = {
  // === Hard Constraints ===

  /** H5: จำนวนผู้คุมต่อห้อง ตามจำนวนผู้เข้าสอบ */
  proctorsPerRoom: {
    threshold: 30,  // ผู้เข้าสอบ ≤ threshold → below คน, > threshold → above คน
    below: 1,
    above: 2,
  },

  /** H6: เวลาพักขั้นต่ำระหว่างรอบติดกัน (นาที) */
  minBreakMinutes: 30,

  /** H8: จำนวนผู้คุมสำรองต่อ session */
  reservePerSession: 2,

  // === Soft Constraint Weights (0-100) ===
  weights: {
    /** S1: กระจายจำนวนรอบ/ชั่วโมงให้ใกล้เคียงกัน */
    fairness: 70,
    /** S2: ลดจำนวนวันที่แต่ละคนต้องเข้ามา */
    minimizeDays: 50,
    /** S3: หลีกเลี่ยงงานติดกันหลายรอบ */
    avoidConsecutive: 40,
    /** S4: ผู้คุมคนเดียวอยู่ห้องเดิมตลอดวัน */
    sameRoom: 30,
    /** S5: ผสมอาจารย์กับเจ้าหน้าที่ในห้อง 2 คน */
    mixTypes: 20,
    /** S6: ความเป็นธรรมข้ามวัน */
    crossDayFairness: 60,
    /** S7: ให้ความสำคัญกับช่วงเวลาที่ผู้คุมสะดวก */
    preferAvailability: 50,
  },

  // === Solver ===

  /** เวลาสูงสุดที่ solver ใช้ได้ (มิลลิวินาที) */
  solverTimeoutMs: 60000,

  /** จำนวน backtrack steps สูงสุดก่อนหยุด */
  maxBacktrackSteps: 100000,

  // === Default Quotas ===

  /** โควต้ารอบ/วัน (ค่าเริ่มต้นสำหรับผู้คุมใหม่) */
  defaultQuotaPerDay: 3,

  /** โควต้ารอบ/โครงการ (ค่าเริ่มต้น) */
  defaultQuotaPerProject: 15,

  /** ชั่วโมงสูงสุด (ค่าเริ่มต้น) */
  defaultMaxHours: 24,

  // === Default Prep/Wrap ===

  /** เวลาเตรียมก่อนสอบ (นาที) */
  defaultPrepMinutes: 30,

  /** เวลาหลังสอบ (นาที) */
  defaultWrapMinutes: 15,

  // === Seed Data Defaults ===
  seedDefaults: {
    /** จำนวนผู้คุม */
    proctorCount: 40,
    /** สัดส่วนอาจารย์ (0-1) */
    lecturerRatio: 0.5,
    /** จำนวนวันสอบ */
    examDays: 3,
    /** จำนวนรอบต่อวัน */
    sessionsPerDay: 2,
    /** จำนวนผู้เข้าสอบต่อรอบ */
    examineesPerSession: 250,
    /** สัดส่วนผู้ไม่ว่าง (0-1) */
    unavailabilityRate: 0.15,
    /** จำนวนห้อง */
    roomCount: 10,
    /** seed สำหรับ random */
    randomSeed: 'exam-scheduler-2024',
  },

  // === UI ===

  /** จำนวน undo/redo steps สูงสุด */
  maxUndoSteps: 20,

  /** แสดงข้อมูลติดต่อ (PDPA) */
  showContactInfo: false,
};

/**
 * โหลดค่าตั้งค่าจาก localStorage หรือใช้ค่าเริ่มต้น
 * @returns {Settings}
 */
export function loadSettings() {
  try {
    const saved = localStorage.getItem('examScheduler_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // รวมค่าที่บันทึกไว้กับค่าเริ่มต้น (เผื่อมีค่าใหม่เพิ่มขึ้น)
      return deepMerge(structuredClone(DEFAULT_SETTINGS), parsed);
    }
  } catch (e) {
    console.warn('ไม่สามารถโหลดค่าตั้งค่าได้ ใช้ค่าเริ่มต้น:', e);
  }
  return structuredClone(DEFAULT_SETTINGS);
}

/**
 * บันทึกค่าตั้งค่าลง localStorage
 * @param {Settings} settings
 */
export function saveSettings(settings) {
  localStorage.setItem('examScheduler_settings', JSON.stringify(settings));
}

/**
 * รีเซ็ตค่าตั้งค่าเป็นค่าเริ่มต้น
 * @returns {Settings}
 */
export function resetSettings() {
  localStorage.removeItem('examScheduler_settings');
  return structuredClone(DEFAULT_SETTINGS);
}

/**
 * รวม object สองตัว (deep merge)
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
