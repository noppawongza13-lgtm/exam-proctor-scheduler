/**
 * ไฟล์การตั้งค่ากฎและข้อจำกัดทั้งหมด (Rule & Constraints Settings)
 * ตามข้อกำหนด 3.7: "ค่ากฎทั้งหมดอยู่ในไฟล์ตั้งค่าเดียว ห้ามฝังตัวเลขในโค้ด"
 */

export const DEFAULT_SETTINGS = {
  // ข้อมูลทั่วไปของโครงการสอบ
  project: {
    name: 'การทดสอบวัดความรู้ความสามารถเฉพาะทางด้วยระบบคอมพิวเตอร์ (CBT)',
    universityName: 'มหาวิทยาลัยราชภัฏบุรีรัมย์',
    universityNameEn: 'Buriram Rajabhat University',
    campusLocation: 'ศูนย์สอบคอมพิวเตอร์ อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์',
    clientOrganization: 'ศูนย์สอบมาตรฐานวิชาการและดิจิทัล มหาวิทยาลัยราชภัฏบุรีรัมย์',
    seed: 42,
  },

  // กฎข้อบังคับเด็ดขาด (Hard Constraints H1-H8)
  hardConstraints: {
    // H1: ไม่จัดผู้คุมคนเดียวกันในเวลาที่ทับซ้อนกัน (รวมเวลา prep และ wrap)
    h1_enforce_no_time_overlap: true,

    // H2: ไม่ใช้ห้องสอบเดียวกันในเวลาที่ทับซ้อนกัน และห้ามเกินความจุ
    h2_enforce_room_capacity_and_overlap: true,

    // H3: ไม่เกินโควต้า
    h3_daily_quota_default: 2,         // โควต้ารอบสูงสุดต่อวัน
    h3_project_quota_default: 6,       // โควต้ารอบสูงสุดต่อโครงการ
    h3_max_hours_default: 18.0,        // จำนวนชั่วโมงสะสมสูงสุดต่อโครงการ

    // H4: ไม่จัดคนในช่วง Unavailability
    h4_enforce_unavailability: true,

    // H5: อัตราส่วนผู้คุมต่อห้อง (ตามบรีฟ: คุมสอบห้องละ 2 คน ยกเว้นห้องใหญ่เกิน 61 คน เช่น 17201 80 ที่นั่ง จะมี 3 คน)
    h5_examinee_threshold_for_two_proctors: 0,    // ทุกห้องคุมสอบห้องละ 2 คน
    h5_examinee_threshold_for_three_proctors: 61, // ห้องที่เกิน 61 คน มีผู้คุม 3 คน
    h5_require_chief_proctor: true,               // ทุกห้องต้องมีหัวหน้าห้อง 1 คน
    h5_require_academic_lead: true,               // กฎข้อ 4: หัวหน้าห้องต้องเป็นอาจารย์สายวิชาการ (Academic Lead)

    // กฎข้อ 2 & ข้อ 3: การเคารพวันสะดวกเฉพาะเจาะจงและรูปแบบกะ
    h4_enforce_explicit_dates: true,              // เคารพวันที่ระบุเจาะจง (Explicit Dates Availability)
    h4_enforce_session_patterns: true,            // เคารพกะ SINGLE_PER_DAY และ FULL_DAY_PAIRED

    // H6: เวลาพักขั้นต่ำระหว่างรอบที่ทำงานติดกัน (นาที) - ค่าเริ่มต้น 0 นาที เพื่อรองรับการคุมสอบเช้า-บ่ายต่อเนื่อง
    h6_min_rest_minutes_between_sessions: 0,

    // H7: ห้องที่มีความต้องการพิเศษ (คอมพิวเตอร์ / รองรับผู้พิการ)
    h7_enforce_special_room_needs: true,
    h7_require_all_computer_rooms: true, // บังคับให้การสอบทั้งหมดต้องจัดในห้องคอมพิวเตอร์เท่านั้น (CBT Mode)

    // H8: ผู้คุมสำรองต่อรอบสอบ (คน) - ค่าเริ่มต้น 0 คน เพื่อให้ตรงกับคำสั่งแต่งตั้ง 21 คน/รอบ (หรือแอดมินปรับได้)
    h8_reserve_proctors_per_session: 0,
    h8_reserve_cannot_be_main: true,

    // กฎ ELMS ข้อ 5: นโยบาย Fallback และการป้องกันการวนซ้ำเกินโควต้า
    h5_fallback_to_senior_support: true,          // หากอาจารย์ไม่พอ อนุญาตให้สายสนับสนุนอาวุโสสูงทำหน้าที่แทน
    h5_prevent_forced_over_quota: true,           // ห้ามจัดเกินโควต้าเด็ดขาด ถ้าคนไม่พอให้ปล่อย Unfilled Slots พร้อมแจ้งเตือน
  },

  // กฎความพึงพอใจและน้ำหนักคะแนน (Soft Constraints S1-S7)
  softWeights: {
    // S1: กระจายจำนวนรอบและชั่วโมงให้ใกล้เคียงกัน (ลดส่วนเบี่ยงเบนมาตรฐาน SD)
    s1_workload_balance: 10,

    // S2: ลดจำนวนวันที่แต่ละคนต้องเดินทางมา (รวมงานในวันเดียวกัน)
    s2_concentrate_days: 8,

    // S3: หลีกเลี่ยงการจัดงานติดกันหลายรอบโดยไม่จำเป็น
    s3_avoid_consecutive: 6,

    // S4: ผู้คุมคนเดิมอยู่ห้องเดิมตลอดทั้งวัน (ลดการสลับห้อง)
    s4_same_room_all_day: 5,

    // S5: ผสมอาจารย์กับเจ้าหน้าที่ในห้องที่ต้องใช้ผู้คุม 2 คน
    s5_mix_faculty_and_staff: 7,

    // S6: ความเป็นธรรมข้ามวัน (คนที่รอบก่อนถูกจัดน้อยกว่า ได้รับความสำคัญก่อน)
    s6_cross_day_fairness: 9,

    // S7: ให้ความสำคัญกับช่วงเวลาที่ผู้คุมระบุว่าสะดวก (Preferred slot)
    s7_preferred_times: 4,
  },

  // การตั้งค่าอัลกอริทึม Solver
  solver: {
    timeoutMs: 30000,                  // ขีดจำกัดเวลา (30 วินาที)
    maxBacktrackDepth: 500,            // จำนวนครั้งสูงสุดในการ backtrack
    randomTieBreaker: true,            // สุ่มกรณีคะแนนเท่ากัน (อิง seed)
  },

  // ค่าเวลามาตรฐานของรอบสอบ
  sessionDefaults: {
    prepMinutes: 30,                   // ผู้คุมต้องมาก่อนสอบ (นาที)
    wrapMinutes: 15,                   // ผู้คุมต้องอยู่หลังสอบเสร็จ (นาที)
  }
};

/**
 * โคลนการตั้งค่าเพื่อไม่ให้กระทบค่าต้นฉบับ
 * @param {typeof DEFAULT_SETTINGS} [customSettings]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function cloneSettings(customSettings = DEFAULT_SETTINGS) {
  return JSON.parse(JSON.stringify(customSettings));
}
