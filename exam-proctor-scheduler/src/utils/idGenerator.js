/**
 * idGenerator.js — สร้าง unique ID
 * ใช้ UUID v4 แบบง่าย (ไม่ต้องพึ่ง library ภายนอก)
 * 
 * @module utils/idGenerator
 */

/**
 * สร้าง UUID v4
 * @returns {string}
 */
export function generateId() {
  // ใช้ crypto.randomUUID ถ้ามี (browser สมัยใหม่)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback: สร้างเอง
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * สร้าง short ID (8 ตัวอักษร) สำหรับแสดงผล
 * @returns {string}
 */
export function generateShortId() {
  return generateId().split('-')[0];
}

/**
 * สร้าง deterministic ID จาก seed (สำหรับ seed data)
 * @param {Function} rng - random number generator (seedrandom)
 * @returns {string}
 */
export function generateSeededId(rng) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (rng() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
