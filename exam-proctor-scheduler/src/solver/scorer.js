/**
 * ตัวคำนวณคะแนนรวมของ Soft Constraints (Composite Scorer)
 * ตามข้อกำหนด 6.3:
 * "เลือกคนที่ให้คะแนน soft สูงสุด โดยถ่วงน้ำหนักตาม Settings"
 */

import {
  scoreS1_WorkloadBalance,
  scoreS2_ConcentrateDays,
  scoreS3_AvoidConsecutive,
  scoreS4_SameRoom,
  scoreS5_MixFacultyAndStaff,
  scoreS6_CrossDayFairness
} from '../rules/soft-constraints.js';

/**
 * คำนวณคะแนนรวมและแยกรายข้อสำหรับผู้คุมที่กำลังพิจารณา
 * @param {Object} params
 * @param {import('../data/models.js').Proctor} params.proctor
 * @param {import('../data/models.js').ExamSession} params.session
 * @param {import('../data/models.js').RoomAllocation} [params.allocation]
 * @param {import('../data/models.js').Proctor[]} params.roomPartners
 * @param {Map<string, number>} params.proctorAssignmentCounts
 * @param {Map<string, Set<string>>} params.proctorWorkedDates
 * @param {Map<string, Map<string, string>>} params.proctorDateRooms
 * @param {boolean} params.isDirectlyConsecutive
 * @param {number} params.totalSessions
 * @param {number} params.totalProctors
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} params.settings
 * @returns {{ totalScore: number, breakdown: Object<string, number> }}
 */
export function calculateCandidateScore({
  proctor,
  session,
  allocation,
  roomPartners = [],
  proctorAssignmentCounts,
  proctorWorkedDates,
  proctorDateRooms,
  isDirectlyConsecutive,
  totalSessions,
  totalProctors,
  settings
}) {
  const weights = settings.softWeights;

  // S1: กระจายภาระงาน
  const s1 = scoreS1_WorkloadBalance(proctor.id, proctorAssignmentCounts, totalSessions, totalProctors);

  // S2: รวมงานในวันเดียว
  const s2 = scoreS2_ConcentrateDays(proctor.id, session.date, proctorWorkedDates);

  // S3: หลีกเลี่ยงติดกัน
  const s3 = scoreS3_AvoidConsecutive(isDirectlyConsecutive);

  // S4: อยู่ห้องเดิม
  const s4 = allocation ? scoreS4_SameRoom(proctor.id, allocation.roomId, session.date, proctorDateRooms) : 0.5;

  // S5: ผสมอาจารย์/เจ้าหน้าที่
  const s5 = scoreS5_MixFacultyAndStaff(proctor, roomPartners);

  // S6: ความเป็นธรรมข้ามวัน
  const s6 = scoreS6_CrossDayFairness(proctor.id, proctorAssignmentCounts);

  const breakdown = {
    s1_workload: s1 * weights.s1_workload_balance,
    s2_concentrate: s2 * weights.s2_concentrate_days,
    s3_consecutive: s3 * weights.s3_avoid_consecutive,
    s4_same_room: s4 * weights.s4_same_room_all_day,
    s5_mix: s5 * weights.s5_mix_faculty_and_staff,
    s6_fairness: s6 * weights.s6_cross_day_fairness
  };

  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { totalScore, breakdown };
}
