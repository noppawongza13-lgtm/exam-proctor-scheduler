/**
 * store.js — State Management (Reactive Store)
 * เก็บข้อมูลทั้งหมดใน memory + localStorage
 * รองรับ observer pattern สำหรับ UI reactivity
 * 
 * จุดเชื่อมต่อ Phase 2: เปลี่ยน localStorage → REST API / IndexedDB
 * โดยสร้าง storageAdapter interface
 * 
 * @module data/store
 */

import { auditLogger } from '../utils/auditLogger.js';

const STORAGE_KEY = 'examScheduler_data';

/**
 * @typedef {Object} StoreState
 * @property {import('./models.js').Room[]} rooms
 * @property {import('./models.js').Proctor[]} proctors
 * @property {import('./models.js').Unavailability[]} unavailabilities
 * @property {import('./models.js').ExamSession[]} sessions
 * @property {import('./models.js').RoomAllocation[]} allocations
 * @property {import('./models.js').ProctorAssignment[]} assignments
 * @property {import('./models.js').ScheduleVersion[]} versions
 */

/** สถานะข้อมูลเริ่มต้น */
const initialState = {
  rooms: [],
  proctors: [],
  unavailabilities: [],
  sessions: [],
  allocations: [],
  assignments: [],
  versions: [],
};

class Store {
  constructor() {
    /** @type {StoreState} */
    this._state = structuredClone(initialState);
    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
    this._load();
  }

  // === State Access ===

  /** @returns {StoreState} */
  getState() {
    return this._state;
  }

  /**
   * ดึง entity ตาม collection และ id
   * @param {keyof StoreState} collection
   * @param {string} id
   */
  getById(collection, id) {
    return this._state[collection]?.find(item => item.id === id) || null;
  }

  /**
   * ดึง entities ตาม filter
   * @param {keyof StoreState} collection
   * @param {Function} filterFn
   */
  getWhere(collection, filterFn) {
    return (this._state[collection] || []).filter(filterFn);
  }

  // === CRUD Operations ===

  /**
   * เพิ่ม entity
   * @param {keyof StoreState} collection
   * @param {Object} entity
   * @param {boolean} [logAction=true] - บันทึก audit log
   * @returns {Object} entity ที่เพิ่ม
   */
  add(collection, entity, logAction = true) {
    this._state[collection].push(entity);
    if (logAction) {
      auditLogger.log({
        action: `เพิ่ม${this._collectionLabel(collection)}`,
        entityType: collection,
        entityId: entity.id,
        after: entity,
      });
    }
    this._save();
    this._notify(collection);
    return entity;
  }

  /**
   * เพิ่มหลาย entities พร้อมกัน
   * @param {keyof StoreState} collection
   * @param {Object[]} entities
   * @param {boolean} [logAction=true]
   */
  addMany(collection, entities, logAction = true) {
    this._state[collection].push(...entities);
    if (logAction) {
      auditLogger.log({
        action: `นำเข้า${this._collectionLabel(collection)} ${entities.length} รายการ`,
        entityType: collection,
        detail: `จำนวน ${entities.length} รายการ`,
      });
    }
    this._save();
    this._notify(collection);
  }

  /**
   * แก้ไข entity
   * @param {keyof StoreState} collection
   * @param {string} id
   * @param {Object} updates
   * @param {boolean} [logAction=true]
   * @returns {Object|null} entity ที่แก้ไข
   */
  update(collection, id, updates, logAction = true) {
    const index = this._state[collection].findIndex(item => item.id === id);
    if (index === -1) return null;

    const before = structuredClone(this._state[collection][index]);
    Object.assign(this._state[collection][index], updates);
    const after = this._state[collection][index];

    if (logAction) {
      auditLogger.log({
        action: `แก้ไข${this._collectionLabel(collection)}`,
        entityType: collection,
        entityId: id,
        before,
        after: structuredClone(after),
      });
    }
    this._save();
    this._notify(collection);
    return after;
  }

  /**
   * ลบ entity
   * @param {keyof StoreState} collection
   * @param {string} id
   * @param {boolean} [logAction=true]
   * @returns {boolean}
   */
  remove(collection, id, logAction = true) {
    const index = this._state[collection].findIndex(item => item.id === id);
    if (index === -1) return false;

    const removed = this._state[collection].splice(index, 1)[0];
    if (logAction) {
      auditLogger.log({
        action: `ลบ${this._collectionLabel(collection)}`,
        entityType: collection,
        entityId: id,
        before: removed,
      });
    }
    this._save();
    this._notify(collection);
    return true;
  }

  /**
   * ล้าง collection ทั้งหมด
   * @param {keyof StoreState} collection
   */
  clear(collection) {
    const count = this._state[collection].length;
    this._state[collection] = [];
    auditLogger.log({
      action: `ล้าง${this._collectionLabel(collection)}ทั้งหมด`,
      entityType: collection,
      detail: `ลบ ${count} รายการ`,
    });
    this._save();
    this._notify(collection);
  }

  /**
   * แทนที่ collection ทั้งหมด (ใช้ตอน import/seed)
   * @param {keyof StoreState} collection
   * @param {Object[]} entities
   * @param {boolean} [logAction=true]
   */
  replaceAll(collection, entities, logAction = true) {
    this._state[collection] = [...entities];
    if (logAction) {
      auditLogger.log({
        action: `แทนที่${this._collectionLabel(collection)}`,
        entityType: collection,
        detail: `${entities.length} รายการ`,
      });
    }
    this._save();
    this._notify(collection);
  }

  // === Snapshot / Version ===

  /**
   * สร้าง snapshot ของ assignments ปัจจุบัน
   * @returns {Object}
   */
  createSnapshot() {
    return {
      assignments: structuredClone(this._state.assignments),
      allocations: structuredClone(this._state.allocations),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * กู้คืน snapshot
   * @param {Object} snapshot
   */
  restoreSnapshot(snapshot) {
    if (snapshot.assignments) {
      this._state.assignments = structuredClone(snapshot.assignments);
    }
    if (snapshot.allocations) {
      this._state.allocations = structuredClone(snapshot.allocations);
    }
    this._save();
    this._notify('assignments');
    this._notify('allocations');
  }

  // === ข้อมูลรวม (Computed) ===

  /**
   * ดึง allocations ของ session
   * @param {string} sessionId
   * @returns {import('./models.js').RoomAllocation[]}
   */
  getAllocationsBySession(sessionId) {
    return this._state.allocations.filter(a => a.sessionId === sessionId);
  }

  /**
   * ดึง assignments ของ allocation
   * @param {string} allocationId
   * @returns {import('./models.js').ProctorAssignment[]}
   */
  getAssignmentsByAllocation(allocationId) {
    return this._state.assignments.filter(a => a.allocationId === allocationId);
  }

  /**
   * ดึง assignments ของ proctor
   * @param {string} proctorId
   * @returns {import('./models.js').ProctorAssignment[]}
   */
  getAssignmentsByProctor(proctorId) {
    return this._state.assignments.filter(a => a.proctorId === proctorId);
  }

  /**
   * ดึง unavailabilities ของ proctor
   * @param {string} proctorId
   * @returns {import('./models.js').Unavailability[]}
   */
  getUnavailabilitiesByProctor(proctorId) {
    return this._state.unavailabilities.filter(u => u.proctorId === proctorId);
  }

  // === Observer Pattern ===

  /**
   * ลงทะเบียน listener สำหรับ collection
   * @param {keyof StoreState | '*'} collection - '*' = ทุก collection
   * @param {Function} fn
   * @returns {Function} unsubscribe
   */
  onChange(collection, fn) {
    if (!this._listeners.has(collection)) {
      this._listeners.set(collection, []);
    }
    this._listeners.get(collection).push(fn);
    return () => {
      const listeners = this._listeners.get(collection);
      if (listeners) {
        this._listeners.set(collection, listeners.filter(l => l !== fn));
      }
    };
  }

  // === Reset ===

  /** ล้างข้อมูลทั้งหมด */
  resetAll() {
    this._state = structuredClone(initialState);
    auditLogger.log({ action: 'ล้างข้อมูลทั้งหมด' });
    this._save();
    for (const key of Object.keys(initialState)) {
      this._notify(key);
    }
  }

  // === Private ===

  /** @private */
  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // รวมกับ initialState เผื่อมี key ใหม่
        for (const key of Object.keys(initialState)) {
          if (parsed[key]) {
            this._state[key] = parsed[key];
          }
        }
      }
    } catch (e) {
      console.warn('ไม่สามารถโหลดข้อมูลได้ ใช้ค่าเริ่มต้น:', e);
    }
  }

  /** @private */
  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch (e) {
      console.warn('ไม่สามารถบันทึกข้อมูลได้:', e);
    }
  }

  /**
   * @private
   * @param {string} collection
   */
  _notify(collection) {
    // แจ้ง listener เฉพาะ collection
    const listeners = this._listeners.get(collection) || [];
    for (const fn of listeners) {
      fn(this._state[collection]);
    }
    // แจ้ง listener แบบ wildcard
    const wildcardListeners = this._listeners.get('*') || [];
    for (const fn of wildcardListeners) {
      fn(this._state, collection);
    }
  }

  /**
   * แปลงชื่อ collection เป็นภาษาไทย
   * @private
   * @param {string} collection
   * @returns {string}
   */
  _collectionLabel(collection) {
    const labels = {
      rooms: 'ห้องสอบ',
      proctors: 'ผู้คุมสอบ',
      unavailabilities: 'ช่วงไม่ว่าง',
      sessions: 'รอบสอบ',
      allocations: 'การจัดสรรห้อง',
      assignments: 'การมอบหมาย',
      versions: 'เวอร์ชัน',
    };
    return labels[collection] || collection;
  }
}

/** Singleton Store instance */
export const store = new Store();
