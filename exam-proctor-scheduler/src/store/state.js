/**
 * ระบบจัดการสถานะและข้อมูลของแอปพลิเคชัน (Application State Management)
 * รองรับ:
 * - Reactive state พร้อม Persistence (localStorage)
 * - Undo / Redo ขั้นต่ำ 30 ขั้น (ข้อกำหนด 7.5)
 * - Version Snapshots & Diffing (ข้อกำหนด 7.8, 7.9)
 * - Audit Log อัตโนมัติ (ข้อกำหนด 3.9, 7.12)
 * - การจัดตารางแบบ What-if Simulator (ข้อกำหนด 7.7)
 * - ระบบจัดการผู้คุมลากะทันหันและเสนอตัวแทน (ข้อกำหนด 7.6)
 */

import { PRNG } from '../utils/prng.js';
import { generateSeedData, SEED_PRESETS } from '../data/seed.js';
import { DEFAULT_SETTINGS, cloneSettings } from '../data/settings.js';
import { validateSchedule, canProctorTakeSlot } from '../rules/validator.js';
import { solveSchedule } from '../solver/greedy-solver.js';
import { calculateCandidateScore } from '../solver/scorer.js';
import { generateAssignmentReason } from '../solver/explain.js';
import { calculateMinimumProctors } from '../solver/min-proctor-calc.js';

const STORAGE_KEY = 'EXAM_PROCTOR_SCHEDULER_V1';

export class AppState {
  constructor() {
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoDepth = 30;

    // โหลดข้อมูลเริ่มต้นหรือจาก LocalStorage
    this.loadInitialData();
  }

  loadInitialData() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.rooms = parsed.rooms || [];
        this.proctors = parsed.proctors || [];
        this.sessions = parsed.sessions || [];
        this.allocations = parsed.allocations || [];
        this.unavailabilities = parsed.unavailabilities || [];
        this.assignments = parsed.assignments || [];
        this.settings = parsed.settings || cloneSettings(DEFAULT_SETTINGS);
        if (!this.settings?.project?.universityName || this.settings.project.universityName === 'มหาวิทยาลัย' || this.settings.project.universityName === 'มหาวิทยาลัยธรรมสถิต') {
          this.settings.project.universityName = 'มหาวิทยาลัยราชภัฏบุรีรัมย์';
          this.settings.project.universityNameEn = 'Buriram Rajabhat University';
          this.settings.project.campusLocation = 'ศูนย์สอบคอมพิวเตอร์ อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์';
        }
        this.versions = parsed.versions || [];
        this.auditLogs = parsed.auditLogs || [];
        this.currentStatus = parsed.currentStatus || 'draft'; // draft | review | published
        this.currentUser = parsed.currentUser || {
          id: 'admin',
          role: 'admin',
          name: 'ผู้ดูแลระบบ (Admin)',
          proctorId: null
        };
        // ตรวจสอบและอัปเกรดเป็นชุดข้อมูลบุคลากรจริง 42 ท่านและ 6 รอบสอบ (27-29 มี.ค. 2569) 10 ห้อง CBT 520 ที่นั่ง
        const hasRealPersonnel = this.proctors && this.proctors.some(p => p.firstName === 'เลอสันต์');
        const hasSixSessions = this.sessions && this.sessions.length === 6 && this.sessions[0].date === '2026-03-27';
        if (!hasRealPersonnel || !hasSixSessions || !this.rooms || this.rooms.length < 10 || !this.rooms[0].officialName) {
          const freshSeed = generateSeedData({ seed: 42, proctorCount: 52 });
          this.rooms = freshSeed.rooms;
          this.proctors = freshSeed.proctors;
          this.sessions = freshSeed.sessions;
          this.allocations = freshSeed.allocations;
          this.unavailabilities = freshSeed.unavailabilities;
          this.assignments = [];
          this.persist();
        }

        if (this.sessions) {
          for (const s of this.sessions) {
            s.prepMinutes = 0;
            s.wrapMinutes = 0;
          }
        }
        if (this.settings?.hardConstraints) {
          this.settings.hardConstraints.h6_min_rest_minutes_between_sessions = 0;
        }
        return;
      } catch (e) {
        console.warn('Failed to parse saved state, creating fresh seed data');
      }
    }

    // สร้างข้อมูลเริ่มต้น (42 บุคลากรจริง มรภ.บุรีรัมย์ / 10 ห้องสอบ CBT 520 ที่นั่ง อาคาร 17 / 6 รอบสอบ)
    const seed = generateSeedData({ seed: 42, proctorCount: 52 });
    this.rooms = seed.rooms;
    this.proctors = seed.proctors;
    this.sessions = seed.sessions;
    this.allocations = seed.allocations;
    this.unavailabilities = seed.unavailabilities;
    this.assignments = [];
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.versions = [];
    this.auditLogs = [];
    this.currentStatus = 'draft';
    this.currentUser = {
      id: 'admin',
      role: 'admin',
      name: 'ผู้ดูแลระบบ (Admin)',
      proctorId: null
    };

    this.logAudit('SYSTEM', 'INITIALIZE', 'APP', 'init', null, 'สร้างข้อมูลเริ่มต้นสำเร็จ (บุคลากรจริง มรภ.บุรีรัมย์ 42 ท่าน / 10 ห้อง CBT 520 ที่นั่ง / 6 รอบ)');
    this.persist();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.persist();
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  persist() {
    try {
      const stateToSave = {
        rooms: this.rooms,
        proctors: this.proctors,
        sessions: this.sessions,
        allocations: this.allocations,
        unavailabilities: this.unavailabilities,
        assignments: this.assignments,
        settings: this.settings,
        versions: this.versions,
        auditLogs: this.auditLogs.slice(-200), // เก็บ 200 รายการล่าสุด
        currentStatus: this.currentStatus,
        currentUser: this.currentUser
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // --- การจัดการสิทธิ์และผู้ใช้งาน (User & Role Authentication) ---
  setCurrentUser(user) {
    this.currentUser = user;
    this.logAudit(user.id, 'AUTH_SWITCH', 'USER', user.id, null, user.name, `เข้าสู่ระบบเป็น: ${user.name} (${user.role})`);
    this.persist();
    this.notify();
  }

  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  isTeacher() {
    return this.currentUser?.role === 'teacher';
  }

  isProctor() {
    return this.currentUser?.role === 'proctor' || this.currentUser?.role === 'teacher';
  }

  canEditEverything() {
    return this.isAdmin();
  }

  canEditProctor(proctorId) {
    return this.isAdmin() || (this.currentUser?.proctorId === proctorId);
  }

  getLoggedInProctor() {
    if (!this.currentUser?.proctorId) return null;
    return this.proctors.find(p => p.id === this.currentUser.proctorId) || null;
  }

  getAvailableAccounts() {
    // รายชื่อบัญชีตัวอย่างที่สามารถสลับเพื่อทดสอบการใช้งานได้ทันที
    const facultyProctors = this.proctors.filter(p => p.proctorType === 'faculty' && p.isActive).slice(0, 4);
    const staffProctors = this.proctors.filter(p => p.proctorType === 'staff' && p.isActive).slice(0, 4);

    return {
      admin: {
        id: 'admin',
        role: 'admin',
        name: 'ผู้ดูแลระบบ (Admin)',
        proctorId: null,
        description: 'สิทธิ์สูงสุด: แก้ไขตาราง เวลา ห้อง ผู้คุม กฎเกณฑ์ และจัดตารางอัตโนมัติ'
      },
      teachers: facultyProctors.map(p => ({
        id: p.id,
        role: 'teacher',
        name: `อ.${p.firstName} ${p.lastName}`,
        proctorId: p.id,
        department: p.department,
        description: `อาจารย์ (${p.department}) - ดูตารางสอน/สอบ แจ้งช่วงไม่ว่าง และแก้ไขข้อมูลส่วนตัว`
      })),
      staff: staffProctors.map(p => ({
        id: p.id,
        role: 'proctor',
        name: `${p.firstName} ${p.lastName}`,
        proctorId: p.id,
        department: p.department,
        description: `เจ้าหน้าที่คุมสอบ (${p.department}) - ดูตารางคุมสอบ แจ้งช่วงไม่ว่าง และแก้ไขข้อมูลส่วนตัว`
      }))
    };
  }

  // --- Snapshot สำหรับ Undo/Redo ---
  pushUndo(actionDescription = 'แก้ไขตาราง') {
    this.undoStack.push({
      assignments: JSON.parse(JSON.stringify(this.assignments)),
      description: actionDescription
    });
    if (this.undoStack.length > this.maxUndoDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // เคลียร์ redo เมื่อมีการเปลี่ยนแปลงใหม่
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    const previous = this.undoStack.pop();
    this.redoStack.push({
      assignments: JSON.parse(JSON.stringify(this.assignments)),
      description: previous.description
    });
    this.assignments = previous.assignments;
    this.logAudit('ADMIN', 'UNDO', 'ASSIGNMENT', 'batch', null, `ย้อนกลับ: ${previous.description}`);
    this.notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const next = this.redoStack.pop();
    this.undoStack.push({
      assignments: JSON.parse(JSON.stringify(this.assignments)),
      description: next.description
    });
    this.assignments = next.assignments;
    this.logAudit('ADMIN', 'REDO', 'ASSIGNMENT', 'batch', null, `ทำซ้ำ: ${next.description}`);
    this.notify();
    return true;
  }

  // --- บันทึก Audit Log (ข้อกำหนด 3.9 & 7.12) ---
  logAudit(actor, action, entityType, entityId, beforeValue, afterValue, reason = '') {
    const logItem = {
      id: `LOG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      entityType,
      entityId,
      beforeValue,
      afterValue,
      reason
    };
    this.auditLogs.unshift(logItem);
  }

  // --- การจัดตารางอัตโนมัติ (Solver) พร้อมระบบแก้ปัญหาขาดแคลนผู้คุมอัตโนมัติ 1-Click ---
  runAutoSchedule(onProgress) {
    this.pushUndo('จัดตารางอัตโนมัติ');

    let autoGeneratedNotice = false;

    // หากมีผู้คุมน้อยกว่า 42 คน หรือไม่พอกับรอบสอบทั้งหมด สุ่มสร้างผู้คุม 52 คนให้ทันที
    const activeProctors = this.proctors.filter(p => p.isActive);
    if (activeProctors.length < 42) {
      this.autoGenerateSufficientProctors(52, false);
      autoGeneratedNotice = true;
    }

    // เก็บเฉพาะ locked assignments
    const locked = this.assignments.filter(a => a.status === 'locked');

    let result = solveSchedule({
      allocations: this.allocations,
      sessions: this.sessions,
      proctors: this.proctors,
      rooms: this.rooms,
      unavailabilities: this.unavailabilities,
      lockedAssignments: locked,
      settings: this.settings,
      onProgress
    });

    // หากยังขาดตำแหน่งเนื่องจากติดเงื่อนไขโควต้า ให้สุ่มเพิ่มผู้คุมเป็น 85 คนและรันใหม่อัตโนมัติทันที
    if (!result.success && result.missingSlots > 0) {
      this.autoGenerateSufficientProctors(85, false);
      autoGeneratedNotice = true;

      result = solveSchedule({
        allocations: this.allocations,
        sessions: this.sessions,
        proctors: this.proctors,
        rooms: this.rooms,
        unavailabilities: this.unavailabilities,
        lockedAssignments: locked,
        settings: this.settings,
        onProgress
      });
    }

    result.autoGeneratedNotice = autoGeneratedNotice;

    if (result.success) {
      this.assignments = result.assignments;
      this.currentStatus = 'draft';
      this.logAudit('SYSTEM', 'AUTO_SCHEDULE', 'SCHEDULE', 'all', null, `จัดตารางสำเร็จ (${result.assignments.length} ตำแหน่ง ในเวลา ${result.durationMs}ms, คุณภาพ ${result.qualityScore}/100)`);
      this.notify();
    }

    return result;
  }

  // --- สุ่มสร้างผู้คุมสอบให้เพียงพอกับสนามสอบ CBT อัตโนมัติ (80 คน) ---
  autoGenerateSufficientProctors(count = 80, pushToUndo = true) {
    if (pushToUndo) {
      this.pushUndo(`สุ่มสร้างผู้คุมสอบ ${count} คน`);
    }

    const uniqueDates = new Set(this.sessions.map(s => s.date));
    const dayCount = uniqueDates.size || 2;
    const sessionsPerDay = Math.ceil(this.sessions.length / Math.max(dayCount, 1)) || 3;

    const fresh = generateSeedData({
      seed: Date.now(),
      proctorCount: count,
      dayCount,
      sessionsPerDay,
      roomCount: this.rooms.length || 10
    });

    this.proctors = fresh.proctors;
    this.unavailabilities = fresh.unavailabilities;

    // ล้างเฉพาะการจัดตำแหน่งที่ไม่ตรงกับ ID ผู้คุมชุดใหม่
    const newProctorIds = new Set(this.proctors.map(p => p.id));
    this.assignments = this.assignments.filter(a => newProctorIds.has(a.proctorId));

    this.logAudit('ADMIN', 'AUTO_GENERATE_PROCTORS', 'PROCTORS', 'all', null, `สุ่มสร้างรายชื่ออาจารย์และบุคลากรผู้คุมสอบอัตโนมัติ ${count} ท่าน`);
    this.notify();
    return this.proctors.length;
  }

  // --- สุ่มเพิ่มผู้คุมสอบอีกชุดเข้าไปในระบบ (โดยไม่ลบคนเก่า) ---
  addRandomProctors(count = 20) {
    this.pushUndo(`สุ่มเพิ่มผู้คุมสอบ ${count} คน`);

    const prng = new PRNG(Date.now());
    const existingMaxId = this.proctors.reduce((max, p) => {
      const num = parseInt(p.id.replace(/\D/g, ''), 10) || 0;
      return Math.max(max, num);
    }, 0);

    const FIRST_NAMES = [
      'กิตติศักดิ์', 'ขวัญชัย', 'จิราพร', 'ฉัตรชัย', 'ชลธิชา',
      'ฐิติมา', 'ณัฐพงษ์', 'ดนัย', 'ทศพร', 'ธนากร',
      'นภัสสร', 'ปิยะวัฒน์', 'พงศกร', 'ภัทรดนัย', 'มนัสวี',
      'ยุวดี', 'รังสรรค์', 'ลลิตา', 'วรวิทย์', 'ศิริพร',
      'สมศักดิ์', 'อนันต์', 'อารียา', 'เอกชัย', 'กมลชนก',
      'จิรวัฒน์', 'ชนินทร์', 'ดารินทร์', 'ทรงพล', 'ธวัลรัตน์'
    ];
    const LAST_NAMES = [
      'เจริญสุข', 'พัฒนาวงศ์', 'เลิศวิริยะ', 'สิริวัฒนา', 'มงคลรัตน์',
      'ประเสริฐผล', 'จงบริบูรณ์', 'ทรัพย์มหาศาล', 'วิทยากร', 'รุ่งเรืองกิจ',
      'ธนารักษ์', 'บุญญานุรักษ์', 'เกษมสุข', 'วัฒนเมธี', 'อัครเดชากร'
    ];
    const DEPARTMENTS = [
      'คณะวิทยาศาสตร์และเทคโนโลยี', 'คณะวิศวกรรมศาสตร์', 'คณะบริหารธุรกิจและการบัญชี',
      'คณะมนุษยศาสตร์และสังคมศาสตร์', 'คณะครุศาสตร์และศึกษาศาสตร์', 'สำนักบริการคอมพิวเตอร์',
      'กองบริหารงานวิชาการและการสอบ', 'สำนักวิทยบริการและหอสมุด'
    ];

    const newProctors = [];
    for (let i = 1; i <= count; i++) {
      const idx = existingMaxId + i;
      const proctorId = `P${String(idx).padStart(3, '0')}`;
      const fName = prng.choice(FIRST_NAMES);
      const lName = prng.choice(LAST_NAMES);
      const isFaculty = prng.next() < 0.6;
      const dept = prng.choice(DEPARTMENTS);
      const level = isFaculty || prng.next() < 0.3 ? 'chief' : 'assistant';
      const academicTitle = isFaculty ? prng.choice(['ผศ.ดร.', 'ผศ.', 'อาจารย์ ดร.', 'อาจารย์']) : 'นักวิชาการศึกษา';

      newProctors.push({
        id: proctorId,
        firstName: fName,
        lastName: lName,
        academicTitle,
        seniorityRank: isFaculty ? 8 : 4,
        pool: prng.next() < 0.85 ? 'core' : 'reserve',
        sessionPattern: 'FULL_DAY_PAIRED',
        availableDates: [],
        keepSameRoom: true,
        proctorType: isFaculty ? 'faculty' : 'staff',
        department: dept,
        email: `proctor_${idx}@univ-exam.ac.th`,
        phone: `08${prng.nextInt(10, 99)}-${prng.nextInt(100, 999)}-${prng.nextInt(1000, 9999)}`,
        dailyQuota: 2,
        projectQuota: 6,
        maxHours: 21,
        isActive: true,
        level,
      });
    }

    this.proctors.push(...newProctors);
    this.logAudit('ADMIN', 'ADD_RANDOM_PROCTORS', 'PROCTORS', 'multiple', null, `สุ่มเพิ่มผู้คุมสอบอีก ${count} ท่าน (รวมเป็น ${this.proctors.length} ท่าน)`);
    this.notify();
    return this.proctors.length;
  }

  // --- สุ่มเลือกผู้คุมที่ผ่านเกณฑ์ทันที 1 ท่านใส่ลงในตำแหน่งที่เลือก (Auto-Pick Proctor for Slot) ---
  autoPickProctorForSlot(sessionId, allocationId, roomId, role, currentAssignId) {
    let candidates = this.getRecommendedSubstitutes(sessionId, allocationId, role, currentAssignId);
    let allowed = candidates.filter(c => c.allowed);

    // หากไม่มีผู้คุมว่าง ให้สุ่มเพิ่มผู้คุมใหม่ 5 คนทันที
    if (allowed.length === 0) {
      this.addRandomProctors(5);
      candidates = this.getRecommendedSubstitutes(sessionId, allocationId, role, currentAssignId);
      allowed = candidates.filter(c => c.allowed);
    }

    if (allowed.length > 0) {
      const topPick = allowed[0];
      this.assignProctorManually({
        sessionId,
        allocationId,
        roomId,
        role,
        proctorId: topPick.proctor.id
      });
      return { success: true, proctor: topPick.proctor, reason: topPick.reason };
    }

    return { success: false, message: 'ไม่สามารถหาผู้คุมที่ผ่านเกณฑ์ได้' };
  }

  // --- การคำนวณจำนวนผู้คุมขั้นต่ำ (Min Proctor Calculator) ---
  calculateMinProctors() {
    return calculateMinimumProctors({
      allocations: this.allocations,
      sessions: this.sessions,
      proctors: this.proctors,
      rooms: this.rooms,
      unavailabilities: this.unavailabilities,
      settings: this.settings
    });
  }

  // --- การแก้ด้วยมือ (Manual Override) ---
  assignProctorManually({ sessionId, allocationId, roomId, proctorId, role, reason = '', doSwap = true }) {
    this.pushUndo(`เปลี่ยนผู้คุมในห้อง ${roomId || 'สำรอง'}`);

    // ค้นหาผู้คุมเดิมในตำแหน่งนี้
    const existingInSlotIndex = this.assignments.findIndex(a => {
      if (role === 'reserve') {
        return a.sessionId === sessionId && a.allocationId === allocationId && a.role === 'reserve';
      }
      return a.allocationId === allocationId && a.role === role;
    });

    const previousProctorId = existingInSlotIndex >= 0 ? this.assignments[existingInSlotIndex].proctorId : null;

    // ตรวจสอบว่า proctorId ใหม่ที่เลือกมา มีตำแหน่งอื่นในรอบเดียวกันนี้อยู่แล้วหรือไม่
    const otherSlotIndex = this.assignments.findIndex(a => a.sessionId === sessionId && a.proctorId === proctorId);

    if (otherSlotIndex >= 0) {
      if (doSwap && previousProctorId) {
        // สลับตัว! เอาคนเดิมไปใส่ตำแหน่งอื่นแทน
        this.assignments[otherSlotIndex].proctorId = previousProctorId;
        this.assignments[otherSlotIndex].status = 'confirmed';
        this.assignments[otherSlotIndex].source = 'manual';
        this.assignments[otherSlotIndex].reason = `สลับตัวกับ ${proctorId}`;
      } else {
        // นำออกจากตำแหน่งเดิม
        this.assignments.splice(otherSlotIndex, 1);
      }
    }

    // ลบการจัดเดิมในตำแหน่งนี้ออก (ถ้ามี)
    const currentSlotAfterIndex = this.assignments.findIndex(a => {
      if (role === 'reserve') {
        return a.sessionId === sessionId && a.allocationId === allocationId && a.role === 'reserve';
      }
      return a.allocationId === allocationId && a.role === role;
    });
    if (currentSlotAfterIndex >= 0) {
      this.assignments.splice(currentSlotAfterIndex, 1);
    }

    // สร้าง assignment ใหม่
    const newAssignment = {
      id: `assign_manual_${sessionId}_${proctorId}_${Date.now()}`,
      allocationId: allocationId || `RESERVE_${sessionId}`,
      sessionId,
      roomId,
      proctorId,
      role,
      status: 'confirmed',
      source: 'manual',
      reason: reason || 'ปรับเปลี่ยนด้วยตนเองโดยผู้ประสานงาน'
    };

    this.assignments.push(newAssignment);
    this.logAudit('ADMIN', 'MANUAL_EDIT', 'ASSIGNMENT', newAssignment.id, previousProctorId, newAssignment, reason);
    this.notify();
  }

  // --- การลากวางเพื่อย้ายหรือสลับตัวผู้คุมสอบ (Drag & Drop Reassign / Swap) ---
  dragAndDropReassign({
    sourceAssignId,
    targetSessionId,
    targetAllocId,
    targetRoomId,
    targetRole,
    targetOrderIndex = 1,
    targetAssignId = null
  }) {
    const sourceAssign = this.assignments.find(a => a.id === sourceAssignId);
    if (!sourceAssign) {
      return { success: false, message: 'ไม่พบข้อมูลผู้คุมที่ถูกลาก' };
    }

    const proctor1 = this.proctors.find(p => p.id === sourceAssign.proctorId);
    if (!proctor1) {
      return { success: false, message: 'ไม่พบประวัติผู้คุมสอบ' };
    }

    const sessionMap = new Map(this.sessions.map(s => [s.id, s]));
    const proctorMap = new Map(this.proctors.map(p => [p.id, p]));

    // ตรวจสอบว่าช่องปลายทางมีผู้คุมอยู่แล้วหรือไม่
    let targetAssign = null;
    if (targetAssignId) {
      targetAssign = this.assignments.find(a => a.id === targetAssignId);
    } else {
      targetAssign = this.assignments.find(a => {
        if (targetRole === 'reserve') {
          return a.sessionId === targetSessionId && a.allocationId === targetAllocId && a.role === 'reserve';
        }
        return a.allocationId === targetAllocId && a.role === targetRole && (a.orderIndex || (targetRole === 'chief' ? 1 : 2)) === targetOrderIndex;
      });
    }

    // กรณีที่ 1: ลากมาช่องเดิมของตัวเอง
    if (targetAssign && targetAssign.id === sourceAssign.id) {
      return { success: true, message: 'ตำแหน่งเดิม' };
    }

    // กรณีที่ 2: สลับตัวผู้คุม (SWAP) เมื่อช่องปลายทางมีคนอยู่แล้ว
    if (targetAssign) {
      const proctor2 = this.proctors.find(p => p.id === targetAssign.proctorId);
      if (!proctor2) {
        return { success: false, message: 'ไม่พบข้อมูลผู้คุมในตำแหน่งปลายทาง' };
      }

      // ตรวจสอบเงื่อนไข proctor1 ในตำแหน่งปลายทาง
      const assignmentsWithoutBoth = this.assignments.filter(a => a.id !== sourceAssign.id && a.id !== targetAssign.id);

      const check1 = canProctorTakeSlot({
        proctorId: proctor1.id,
        sessionId: targetSessionId,
        allocationId: targetAllocId,
        role: targetRole,
        currentAssignments: assignmentsWithoutBoth,
        sessionMap,
        proctorMap,
        unavailabilities: this.unavailabilities,
        settings: this.settings
      });

      if (!check1.allowed) {
        return {
          success: false,
          message: `ไม่สามารถสลับได้: ${proctor1.firstName} ${check1.reason}`
        };
      }

      // ตรวจสอบเงื่อนไข proctor2 ในตำแหน่งต้นทาง
      const check2 = canProctorTakeSlot({
        proctorId: proctor2.id,
        sessionId: sourceAssign.sessionId,
        allocationId: sourceAssign.allocationId,
        role: sourceAssign.role,
        currentAssignments: [...assignmentsWithoutBoth, { ...targetAssign, proctorId: proctor1.id, allocationId: targetAllocId, sessionId: targetSessionId, role: targetRole }],
        sessionMap,
        proctorMap,
        unavailabilities: this.unavailabilities,
        settings: this.settings
      });

      if (!check2.allowed) {
        return {
          success: false,
          message: `ไม่สามารถสลับได้: ${proctor2.firstName} ${check2.reason}`
        };
      }

      // ผ่านเกณฑ์ทั้งคู่ ดำเนินการสลับตัว!
      this.pushUndo(`สลับตัว ${proctor1.firstName} ⇄ ${proctor2.firstName}`);
      const tempP1 = sourceAssign.proctorId;
      sourceAssign.proctorId = targetAssign.proctorId;
      sourceAssign.status = 'confirmed';
      sourceAssign.source = 'manual';
      sourceAssign.reason = `สลับตัวกับ ${proctor1.firstName} (ลากวาง Swap)`;

      targetAssign.proctorId = tempP1;
      targetAssign.status = 'confirmed';
      targetAssign.source = 'manual';
      targetAssign.reason = `สลับตัวกับ ${proctor2.firstName} (ลากวาง Swap)`;

      this.logAudit('ADMIN', 'DRAG_SWAP', 'ASSIGNMENT', sourceAssign.id, null, { p1: proctor1.id, p2: proctor2.id }, `ลากสลับตัว ${proctor1.firstName} กับ ${proctor2.firstName}`);
      this.notify();
      return {
        success: true,
        message: `สลับตัว ${proctor1.firstName} กับ ${proctor2.firstName} สำเร็จ`
      };
    }

    // กรณีที่ 3: ย้ายไปยังช่องว่าง (MOVE)
    const assignmentsWithoutSource = this.assignments.filter(a => a.id !== sourceAssign.id);
    const checkMove = canProctorTakeSlot({
      proctorId: proctor1.id,
      sessionId: targetSessionId,
      allocationId: targetAllocId,
      role: targetRole,
      currentAssignments: assignmentsWithoutSource,
      sessionMap,
      proctorMap,
      unavailabilities: this.unavailabilities,
      settings: this.settings
    });

    if (!checkMove.allowed) {
      return {
        success: false,
        message: `ไม่สามารถย้ายได้: ${proctor1.firstName} ${checkMove.reason}`
      };
    }

    // ดำเนินการย้าย
    this.pushUndo(`ย้าย ${proctor1.firstName} ไปห้อง ${targetRoomId || 'สำรอง'}`);
    sourceAssign.sessionId = targetSessionId;
    sourceAssign.allocationId = targetAllocId;
    sourceAssign.roomId = targetRoomId;
    sourceAssign.role = targetRole;
    sourceAssign.orderIndex = targetOrderIndex;
    sourceAssign.status = 'confirmed';
    sourceAssign.source = 'manual';
    sourceAssign.reason = `ลากย้ายตำแหน่งมายังห้อง ${targetRoomId || 'สำรอง'}`;

    this.logAudit('ADMIN', 'DRAG_MOVE', 'ASSIGNMENT', sourceAssign.id, null, sourceAssign, `ลากย้าย ${proctor1.firstName} ไปรอบ ${targetSessionId} ห้อง ${targetRoomId}`);
    this.notify();
    return {
      success: true,
      message: `ย้าย ${proctor1.firstName} ไปยังห้อง ${targetRoomId || 'สำรอง'} สำเร็จ`
    };
  }

  // --- ปรับโควต้าและวันที่สะดวกของผู้คุมสอบแบบรวดเร็ว (Update Quota & Available Dates) ---
  updateProctorQuotaAndDates(proctorId, { dailyQuota, projectQuota, availableDates, sessionPattern }) {
    const p = this.proctors.find(item => item.id === proctorId);
    if (!p) return false;

    this.pushUndo(`ปรับโควต้า/วันที่ของ ${p.firstName}`);
    if (dailyQuota !== undefined) p.dailyQuota = Number(dailyQuota);
    if (projectQuota !== undefined) p.projectQuota = Number(projectQuota);
    if (availableDates !== undefined) p.availableDates = availableDates;
    if (sessionPattern !== undefined) p.sessionPattern = sessionPattern;

    this.logAudit('ADMIN', 'UPDATE_QUOTA_DATES', 'PROCTOR', proctorId, null, { dailyQuota, projectQuota, availableDates, sessionPattern }, `ปรับโควต้าเป็น ${p.projectQuota} รอบ, วันสะดวก: ${p.availableDates?.join(', ') || 'ทุกวัน'}`);
    this.notify();
    return true;
  }

  // ลบผู้คุมออกจากตำแหน่ง
  removeAssignment(assignmentId) {
    const idx = this.assignments.findIndex(a => a.id === assignmentId);
    if (idx >= 0) {
      this.pushUndo('ลบผู้คุมออกจากห้อง');
      const removed = this.assignments.splice(idx, 1)[0];
      this.logAudit('ADMIN', 'REMOVE_ASSIGNMENT', 'ASSIGNMENT', assignmentId, removed, null);
      this.notify();
    }
  }

  // สลับหรือล็อก (Toggle Lock)
  toggleLockAssignment(assignmentId) {
    const a = this.assignments.find(item => item.id === assignmentId);
    if (a) {
      this.pushUndo(`เปลี่ยนสถานะล็อก ${a.proctorId}`);
      a.status = a.status === 'locked' ? 'confirmed' : 'locked';
      this.logAudit('ADMIN', 'TOGGLE_LOCK', 'ASSIGNMENT', assignmentId, null, a.status);
      this.notify();
    }
  }

  // ล้างการจัดตารางทั้งหมด (Clear Schedule)
  clearSchedule(clearLocked = false) {
    this.pushUndo('ล้างตารางการจัดสอบทั้งหมด');
    const beforeCount = this.assignments.length;
    if (clearLocked) {
      this.assignments = [];
    } else {
      this.assignments = this.assignments.filter(a => a.status === 'locked');
    }
    this.currentStatus = 'draft';
    this.logAudit('ADMIN', 'CLEAR_SCHEDULE', 'SCHEDULE', 'all', beforeCount, this.assignments.length, 'ล้างผลการจัดตาราง');
    this.notify();
  }

  // ล้างผู้คุมเฉพาะในรอบสอบที่ระบุ
  clearSessionAssignments(sessionId) {
    this.pushUndo(`ล้างผู้คุมในรอบ ${sessionId}`);
    const beforeCount = this.assignments.length;
    this.assignments = this.assignments.filter(a => a.sessionId !== sessionId);
    this.logAudit('ADMIN', 'CLEAR_SESSION', 'SESSION', sessionId, beforeCount, this.assignments.length, `ล้างผู้คุมในรอบ ${sessionId}`);
    this.notify();
  }

  // --- การจัดการข้อมูลหลัก (Master Data CRUD) ---
  saveProctor(data) {
    const isNew = !data.id || !this.proctors.some(p => p.id === data.id);
    let id = data.id;
    if (isNew && !id) {
      const maxNum = this.proctors.reduce((max, p) => {
        const num = parseInt(p.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      id = `P${String(maxNum + 1).padStart(3, '0')}`;
    }

    const idx = this.proctors.findIndex(p => p.id === id);
    const existing = idx >= 0 ? this.proctors[idx] : null;

    // หากผู้ใช้ทั่วไปแก้ไขข้อมูลตนเอง (ไม่ใช่ Admin) จะไม่อนุญาตให้แก้โควต้าหรือบทบาท
    const isSelfEdit = !this.isAdmin() && this.currentUser?.proctorId === id;

    const proctorObj = {
      id,
      academicTitle: data.academicTitle !== undefined ? data.academicTitle : (existing?.academicTitle || ''),
      firstName: data.firstName || existing?.firstName || 'ไม่ระบุชื่อ',
      lastName: data.lastName || existing?.lastName || '',
      proctorType: isSelfEdit ? (existing?.proctorType || 'faculty') : (data.proctorType || 'faculty'),
      level: isSelfEdit ? (existing?.level || 'assistant') : (data.level || 'assistant'),
      seniorityRank: data.seniorityRank !== undefined ? Number(data.seniorityRank) : (existing?.seniorityRank || (data.proctorType === 'faculty' ? 7 : 4)),
      department: data.department || existing?.department || 'ทั่วไป',
      email: data.email || existing?.email || `${id.toLowerCase()}@bru.ac.th`,
      phone: data.phone || existing?.phone || '081-000-0000',
      dailyQuota: isSelfEdit ? (existing?.dailyQuota ?? 2) : (Number(data.dailyQuota) || 2),
      projectQuota: isSelfEdit ? (existing?.projectQuota ?? 6) : (Number(data.projectQuota) || 6),
      maxHours: isSelfEdit ? (existing?.maxHours ?? 18) : (Number(data.maxHours) || 18),
      availableDates: data.availableDates !== undefined ? data.availableDates : (existing?.availableDates || []),
      sessionPattern: data.sessionPattern || existing?.sessionPattern || 'FULL_DAY_PAIRED',
      keepSameRoom: existing?.keepSameRoom !== undefined ? existing.keepSameRoom : true,
      pool: existing?.pool || 'core',
      isActive: isSelfEdit ? (existing?.isActive !== false) : (data.isActive !== false)
    };

    if (idx >= 0) {
      const before = this.proctors[idx];
      this.proctors[idx] = proctorObj;
      this.logAudit(this.currentUser?.name || 'USER', 'UPDATE', 'PROCTOR', id, before, proctorObj, 'แก้ไขข้อมูลผู้คุมสอบ');
    } else {
      this.proctors.push(proctorObj);
      this.logAudit('ADMIN', 'CREATE', 'PROCTOR', id, null, proctorObj, 'เพิ่มผู้คุมสอบใหม่');
    }

    // อัปเดตชื่อใน currentUser ทันทีหากเป็นการแก้ไขโปรไฟล์ตัวเอง
    if (this.currentUser?.proctorId === id) {
      this.currentUser.name = `${proctorObj.proctorType === 'faculty' ? 'อ.' : ''}${proctorObj.firstName} ${proctorObj.lastName}`;
    }

    this.notify();
    return proctorObj;
  }

  deleteProctor(proctorId) {
    const idx = this.proctors.findIndex(p => p.id === proctorId);
    if (idx >= 0) {
      const removed = this.proctors.splice(idx, 1)[0];
      this.assignments = this.assignments.filter(a => a.proctorId !== proctorId);
      this.unavailabilities = this.unavailabilities.filter(u => u.proctorId !== proctorId);
      this.logAudit('ADMIN', 'DELETE', 'PROCTOR', proctorId, removed, null, 'ลบผู้คุมสอบออกจากระบบ');
      this.notify();
      return true;
    }
    return false;
  }

  saveRoom(data) {
    const isNew = !data.id || !this.rooms.some(r => r.id === data.id);
    let id = data.id;
    if (isNew && !id) {
      const maxNum = this.rooms.reduce((max, r) => {
        const num = parseInt(r.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      id = `R${String(maxNum + 1).padStart(2, '0')}`;
    }

    const roomObj = {
      id,
      name: data.name || `ห้องปฏิบัติการคอมพิวเตอร์ LAB ${id}`,
      building: data.building || 'อาคารปฏิบัติการ',
      floor: Number(data.floor) || 1,
      capacity: Number(data.capacity) || 35,
      roomType: data.roomType || 'computer',
      accessibleForDisabled: Boolean(data.accessibleForDisabled),
      isActive: data.isActive !== false
    };

    const idx = this.rooms.findIndex(r => r.id === id);
    if (idx >= 0) {
      const before = this.rooms[idx];
      this.rooms[idx] = roomObj;
      this.logAudit('ADMIN', 'UPDATE', 'ROOM', id, before, roomObj, 'แก้ไขข้อมูลห้องสอบ');
    } else {
      this.rooms.push(roomObj);
      this.logAudit('ADMIN', 'CREATE', 'ROOM', id, null, roomObj, 'เพิ่มห้องสอบใหม่');
    }

    this.notify();
    return roomObj;
  }

  deleteRoom(roomId) {
    const idx = this.rooms.findIndex(r => r.id === roomId);
    if (idx >= 0) {
      const removed = this.rooms.splice(idx, 1)[0];
      const removedAllocIds = new Set(this.allocations.filter(a => a.roomId === roomId).map(a => a.id));
      this.allocations = this.allocations.filter(a => a.roomId !== roomId);
      this.assignments = this.assignments.filter(a => !removedAllocIds.has(a.allocationId));
      this.logAudit('ADMIN', 'DELETE', 'ROOM', roomId, removed, null, 'ลบห้องสอบออกจากระบบ');
      this.notify();
      return true;
    }
    return false;
  }

  saveSession(data) {
    const isNew = !data.id || !this.sessions.some(s => s.id === data.id);
    let id = data.id;
    if (isNew && !id) {
      const maxNum = this.sessions.reduce((max, s) => {
        const num = parseInt(s.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      id = `S${String(maxNum + 1).padStart(2, '0')}`;
    }

    const sessionObj = {
      id,
      name: data.name || `รอบการสอบ ${id}`,
      date: data.date || '2026-10-24',
      startTime: data.startTime || `${data.date || '2026-10-24'}T09:00:00+07:00`,
      endTime: data.endTime || `${data.date || '2026-10-24'}T12:00:00+07:00`,
      totalExaminees: Number(data.totalExaminees) || 0,
      prepMinutes: Number(data.prepMinutes) || 30,
      wrapMinutes: Number(data.wrapMinutes) || 15,
      organization: data.organization || 'ศูนย์สอบมหาวิทยาลัย'
    };

    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx >= 0) {
      const before = this.sessions[idx];
      this.sessions[idx] = sessionObj;
      this.logAudit('ADMIN', 'UPDATE', 'SESSION', id, before, sessionObj, 'แก้ไขรอบการสอบ');
    } else {
      this.sessions.push(sessionObj);
      for (const r of this.rooms.filter(room => room.isActive)) {
        this.allocations.push({
          id: `A_${id}_${r.id}`,
          sessionId: id,
          roomId: r.id,
          examineesInRoom: Math.min(r.capacity, 30),
          specialNeeds: 'computer'
        });
      }
      this.logAudit('ADMIN', 'CREATE', 'SESSION', id, null, sessionObj, 'เพิ่มรอบการสอบใหม่');
    }

    this.notify();
    return sessionObj;
  }

  deleteSession(sessionId) {
    const idx = this.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      const removed = this.sessions.splice(idx, 1)[0];
      this.allocations = this.allocations.filter(a => a.sessionId !== sessionId);
      this.assignments = this.assignments.filter(a => a.sessionId !== sessionId);
      this.logAudit('ADMIN', 'DELETE', 'SESSION', sessionId, removed, null, 'ลบรอบการสอบออกจากระบบ');
      this.notify();
      return true;
    }
    return false;
  }

  // --- การจัดการห้องสอบประจำรอบ (Room Allocations) สำหรับ Admin ---
  addRoomToSession(sessionId, roomId, examinees = 30) {
    if (this.allocations.some(a => a.sessionId === sessionId && a.roomId === roomId)) {
      return false; // มีห้องนี้ในรอบแล้ว
    }
    const room = this.rooms.find(r => r.id === roomId);
    const capacity = room ? room.capacity : 35;
    const newAlloc = {
      id: `A_${sessionId}_${roomId}`,
      sessionId,
      roomId,
      examineesInRoom: Math.min(Number(examinees) || capacity, capacity),
      specialNeeds: 'computer'
    };
    this.pushUndo(`เพิ่มห้อง ${roomId} ในรอบ ${sessionId}`);
    this.allocations.push(newAlloc);
    this.logAudit('ADMIN', 'ADD_ROOM_SESSION', 'ALLOCATION', newAlloc.id, null, newAlloc, `เพิ่มห้อง ${roomId} ในรอบ ${sessionId}`);
    this.notify();
    return newAlloc;
  }

  removeRoomFromSession(allocationId) {
    const idx = this.allocations.findIndex(a => a.id === allocationId);
    if (idx >= 0) {
      this.pushUndo('ถอดห้องสอบออกจากรอบ');
      const removed = this.allocations.splice(idx, 1)[0];
      this.assignments = this.assignments.filter(a => a.allocationId !== allocationId);
      this.logAudit('ADMIN', 'REMOVE_ROOM_SESSION', 'ALLOCATION', allocationId, removed, null, 'ถอดห้องออกจากรอบการสอบ');
      this.notify();
      return true;
    }
    return false;
  }

  updateAllocation(allocationId, { examineesInRoom, roomId }) {
    const alloc = this.allocations.find(a => a.id === allocationId);
    if (alloc) {
      this.pushUndo('แก้ไขข้อมูลห้องสอบในรอบ');
      if (examineesInRoom !== undefined) {
        alloc.examineesInRoom = Number(examineesInRoom);
      }
      if (roomId && roomId !== alloc.roomId) {
        alloc.roomId = roomId;
        this.assignments.filter(a => a.allocationId === allocationId).forEach(a => a.roomId = roomId);
      }
      this.logAudit('ADMIN', 'UPDATE_ALLOCATION', 'ALLOCATION', allocationId, null, alloc, 'แก้ไขจำนวนผู้เข้าสอบหรือห้อง');
      this.notify();
      return true;
    }
    return false;
  }

  saveUnavailability(data) {
    const isNew = !data.id || !this.unavailabilities.some(u => u.id === data.id);
    const id = data.id || `U_${Date.now()}`;
    const unavailObj = {
      id,
      proctorId: data.proctorId,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason || ''
    };

    const idx = this.unavailabilities.findIndex(u => u.id === id);
    if (idx >= 0) {
      const before = this.unavailabilities[idx];
      this.unavailabilities[idx] = unavailObj;
      this.logAudit('ADMIN', 'UPDATE', 'UNAVAILABILITY', id, before, unavailObj, 'แก้ไขช่วงเวลาไม่ว่าง');
    } else {
      this.unavailabilities.push(unavailObj);
      this.logAudit('ADMIN', 'CREATE', 'UNAVAILABILITY', id, null, unavailObj, 'เพิ่มช่วงเวลาไม่ว่าง');
    }

    this.notify();
    return unavailObj;
  }

  deleteUnavailability(unavailId) {
    const idx = this.unavailabilities.findIndex(u => u.id === unavailId);
    if (idx >= 0) {
      const removed = this.unavailabilities.splice(idx, 1)[0];
      this.logAudit('ADMIN', 'DELETE', 'UNAVAILABILITY', unavailId, removed, null, 'ลบช่วงเวลาไม่ว่าง');
      this.notify();
      return true;
    }
    return false;
  }

  // --- แนะนำตัวแทน (Recommend Candidates) ---
  getRecommendedSubstitutes(sessionId, allocationId, role, currentProctorId = null) {
    const sessionMap = new Map(this.sessions.map(s => [s.id, s]));
    const proctorMap = new Map(this.proctors.map(p => [p.id, p]));
    const targetSession = sessionMap.get(sessionId);
    const alloc = allocationId ? this.allocations.find(a => a.id === allocationId) : null;

    // 1. ตรวจสอบผู้คุมสำรองในรอบเดียวกันก่อน (ตามข้อกำหนด 7.6: "เริ่มจากผู้คุมสำรอง")
    const reserveAssignments = this.assignments.filter(a => a.sessionId === sessionId && a.role === 'reserve');
    const reserveProctorIds = new Set(reserveAssignments.map(a => a.proctorId));

    // นับรอบงานของผู้คุมปัจจุบัน
    const counts = new Map();
    for (const a of this.assignments) {
      counts.set(a.proctorId, (counts.get(a.proctorId) || 0) + 1);
    }

    const candidates = [];
    const busyCandidates = [];

    for (const p of this.proctors) {
      if (!p.isActive || p.id === currentProctorId) continue;

      const check = canProctorTakeSlot({
        proctorId: p.id,
        sessionId,
        allocationId,
        role,
        currentAssignments: this.assignments.filter(a => a.proctorId !== currentProctorId),
        sessionMap,
        proctorMap,
        unavailabilities: this.unavailabilities,
        settings: this.settings
      });

      // ตรวจสอบว่าในรอบเดียวกันนี้ คนนี้ถูกจัดในห้องไหนอยู่หรือไม่
      const existingInSession = this.assignments.find(a => a.sessionId === sessionId && a.proctorId === p.id);
      let assignedRoomName = '';
      if (existingInSession) {
        if (existingInSession.role === 'reserve') {
          assignedRoomName = 'ผู้คุมสำรองประจำรอบ';
        } else {
          const r = this.rooms.find(rm => rm.id === existingInSession.roomId);
          assignedRoomName = r ? r.name : (existingInSession.roomId || 'ห้องสอบอื่น');
        }
      }

      if (check.allowed) {
        const isReserve = reserveProctorIds.has(p.id);
        const { totalScore } = calculateCandidateScore({
          proctor: p,
          session: targetSession,
          allocation: alloc,
          roomPartners: [],
          proctorAssignmentCounts: counts,
          proctorWorkedDates: new Map(),
          proctorDateRooms: new Map(),
          isDirectlyConsecutive: false,
          totalSessions: this.sessions.length,
          totalProctors: this.proctors.length,
          settings: this.settings
        });

        const finalScore = isReserve ? totalScore + 100 : totalScore;

        candidates.push({
          proctor: p,
          score: finalScore,
          isReserve,
          allowed: true,
          workload: counts.get(p.id) || 0,
          assignedInSameSession: existingInSession,
          assignedRoomName,
          reason: isReserve
            ? `⭐ ผู้คุมสำรองประจำรอบนี้ (พร้อมเข้าแทนทันที)`
            : `ผู้คุมว่าง (ภาระงาน ${counts.get(p.id) || 0} รอบ, คะแนน ${totalScore.toFixed(1)})`
        });
      } else {
        busyCandidates.push({
          proctor: p,
          score: -100,
          isReserve: false,
          allowed: false,
          workload: counts.get(p.id) || 0,
          assignedInSameSession: existingInSession,
          assignedRoomName,
          blockedReason: check.reason || 'ไม่ผ่านเกณฑ์',
          reason: existingInSession
            ? `📌 กำลังคุมอยู่: ${assignedRoomName}`
            : (check.reason || 'ไม่ผ่านเกณฑ์การจัดสรร')
        });
      }
    }

    // เรียงผู้คุมที่ว่างตามคะแนนความเหมาะสมสูงสุด
    candidates.sort((a, b) => b.score - a.score);
    // รวมผู้คุมที่ไม่ว่างไว้ต่อท้ายเพื่อให้เลือกสลับตัวหรือตรวจดูได้
    return [...candidates, ...busyCandidates];
  }

  // --- ผู้คุมลากะทันหัน (Sudden Leave Handler - ข้อกำหนด 7.6) ---
  handleSuddenLeave(proctorId, sessionId, replacementProctorId, reason = '') {
    this.pushUndo(`แจ้งลากะทันหัน: ${proctorId}`);

    // หา assignments ทั้งหมดของคนนี้ในรอบดังกล่าว
    const targetAssigns = this.assignments.filter(a => a.sessionId === sessionId && a.proctorId === proctorId);

    for (const target of targetAssigns) {
      // บันทึก unavailability เพิ่มเติมอัตโนมัติ
      const session = this.sessions.find(s => s.id === sessionId);
      if (session) {
        this.unavailabilities.push({
          id: `U_SUDDEN_${Date.now()}`,
          proctorId,
          startTime: session.startTime,
          endTime: session.endTime,
          reason: `ลากะทันหัน: ${reason || 'เหตุฉุกเฉิน'}`
        });
      }

      // เปลี่ยนตัวเป็นผู้คุมคนใหม่
      target.proctorId = replacementProctorId;
      target.source = 'manual';
      target.reason = `เข้าปฏิบัติหน้าที่แทน ${proctorId} เนื่องจากลากะทันหัน (${reason || 'เหตุจำเป็น'})`;
    }

    this.logAudit('ADMIN', 'SUDDEN_LEAVE', 'PROCTOR', proctorId, proctorId, replacementProctorId, `ลากะทันหันในรอบ ${sessionId}: ${reason}`);
    this.notify();
  }

  // --- การจัดการเวอร์ชัน (Versioning & Diff - ข้อกำหนด 7.9) ---
  saveVersionSnapshot(note = '') {
    const versionNumber = this.versions.length + 1;
    const newVersion = {
      id: `VER_${versionNumber}_${Date.now()}`,
      versionNumber,
      createdAt: new Date().toISOString(),
      scheduleStatus: this.currentStatus,
      note: note || `เวอร์ชันที่ ${versionNumber} (${this.currentStatus})`,
      assignments: JSON.parse(JSON.stringify(this.assignments))
    };
    this.versions.push(newVersion);
    this.logAudit('ADMIN', 'SAVE_VERSION', 'VERSION', newVersion.id, null, `บันทึกเวอร์ชัน ${versionNumber}: ${note}`);
    this.notify();
    return newVersion;
  }

  restoreVersion(versionId) {
    const targetVer = this.versions.find(v => v.id === versionId);
    if (!targetVer) return false;

    this.pushUndo(`ย้อนกลับไปใช้เวอร์ชัน ${targetVer.versionNumber}`);
    this.assignments = JSON.parse(JSON.stringify(targetVer.assignments));
    this.currentStatus = targetVer.scheduleStatus;
    this.logAudit('ADMIN', 'RESTORE_VERSION', 'VERSION', versionId, null, `ย้อนกลับไปใช้เวอร์ชัน ${targetVer.versionNumber}`);
    this.notify();
    return true;
  }

  // เปรียบเทียบสองเวอร์ชัน (Diff)
  compareVersions(versionIdA, versionIdB) {
    const verA = versionIdA === 'current'
      ? { versionNumber: 'ปัจจุบัน', assignments: this.assignments }
      : this.versions.find(v => v.id === versionIdA);

    const verB = versionIdB === 'current'
      ? { versionNumber: 'ปัจจุบัน', assignments: this.assignments }
      : this.versions.find(v => v.id === versionIdB);

    if (!verA || !verB) return null;

    const mapA = new Map();
    for (const a of verA.assignments) {
      const key = `${a.sessionId}_${a.roomId || 'reserve'}_${a.role}`;
      mapA.set(key, a);
    }

    const mapB = new Map();
    for (const b of verB.assignments) {
      const key = `${b.sessionId}_${b.roomId || 'reserve'}_${b.role}`;
      mapB.set(key, b);
    }

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const differences = [];

    for (const key of allKeys) {
      const itemA = mapA.get(key);
      const itemB = mapB.get(key);

      if (!itemA && itemB) {
        differences.push({
          type: 'added',
          slotKey: key,
          before: null,
          after: itemB
        });
      } else if (itemA && !itemB) {
        differences.push({
          type: 'removed',
          slotKey: key,
          before: itemA,
          after: null
        });
      } else if (itemA && itemB && itemA.proctorId !== itemB.proctorId) {
        differences.push({
          type: 'changed',
          slotKey: key,
          before: itemA,
          after: itemB
        });
      }
    }

    return {
      versionA: verA.versionNumber,
      versionB: verB.versionNumber,
      differences
    };
  }

  // เปลี่นสถานะตาราง (ร่าง -> รอตรวจ -> เผยแพร่)
  updateScheduleStatus(newStatus, reason = '') {
    const oldStatus = this.currentStatus;
    this.currentStatus = newStatus;
    this.logAudit('ADMIN', 'CHANGE_STATUS', 'SCHEDULE', 'status', oldStatus, newStatus, reason);
    this.notify();
  }

  // สลับใช้ Preset ข้อมูลจำลอง (20 / 40 / 80 / stress)
  loadPreset(presetKey) {
    const preset = SEED_PRESETS[presetKey];
    if (!preset) return;

    this.pushUndo(`โหลดชุดข้อมูล ${preset.label}`);
    const data = generateSeedData(preset.options);
    this.rooms = data.rooms;
    this.proctors = data.proctors;
    this.sessions = data.sessions;
    this.allocations = data.allocations;
    this.unavailabilities = data.unavailabilities;
    this.assignments = [];
    this.currentStatus = 'draft';

    this.logAudit('ADMIN', 'LOAD_PRESET', 'DATA', presetKey, null, `โหลดชุดข้อมูล: ${preset.label}`);
    this.notify();
  }

  // รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น
  resetSettings() {
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.logAudit('ADMIN', 'RESET_SETTINGS', 'SETTINGS', 'default', null, 'รีเซ็ตการตั้งค่าเป็นค่ามาตรฐาน');
    this.notify();
  }
}

// Global Singleton Instance
export const appState = new AppState();
