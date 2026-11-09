/**
 * โมดูลระบบสำหรับผู้เข้าชมและนักศึกษา (University Visitor & Examinee Portal)
 * อิงตามแบบเว็บไซต์ทางการ มหาวิทยาลัยราชภัฏบุรีรัมย์ (Buriram Rajabhat University)
 * มีระบบ:
 * 1. University Header & Top Utility Bar (ตรงตามภาพถ่ายหน้าเว็บ BRU)
 * 2. ข่าวประชาสัมพันธ์ศูนย์สอบ CBT อาคาร 17 (ตามเลย์เอาต์ภาพถ่าย)
 * 3. ระบบค้นหาที่นั่งสอบและห้องสอบรายบุคคล (Examinee Seat & Room Finder)
 * 4. บัตรประจำตัวผู้เข้าสอบอิเล็กทรอนิกส์ พร้อมผังที่นั่งจริง & ปุ่มพิมพ์
 * 5. ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (10 ห้อง 520 เครื่อง)
 * 6. ระเบียบข้อปฏิบัติการเข้าสอบมาตรฐาน CBT
 * 7. ตารางกำหนดการสอบสาธารณะ
 */

import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';
import { BRU_LOGO_DATA_URI } from '../data/branding.js';

// ข้อมูลจำลองผู้เข้าสอบตัวอย่างสำหรับทดสอบค้นหา
export const SAMPLE_EXAMINEES = [
  {
    id: '65011234001',
    title: 'นาย',
    firstName: 'กิตติศักดิ์',
    lastName: 'เจริญผล',
    faculty: 'คณะวิทยาศาสตร์',
    major: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'CBT-101',
    subjectName: 'การทดสอบความรู้ความสามารถทั่วไปทางคอมพิวเตอร์ (CBT Exam)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 1,
    roomCode: '17108',
    roomName: 'ห้อง 17108 (วินิตปัญญา 5)',
    seatNumber: 'CBT-18',
    seatBlock: 'บล็อกซ้าย แถวที่ 2',
    seatIndex: 18,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '65011234002',
    title: 'นางสาว',
    firstName: 'ชุติมา',
    lastName: 'สายชล',
    faculty: 'คณะวิทยาการจัดการ',
    major: 'สาขาวิชาการบัญชีและการเงิน',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'CBT-101',
    subjectName: 'การทดสอบความรู้ความสามารถทั่วไปทางคอมพิวเตอร์ (CBT Exam)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 2,
    roomCode: '17201',
    roomName: 'ห้อง 17201 (ชั้น 2)',
    seatNumber: 'CBT-05',
    seatBlock: 'บล็อก 1 แถวที่ 1',
    seatIndex: 5,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '65011234003',
    title: 'นาย',
    firstName: 'ณัฐภัทร',
    lastName: 'วัฒนสุนทร',
    faculty: 'คณะมนุษยศาสตร์และสังคมศาสตร์',
    major: 'สาขาวิชานิติศาสตร์',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'CBT-101',
    subjectName: 'การทดสอบความรู้ความสามารถทั่วไปทางคอมพิวเตอร์ (CBT Exam)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 3,
    roomCode: '17301',
    roomName: 'ห้อง 17301 (ชั้น 3)',
    seatNumber: 'CBT-22',
    seatBlock: 'บล็อกกลาง แถวที่ 3',
    seatIndex: 22,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '65011234004',
    title: 'นางสาว',
    firstName: 'ลลิตา',
    lastName: 'ศิริโภคิน',
    faculty: 'คณะครุศาสตร์',
    major: 'สาขาวิชาภาษาอังกฤษ',
    sessionId: 's2',
    sessionName: 'รอบที่ 2: เสาร์บ่าย (13:00 - 16:00)',
    subjectCode: 'CBT-102',
    subjectName: 'การทดสอบภาษาอังกฤษเพื่อการสื่อสารระดับสากล',
    date: '2026-10-31',
    time: '13:00 - 16:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 4,
    roomCode: '17401',
    roomName: 'ห้อง 17401 (ชั้น 4)',
    seatNumber: 'CBT-11',
    seatBlock: 'บล็อกซ้าย แถวที่ 2',
    seatIndex: 11,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '65011234005',
    title: 'นาย',
    firstName: 'พงศกร',
    lastName: 'ประเสริฐผล',
    faculty: 'คณะเทคโนโลยีการเกษตร',
    major: 'สาขาวิชาเทคโนโลยีอาหาร',
    sessionId: 's2',
    sessionName: 'รอบที่ 2: เสาร์บ่าย (13:00 - 16:00)',
    subjectCode: 'CBT-102',
    subjectName: 'การทดสอบภาษาอังกฤษเพื่อการสื่อสารระดับสากล',
    date: '2026-10-31',
    time: '13:00 - 16:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 5,
    roomCode: '17503',
    roomName: 'ห้อง 17503 (ชั้น 5)',
    seatNumber: 'CBT-30',
    seatBlock: 'บล็อกขวา แถวที่ 3',
    seatIndex: 30,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '65011234006',
    title: 'นางสาว',
    firstName: 'นภัสสร',
    lastName: 'รุ่งเรืองกิจ',
    faculty: 'คณะพยาบาลศาสตร์',
    major: 'สาขาวิชาพยาบาลศาสตร์',
    sessionId: 's3',
    sessionName: 'รอบที่ 3: อาทิตย์เช้า (09:00 - 12:00)',
    subjectCode: 'CBT-103',
    subjectName: 'การทดสอบทักษะดิจิทัลและเทคโนโลยีสารสนเทศ (Digital Literacy)',
    date: '2026-11-01',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 1,
    roomCode: '17108',
    roomName: 'ห้อง 17108 (วินิตปัญญา 5)',
    seatNumber: 'CBT-02',
    seatBlock: 'บล็อกซ้าย แถวที่ 1',
    seatIndex: 2,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  }
];

/**
 * แสดงตราสัญลักษณ์ทางการ มหาวิทยาลัยราชภัฏบุรีรัมย์ (จากไฟล์ภาพที่ได้รับ)
 */
export function getUniversityEmblem(height = 50, className = 'uni-seal-img') {
  return `<img src="${BRU_LOGO_DATA_URI}" alt="ตราประจำมหาวิทยาลัยราชภัฏบุรีรัมย์" class="${className}" style="height: ${height}px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.18));" />`;
}

export function getUniversityEmblemSvg(size = 50) {
  return getUniversityEmblem(size);
}

/**
 * เรนเดอร์ Header ประจำมหาวิทยาลัยราชภัฏบุรีรัมย์ (University Header)
 * มีทั้ง Top Utility Bar สีขาว และ Primary Navbar สีม่วงราชภัฏ
 */
export function renderUniversityHeader({ currentTab, onVisitorMode = false }) {
  return `
    <header class="uni-header-container" id="uni-main-header">
      <!-- 1. Top Utility Bar (สีขาว มีตรามหาลัย + ลิงก์ด่วนบุคลากร/นักศึกษา) -->
      <div class="uni-top-utility-bar">
        <div class="uni-utility-inner">
          <!-- Logo & University Title (มุมซ้ายบน) -->
          <div class="uni-brand-wrapper" id="btn-uni-home" style="cursor: pointer;" title="คลิกเพื่อกลับหน้าหลักมหาวิทยาลัย / ศูนย์สอบ">
            ${getUniversityEmblem(52, 'uni-seal-img-left')}
            <div class="uni-title-box">
              <span class="uni-title-th">มหาวิทยาลัยราชภัฏบุรีรัมย์</span>
              <span class="uni-title-en">BURIRAM RAJABHAT UNIVERSITY</span>
            </div>
            <div class="uni-cbt-tag">
              <span class="cbt-badge">ศูนย์สอบ CBT อาคาร 17</span>
            </div>
          </div>

          <!-- Quick Utility Links + ตราประจำมหาวิทยาลัยมุมขวาบน -->
          <div class="uni-utility-right">
            <nav class="uni-quick-links" aria-label="ลิงก์ด่วนมหาวิทยาลัย">
              <a href="#quick-student" class="uni-quick-link" id="link-student-view">นักศึกษาปัจจุบัน</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-staff" class="uni-quick-link" id="link-staff-view">บุคลากร</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-alumni" class="uni-quick-link">ศิษย์เก่า</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-reg" class="uni-quick-link">ระบบบริการการศึกษา</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-edoc" class="uni-quick-link">E-DOC</a>
            </nav>

            <!-- Social Media Icons (ตามภาพเว็บมหาวิทยาลัย) -->
            <div class="uni-social-group">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="Facebook มหาวิทยาลัย">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 6.46 11.82 5 14.5 5c1.28 0 2.62.23 2.62.23v2.89h-1.48c-1.5 0-1.97.93-1.97 1.88V12h3.25l-.52 3h-2.73v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="Twitter / X">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="YouTube BRU Channel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>

            <!-- ตราประจำมหาวิทยาลัยมุมขวาบน (Official BRU Crest) -->
            <div class="uni-top-right-crest" title="ตราประจำมหาวิทยาลัยราชภัฏบุรีรัมย์">
              ${getUniversityEmblem(46, 'uni-seal-img-right')}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Main University Navigation Bar (แถบสีม่วงราชภัฏบุรีรัมย์ #3B1F54 พร้อมปุ่มสีเหลืองทอง) -->
      <div class="uni-primary-navbar">
        <div class="uni-navbar-inner">
          <ul class="uni-nav-links">
            <li class="uni-nav-item">
              <a href="#visitor-news" class="uni-nav-link active" data-scroll="visitor-news">หน้าแรกศูนย์สอบ CBT</a>
            </li>

            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-rooms" class="uni-nav-link" data-scroll="visitor-rooms">🏢 อาคาร 17 & ห้องสอบ (10 ห้อง)</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-rules" class="uni-nav-link" data-scroll="visitor-rules">📜 ระเบียบการเข้าสอบ</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-schedule" class="uni-nav-link" data-scroll="visitor-schedule">📅 ตารางสอบ</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-contact" class="uni-nav-link" data-scroll="visitor-contact">ติดต่อศูนย์สอบ</a>
            </li>
          </ul>

          <!-- Action Switcher CTA Button (ปุ่มสีเหลืองทองแบบแคปซูล ตามภาพต้นแบบเว็บมหาลัย) -->
          <div class="uni-navbar-right">
            ${currentTab === 'visitor' ? `
              <button class="uni-cta-pill" id="btn-enter-staff-system" title="เข้าสู่ระบบจัดการและจัดตารางคุมสอบสำหรับเจ้าหน้าที่ / อาจารย์">
                <span class="icon">🛡️</span>
                <span>เข้าสู่ระบบจัดตาราง (Staff)</span>
                <span class="arrow">➔</span>
              </button>
            ` : `
              <button class="uni-cta-pill btn-switch-to-visitor" id="btn-back-to-visitor" title="กลับสู่หน้าหลักสำหรับผู้เข้าชมและนักศึกษา">
                <span class="icon">🌐</span>
                <span>หน้าหลักผู้เข้าชม / นศ.</span>
                <span class="arrow">➔</span>
              </button>
            `}

          </div>
        </div>
      </div>
    </header>
  `;
}

/**
 * เรนเดอร์หน้าหลักสำหรับผู้เข้าชม (Visitor & Examinee Portal)
 */
export function renderVisitorPortal(appState) {
  const activeRooms = appState.rooms || [];
  const sessions = appState.sessions || [];
  const allocations = appState.allocations || [];
  const assignments = appState.assignments || [];

  return `
    <div class="visitor-portal-view" id="visitor-portal-root">
      
      <!-- Section 1: ข่าวประชาสัมพันธ์ทางการ (Announcement Banner ตามแบบภาพถ่าย BRU) -->
      <section class="visitor-news-section" id="visitor-news">
        <div class="visitor-container">
          <div class="uni-news-card">
            <!-- Orange Tag -->
            <div class="uni-news-tag">
              <span class="tag-bar"></span>
              <span class="tag-label">ข่าวประชาสัมพันธ์</span>
            </div>

            <!-- Headline -->
            <h1 class="uni-news-title">
              ประกาศศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์: 
              กำหนดการทดสอบและช่องทางตรวจสอบผังที่นั่งสอบรายบุคคล ประจำปีการศึกษา 2569
            </h1>

            <!-- Meta line (ตามภาพ: ผู้ดูแลระบบ, วันที่, จำนวนคนดู, ปุ่มแชร์) -->
            <div class="uni-news-meta">
              <div class="meta-left">
                <span class="meta-author">โดย <strong>ผู้ดูแลระบบศูนย์สอบ CBT</strong></span>
                <span class="meta-dot">,</span>
                <span class="meta-date">4 พฤศจิกายน 2569</span>

              </div>
              <div class="meta-shares">
                <button class="share-icon" title="แชร์ลง Facebook">f</button>
                <button class="share-icon" title="แชร์ลง Twitter">t</button>
                <button class="share-icon" title="แชร์ลง Google+">G+</button>
                <button class="share-icon" id="btn-copy-portal-link" title="คัดลอกลิงก์ประกาศ">🔗</button>
              </div>
            </div>

            <!-- News Visual Poster & Quick Highlights -->
            <div class="uni-news-banner-visual">
              <div class="banner-badge-box">
                <span class="banner-tag-red">แจ้งเตือนสำคัญ</span>
                <h2 class="banner-headline">ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT) อาคาร 17</h2>
                <p class="banner-subtext">มหาวิทยาลัยราชภัฏบุรีรัมย์ เปิดให้นักศึกษาและผู้เข้าสอบตรวจสอบห้องสอบ เลขที่นั่งสอบ และระเบียบการสอบล่วงหน้า</p>
                <div class="banner-stats-row">
                  <div class="stat-pill">
                    <span class="stat-num">10</span>
                    <span class="stat-desc">ห้องปฏิบัติการ</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">520</span>
                    <span class="stat-desc">เครื่องสอบ CBT</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">2</span>
                    <span class="stat-desc">ชั้น (มีลิฟต์ & ทางลาด)</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">100%</span>
                    <span class="stat-desc">แอร์ & วงจรปิด CCTV</span>
                  </div>
                </div>
              </div>

              <!-- Action Prompt inside Banner -->
              <div class="banner-action-card">
                <div class="card-title">🏢 ข้อมูลอาคารสอบ</div>
                <p class="card-desc">ดูรายละเอียดห้องสอบ 10 ห้อง ผังอาคาร 17 ชั้น 1 และชั้น 2 รวม 520 ที่นั่งจริงในอาคาร 17</p>
                <a href="#visitor-rooms" class="btn btn-accent btn-block" style="text-align: center; font-weight: 700; padding: 10px 16px; border-radius: 9999px;">
                  ดูข้อมูลอาคารสอบ & ห้องสอบ 🏢
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (10 Rooms Directory) -->
      <section class="visitor-rooms-section" id="visitor-rooms">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">🏢 ข้อมูลอาคารสอบ</div>
            <h2 class="section-title">ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (CBT Center)</h2>
            <p class="section-subtitle">ศูนย์สอบคอมพิวเตอร์มาตรฐาน 10 ห้องสอบ รวม 520 ที่นั่ง พร้อมระบบปรับอากาศและบันทึกภาพ CCTV ทุกห้อง</p>
          </div>

          <!-- Floor Filter Buttons -->
          <div class="floor-filter-pills" id="visitor-floor-filters">
            <button class="floor-pill active" data-floor="all">ทั้งหมด (10 ห้อง)</button>
            <button class="floor-pill" data-floor="1">ชั้น 1 (4 ห้อง - 210 ที่นั่ง)</button>
            <button class="floor-pill" data-floor="2">ชั้น 2 (6 ห้อง - 310 ที่นั่ง)</button>
          </div>

          <!-- Room Cards Grid -->
          <div class="visitor-rooms-grid">
            ${activeRooms.map(room => {
              const rCode = room.roomCode || room.code || room.id;
              const floorNum = room.floor || (rCode.startsWith('172') ? 2 : 1);
              return `
                <div class="visitor-room-card" data-room-floor="${floorNum}" data-room-id="${room.id}">
                  <div class="room-card-top">
                    <div class="room-card-code">
                      <span class="room-badge-floor">ชั้น ${floorNum}</span>
                      <h3>ห้อง ${rCode}</h3>
                    </div>
                    <span class="room-badge-cap">${room.capacity} เครื่อง</span>
                  </div>

                  <div class="room-official-name">
                    ${room.officialName || room.name}
                  </div>

                  <p class="room-desc-short">
                    ${room.description || `ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น ${floorNum} รองรับการสอบ CBT`}
                  </p>

                  <div class="room-amenities">
                    <span class="amenity-item" title="เครื่องปรับอากาศ">❄️ แอร์ ${room.airConditioners || 4} ตัว</span>
                    <span class="amenity-item" title="กล้องวงจรปิด CCTV">📹 CCTV ${room.cctvCount || 2} ตัว</span>
                    ${room.accessibleForDisabled ? `
                      <span class="amenity-item tag-access" title="รองรับผู้พิการ">♿ มีทางลาด</span>
                    ` : ''}
                  </div>

                  <div class="room-card-actions">
                    <button class="btn btn-secondary btn-sm btn-view-room-plan" data-room-id="${room.id}" style="width: 100%; justify-content: center; font-weight: 600;">
                      🗺️ เปิดดูผังที่นั่ง & ตำแหน่งเครื่อง
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- Section 4: ระเบียบและข้อปฏิบัติการเข้าสอบ CBT (Code of Conduct) -->
      <section class="visitor-rules-section" id="visitor-rules">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">📜 ข้อบังคับศูนย์สอบ</div>
            <h2 class="section-title">ระเบียบและแนวทางปฏิบัติสำหรับผู้เข้าสอบ CBT</h2>
            <p class="section-subtitle">เพื่อความโปร่งใส ยุติธรรม และความปลอดภัย ขอความร่วมมือผู้เข้าสอบปฏิบัติตามระเบียบอย่างเคร่งครัด</p>
          </div>

          <div class="rules-card-grid">
            <!-- Card 1 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(37,99,235,0.1); color: #2563EB;">🪪</div>
              <h3 class="rule-title">1. หลักฐานแสดงตนเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ต้องนำ<strong>บัตรประจำตัวประชาชนฉบับจริง</strong> หรือ<strong>บัตรประจำตัวนักศึกษา</strong> (ที่ยังไม่หมดอายุ) มาแสดงต่อกรรมการคุมสอบหน้าห้องสอบ หากไม่มีหลักฐานจะไม่ได้รับอนุญาตให้เข้าสอบ
              </p>
            </div>

            <!-- Card 2 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(220,38,38,0.1); color: #DC2626;">⏰</div>
              <h3 class="rule-title">2. กำหนดเวลาเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ผู้เข้าสอบต้องมาถึงหน้าห้องสอบก่อนเวลาสอบ<strong>อย่างน้อย 15 นาที</strong> เพื่อฟังคำชี้แจง และไม่อนุญาตให้เข้าห้องสอบหลังจากเริ่มสอบไปแล้วเกิน <strong>15 นาที</strong> โดยเด็ดขาด
              </p>
            </div>

            <!-- Card 3 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(217,119,6,0.1); color: #D97706;">📵</div>
              <h3 class="rule-title">3. สิ่งของต้องห้ามนำเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ห้ามนำ<strong>โทรศัพท์มือถือ สมาร์ตวอทช์ เครื่องคำนวณ หูฟัง เอกสาร หรือสัมภาระทุกชนิด</strong>เข้าห้องสอบ ต้องปิดเครื่องและฝากไว้ในจุดที่ศูนย์สอบจัดไว้หน้าห้องสอบ
              </p>
            </div>

            <!-- Card 4 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(16,185,129,0.1); color: #10B981;">💻</div>
              <h3 class="rule-title">4. การใช้งานเครื่องคอมพิวเตอร์ CBT</h3>
              <p class="rule-desc">
                นั่งสอบตรงตาม<strong>หมายเลขเครื่อง (CBT Number)</strong> ที่กำหนด ห้ามสลับเครื่อง ห้ามเปิดเว็บเบราว์เซอร์อื่น หรือโปรแกรมภายนอก หากเครื่องมีปัญหาให้ยกมือแจ้งกรรมการคุมสอบทันที
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 5: ตารางกำหนดการสอบสาธารณะ (Public Exam Timetable) -->
      <section class="visitor-schedule-section" id="visitor-schedule">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">📅 กำหนดการจัดสอบ</div>
            <h2 class="section-title">ตารางรอบการทดสอบ ณ อาคาร 17 ศูนย์สอบ CBT</h2>
            <p class="section-subtitle">ข้อมูลรอบการจัดสอบ ห้องสอบ และจำนวนผู้เข้าสอบที่ลงทะเบียนในระบบ</p>
          </div>

          <div class="visitor-table-card">
            <table class="visitor-schedule-table">
              <thead>
                <tr>
                  <th>รอบสอบ</th>
                  <th>วันที่สอบ</th>
                  <th>เวลาสอบ</th>
                  <th>รายวิชา / การทดสอบ</th>
                  <th>ห้องสอบที่เปิด</th>
                  <th>จำนวนผู้เข้าสอบ</th>
                  <th>สถานะรอบ</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map((sess, idx) => {
                  const sAllocs = allocations.filter(a => a.sessionId === sess.id);
                  const roomCodes = sAllocs.map(a => {
                    const r = activeRooms.find(rm => rm.id === a.roomId);
                    return r ? r.code : a.roomId;
                  }).join(', ');
                  return `
                    <tr>
                      <td><span class="badge badge-normal">รอบที่ ${idx + 1}</span></td>
                      <td><strong>${formatThaiDate(sess.date)}</strong></td>
                      <td><span class="badge badge-primary">${sess.startTime} - ${sess.endTime} น.</span></td>
                      <td><strong>${sess.name}</strong></td>
                      <td><span class="badge badge-secondary">${roomCodes || 'ทุกห้องในอาคาร 17'}</span></td>
                      <td><strong>${sess.totalExaminees || 350} คน</strong></td>
                      <td><span class="badge badge-success">พร้อมดำเนินการ</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section 6: ติดต่อศูนย์สอบและข้อมูลมหาวิทยาลัย (Footer) -->
      <footer class="visitor-footer" id="visitor-contact">
        <div class="visitor-container">
          <div class="footer-grid">
            <div class="footer-col brand-col">
              <div class="footer-brand">
                ${getUniversityEmblemSvg(42)}
                <div>
                  <h4 class="footer-uni-title">มหาวิทยาลัยราชภัฏบุรีรัมย์</h4>
                  <p class="footer-sub">Buriram Rajabhat University</p>
                </div>
              </div>
              <p class="footer-desc">
                ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT Exam Center) อาคาร 17<br>
                บริการจัดสอบมาตรฐานสำหรับนักศึกษา หน่วยงานราชการ และองค์กรภายนอก
              </p>
            </div>

            <div class="footer-col">
              <h4 class="footer-heading">สถานที่ตั้ง & ติดต่อ</h4>
              <p class="footer-text">
                📍 เลขที่ 439 ถนนจิระ ตำบลในเมือง อำเภอเมืองบุรีรัมย์ จังหวัดบุรีรัมย์ 31000<br>
                📞 โทรศัพท์: 0-4461-1221 ต่อ 1700 (งานศูนย์สอบ CBT)<br>
                ✉️ อีเมล: cbt-center@bru.ac.th<br>
                🌐 เว็บไซต์: www.bru.ac.th
              </p>
            </div>

            <div class="footer-col">
              <h4 class="footer-heading">ระบบสำหรับเจ้าหน้าที่</h4>
              <p class="footer-text">
                สำหรับอาจารย์ผู้คุมสอบและคณะกรรมการคุมสอบ กรุณาเข้าสู่ระบบเพื่อตรวจสอบคำสั่งและจัดตารางปฏิบัติหน้าที่
              </p>
              <button class="btn btn-accent btn-sm" id="btn-footer-staff-login" style="margin-top: 8px; font-weight: 700;">
                🛡️ เข้าสู่ระบบจัดตารางสอบ (Staff / Admin)
              </button>
            </div>
          </div>

          <div class="footer-bottom">
            <span>© 2026 มหาวิทยาลัยราชภัฏบุรีรัมย์ (Buriram Rajabhat University) - สงวนลิขสิทธิ์</span>
            <span>ระบบจัดตารางและบริการศูนย์สอบ CBT อาคาร 17</span>
          </div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * เรนเดอร์การ์ดบัตรประจำตัวผู้เข้าสอบ (Electronic Exam Pass Ticket)
 */
export function renderExamineePassCard(examinee, appState) {
  if (!examinee) {
    return `
      <div class="no-result-box">
        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
        <h3>ไม่พบข้อมูลผู้เข้าสอบตามคำค้นหา</h3>
        <p>กรุณาตรวจสอบรหัสนักศึกษา หรือชื่อ-นามสกุลอีกครั้ง หรือคลิกเลือกตัวอย่างรายชื่อด้านบน</p>
      </div>
    `;
  }

  // หาข้อมูลห้องสอบจริง
  const room = (appState.rooms || []).find(r => r.code === examinee.roomCode) || {
    code: examinee.roomCode,
    name: examinee.roomName,
    floor: examinee.floor,
    capacity: 40
  };

  // หาผู้คุมสอบประจำห้องในรอบนั้น (ถ้ามี)
  const alloc = (appState.allocations || []).find(a => a.sessionId === examinee.sessionId && (a.roomId === room.id || a.roomId === (room.roomCode || room.code)));
  let chiefProctorName = 'อาจารย์ประจำศูนย์สอบ CBT';
  if (alloc) {
    const assignedChief = (appState.assignments || []).find(as => as.allocationId === alloc.id && as.role === 'chief');
    if (assignedChief) {
      const p = (appState.proctors || []).find(pr => pr.id === assignedChief.proctorId);
      if (p) chiefProctorName = `${p.title || ''}${p.firstName} ${p.lastName}`;
    }
  }

  return `
    <div class="examinee-pass-card" id="printable-examinee-pass">
      <div class="pass-header">
        <div class="pass-header-left">
          <span class="pass-tag">บัตรประจำตัวผู้เข้าสอบอิเล็กทรอนิกส์ (E-Exam Pass)</span>
          <h3 class="pass-university">มหาวิทยาลัยราชภัฏบุรีรัมย์ • ศูนย์สอบ CBT อาคาร 17</h3>
          <div class="pass-subject">${examinee.subjectName} (${examinee.subjectCode})</div>
        </div>
        <div class="pass-qr-stub">
          <div class="qr-mock">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" fill="#FFFFFF"/>
              <!-- Mock QR Code Corners -->
              <rect x="10" y="10" width="26" height="26" fill="#000000"/>
              <rect x="14" y="14" width="18" height="18" fill="#FFFFFF"/>
              <rect x="18" y="18" width="10" height="10" fill="#000000"/>

              <rect x="64" y="10" width="26" height="26" fill="#000000"/>
              <rect x="68" y="14" width="18" height="18" fill="#FFFFFF"/>
              <rect x="72" y="18" width="10" height="10" fill="#000000"/>

              <rect x="10" y="64" width="26" height="26" fill="#000000"/>
              <rect x="14" y="68" width="18" height="18" fill="#FFFFFF"/>
              <rect x="18" y="72" width="10" height="10" fill="#000000"/>

              <!-- Dots -->
              <rect x="42" y="15" width="6" height="12" fill="#000000"/>
              <rect x="52" y="25" width="6" height="6" fill="#000000"/>
              <rect x="42" y="42" width="16" height="16" fill="#000000"/>
              <rect x="64" y="45" width="12" height="6" fill="#000000"/>
              <rect x="42" y="65" width="6" height="15" fill="#000000"/>
              <rect x="55" y="75" width="15" height="6" fill="#000000"/>
              <rect x="75" y="65" width="15" height="15" fill="#000000"/>
            </svg>
          </div>
          <span class="qr-label">สแกนตรวจสอบสิทธิ์</span>
        </div>
      </div>

      <!-- Main Pass Info Body -->
      <div class="pass-body">
        <div class="pass-student-info">
          <div class="info-row">
            <span class="lbl">ชื่อ - สกุล:</span>
            <span class="val strong">${examinee.title} ${examinee.firstName} ${examinee.lastName}</span>
          </div>
          <div class="info-row">
            <span class="lbl">รหัสนักศึกษา:</span>
            <span class="val highlight">${examinee.id}</span>
          </div>
          <div class="info-row">
            <span class="lbl">คณะ / สาขาวิชา:</span>
            <span class="val">${examinee.faculty} (${examinee.major})</span>
          </div>
          <div class="info-row">
            <span class="lbl">วันและเวลาสอบ:</span>
            <span class="val"><strong>${formatThaiDate(examinee.date)}</strong> เวลา ${examinee.time}</span>
          </div>
          <div class="info-row">
            <span class="lbl">หัวหน้าผู้คุมห้อง:</span>
            <span class="val">${chiefProctorName}</span>
          </div>
        </div>

        <!-- Seat & Room Spotlight Badge (เน้นชัดเจนตามความต้องการผู้เข้าสอบ) -->
        <div class="pass-seat-spotlight">
          <div class="spotlight-header">📍 ตำแหน่งที่นั่งสอบของท่าน</div>
          
          <div class="spotlight-room">
            <span class="label-tiny">ห้องสอบ</span>
            <span class="room-big">${examinee.roomCode}</span>
            <span class="room-sub">${examinee.roomName}</span>
          </div>

          <div class="spotlight-terminal">
            <span class="label-tiny">หมายเลขเครื่องสอบ CBT</span>
            <span class="seat-big">${examinee.seatNumber}</span>
            <span class="seat-sub">${examinee.seatBlock}</span>
          </div>

          <div class="spotlight-floor">
            <span>อาคาร 17 (ชั้น ${examinee.floor})</span>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pass-actions">
        <button class="btn btn-primary btn-sm btn-view-examinee-blueprint" data-room-code="${examinee.roomCode}" data-seat-number="${examinee.seatNumber}">
          🗺️ เปิดดูผังที่นั่งห้อง ${examinee.roomCode} (แสดงตำแหน่งเครื่อง ${examinee.seatNumber})
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-print-exam-pass">
          🖨️ พิมพ์บัตรประจำตัวสอบ (Print Pass)
        </button>
      </div>
    </div>
  `;
}
