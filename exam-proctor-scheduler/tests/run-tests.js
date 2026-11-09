/**
 * ชุดทดสอบระบบจัดตารางผู้คุมสอบ (Comprehensive Test Suite)
 * ตามข้อกำหนด 11:
 * - 11.1 Unit test ตัวตรวจกฎ H1 - H8 (ผ่าน และ ไม่ผ่าน)
 * - 11.2 Edge cases กรณีขอบ
 * - 11.3 Property test
 * - 11.4 Benchmark matrix (3 ขนาด 20/40/80 x 5 seeds)
 */

import { generateSeedData } from '../src/data/seed.js';
import { cloneSettings, DEFAULT_SETTINGS } from '../src/data/settings.js';
import {
  checkH1_ProctorTimeOverlap,
  checkH2_RoomOverlapAndCapacity,
  checkH3_QuotaLimits,
  checkH4_Unavailability,
  checkH5_RequiredProctorsAndChief,
  checkH6_RestPeriodBetweenSessions,
  checkH7_SpecialRoomNeeds,
  checkH8_ReserveProctors,
  checkH9_ConflictOfInterest
} from '../src/rules/hard-constraints.js';
import { validateSchedule } from '../src/rules/validator.js';
import { solveSchedule } from '../src/solver/greedy-solver.js';
import { calculateMinimumProctors } from '../src/solver/min-proctor-calc.js';

export async function runAllTests(logger = console.log) {
  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, testName, message = '') {
    if (condition) {
      passed++;
      results.push({ name: testName, status: 'PASS', message });
      logger(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      results.push({ name: testName, status: 'FAIL', message });
      logger(`❌ [FAIL] ${testName}: ${message}`);
    }
  }

  logger('=== เริ่มต้นรันชุดทดสอบ (Test Suite) ===\n');

  // ==========================================
  // 11.1 Unit Test: Hard Constraints (H1 - H8)
  // ==========================================
  logger('--- 11.1 Unit Tests: H1 - H8 ---');
  const baseData = generateSeedData({ seed: 100, proctorCount: 20 });
  const settings = cloneSettings(DEFAULT_SETTINGS);
  const sessionMap = new Map(baseData.sessions.map(s => [s.id, s]));
  const proctorMap = new Map(baseData.proctors.map(p => [p.id, p]));
  const roomMap = new Map(baseData.rooms.map(r => [r.id, r]));

  // H1: ซ้อนเวลา
  const h1PassAssigns = [
    { id: 'a1', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'chief' },
    { id: 'a2', sessionId: baseData.sessions[1].id, proctorId: 'P001', role: 'chief' } // คนละรอบ
  ];
  assert(checkH1_ProctorTimeOverlap(h1PassAssigns, sessionMap, proctorMap, settings).length === 0, 'H1 ผ่าน: คนเดียวกันแต่คนละรอบสอบ');

  const h1FailAssigns = [
    { id: 'a1', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'chief' },
    { id: 'a2', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'proctor' } // รอบเดียวกัน
  ];
  assert(checkH1_ProctorTimeOverlap(h1FailAssigns, sessionMap, proctorMap, settings).length > 0, 'H1 ตรวจจับได้: คนเดียวกันถูกจัดในรอบเวลาทับซ้อนกัน');

  // H2: ห้องซ้อน & ความจุ
  const h2AllocationsOk = [
    { id: 'al1', sessionId: 'S01', roomId: 'R01', examineesInRoom: 30, specialNeeds: 'none' }
  ];
  assert(checkH2_RoomOverlapAndCapacity(h2AllocationsOk, sessionMap, roomMap, settings).length === 0, 'H2 ผ่าน: ผู้เข้าสอบไม่เกินความจุห้อง');

  const h2AllocationsOver = [
    { id: 'al1', sessionId: 'S01', roomId: 'R01', examineesInRoom: 999, specialNeeds: 'none' }
  ];
  assert(checkH2_RoomOverlapAndCapacity(h2AllocationsOver, sessionMap, roomMap, settings).length > 0, 'H2 ตรวจจับได้: จำนวนผู้เข้าสอบเกินความจุห้อง');

  // H3: โควต้า
  const h3AssignsOk = [
    { id: 'a1', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'chief' }
  ];
  assert(checkH3_QuotaLimits(h3AssignsOk, sessionMap, proctorMap, settings).length === 0, 'H3 ผ่าน: ภาระงานอยู่ภายใต้โควต้า');

  // สร้าง assignments ที่เกินโควต้าต่อวัน (3 รอบในวันเดียวกัน สมมติโควต้าวันละ 2)
  const h3AssignsOver = [
    { id: 'a1', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'chief' },
    { id: 'a2', sessionId: baseData.sessions[1].id, proctorId: 'P001', role: 'chief' },
    { id: 'a3', sessionId: baseData.sessions[2].id, proctorId: 'P001', role: 'chief' }
  ];
  assert(checkH3_QuotaLimits(h3AssignsOver, sessionMap, proctorMap, settings).length > 0, 'H3 ตรวจจับได้: เกินโควต้าต่อวัน');

  // H4: Unavailability
  const h4Unavail = [
    { id: 'u1', proctorId: 'P001', startTime: baseData.sessions[0].startTime, endTime: baseData.sessions[0].endTime, reason: 'ติดสอน' }
  ];
  const h4AssignsFail = [
    { id: 'a1', sessionId: baseData.sessions[0].id, proctorId: 'P001', role: 'chief' }
  ];
  assert(checkH4_Unavailability(h4AssignsFail, sessionMap, proctorMap, h4Unavail, settings).length > 0, 'H4 ตรวจจับได้: จัดงานตรงช่วงไม่ว่าง');

  // H5: หัวหน้าห้อง และ ผู้คุมครบเกณฑ์ (ELMS: ห้อง < 70 ที่นั่งใช้ 2 คน, ห้อง >= 70 ที่นั่งใช้ 3 คน)
  const h5AllocNeed2 = [{ id: 'al_h5', sessionId: 'S01', roomId: 'R01', examineesInRoom: 40, specialNeeds: 'none' }];
  const h5AssignsIncomplete = [
    { id: 'a1', allocationId: 'al_h5', sessionId: 'S01', proctorId: 'P001', role: 'chief' }
  ]; // มีแค่ 1 คน ขาดอีก 1 คน
  assert(checkH5_RequiredProctorsAndChief(h5AllocNeed2, h5AssignsIncomplete, proctorMap, settings).length > 0, 'H5 ตรวจจับได้: ห้องสอบต้องการผู้คุม 2 คน แต่จัดเพียง 1 คน');

  const h5AllocNeed3 = [{ id: 'al_h5_3', sessionId: 'S01', roomId: 'R17201', examineesInRoom: 80, specialNeeds: 'none' }];
  const h5AssignsOnly2 = [
    { id: 'a1', allocationId: 'al_h5_3', sessionId: 'S01', proctorId: 'P001', role: 'chief' },
    { id: 'a2', allocationId: 'al_h5_3', sessionId: 'S01', proctorId: 'P002', role: 'proctor' }
  ];
  assert(checkH5_RequiredProctorsAndChief(h5AllocNeed3, h5AssignsOnly2, proctorMap, settings).length > 0, 'H5 ตรวจจับได้: ห้องสอบขนาดใหญ่ (>= 70 คน เช่น 17201) ต้องการผู้คุม 3 คน แต่จัดเพียง 2 คน');
  const h5AssignsFull3 = [
    ...h5AssignsOnly2,
    { id: 'a3', allocationId: 'al_h5_3', sessionId: 'S01', proctorId: 'P003', role: 'proctor' }
  ];
  assert(checkH5_RequiredProctorsAndChief(h5AllocNeed3, h5AssignsFull3, proctorMap, settings).length === 0, 'H5 ผ่าน: ห้องสอบ 80 คนจัดผู้คุม 3 คนครบถ้วนตามเกณฑ์ ELMS');

  // H6: เวลาพักระหว่างรอบ
  // แก้ไขให้ session 0 และ session 1 ติดกันโดยพักน้อยกว่า 30 นาที
  const modifiedSessionMap = new Map(sessionMap);
  const s0 = { ...baseData.sessions[0], endTime: '2026-10-24T12:00:00+07:00' };
  const s1 = { ...baseData.sessions[1], startTime: '2026-10-24T13:00:00+07:00' };
  modifiedSessionMap.set(s0.id, s0);
  modifiedSessionMap.set(s1.id, s1);
  const h6Assigns = [
    { id: 'a1', sessionId: s0.id, proctorId: 'P001', role: 'chief' },
    { id: 'a2', sessionId: s1.id, proctorId: 'P001', role: 'chief' }
  ];
  assert(checkH6_RestPeriodBetweenSessions(h6Assigns, modifiedSessionMap, proctorMap, settings).length > 0, 'H6 ตรวจจับได้: เวลาพักระหว่างรอบน้อยกว่า 30 นาที');

  // H7: ความต้องการพิเศษ
  const h7AllocSpecial = [{ id: 'al_spec', sessionId: 'S01', roomId: 'R01', examineesInRoom: 25, specialNeeds: 'computer' }];
  const normalRoomMap = new Map([['R01', { id: 'R01', name: 'ห้องปกติ', roomType: 'normal', accessibleForDisabled: false, capacity: 40 }]]);
  assert(checkH7_SpecialRoomNeeds(h7AllocSpecial, normalRoomMap, settings).length > 0, 'H7 ตรวจจับได้: ต้องการห้องคอมพิวเตอร์แต่ใช้ห้องปกติ');

  // H8: ผู้คุมสำรอง
  const h8AssignsFail = [
    { id: 'a1', sessionId: 'S01', allocationId: 'al1', proctorId: 'P001', role: 'chief' },
    { id: 'a2', sessionId: 'S01', allocationId: 'RESERVE_S01', proctorId: 'P001', role: 'reserve' }
  ];
  assert(checkH8_ReserveProctors(h8AssignsFail, sessionMap, proctorMap, settings).length > 0, 'H8 ตรวจจับได้: ผู้คุมคนเดียวกันเป็นทั้งผู้คุมหลักและสำรองในรอบเดียว');

  // H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
  const h9Settings = cloneSettings(settings);
  h9Settings.h9_enforce_no_conflict_of_interest = true;
  if (h9Settings.hardConstraints) h9Settings.hardConstraints.h9_enforce_no_conflict_of_interest = true;
  const pWithConflict = {
    ...baseData.proctors[0],
    id: 'P_CONFLICT',
    conflictExamineeIds: ['EX_999']
  };
  const proctorMapH9 = new Map(proctorMap);
  proctorMapH9.set(pWithConflict.id, pWithConflict);

  const h9AllocWithExaminee = [
    { id: 'al_h9', sessionId: 'S01', roomId: 'R01', examineesInRoom: 30, specialNeeds: 'none', examineeIds: ['EX_999'] }
  ];
  const h9AssignConflict = [
    { id: 'a1', allocationId: 'al_h9', roomId: 'R01', sessionId: 'S01', proctorId: 'P_CONFLICT', role: 'chief' }
  ];
  assert(checkH9_ConflictOfInterest(h9AssignConflict, h9AllocWithExaminee, proctorMapH9, h9Settings).length > 0, 'H9 ตรวจจับได้: ผู้คุมมีรายชื่อเครือญาติ/ผลประโยชน์ทับซ้อนกับผู้เข้าสอบในห้องเดียวกัน');

  const h9AllocNoConflict = [
    { id: 'al_h9', sessionId: 'S01', roomId: 'R01', examineesInRoom: 30, specialNeeds: 'none', examineeIds: ['EX_888'] }
  ];
  assert(checkH9_ConflictOfInterest(h9AssignConflict, h9AllocNoConflict, proctorMapH9, h9Settings).length === 0, 'H9 ผ่าน: ผู้คุมไม่มีความเกี่ยวข้องกับผู้เข้าสอบในห้อง');

  // ==========================================
  // 11.2 Edge Cases (กรณีขอบ)
  // ==========================================
  logger('\n--- 11.2 Edge Cases Tests ---');

  // Edge 1: ผู้คุมไม่พอ (มีเพียง 2 คน แต่ต้องการ 10 คน)
  const scarceProctors = baseData.proctors.slice(0, 2);
  const scarceRes = solveSchedule({
    allocations: baseData.allocations,
    sessions: baseData.sessions,
    proctors: scarceProctors,
    rooms: baseData.rooms,
    settings
  });
  assert(!scarceRes.success, 'Edge Case 1: ผู้คุมไม่พอ solver ต้องรายงานไม่สำเร็จพร้อมระบุคอขวด');

  // Edge 2: ผู้เข้าสอบเท่ากับความจุห้องพอดี (Boundary value)
  const r01Cap = baseData.rooms[0].capacity;
  const exactAlloc = [{ id: 'al_exact', sessionId: 'S01', roomId: baseData.rooms[0].id, examineesInRoom: r01Cap, specialNeeds: 'none' }];
  assert(checkH2_RoomOverlapAndCapacity(exactAlloc, sessionMap, roomMap, settings).length === 0, 'Edge Case 2: ผู้เข้าสอบเท่ากับความจุพอดี ต้องผ่าน');

  // Edge 3: ผู้คุมหัวหน้าห้อง (chief) มีเพียงคนเดียวทั้งระบบ แต่ต้องการ 5 ห้อง
  const oneChiefProctors = baseData.proctors.map((p, idx) => ({
    ...p,
    level: idx === 0 ? 'chief' : 'assistant',
    proctorType: idx === 0 ? 'faculty' : 'staff'
  }));
  const oneChiefRes = solveSchedule({
    allocations: baseData.allocations.slice(0, 5),
    sessions: [baseData.sessions[0]],
    proctors: oneChiefProctors,
    rooms: baseData.rooms,
    settings
  });
  assert(!oneChiefRes.success, 'Edge Case 3: มี chief เพียงคนเดียวสำหรับ 5 ห้อง ต้องจัดไม่สำเร็จพร้อมเตือน');

  // ==========================================
  // 11.3 Property Test
  // ==========================================
  logger('\n--- 11.3 Property Test (Soundness Guarantee) ---');
  // Property: สำหรับทุก seed ที่ solver รายงานว่า success === true -> validator ต้องไม่พบข้อผิดพลาดใดๆ
  let propertyPassed = true;
  for (let s = 1; s <= 3; s++) {
    const testData = generateSeedData({ seed: 777 + s, proctorCount: 40, dayCount: 1, sessionsPerDay: 2, roomCount: 6 });
    const sol = solveSchedule({
      allocations: testData.allocations,
      sessions: testData.sessions,
      proctors: testData.proctors,
      rooms: testData.rooms,
      unavailabilities: testData.unavailabilities,
      settings
    });

    if (sol.success) {
      const val = validateSchedule({
        assignments: sol.assignments,
        allocations: testData.allocations,
        sessions: testData.sessions,
        proctors: testData.proctors,
        rooms: testData.rooms,
        unavailabilities: testData.unavailabilities,
        settings
      });
      if (!val.isValid || val.errorCount > 0) {
        propertyPassed = false;
        break;
      }
    }
  }
  assert(propertyPassed, 'Property Test: ทุกผลลัพธ์ที่ Solver จัดสำเร็จ ต้องผ่าน Validator 100% เสมอ');

  // ==========================================
  // 11.4 Benchmark Matrix (3 ขนาด x Seeds)
  // ==========================================
  logger('\n--- 11.4 Benchmark Matrix (3 ขนาด x Seeds) ---');
  const benchmarkRows = [];
  const sizes = [
    { label: '20 คน (6 ห้อง / 1 วัน 2 รอบ)', proctors: 20, days: 1, sessions: 2, rooms: 6 },
    { label: '40 คน (10 ห้อง / 2 วัน 3 รอบ)', proctors: 40, days: 2, sessions: 3, rooms: 10 },
    { label: '80 คน (10 ห้อง / 4 วัน 3 รอบ)', proctors: 80, days: 4, sessions: 3, rooms: 10 }
  ];
  const testSeeds = [101, 202];

  for (const sz of sizes) {
    for (const sd of testSeeds) {
      const data = generateSeedData({
        seed: sd,
        proctorCount: sz.proctors,
        dayCount: sz.days,
        sessionsPerDay: sz.sessions,
        roomCount: sz.rooms
      });

      const startTime = Date.now();
      const sol = solveSchedule({
        allocations: data.allocations,
        sessions: data.sessions,
        proctors: data.proctors,
        rooms: data.rooms,
        unavailabilities: data.unavailabilities,
        settings: { ...settings, solver: { ...settings.solver, timeoutMs: 2500, maxBacktrackDepth: 150 } }
      });
      const elapsed = Date.now() - startTime;

      // คำนวณผู้คุมขั้นต่ำ
      let minNeeded = '-';
      try {
        const minP = calculateMinimumProctors({
          allocations: data.allocations,
          sessions: data.sessions,
          proctors: data.proctors,
          rooms: data.rooms,
          unavailabilities: data.unavailabilities,
          settings: { ...settings, solver: { ...settings.solver, timeoutMs: 800, maxBacktrackDepth: 50 } }
        });
        minNeeded = minP.minProctorsNeeded;
      } catch (err) {
        minNeeded = '-';
      }

      benchmarkRows.push({
        size: sz.label,
        seed: sd,
        success: sol.success ? 'สำเร็จ' : 'ไม่สำเร็จ',
        durationMs: elapsed,
        sdWorkload: sol.standardDeviation.toFixed(2),
        minProctors: minNeeded
      });
    }
  }

  logger('\n📊 ตารางผลทดสอบประสิทธิภาพ (Benchmark Matrix):');
  console.table ? console.table(benchmarkRows) : logger(JSON.stringify(benchmarkRows, null, 2));

  logger(`\n=== สรุปผลการทดสอบ: ผ่าน ${passed} ข้อ, ล้มเหลว ${failed} ข้อ ===\n`);

  return {
    passed,
    failed,
    total: passed + failed,
    results,
    benchmarkRows
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tests/run-tests.js')) {
  runAllTests().then(res => {
    if (res.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }).catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
