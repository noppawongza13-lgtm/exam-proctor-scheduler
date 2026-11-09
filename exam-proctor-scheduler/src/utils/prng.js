/**
 * Mulberry32 PRNG (Pseudo-Random Number Generator)
 * สร้างตัวเลขสุ่มแบบ deterministic ที่ให้ผลลัพธ์เหมือนเดิมทุกครั้งเมื่อใช้ seed เดิม
 */
export class PRNG {
  /**
   * @param {number|string} seed
   */
  constructor(seed = 123456789) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
      }
      this.seed = hash >>> 0;
    } else {
      this.seed = (seed >>> 0) || 123456789;
    }
  }

  /**
   * คืนค่าสุ่มทศนิยมระหว่าง [0, 1)
   * @returns {number}
   */
  next() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * สุ่มเลขจำนวนเต็มระหว่าง [min, max]
   * @param {number} min 
   * @param {number} max 
   * @returns {number}
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * สุ่มเลือกหนึ่งชิ้นจาก array
   * @template T
   * @param {T[]} array 
   * @returns {T}
   */
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * สับเปลี่ยนตำแหน่งใน array (Fisher-Yates shuffle แบบ deterministic)
   * @template T
   * @param {T[]} array 
   * @returns {T[]} อาเรย์ใหม่ที่สับเปลี่ยนแล้ว
   */
  shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
