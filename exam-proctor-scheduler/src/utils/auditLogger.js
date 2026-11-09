/**
 * auditLogger.js — บันทึกการเปลี่ยนแปลงทุกรายการ
 * เก็บใน memory + localStorage
 * 
 * @module utils/auditLogger
 */

import { generateId } from './idGenerator.js';
import { nowISO } from './dateUtils.js';

const STORAGE_KEY = 'examScheduler_auditLog';
const MAX_ENTRIES = 1000; // จำกัดจำนวน log ใน localStorage

/**
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {string} actor
 * @property {string} action
 * @property {string} [entityType]
 * @property {string} [entityId]
 * @property {Object} [before]
 * @property {Object} [after]
 * @property {string} [detail]
 */

class AuditLogger {
  constructor() {
    /** @type {AuditEntry[]} */
    this._entries = [];
    /** @type {Function[]} */
    this._listeners = [];
    this._load();
  }

  /**
   * บันทึก log
   * @param {Object} params
   * @param {string} params.action - การกระทำ เช่น "เพิ่มผู้คุม", "จัดตารางอัตโนมัติ"
   * @param {string} [params.entityType] - ประเภทข้อมูล เช่น "Proctor", "Assignment"
   * @param {string} [params.entityId] - ID ของข้อมูลที่เปลี่ยน
   * @param {Object} [params.before] - ค่าก่อนเปลี่ยน
   * @param {Object} [params.after] - ค่าหลังเปลี่ยน
   * @param {string} [params.detail] - รายละเอียดเพิ่มเติม
   * @param {string} [params.actor] - ผู้กระทำ (demo: "admin")
   */
  log({ action, entityType, entityId, before, after, detail, actor = 'admin' }) {
    const entry = {
      id: generateId(),
      timestamp: nowISO(),
      actor,
      action,
      entityType,
      entityId,
      before: before ? structuredClone(before) : undefined,
      after: after ? structuredClone(after) : undefined,
      detail,
    };

    this._entries.push(entry);

    // จำกัดขนาด
    if (this._entries.length > MAX_ENTRIES) {
      this._entries = this._entries.slice(-MAX_ENTRIES);
    }

    this._save();
    this._notify(entry);
    return entry;
  }

  /**
   * ดึง log ทั้งหมด (เรียงจากใหม่ไปเก่า)
   * @param {Object} [filters]
   * @param {string} [filters.entityType] - กรองตามประเภท
   * @param {string} [filters.entityId] - กรองตาม ID
   * @param {string} [filters.action] - กรองตามการกระทำ
   * @param {string} [filters.fromDate] - กรองจากวันที่
   * @param {string} [filters.toDate] - กรองถึงวันที่
   * @returns {AuditEntry[]}
   */
  getEntries(filters = {}) {
    let entries = [...this._entries];

    if (filters.entityType) {
      entries = entries.filter(e => e.entityType === filters.entityType);
    }
    if (filters.entityId) {
      entries = entries.filter(e => e.entityId === filters.entityId);
    }
    if (filters.action) {
      entries = entries.filter(e => e.action.includes(filters.action));
    }
    if (filters.fromDate) {
      entries = entries.filter(e => e.timestamp >= filters.fromDate);
    }
    if (filters.toDate) {
      entries = entries.filter(e => e.timestamp <= filters.toDate);
    }

    return entries.reverse();
  }

  /**
   * จำนวน log ทั้งหมด
   * @returns {number}
   */
  get count() {
    return this._entries.length;
  }

  /** ล้าง log ทั้งหมด */
  clear() {
    this._entries = [];
    this._save();
    this._notify(null);
  }

  /**
   * ลงทะเบียน listener
   * @param {Function} fn
   * @returns {Function} unsubscribe
   */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  /** @private */
  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this._entries = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('ไม่สามารถโหลด audit log ได้:', e);
      this._entries = [];
    }
  }

  /** @private */
  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._entries));
    } catch (e) {
      console.warn('ไม่สามารถบันทึก audit log ได้:', e);
    }
  }

  /** @private */
  _notify(entry) {
    for (const fn of this._listeners) {
      fn(entry);
    }
  }
}

/** Singleton instance */
export const auditLogger = new AuditLogger();
