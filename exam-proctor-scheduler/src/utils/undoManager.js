/**
 * undoManager.js — จัดการ Undo/Redo
 * รองรับ 20 ขั้นตอน (ตั้งค่าได้จาก settings)
 * 
 * @module utils/undoManager
 */

/**
 * @typedef {Object} UndoEntry
 * @property {string} description - คำอธิบายการเปลี่ยนแปลง
 * @property {Object} before - snapshot ก่อนเปลี่ยน
 * @property {Object} after - snapshot หลังเปลี่ยน
 * @property {string} timestamp - เวลาที่เปลี่ยน
 */

export class UndoManager {
  /**
   * @param {number} maxSteps - จำนวน undo/redo สูงสุด
   */
  constructor(maxSteps = 20) {
    /** @type {UndoEntry[]} */
    this._undoStack = [];
    /** @type {UndoEntry[]} */
    this._redoStack = [];
    this._maxSteps = maxSteps;
    /** @type {Function[]} */
    this._listeners = [];
  }

  /**
   * บันทึกการเปลี่ยนแปลง
   * @param {string} description - คำอธิบายสั้นๆ
   * @param {Object} before - ค่าก่อนเปลี่ยน
   * @param {Object} after - ค่าหลังเปลี่ยน
   */
  push(description, before, after) {
    this._undoStack.push({
      description,
      before: structuredClone(before),
      after: structuredClone(after),
      timestamp: new Date().toISOString(),
    });

    // จำกัดขนาด stack
    if (this._undoStack.length > this._maxSteps) {
      this._undoStack.shift();
    }

    // เมื่อมี action ใหม่ ล้าง redo stack
    this._redoStack = [];
    this._notify();
  }

  /**
   * Undo — คืนค่าก่อนเปลี่ยน
   * @returns {UndoEntry|null}
   */
  undo() {
    if (this._undoStack.length === 0) return null;
    const entry = this._undoStack.pop();
    this._redoStack.push(entry);
    this._notify();
    return entry;
  }

  /**
   * Redo — ทำซ้ำ
   * @returns {UndoEntry|null}
   */
  redo() {
    if (this._redoStack.length === 0) return null;
    const entry = this._redoStack.pop();
    this._undoStack.push(entry);
    this._notify();
    return entry;
  }

  /** @returns {boolean} */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  canRedo() {
    return this._redoStack.length > 0;
  }

  /** @returns {number} */
  get undoCount() {
    return this._undoStack.length;
  }

  /** @returns {number} */
  get redoCount() {
    return this._redoStack.length;
  }

  /**
   * ดูรายการ undo ล่าสุด (ไม่ลบ)
   * @returns {UndoEntry|null}
   */
  peekUndo() {
    return this._undoStack.length > 0
      ? this._undoStack[this._undoStack.length - 1]
      : null;
  }

  /**
   * ดูรายการ redo ล่าสุด (ไม่ลบ)
   * @returns {UndoEntry|null}
   */
  peekRedo() {
    return this._redoStack.length > 0
      ? this._redoStack[this._redoStack.length - 1]
      : null;
  }

  /** ล้างทั้ง undo และ redo */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._notify();
  }

  /**
   * ลงทะเบียน listener เมื่อ stack เปลี่ยน
   * @param {Function} fn
   * @returns {Function} unsubscribe function
   */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  /** @private */
  _notify() {
    for (const fn of this._listeners) {
      fn({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoCount,
        redoCount: this.redoCount,
        lastUndo: this.peekUndo(),
        lastRedo: this.peekRedo(),
      });
    }
  }
}

/** Singleton instance */
export const undoManager = new UndoManager();
