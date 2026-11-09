/**
 * ตัวสร้างข้อมูลจำลอง (Reproducible Seed Data Generator)
 * ตามข้อกำหนด 4:
 * - ใช้ seed เดิมแล้วผลเหมือนเดิมทุกครั้ง
 * - ปรับขนาดผู้คุมได้ (20, 40, 80, หรือกำหนดเอง)
 * - ชื่อ-นามสกุลไทยสมมติ (ไม่ใช่บุคคลจริง)
 * - มีชุดข้อมูล stress case
 */

import { PRNG } from '../utils/prng.js';
import { toBangkokISO } from '../utils/thai-date.js';
import { DEFAULT_SETTINGS } from './settings.js';

// รายการชื่อ-นามสกุลไทยสมมติ (สร้างจากคำมงคล/คำทั่วไป ไม่ซ้ำบุคคลจริง)
const FIRST_NAMES = [
  'กิตติศักดิ์', 'ขวัญชัย', 'จิราพร', 'ฉัตรชัย', 'ชลธิชา',
  'ฐิติมา', 'ณัฐพงษ์', 'ดนัย', 'ทศพร', 'ธนากร',
  'นภัสสร', 'ปิยะวัฒน์', 'พงศกร', 'ภัทรดนัย', 'มนัสวี',
  'ยุวดี', 'รังสรรค์', 'ลลิตา', 'วรวิทย์', 'ศิริพร',
  'สมศักดิ์', 'อนันต์', 'อารียา', 'เอกชัย', 'กมลชนก',
  'จิรวัฒน์', 'ชนินทร์', 'ดารินทร์', 'ทรงพล', 'ธวัลรัตน์',
  'นฤมล', 'ปวริศา', 'พิชญุตม์', 'ภาสกร', 'มรกต',
  'รัชกฤช', 'วราภรณ์', 'ศุภกิตติ์', 'สุรชัย', 'อดิศักดิ์'
];

const LAST_NAMES = [
  'เจริญสุข', 'พัฒนาวงศ์', 'เลิศวิริยะ', 'สิริวัฒนา', 'มงคลรัตน์',
  'ประเสริฐผล', 'จงบริบูรณ์', 'ทรัพย์มหาศาล', 'วิทยากร', 'รุ่งเรืองกิจ',
  'ธนารักษ์', 'บุญญานุรักษ์', 'เกษมสุข', 'วัฒนเมธี', 'อัครเดชากร',
  'บริสุทธิ์', 'พรหมมินทร์', 'ศิริโภคิน', 'ชัยสิทธิ์', 'วรปรีชา',
  'พงษ์วิเศษ', 'สุวรรณรัตน์', 'เกียรติบวร', 'อุดมโภคัย', 'นวคุณากูล'
];

const DEPARTMENTS_FACULTY = [
  'คณะวิทยาศาสตร์และเทคโนโลยี',
  'คณะวิศวกรรมศาสตร์',
  'คณะบริหารธุรกิจและการบัญชี',
  'คณะมนุษยศาสตร์และสังคมศาสตร์',
  'คณะนิติศาสตร์',
  'คณะครุศาสตร์และศึกษาศาสตร์'
];

const DEPARTMENTS_STAFF = [
  'กองบริหารงานวิชาการและการสอบ',
  'สำนักบริการคอมพิวเตอร์',
  'กองกิจการนักศึกษา',
  'สำนักงานอธิการบดี',
  'สำนักวิทยบริการและหอสมุด',
  'กองอาคารสถานที่และยานพาหนะ'
];

// รายชื่อบุคลากรจริงจากคำสั่งแต่งตั้งกรรมการกำกับการสอบ ก.พ. ๒๕๖๙ มหาวิทยาลัยราชภัฏบุรีรัมย์ (42 ท่าน)
export const REAL_BRU_PERSONNEL = [
  // --- 28 อาจารย์ (สายวิชาการ / หัวหน้าห้อง Chief) ---
  { id: 'P001', academicTitle: 'ผศ.ดร.', firstName: 'เลอสันต์', lastName: 'ฤทธิขันธ์', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'leosan.r@bru.ac.th', phone: '081-423-8912', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P002', academicTitle: 'อาจารย์', firstName: 'ชลัท', lastName: 'รังสิมาเทวัญ', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะมนุษยศาสตร์และสังคมศาสตร์', email: 'chalat.r@bru.ac.th', phone: '089-712-3401', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P003', academicTitle: 'ผศ.ดร.', firstName: 'นิธิโรจน์', lastName: 'ศุภกฤษสุวรรณกุล', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะวิทยาการจัดการ', email: 'nithiroj.s@bru.ac.th', phone: '086-554-1290', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P004', academicTitle: 'อาจารย์', firstName: 'ปิติวรรณ', lastName: 'ฝ้ายโคกสูง', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะครุศาสตร์', email: 'pitiwan.f@bru.ac.th', phone: '084-332-9871', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P005', academicTitle: 'อาจารย์ ดร.', firstName: 'ณปภัช', lastName: 'วรรณตรง', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาการจัดการ', email: 'napaphat.w@bru.ac.th', phone: '087-891-2345', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-27'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P006', academicTitle: 'อาจารย์', firstName: 'นพพล', lastName: 'เชาวนกุล', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะเทคโนโลยีอุตสาหกรรม', email: 'nopphol.c@bru.ac.th', phone: '083-221-8765', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P007', academicTitle: 'อาจารย์ ดร.', firstName: 'ชูศักดิ์', lastName: 'ยาทองไชย', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'choosak.y@bru.ac.th', phone: '081-998-3214', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P008', academicTitle: 'ผศ.', firstName: 'วรินทร์พิพัชร', lastName: 'วัชรพงษ์เกษม', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะเทคโนโลยีการเกษตร', email: 'warinpipat.w@bru.ac.th', phone: '085-443-6789', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P009', academicTitle: 'อาจารย์', firstName: 'คธาวุฒิ', lastName: 'จันบัวลา', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'khatawut.j@bru.ac.th', phone: '088-776-5432', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P010', academicTitle: 'ผศ.ดร.', firstName: 'กมลรัตน์', lastName: 'สมใจ', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะครุศาสตร์', email: 'kamolrat.s@bru.ac.th', phone: '082-114-5678', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-27'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P011', academicTitle: 'ผศ.ดร.', firstName: 'วิไลรัตน์', lastName: 'ยาทองไชย', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'wilairat.y@bru.ac.th', phone: '089-335-7890', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-27'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P012', academicTitle: 'อาจารย์', firstName: 'เก่ง', lastName: 'จันทร์นวล', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะมนุษยศาสตร์และสังคมศาสตร์', email: 'keng.j@bru.ac.th', phone: '084-556-7812', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P013', academicTitle: 'อาจารย์', firstName: 'พิชิต', lastName: 'วันดี', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'pichit.w@bru.ac.th', phone: '081-778-9023', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P014', academicTitle: 'อาจารย์', firstName: 'สกรณ์', lastName: 'บุษบง', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาการจัดการ', email: 'sakorn.b@bru.ac.th', phone: '086-443-2198', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'ANY' },
  { id: 'P015', academicTitle: 'ผศ.ดร.', firstName: 'เปรม', lastName: 'อิงคเวชชากุล', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะครุศาสตร์', email: 'prem.i@bru.ac.th', phone: '083-998-1245', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'ANY' },
  { id: 'P016', academicTitle: 'อาจารย์ ดร.', firstName: 'โยธิน', lastName: 'จ่าแท่นทะรังค์', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาการจัดการ', email: 'yothin.j@bru.ac.th', phone: '087-332-1109', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P017', academicTitle: 'อาจารย์', firstName: 'ปุริม', lastName: 'ชฏารัตนฐิติ', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะเทคโนโลยีอุตสาหกรรม', email: 'purim.c@bru.ac.th', phone: '085-667-8934', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'ANY' },
  { id: 'P018', academicTitle: 'อาจารย์', firstName: 'วิทวัส', lastName: 'สหวงษ์', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะมนุษยศาสตร์และสังคมศาสตร์', email: 'witthawat.s@bru.ac.th', phone: '088-223-4567', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'ANY' },
  { id: 'P019', academicTitle: 'ผศ.', firstName: 'พงษ์พัฒน์', lastName: 'สมใจ', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะครุศาสตร์', email: 'pongpat.s@bru.ac.th', phone: '082-998-7654', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P020', academicTitle: 'อาจารย์', firstName: 'นิธินันท์', lastName: 'มาตา', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาการจัดการ', email: 'nithinun.m@bru.ac.th', phone: '084-112-3498', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P021', academicTitle: 'อาจารย์', firstName: 'สมพร', lastName: 'กระออมแก้ว', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'somporn.k@bru.ac.th', phone: '081-334-5566', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P022', academicTitle: 'อาจารย์ ดร.', firstName: 'บรรพต', lastName: 'วงศ์ทองเจริญ', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะเทคโนโลยีอุตสาหกรรม', email: 'banpot.w@bru.ac.th', phone: '086-778-9900', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P023', academicTitle: 'ผศ.ดร.', firstName: 'อนล', lastName: 'สวนประดิษฐ์', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะวิทยาการจัดการ', email: 'onol.s@bru.ac.th', phone: '089-223-1144', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P024', academicTitle: 'อาจารย์', firstName: 'กรนาริน', lastName: 'สาริยา', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะมนุษยศาสตร์และสังคมศาสตร์', email: 'kornnarin.s@bru.ac.th', phone: '083-445-6677', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P025', academicTitle: 'อาจารย์', firstName: 'ศิโรรัตน์', lastName: 'สายปัญญา', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะพยาบาลศาสตร์', email: 'sirorat.s@bru.ac.th', phone: '087-556-7788', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P026', academicTitle: 'อาจารย์', firstName: 'จิรวดี', lastName: 'โยยรัมย์', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะครุศาสตร์', email: 'jirawadee.y@bru.ac.th', phone: '085-112-9900', projectQuota: 2, dailyQuota: 2, availableDates: ['2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P027', academicTitle: 'อาจารย์ ดร.', firstName: 'แสงดาว', lastName: 'นพพิทักษ์', proctorType: 'faculty', level: 'chief', seniorityRank: 7, department: 'คณะวิทยาศาสตร์และเทคโนโลยี', email: 'saengdao.n@bru.ac.th', phone: '088-334-2211', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P028', academicTitle: 'ผศ.ดร.', firstName: 'อัศวิน', lastName: 'วงศ์ปรเมษฐ์', proctorType: 'faculty', level: 'chief', seniorityRank: 8, department: 'คณะวิทยาการจัดการ', email: 'assawin.w@bru.ac.th', phone: '082-778-5533', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },

  // --- 14 เจ้าหน้าที่ (เจ้าหน้าที่ศูนย์คอมพิวเตอร์ / สำนักบริการคอมพิวเตอร์ / สนับสนุน) ---
  { id: 'P029', academicTitle: 'นาย', firstName: 'ยุทธนา', lastName: 'อาจทวีกุล', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'yutthana.a@bru.ac.th', phone: '081-667-8899', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P030', academicTitle: 'นาย', firstName: 'พัฒนพงษ์', lastName: 'จงปัตนา', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'pattanapong.j@bru.ac.th', phone: '084-223-1155', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P031', academicTitle: 'นาย', firstName: 'สนทนา', lastName: 'สัตตารัมย์', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'sontana.s@bru.ac.th', phone: '086-889-4422', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P032', academicTitle: 'นางสาว', firstName: 'วีราพัชร์', lastName: 'ปุญญพัฒนศิริ', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'กองบริหารงานวิชาการและการสอบ', email: 'veeraphat.p@bru.ac.th', phone: '089-112-8877', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P033', academicTitle: 'นาย', firstName: 'อดิสรณ์', lastName: 'แก้วดวง', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'adisorn.k@bru.ac.th', phone: '083-556-9911', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P034', academicTitle: 'นาย', firstName: 'รักเกียรติ', lastName: 'เสาร์วงศ์', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'rakkiat.s@bru.ac.th', phone: '087-443-6688', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P035', academicTitle: 'นาย', firstName: 'ฐาปกรณ์', lastName: 'เสียงวังเวง', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'thapakorn.s@bru.ac.th', phone: '085-778-3344', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P036', academicTitle: 'นาย', firstName: 'ปณวัชร์', lastName: 'อะโรคา', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'panawat.a@bru.ac.th', phone: '088-990-1122', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P037', academicTitle: 'นาย', firstName: 'วัชรินทร์', lastName: 'เมื่อประโคน', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'watcharin.m@bru.ac.th', phone: '082-334-5599', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P038', academicTitle: 'นาย', firstName: 'อาณัติ', lastName: 'กัมรัมย์', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'anat.k@bru.ac.th', phone: '081-223-7766', projectQuota: 6, dailyQuota: 2, availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P039', academicTitle: 'นาย', firstName: 'ศิธศักดิ์', lastName: 'สมพร', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'กองบริหารงานวิชาการและการสอบ', email: 'sithasak.s@bru.ac.th', phone: '086-119-4433', projectQuota: 4, dailyQuota: 2, availableDates: ['2026-03-28', '2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P040', academicTitle: 'นาย', firstName: 'พรพิสุทธิ์', lastName: 'ธิราช', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'pornpisut.t@bru.ac.th', phone: '089-887-2211', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-29'], sessionPattern: 'FULL_DAY_PAIRED' },
  { id: 'P041', academicTitle: 'นาย', firstName: 'อภิสิทธิ์ธำรง', lastName: 'แสงเสดาะ', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'aphisit.s@bru.ac.th', phone: '084-776-3399', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-29'], sessionPattern: 'ANY' },
  { id: 'P042', academicTitle: 'นาย', firstName: 'ธนกฤต', lastName: 'ทะนวนรัมย์', proctorType: 'staff', level: 'assistant', seniorityRank: 4, department: 'สำนักบริการคอมพิวเตอร์', email: 'thanakrit.t@bru.ac.th', phone: '087-665-2200', projectQuota: 3, dailyQuota: 2, availableDates: ['2026-03-29'], sessionPattern: 'ANY' },
];

// ข้อมูลห้องสอบจริงจากสนามสอบ (ภาพผังห้องสอบจริง 10 ห้อง 520 ที่นั่ง อาคาร 17)
export const REAL_EXAM_ROOM_CONFIGS = [
  {
    roomNumber: 1,
    code: '17108',
    officialName: 'วินิตปัญญา 5',
    name: 'ห้องสอบที่ 1 (17108 - วินิตปัญญา 5)',
    building: 'อาคาร 17',
    floor: 1,
    capacity: 40,
    seatStart: 1,
    seatEnd: 40,
    roomType: 'computer',
    accessibleForDisabled: true,
    doorPosition: 'front-both', // ประตู 2 บาน ซ้าย-ขวา ด้านหน้า
    layoutType: 'grid-columns', // 4 คอลัมน์ แถวละ 10
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 1 ฝั่งปีกตะวันตก รองรับการสอบ CBT',
    airConditioners: 4,
    cctvCount: 2,
    doors: 'ประตูหน้าห้อง 2 บาน (ซ้าย-ขวา)',
    accessibilityNote: 'รองรับผู้พิการ (ทางลาดเข้าอาคารชั้น 1, ใกล้ห้องน้ำคนพิการ 17112)',
    nearby: ['ห้องน้ำคนพิการ (17112)', 'บันไดกลาง', 'ลิฟต์โดยสาร'],
    wing: 'ปีกตะวันตก (West Wing)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[1,2,3,4,5,6,7,8,9,10], [11,12,13,14,15,16,17,18,19,20]] },
      { name: 'บล็อกขวา (แถว 3-4)', columns: [[21,22,23,24,25,26,27,28,29,30], [31,32,33,34,35,36,37,38,39,40]] }
    ]
  },
  {
    roomNumber: 2,
    code: '17109',
    officialName: 'วินิตปัญญา 6',
    name: 'ห้องสอบที่ 2 (17109 - วินิตปัญญา 6)',
    building: 'อาคาร 17',
    floor: 1,
    capacity: 60,
    seatStart: 41,
    seatEnd: 100,
    roomType: 'computer',
    accessibleForDisabled: true,
    doorPosition: 'front-both',
    layoutType: 'grid-columns', // 6 คอลัมน์ แถวละ 10
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ขนาดใหญ่ อาคาร 17 ชั้น 1 ระเบียงทิศเหนือ ติดห้อง 17110',
    airConditioners: 6,
    cctvCount: 2,
    doors: 'ประตูหน้าห้อง 2 บาน (ซ้าย-ขวา)',
    accessibilityNote: 'รองรับผู้พิการ ชั้น 1 ทางเดินเรียบ เข้าถึงสะดวก',
    nearby: ['ติดห้อง 17110', 'ตรงข้ามโถงกลาง', 'ใกล้บันไดกลาง'],
    wing: 'ระเบียงทิศเหนือ (North Corridor)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[41,42,43,44,45,46,47,48,49,50], [51,52,53,54,55,56,57,58,59,60]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[61,62,63,64,65,66,67,68,69,70], [71,72,73,74,75,76,77,78,79,80]] },
      { name: 'บล็อกขวา (แถว 5-6)', columns: [[81,82,83,84,85,86,87,88,89,90], [91,92,93,94,95,96,97,98,99,100]] }
    ]
  },
  {
    roomNumber: 3,
    code: '17110',
    officialName: 'วินิตปัญญา 7',
    name: 'ห้องสอบที่ 3 (17110 - วินิตปัญญา 7)',
    building: 'อาคาร 17',
    floor: 1,
    capacity: 60,
    seatStart: 101,
    seatEnd: 160,
    roomType: 'computer',
    accessibleForDisabled: false,
    doorPosition: 'front-both',
    layoutType: 'grid-columns',
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ขนาดใหญ่ อาคาร 17 ชั้น 1 ระเบียงทิศเหนือ (ระหว่างห้อง 17109 และ 17111)',
    airConditioners: 6,
    cctvCount: 2,
    doors: 'ประตูหน้าห้อง 2 บาน (ซ้าย-ขวา)',
    accessibilityNote: 'ชั้น 1 ทางเดินเรียบเข้าถึงสะดวก',
    nearby: ['อยู่ระหว่างห้อง 17109 และ 17111', 'ตรงข้ามโถงกลาง'],
    wing: 'ระเบียงทิศเหนือ (North Corridor)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[101,102,103,104,105,106,107,108,109,110], [111,112,113,114,115,116,117,118,119,120]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[121,122,123,124,125,126,127,128,129,130], [131,132,133,134,135,136,137,138,139,140]] },
      { name: 'บล็อกขวา (แถว 5-6)', columns: [[141,142,143,144,145,146,147,148,149,150], [151,152,153,154,155,156,157,158,159,160]] }
    ]
  },
  {
    roomNumber: 4,
    code: '17111',
    officialName: 'วินิตปัญญา 8',
    name: 'ห้องสอบที่ 4 (17111 - วินิตปัญญา 8)',
    building: 'อาคาร 17',
    floor: 1,
    capacity: 50,
    seatStart: 161,
    seatEnd: 210,
    roomType: 'computer',
    accessibleForDisabled: true,
    doorPosition: 'front-both',
    layoutType: 'grid-columns',
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 1 มุมทิศเหนือ ใกล้ทางเชื่อมโถงกลมและห้องน้ำคนพิการ',
    airConditioners: 5,
    cctvCount: 2,
    doors: 'ประตูหน้าห้อง 2 บาน (ซ้าย-ขวา)',
    accessibilityNote: 'ติดกับห้องน้ำคนพิการ (17112) และใกล้ลิฟต์โดยสารมากที่สุด',
    nearby: ['ห้องน้ำคนพิการ (17112)', 'ห้องน้ำทั่วไป', 'ลิฟต์โดยสาร', 'บันไดขึ้นชั้น 2'],
    wing: 'ระเบียงทิศเหนือ ฝั่งโถงกลม (East Hub)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[161,162,163,164,165,166,167,168,169,170], [171,172,173,174,175,176,177,178,179,180]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[181,182,183,184,185,186,187,188,189,190], [191,192,193,194,195,196,197,198,199,200]] },
      { name: 'บล็อกขวา (แถว 5)', columns: [[201,202,203,204,205,206,207,208,209,210]] }
    ]
  },
  {
    roomNumber: 5,
    code: '17201',
    officialName: 'ห้องประชุมหงส์พันธ์',
    name: 'ห้องสอบที่ 5 (17201 - ห้องประชุมหงส์พันธ์)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 80,
    seatStart: 211,
    seatEnd: 290,
    roomType: 'computer',
    accessibleForDisabled: true,
    doorPosition: 'right-side-two', // ประตู 2 บานด้านขวาเฉียง
    layoutType: 'trapezoid-rows', // 6 แถวขยายออก
    description: 'ห้องประชุมบรรยายแบบขั้นบันไดสโลปใหญ่ทรงพัด อาคาร 17 ชั้น 2 ฝั่งโถงกลมตะวันออก',
    airConditioners: 8,
    cctvCount: 4,
    doors: 'ประตูทางเข้าด้านข้าง 2 บาน (ฝั่งขวาเฉียง)',
    accessibilityNote: 'มีลิฟต์ขึ้นชั้น 2 และมีที่นั่งระดับพื้นแถวหน้าสุดสำหรับวีลแชร์',
    nearby: ['ติดห้องประชุมเจริญพันธุวงศ์ (17202)', 'โถงบันไดวน', 'ลิฟต์โดยสาร'],
    wing: 'โถงอาคารวงกลม (East Circular Wing)',
    rows: [
      { rowNum: 1, left: [211,212,213,214], right: [215,216,217,218] },
      { rowNum: 2, left: [219,220,221,222,223], right: [224,225,226,227,228] },
      { rowNum: 3, left: [229,230,231,232,233,234], right: [235,236,237,238,239,240] },
      { rowNum: 4, left: [241,242,243,244,245,246,247], right: [248,249,250,251,252,253,254] },
      { rowNum: 5, left: [255,256,257,258,259,260,261,262], right: [263,264,265,266,267,268,269,270] },
      { rowNum: 6, left: [271,272,273,274,275,276,277,278,279,280], right: [281,282,283,284,285,286,287,288,289,290] }
    ]
  },
  {
    roomNumber: 6,
    code: '17205',
    officialName: 'สุตปัญญา',
    name: 'ห้องสอบที่ 6 (17205 - สุตปัญญา)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 40,
    seatStart: 291,
    seatEnd: 330,
    roomType: 'computer',
    accessibleForDisabled: false,
    doorPosition: 'right-side-two', // ประตู 2 บานด้านขวา
    layoutType: 'staggered-rows', // 6 แถว แนวนอน: แถว 1 ขวา 4, แถว 2-5 ซ้าย 4 ขวา 4, แถว 6 ซ้าย 4
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 2 ระเบียงทิศใต้ ผังสับหว่าง 40 ที่นั่ง',
    airConditioners: 4,
    cctvCount: 2,
    doors: 'ประตูด้านข้าง 2 บาน (ฝั่งขวา)',
    accessibilityNote: 'ขึ้นลิฟต์ชั้น 2 เดินผ่านโถงกลาง',
    nearby: ['ติดห้องประชุมวงษ์แก้ว (17206)', 'ห้องควบคุม (17204)', 'บันไดกลาง'],
    wing: 'ระเบียงทิศใต้ (South Corridor)',
    rows: [
      { rowNum: 1, left: null, right: [291, 292, 293, 294] },
      { rowNum: 2, left: [295, 296, 297, 298], right: [299, 300, 301, 302] },
      { rowNum: 3, left: [303, 304, 305, 306], right: [307, 308, 309, 310] },
      { rowNum: 4, left: [311, 312, 313, 314], right: [315, 316, 317, 318] },
      { rowNum: 5, left: [319, 320, 321, 322], right: [323, 324, 325, 326] },
      { rowNum: 6, left: [327, 328, 329, 330], right: null }
    ]
  },
  {
    roomNumber: 7,
    code: '17206',
    officialName: 'ห้องประชุมวงษ์แก้ว',
    name: 'ห้องสอบที่ 7 (17206 - ห้องประชุมวงษ์แก้ว)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 40,
    seatStart: 331,
    seatEnd: 370,
    roomType: 'computer',
    accessibleForDisabled: false,
    doorPosition: 'right-side-two', // ประตู 2 บานด้านขวา
    layoutType: 'grid-rows', // 5 แถว แนวนอน 8 ที่นั่ง
    description: 'ห้องประชุม/ปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 2 ระเบียงทิศใต้ ผัง 5 แถวแนวนอน',
    airConditioners: 4,
    cctvCount: 2,
    doors: 'ประตูด้านข้าง 2 บาน (ฝั่งขวา)',
    accessibilityNote: 'ขึ้นลิฟต์ชั้น 2 ทางเดินเรียบ',
    nearby: ['ติดห้องสุตปัญญา (17205)', 'ตรงข้ามห้อง 17211', 'บันไดกลาง'],
    wing: 'ระเบียงทิศใต้ (South Corridor)',
    rows: [
      { rowNum: 1, left: [331,332,333,334], right: [335,336,337,338] },
      { rowNum: 2, left: [339,340,341,342], right: [343,344,345,346] },
      { rowNum: 3, left: [347,348,349,350], right: [351,352,353,354] },
      { rowNum: 4, left: [355,356,357,358], right: [359,360,361,362] },
      { rowNum: 5, left: [363,364,365,366], right: [367,368,369,370] }
    ]
  },
  {
    roomNumber: 8,
    code: '17211',
    officialName: 'จิตตปัญญา 1',
    name: 'ห้องสอบที่ 8 (17211 - จิตตปัญญา 1)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 50,
    seatStart: 371,
    seatEnd: 420,
    roomType: 'computer',
    accessibleForDisabled: false,
    doorPosition: 'right-side-two', // ประตู 2 บานด้านขวา
    layoutType: 'grid-columns', // 6 คอลัมน์ 8-9 แถว
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 2 ระเบียงทิศเหนือ ติดห้อง 17212',
    airConditioners: 5,
    cctvCount: 2,
    doors: 'ประตูด้านข้าง 2 บาน (ฝั่งขวา)',
    accessibilityNote: 'ขึ้นลิฟต์ชั้น 2 ใกล้บันไดหนีไฟ',
    nearby: ['ติดห้องจิตตปัญญา 2 (17212)', 'ตรงข้ามห้อง 17206', 'บันไดกลาง'],
    wing: 'ระเบียงทิศเหนือ (North Corridor)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[371,372,373,374,375,376,377,378], [379,380,381,382,383,384,385,386]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[387,388,389,390,391,392,393,394,395], [396,397,398,399,400,401,402,403,404]] },
      { name: 'บล็อกขวา (แถว 5-6)', columns: [[405,406,407,408,409,410,411,412], [413,414,415,416,417,418,419,420]] }
    ]
  },
  {
    roomNumber: 9,
    code: '17212',
    officialName: 'จิตตปัญญา 2',
    name: 'ห้องสอบที่ 9 (17212 - จิตตปัญญา 2)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 52,
    seatStart: 421,
    seatEnd: 472,
    roomType: 'computer',
    accessibleForDisabled: false,
    doorPosition: 'left-side-two', // ประตู 2 บานด้านซ้าย
    layoutType: 'grid-columns', // 6 คอลัมน์
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 2 ระเบียงทิศเหนือ (ระหว่างห้อง 17211 และ 17213)',
    airConditioners: 5,
    cctvCount: 2,
    doors: 'ประตูด้านข้าง 2 บาน (ฝั่งซ้าย)',
    accessibilityNote: 'ขึ้นลิฟต์ชั้น 2 ทางเดินเรียบ',
    nearby: ['อยู่ระหว่างห้อง 17211 และ 17213', 'ตรงข้ามโถงกลาง'],
    wing: 'ระเบียงทิศเหนือ (North Corridor)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[421,422,423,424,425,426,427,428,429], [430,431,432,433,434,435,436,437,438]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[439,440,441,442,443,444,445,446], [447,448,449,450,451,452,453,454]] },
      { name: 'บล็อกขวา (แถว 5-6)', columns: [[455,456,457,458,459,460,461,462,463], [464,465,466,467,468,469,470,471,472]] }
    ]
  },
  {
    roomNumber: 10,
    code: '17213',
    officialName: 'จิตตปัญญา 3',
    name: 'ห้องสอบที่ 10 (17213 - จิตตปัญญา 3)',
    building: 'อาคาร 17',
    floor: 2,
    capacity: 48,
    seatStart: 473,
    seatEnd: 520,
    roomType: 'computer',
    accessibleForDisabled: true,
    doorPosition: 'left-side-two', // ประตู 2 บานด้านซ้าย
    layoutType: 'grid-columns', // 6 คอลัมน์ แถวละ 8
    description: 'ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น 2 ระเบียงทิศเหนือ ติดห้องน้ำคนพิการ (17214)',
    airConditioners: 5,
    cctvCount: 2,
    doors: 'ประตูด้านข้าง 2 บาน (ฝั่งซ้าย)',
    accessibilityNote: 'ติดกับห้องน้ำคนพิการ (17214) และใกล้ลิฟต์โดยสารมากที่สุด',
    nearby: ['ห้องน้ำคนพิการ (17214)', 'ห้องน้ำทั่วไป', 'ลิฟต์โดยสาร', 'บันไดขึ้นลง'],
    wing: 'ระเบียงทิศเหนือ ฝั่งโถงกลม (East Hub)',
    blocks: [
      { name: 'บล็อกซ้าย (แถว 1-2)', columns: [[473,474,475,476,477,478,479,480], [481,482,483,484,485,486,487,488]] },
      { name: 'บล็อกกลาง (แถว 3-4)', columns: [[489,490,491,492,493,494,495,496], [497,498,499,500,501,502,503,504]] },
      { name: 'บล็อกขวา (แถว 5-6)', columns: [[505,506,507,508,509,510,511,512], [513,514,515,516,517,518,519,520]] }
    ]
  }
];

// ข้อมูล Directory และผังอาคาร 17 ครบทุกห้องตามภาพถ่ายป้ายบอกทางจริง
export const BUILDING_17_DIRECTORY = {
  floor1: [
    { code: '17101', name: 'นิทัศนปัญญา', type: 'hall', isExamRoom: false, desc: 'โถงนิทรรศการและกิจกรรม' },
    { code: '17102', name: 'นันทนปัญญา 1', type: 'activity', isExamRoom: false, desc: 'ห้องกิจกรรมและสันทนาการ 1' },
    { code: '17103', name: 'นันทนปัญญา 2', type: 'activity', isExamRoom: false, desc: 'ห้องกิจกรรมและสันทนาการขนาดใหญ่' },
    { code: '17104', name: 'วินิตปัญญา 1', type: 'classroom', isExamRoom: false, desc: 'ห้องบรรยาย 1' },
    { code: '17105', name: 'วินิตปัญญา 2', type: 'classroom', isExamRoom: false, desc: 'ห้องบรรยาย 2' },
    { code: '17106', name: 'วินิตปัญญา 3', type: 'classroom', isExamRoom: false, desc: 'ห้องบรรยาย 3' },
    { code: '17107', name: 'วินิตปัญญา 4', type: 'classroom', isExamRoom: false, desc: 'ห้องบรรยาย 4' },
    { code: '17108', name: 'วินิตปัญญา 5', type: 'computer', isExamRoom: true, examRoomNumber: 1, capacity: 40, seats: '1 - 40' },
    { code: '17109', name: 'วินิตปัญญา 6', type: 'computer', isExamRoom: true, examRoomNumber: 2, capacity: 60, seats: '41 - 100' },
    { code: '17110', name: 'วินิตปัญญา 7', type: 'computer', isExamRoom: true, examRoomNumber: 3, capacity: 60, seats: '101 - 160' },
    { code: '17111', name: 'วินิตปัญญา 8', type: 'computer', isExamRoom: true, examRoomNumber: 4, capacity: 50, seats: '161 - 210' },
    { code: '17112', name: 'ห้องน้ำคนพิการ', type: 'facility', isExamRoom: false, desc: 'ห้องน้ำผู้พิการ ชั้น 1' },
    { code: '17113', name: 'งานเทคนิคอาคาร', type: 'office', isExamRoom: false, desc: 'ห้องปฏิบัติการเทคนิคอาคารและควบคุมระบบ' }
  ],
  floor2: [
    { code: '17201', name: 'ห้องประชุมหงส์พันธ์ (สโลป)', type: 'auditorium', isExamRoom: true, examRoomNumber: 5, capacity: 80, seats: '211 - 290' },
    { code: '17202', name: 'ห้องประชุมเจริญพันธุวงศ์', type: 'meeting', isExamRoom: false, desc: 'ห้องประชุมบรรยายทรงพัด' },
    { code: '17203', name: 'ห้องประชุมลักษณงาม', type: 'meeting', isExamRoom: false, desc: 'ห้องประชุมกลุ่มย่อย' },
    { code: '17204', name: 'ห้องควบคุม', type: 'control', isExamRoom: false, desc: 'ห้องควบคุมระบบโสตทัศนูปกรณ์' },
    { code: '17205', name: 'สุตปัญญา', type: 'computer', isExamRoom: true, examRoomNumber: 6, capacity: 40, seats: '291 - 330' },
    { code: '17206', name: 'ห้องประชุมวงษ์แก้ว', type: 'computer', isExamRoom: true, examRoomNumber: 7, capacity: 40, seats: '331 - 370' },
    { code: '17207', name: 'ห้องประชุมเชื่อมกลาง (หอประชุมใหญ่)', type: 'hall', isExamRoom: false, desc: 'หอประชุมใหญ่สโลปพร้อมเวที' },
    { code: '17208', name: 'ห้องแต่งตัวหญิง', type: 'facility', isExamRoom: false, desc: 'ห้องแต่งตัวหลังเวที' },
    { code: '17209', name: 'ห้องแต่งตัวชาย', type: 'facility', isExamRoom: false, desc: 'ห้องแต่งตัวหลังเวที' },
    { code: '17210', name: 'ห้องรับรอง', type: 'lounge', isExamRoom: false, desc: 'ห้องรับรองวิทยากรและผู้ทรงคุณวุฒิ' },
    { code: '17211', name: 'จิตตปัญญา 1', type: 'computer', isExamRoom: true, examRoomNumber: 8, capacity: 50, seats: '371 - 420' },
    { code: '17212', name: 'จิตตปัญญา 2', type: 'computer', isExamRoom: true, examRoomNumber: 9, capacity: 52, seats: '421 - 472' },
    { code: '17213', name: 'จิตตปัญญา 3', type: 'computer', isExamRoom: true, examRoomNumber: 10, capacity: 48, seats: '473 - 520' },
    { code: '17214', name: 'ห้องน้ำคนพิการ', type: 'facility', isExamRoom: false, desc: 'ห้องน้ำผู้พิการ ชั้น 2' }
  ]
};

/**
 * สร้างชุดข้อมูลจำลองตามพารามิเตอร์ที่ระบุ
 * @param {Object} options
 * @param {number} [options.seed=42]
 * @param {number} [options.proctorCount=40]
 * @param {number} [options.facultyRatio=0.5]
 * @param {number} [options.dayCount=2]
 * @param {number} [options.sessionsPerDay=3]
 * @param {number} [options.roomCount=9]
 * @param {number} [options.unavailabilityRate=0.15]
 * @param {boolean} [options.isStressTest=false]
 * @returns {{
 *   rooms: import('./models.js').Room[],
 *   proctors: import('./models.js').Proctor[],
 *   sessions: import('./models.js').ExamSession[],
 *   allocations: import('./models.js').RoomAllocation[],
 *   unavailabilities: import('./models.js').Unavailability[],
 *   settings: typeof DEFAULT_SETTINGS
 * }}
 */
export function generateSeedData(options = {}) {
  const seed = options.seed ?? 42;
  const proctorCount = options.proctorCount ?? 40;
  const facultyRatio = options.facultyRatio ?? 0.5;
  const dayCount = options.dayCount ?? 2;
  const sessionsPerDay = options.sessionsPerDay ?? 3;
  const roomCount = options.roomCount ?? REAL_EXAM_ROOM_CONFIGS.length;
  const unavailabilityRate = options.unavailabilityRate ?? 0.15;
  const isStressTest = options.isStressTest ?? false;

  const prng = new PRNG(seed);

  // 1. สร้างห้องสอบ (Rooms) จากโครงสร้างห้องสอบจริง (ภาพสนามสอบจริง 9 ห้อง 472 ที่นั่ง)
  /** @type {import('./models.js').Room[]} */
  const rooms = [];
  const configsToUse = REAL_EXAM_ROOM_CONFIGS.slice(0, Math.min(roomCount, REAL_EXAM_ROOM_CONFIGS.length));
  for (const cfg of configsToUse) {
    rooms.push({
      id: `R${String(cfg.roomNumber).padStart(2, '0')}`,
      roomNumber: cfg.roomNumber,
      roomCode: cfg.code,
      officialName: cfg.officialName,
      name: cfg.name,
      building: cfg.building,
      floor: cfg.floor,
      capacity: cfg.capacity,
      seatStart: cfg.seatStart,
      seatEnd: cfg.seatEnd,
      roomType: cfg.roomType,
      accessibleForDisabled: cfg.accessibleForDisabled,
      doorPosition: cfg.doorPosition,
      layoutType: cfg.layoutType,
      description: cfg.description,
      airConditioners: cfg.airConditioners,
      cctvCount: cfg.cctvCount,
      doors: cfg.doors,
      accessibilityNote: cfg.accessibilityNote,
      nearby: cfg.nearby || [],
      wing: cfg.wing,
      blocks: cfg.blocks || null,
      rows: cfg.rows || null,
      isActive: true,
    });
  }

  // 2. สร้างผู้คุมสอบ (Proctors)
  /** @type {import('./models.js').Proctor[]} */
  const proctors = [];

  // นำบุคลากรจริง 42 ท่านจากคำสั่งแต่งตั้ง มหาวิทยาลัยราชภัฏบุรีรัมย์ มาเป็นชุดข้อมูลหลัก
  for (const p of REAL_BRU_PERSONNEL) {
    proctors.push({
      ...p,
      pool: 'core',
      keepSameRoom: true,
      maxHours: (p.projectQuota || 6) * 4.5,
      isActive: true,
    });
  }

  // หาก proctorCount มากกว่า 42 ให้สร้างบุคลากรสำรอง/เพิ่มเติมของ มรภ.บุรีรัมย์ จนครบ proctorCount
  const targetProctorCount = Math.max(proctorCount, REAL_BRU_PERSONNEL.length);
  if (targetProctorCount > REAL_BRU_PERSONNEL.length) {
    const needed = targetProctorCount - REAL_BRU_PERSONNEL.length;
    const shuffledFirstNames = prng.shuffle(FIRST_NAMES);
    const shuffledLastNames = prng.shuffle(LAST_NAMES);

    for (let i = 1; i <= needed; i++) {
      const idx = REAL_BRU_PERSONNEL.length + i;
      const proctorId = `P${String(idx).padStart(3, '0')}`;
      const isFaculty = prng.next() < facultyRatio;
      const proctorType = isFaculty ? 'faculty' : 'staff';
      const deptList = isFaculty ? DEPARTMENTS_FACULTY : DEPARTMENTS_STAFF;
      const department = prng.choice(deptList);

      const fName = shuffledFirstNames[(i - 1) % shuffledFirstNames.length];
      const lName = shuffledLastNames[(i - 1) % shuffledLastNames.length];
      const academicTitle = isFaculty ? (prng.next() < 0.5 ? 'อาจารย์' : 'ผศ.ดร.') : 'เจ้าหน้าที่';
      const level = isFaculty ? 'chief' : (prng.next() < 0.2 ? 'chief' : 'assistant');
      const seniorityRank = isFaculty ? 7 : 4;
      const quotaChoice = prng.choice([6, 4, 3, 2]);

      proctors.push({
        id: proctorId,
        firstName: fName,
        lastName: lName,
        academicTitle,
        seniorityRank,
        pool: i > (needed * 0.7) ? 'reserve' : 'core',
        sessionPattern: 'FULL_DAY_PAIRED',
        availableDates: ['2026-03-27', '2026-03-28', '2026-03-29'],
        keepSameRoom: true,
        proctorType,
        department,
        email: `reserve_${idx}@bru.ac.th`,
        phone: `08${prng.nextInt(10, 99)}-${prng.nextInt(100, 999)}-${prng.nextInt(1000, 9999)}`,
        dailyQuota: 2,
        projectQuota: quotaChoice,
        maxHours: quotaChoice * 4.5,
        isActive: true,
        level,
      });
    }
  }

  // 3. สร้างรอบสอบ (ExamSessions) - 6 รอบ 3 วัน (27, 28, 29 มี.ค. 2569) ตามคำสั่งมหาวิทยาลัยราชภัฏบุรีรัมย์
  /** @type {import('./models.js').ExamSession[]} */
  const sessions = [
    {
      id: 'S01',
      name: 'วันที่ 1 - รอบเช้า (วิชาความรู้ทั่วไป)',
      date: '2026-03-27',
      startTime: toBangkokISO('2026-03-27', '08:00'),
      endTime: toBangkokISO('2026-03-27', '12:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    },
    {
      id: 'S02',
      name: 'วันที่ 1 - รอบบ่าย (วิชาเฉพาะตำแหน่ง)',
      date: '2026-03-27',
      startTime: toBangkokISO('2026-03-27', '12:30'),
      endTime: toBangkokISO('2026-03-27', '17:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    },
    {
      id: 'S03',
      name: 'วันที่ 2 - รอบเช้า (วิชาความรู้ทั่วไป)',
      date: '2026-03-28',
      startTime: toBangkokISO('2026-03-28', '08:00'),
      endTime: toBangkokISO('2026-03-28', '12:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    },
    {
      id: 'S04',
      name: 'วันที่ 2 - รอบบ่าย (วิชาเฉพาะตำแหน่ง)',
      date: '2026-03-28',
      startTime: toBangkokISO('2026-03-28', '12:30'),
      endTime: toBangkokISO('2026-03-28', '17:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    },
    {
      id: 'S05',
      name: 'วันที่ 3 - รอบเช้า (วิชาความรู้ทั่วไป)',
      date: '2026-03-29',
      startTime: toBangkokISO('2026-03-29', '08:00'),
      endTime: toBangkokISO('2026-03-29', '12:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    },
    {
      id: 'S06',
      name: 'วันที่ 3 - รอบบ่าย (วิชาเฉพาะตำแหน่ง)',
      date: '2026-03-29',
      startTime: toBangkokISO('2026-03-29', '12:30'),
      endTime: toBangkokISO('2026-03-29', '17:30'),
      totalExaminees: 520,
      prepMinutes: 0,
      wrapMinutes: 0,
      organization: 'สำนักงาน ก.พ. / ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์',
    }
  ];

  // 4. สร้างการจัดสรรห้อง (RoomAllocations)
  /** @type {import('./models.js').RoomAllocation[]} */
  const allocations = [];
  for (const session of sessions) {
    let sessionTotal = 0;
    // จัดให้ทุก session ใช้ห้องทั้งหมดหรือเกือบทั้งหมด
    const activeRooms = rooms.slice(0, Math.min(roomCount, 10));

    for (let rIdx = 0; rIdx < activeRooms.length; rIdx++) {
      const room = activeRooms[rIdx];
      const allocId = `A_${session.id}_${room.id}`;

      // จำนวนผู้เข้าสอบตามความจุห้องจริง (40, 60, 60, 50, 80, 40, 40, 50, 52) รวม 472 คนต่อรอบ
      let examinees = room.capacity;
      sessionTotal += examinees;

      // ความต้องการพิเศษ: เป็นการสอบบนคอมพิวเตอร์ทั้งหมด (CBT)
      // ถ้าเป็นห้องแรกของรอบและห้องรองรับผู้พิการ ให้ specialNeeds = 'both'
      let specialNeeds = 'computer';
      if (rIdx === 0 && room.accessibleForDisabled) {
        specialNeeds = 'both';
      }

      allocations.push({
        id: allocId,
        sessionId: session.id,
        roomId: room.id,
        examineesInRoom: examinees,
        specialNeeds,
      });
    }

    session.totalExaminees = sessionTotal;
  }

  // 5. สร้างช่วงเวลาไม่ว่าง (Unavailabilities)
  /** @type {import('./models.js').Unavailability[]} */
  const unavailabilities = [];
  let unavailCounter = 1;

  for (const proctor of proctors) {
    // โอกาสที่คนนี้จะมีช่วงไม่ว่าง
    if (prng.next() < unavailabilityRate) {
      // สุ่มเลือกว่าไม่ว่างในรอบสอบใดรอบหนึ่ง
      const randomSession = prng.choice(sessions);
      if (randomSession) {
        unavailabilities.push({
          id: `U${String(unavailCounter++).padStart(3, '0')}`,
          proctorId: proctor.id,
          startTime: randomSession.startTime,
          endTime: randomSession.endTime,
          reason: prng.choice([
            'ติดสอนชดเชยวิชาเอก',
            'ติดประชุมคณะกรรมการประจำคณะ',
            'ติดภารกิจราชการต่างจังหวัด',
            'มีนัดพบแพทย์ประจำปี',
            'ติดสอบวิทยานิพนธ์นักศึกษาปริญญาโท'
          ]),
        });
      }
    }
  }

  return {
    rooms,
    proctors,
    sessions,
    allocations,
    unavailabilities,
    settings: DEFAULT_SETTINGS,
  };
}

/**
 * แม่แบบพรีเซ็ตข้อมูลขนาดต่างๆ ตามข้อกำหนด 4 และ 11.4
 */
export const SEED_PRESETS = {
  // ขนาดเล็ก: 20 คน (1 วัน, 2 รอบ, 6 ห้อง)
  small_20: {
    label: 'ขนาดเล็ก (20 ผู้คุม / 6 ห้อง / 1 วัน 2 รอบ)',
    options: {
      proctorCount: 20,
      facultyRatio: 0.5,
      dayCount: 1,
      sessionsPerDay: 2,
      roomCount: 6,
      unavailabilityRate: 0.1,
      isStressTest: false,
    }
  },

  // ขนาดมาตรฐาน: 40 คน (2 วัน, 3 รอบ/วัน, 10 ห้อง)
  standard_40: {
    label: 'ขนาดมาตรฐาน (40 ผู้คุม / 10 ห้อง / 2 วัน 3 รอบ/วัน)',
    options: {
      proctorCount: 40,
      facultyRatio: 0.5,
      dayCount: 2,
      sessionsPerDay: 3,
      roomCount: 10,
      unavailabilityRate: 0.15,
      isStressTest: false,
    }
  },

  // ขนาดใหญ่: 80 คน (4 วัน, 3 รอบ/วัน, 10 ห้อง)
  large_80: {
    label: 'ขนาดใหญ่ (80 ผู้คุม / 10 ห้อง / 4 วัน 3 รอบ/วัน)',
    options: {
      proctorCount: 80,
      facultyRatio: 0.5,
      dayCount: 4,
      sessionsPerDay: 3,
      roomCount: 10,
      unavailabilityRate: 0.15,
      isStressTest: false,
    }
  },

  // กรณีทดสอบขีดจำกัด (Stress Case): โควต้าพอดีเป๊ะ คนว่างน้อย
  stress_case: {
    label: 'ทดสอบวิกฤต (Stress Test: คนพอดีเป๊ะ / คนว่างน้อย)',
    options: {
      proctorCount: 24,
      facultyRatio: 0.5,
      dayCount: 1,
      sessionsPerDay: 2,
      roomCount: 8,
      unavailabilityRate: 0.30,
      isStressTest: true,
    }
  }
};
