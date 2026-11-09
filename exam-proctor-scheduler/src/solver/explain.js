/**
 * ตัวสร้างคำอธิบายเหตุผลการจัดตาราง (Explainability Engine)
 * ตามข้อกำหนด 6.5:
 * "ทุกการจัดต้องบันทึก 'เหตุผลสั้นๆ' เช่น 'คะแนนความเป็นธรรมสูงสุดในบรรดาคนว่าง 7 คน'
 * เพื่อตอบคำถาม 'ทำไมจัดคนนี้' ได้"
 */

/**
 * สร้างคำอธิบายสั้นๆ เป็นภาษาไทยว่าทำไมถึงจัดผู้คุมคนนี้ใน slot ดังกล่าว
 * @param {Object} params
 * @param {import('../data/models.js').Proctor} params.proctor
 * @param {number} params.candidatePoolSize - จำนวนคนว่างที่ผ่าน hard constraint ทั้งหมดใน slot นี้
 * @param {number} params.score - คะแนนรวมที่ได้
 * @param {Object<string, number>} params.breakdown - คะแนนแยกรายข้อ
 * @param {string} params.role - 'chief' | 'proctor' | 'reserve'
 * @param {boolean} [params.isLocked=false]
 * @returns {string}
 */
export function generateAssignmentReason({
  proctor,
  candidatePoolSize,
  score,
  breakdown,
  role,
  isLocked = false
}) {
  if (isLocked) {
    return 'ผู้ใช้ล็อกการมอบหมายนี้ไว้ด้วยตนเอง';
  }

  const roleText = role === 'chief' ? 'หัวหน้าห้อง' : (role === 'reserve' ? 'ผู้คุมสำรอง' : 'ผู้คุมร่วม');

  // หาจุดเด่นที่สุดของคะแนน (Top factor)
  let topFactor = '';
  let maxFactorVal = -1;

  if (breakdown) {
    const factorNames = {
      s1_workload: 'กระจายภาระงานสม่ำเสมอที่สุด',
      s2_concentrate: 'รวมงานในวันเดียวกันเพื่อลดการเดินทาง',
      s3_consecutive: 'มีช่วงพักสบายไม่ติดกัน',
      s4_same_room: 'อยู่ห้องเดิมต่อเนื่องตลอดวัน',
      s5_mix: 'ผสมผสานอาจารย์และเจ้าหน้าที่เหมาะสม',
      s6_fairness: 'ได้คะแนนความเป็นธรรมสะสมสูงสุด'
    };

    for (const [k, val] of Object.entries(breakdown)) {
      if (val > maxFactorVal) {
        maxFactorVal = val;
        topFactor = factorNames[k] || '';
      }
    }
  }

  if (candidatePoolSize <= 1) {
    return `เป็นผู้คุมระดับ ${roleText} เพียงท่านเดียวที่ว่างและผ่านเกณฑ์ในรอบนี้`;
  }

  if (topFactor) {
    return `คะแนนรวมสูงสุด (${score.toFixed(1)} คะแนน) จากผู้มีคุณสมบัติ ${candidatePoolSize} คน (${topFactor})`;
  }

  return `คะแนนความเหมาะสมสูงสุด (${score.toFixed(1)} คะแนน) จากคนว่างทั้งหมด ${candidatePoolSize} คน`;
}
