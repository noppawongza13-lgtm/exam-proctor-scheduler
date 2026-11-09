/**
 * แอปพลิเคชัน UI หลัก (Main Application View Controller)
 * จัดการหน้าจอทั้งหมด (Dashboard, Scheduler, 3 Views, Manual Edit, What-if, Versions, Settings, Audit Log, Test Suite)
 */

import { appState } from '../store/state.js';
import { formatThaiDate, formatThaiTimeRange, formatThaiTime } from '../utils/thai-date.js';
import { validateSchedule } from '../rules/validator.js';
import { exportExcelWorkbook } from '../io/excel-export.js';
import { openPrintableSignoffSheets, openPersonalDutySheet, openPrintableDoorSignsAndSeatingPlan, renderSeatingPlanInnerDiagram } from '../io/pdf-export.js';
import { exportToCSV, triggerCSVDownload, parseCSV, CSV_TEMPLATES } from '../data/csv-io.js';
import { SEED_PRESETS, BUILDING_17_DIRECTORY } from '../data/seed.js';
import { runAllTests } from '../../tests/run-tests.js';
import { ProctorAIAgent } from '../agent/proctor-agent.js';
import {
  renderBlueprintRoomCell,
  renderDirectorySidebar,
  renderFloor1Blueprint,
  renderFloor2Blueprint,
  renderBuildingDirectoryTable,
  renderRoomDetailModal
} from './building-floor-plan.js';
import {
  renderKpiRoomsModal,
  renderKpiProctorsModal,
  renderKpiScheduleStatusModal,
  renderKpiRulesAuditModal
} from './kpi-modals.js';
import {
  renderUniversityHeader,
  renderVisitorPortal,
  renderExamineePassCard,
  getUniversityEmblem,
  SAMPLE_EXAMINEES
} from './visitor-portal.js';

export class AppView {
  constructor(rootElement) {
    this.root = rootElement;
    this.currentTab = 'visitor'; // visitor | dashboard | scheduler | master-data | what-if | versions | settings | audit | tests | ai-agent
    this.scheduleSubView = 'grid'; // grid | personal | workload
    this.masterDataSubTab = 'proctors'; // proctors | rooms | sessions | unavail
    this.roomsViewMode = 'table'; // table | floor1 | floor2 | directory
    this.roomDetailSubTab = 'seating'; // seating | specs | proctors
    this.maskPDPA = false;
    this.activeModal = null;
    this.dashboardSessionView = 'cards'; // cards | table
    this.selectedSessionFilter = 'all'; // 'all' or sessionId
    this.proctorSearchQuery = '';
    this.proctorFilterLevel = 'all'; // 'all' | 'chief' | 'assistant'
    this.minProctorResult = null;
    this.lastSolverResult = null;
    this.whatIfScenario = null;
    this.aiAgent = new ProctorAIAgent(appState);
    this.testResults = null;

    // ติดตามการเปลี่ยนแปลง state
    appState.subscribe(() => {
      this.render();
    });

    this.render();
  }

  // เปลี่ยนแท็บหน้าหลัก
  setTab(tab) {
    this.currentTab = tab;
    this.render();
  }

  // เปลี่ยนมุมมองย่อยในหน้าตาราง
  setScheduleSubView(view) {
    this.scheduleSubView = view;
    this.render();
  }

  render() {
    const valResult = validateSchedule({
      assignments: appState.assignments,
      allocations: appState.allocations,
      sessions: appState.sessions,
      proctors: appState.proctors,
      rooms: appState.rooms,
      unavailabilities: appState.unavailabilities,
      settings: appState.settings
    });

    // ตรวจสอบสถานะตาราง
    const totalSlots = appState.allocations.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
      + (appState.sessions.length * appState.settings.hardConstraints.h8_reserve_proctors_per_session);
    const assignedSlots = appState.assignments.length;
    const isComplete = assignedSlots >= totalSlots && valResult.isValid;
    const isVisitor = this.currentTab === 'visitor';

    this.root.innerHTML = `
      ${renderUniversityHeader({ currentTab: this.currentTab, onVisitorMode: isVisitor })}

      ${isVisitor ? `
        <!-- Visitor & Examinee Portal Mode -->
        <main class="visitor-wrapper" style="width: 100%;">
          ${renderVisitorPortal(appState)}
        </main>
      ` : `
        <!-- Staff & Scheduler Workspace Mode -->
        <div class="app-container">
          <!-- Sidebar Navigation -->
          <aside class="sidebar">
            <div class="sidebar-header">
              <div class="brand-icon" style="background: transparent; border: none; padding: 0; box-shadow: none;">
                ${getUniversityEmblem(38, 'sidebar-seal')}
              </div>
              <div>
                <div class="brand-title">ระบบจัดตารางผู้คุมสอบ</div>
                <div class="brand-subtitle">${appState.settings.project.universityName}</div>
              </div>
            </div>

            <ul class="nav-list">
              <div class="nav-section-title">พอร์ทัลมหาวิทยาลัย</div>
              <li class="nav-item ${this.currentTab === 'visitor' ? 'active' : ''}" data-tab="visitor" style="background: rgba(229,168,35,0.12); border-left: 3px solid var(--accent-500); font-weight: 700;">
                <span class="icon">🌐</span>
                <span>หน้าหลักผู้เข้าชม (Visitor)</span>
              </li>

              <div class="nav-section-title">เมนูหลัก (เจ้าหน้าที่)</div>
              ${appState.isProctor() ? `
                <li class="nav-item ${this.currentTab === 'my-profile' ? 'active' : ''}" data-tab="my-profile">
                  <span class="icon">👤</span>
                  <span>ข้อมูลและตารางของฉัน</span>
                </li>
              ` : ''}
              <li class="nav-item ${this.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
                <span class="icon">📊</span>
                <span>แดชบอร์ดภาพรวม</span>
              </li>
              <li class="nav-item ${this.currentTab === 'scheduler' ? 'active' : ''}" data-tab="scheduler">
                <span class="icon">📅</span>
                <span>ตารางผู้คุมสอบ</span>
                ${valResult.errorCount > 0 ? `<span class="badge-count">${valResult.errorCount}</span>` : ''}
              </li>
              <li class="nav-item ${this.currentTab === 'master-data' ? 'data-tab="master-data"' : ''} ${this.currentTab === 'master-data' ? 'active' : ''}" data-tab="master-data">
                <span class="icon">🗂️</span>
                <span>ข้อมูลระบบ (ห้อง/ผู้คุม/รอบ)</span>
              </li>
              <li class="nav-item ${this.currentTab === 'what-if' ? 'active' : ''}" data-tab="what-if">
                <span class="icon">🔮</span>
                <span>จำลอง What-if</span>
              </li>
              <li class="nav-item ${this.currentTab === 'versions' ? 'active' : ''}" data-tab="versions">
                <span class="icon">🕒</span>
                <span>เวอร์ชัน & เปรียบเทียบ</span>
              </li>
              <li class="nav-item ${this.currentTab === 'audit' ? 'active' : ''}" data-tab="audit">
                <span class="icon">📋</span>
                <span>ประวัติการแก้ไข (Audit)</span>
              </li>

              <li class="nav-item ${this.currentTab === 'ai-agent' ? 'active' : ''}" data-tab="ai-agent" style="background: linear-gradient(90deg, rgba(126,34,206,0.12) 0%, rgba(245,158,11,0.12) 100%); border-left: 3px solid var(--accent-500);">
                <span class="icon">🤖</span>
                <span>ผู้ช่วย AI (AI Agent)</span>
                <span class="badge" style="background: var(--accent-500); color: #000; font-size: 10px; font-weight: 800; margin-left: auto;">AI</span>
              </li>

              <div class="nav-section-title">การตั้งค่าและทดสอบ</div>
              <li class="nav-item ${this.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
                <span class="icon">⚙️</span>
                <span>ตั้งค่ากฎ & โควต้า</span>
              </li>
              <li class="nav-item ${this.currentTab === 'tests' ? 'active' : ''}" data-tab="tests">
                <span class="icon">🧪</span>
                <span>ชุดทดสอบระบบ (Test Suite)</span>
              </li>
            </ul>

            <div class="sidebar-footer">
              <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>สถานะตาราง:</span>
                <strong style="color: ${appState.currentStatus === 'published' ? 'var(--success-500)' : 'var(--warning-500)'}">
                  ${appState.currentStatus === 'published' ? '✅ เผยแพร่แล้ว' : (appState.currentStatus === 'review' ? '⏳ รอตรวจสอบ' : '📝 แบบร่าง')}
                </strong>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-toggle-theme" style="width: 100%;">
                🌓 สลับโหมด สว่าง / มืด
              </button>
              <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 6px; margin-top: 4px;">
                <span>🌐 Open Source</span>
                <button class="btn btn-secondary btn-sm" id="btn-show-license" style="padding: 2px 6px; font-size: 10px; line-height: 1.2;">
                  MIT License
                </button>
              </div>
            </div>
          </aside>

          <!-- Main Wrapper -->
          <div class="main-wrapper">
            <!-- Topbar Header -->
            <header class="topbar">
              <div class="topbar-left">
                <h1 class="page-title">${this.getPageTitle()}</h1>
              </div>

              <div class="topbar-right">
                <!-- Quick AI Assistant Button -->
                <button class="btn btn-accent btn-sm" id="btn-quick-ai" style="display: flex; align-items: center; gap: 4px; font-weight: 700; box-shadow: 0 2px 8px rgba(245,158,11,0.35);">
                  🤖 ผู้ช่วย AI
                </button>

                <!-- สลับบทบาทและผู้ใช้งาน (User & Role Switcher) -->
                <div class="user-profile-badge" id="btn-open-user-modal" style="cursor: pointer;" title="คลิกเพื่อสลับบทบาทหรือเข้าสู่ระบบในฐานะ Admin / อาจารย์ / ผู้คุมสอบ">
                  <span style="font-size: 18px;">${appState.isAdmin() ? '👑' : (appState.isTeacher() ? '👨‍🏫' : '👤')}</span>
                  <div style="display: flex; flex-direction: column; line-height: 1.2;">
                    <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${appState.currentUser?.name}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${appState.isAdmin() ? 'แอดมิน (แก้ไขได้ทุกอย่าง)' : (appState.isTeacher() ? 'อาจารย์' : 'เจ้าหน้าที่คุมสอบ')}</span>
                  </div>
                  <span class="role-tag ${appState.currentUser?.role}">
                    ${appState.isAdmin() ? '👑 Admin' : (appState.isTeacher() ? '👨‍🏫 อาจารย์' : '👤 ผู้คุมสอบ')}
                  </span>
                  <span class="btn btn-sm btn-accent" style="padding: 3px 8px; font-size: 11px; margin-left: 2px;">
                    🔑 สลับผู้ใช้ ▾
                  </span>
                </div>

                <!-- Quick Undo / Redo (Admin Only) -->
                ${appState.isAdmin() ? `
                  <div style="display: flex; gap: 4px; border-left: 1px solid var(--border-subtle); padding-left: 8px;">
                    <button class="btn btn-secondary btn-sm" id="btn-undo" ${!appState.canUndo() ? 'disabled style="opacity: 0.5;"' : ''} title="ย้อนกลับ (Undo)">
                      ↩️
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-redo" ${!appState.canRedo() ? 'disabled style="opacity: 0.5;"' : ''} title="ทำซ้ำ (Redo)">
                      ↪️
                    </button>
                  </div>
                ` : ''}

                <!-- Quick Export Dropdown -->
                <button class="btn btn-secondary btn-sm" id="btn-export-excel">
                  📗 Excel
                </button>
                <button class="btn btn-accent btn-sm" id="btn-print-door-signs" style="font-weight: 700;" title="พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งจริง (10 ห้อง 520 ที่นั่ง)">
                  🪧 ป้ายหน้าห้อง & ผังที่นั่ง
                </button>
                <button class="btn btn-primary btn-sm" id="btn-export-pdf">
                  🖨️ PDF
                </button>
              </div>
            </header>

            <!-- Main Content Body -->
            <main class="content-body">
              ${this.renderActiveTab(valResult, totalSlots, assignedSlots, isComplete)}
            </main>
          </div>
        </div>
      `}

      <!-- Modal Container -->
      <div id="modal-root">${this.activeModal ? this.renderModal() : ''}</div>
    `;

    this.attachEvents();
  }

  getPageTitle() {
    switch (this.currentTab) {
      case 'visitor': return '🌐 ศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17 — มหาวิทยาลัยราชภัฏบุรีรัมย์';
      case 'my-profile': return '👤 ข้อมูลและตารางคุมสอบของฉัน';
      case 'dashboard': return '📊 แดชบอร์ดภาพรวมการจัดสอบ';
      case 'scheduler': return '📅 จัดตารางและตรวจสอบผู้คุมสอบ';
      case 'master-data': return '🗂️ จัดการข้อมูลห้องสอบ ผู้คุม และรอบสอบ';
      case 'what-if': return '🔮 เครื่องมือจำลองสถานการณ์ (What-if Simulator)';
      case 'versions': return '🕒 ประวัติเวอร์ชันและเปรียบเทียบการเปลี่ยนแปลง';
      case 'settings': return '⚙️ ตั้งค่ากฎเกณฑ์ โควต้า และน้ำหนักคะแนน';
      case 'audit': return '📋 บันทึกประวัติการเปลี่ยนแปลง (Audit Trail)';
      case 'tests': return '🧪 รันชุดทดสอบอัตโนมัติ (Automated Tests & Benchmarks)';
      case 'ai-agent': return '🤖 ผู้ช่วยจัดตารางอัจฉริยะ (ProctorAI Agent)';
      default: return 'ระบบจัดตารางผู้คุมสอบ';
    }
  }

  renderActiveTab(valResult, totalSlots, assignedSlots, isComplete) {
    switch (this.currentTab) {
      case 'visitor':
        return renderVisitorPortal(appState);
      case 'my-profile':
        return this.renderMyProfileTab();
      case 'dashboard':
        return this.renderDashboardTab(valResult, totalSlots, assignedSlots, isComplete);
      case 'scheduler':
        return this.renderSchedulerTab(valResult, totalSlots, assignedSlots);
      case 'master-data':
        return this.renderMasterDataTab();
      case 'what-if':
        return this.renderWhatIfTab();
      case 'versions':
        return this.renderVersionsTab();
      case 'settings':
        return this.renderSettingsTab();
      case 'audit':
        return this.renderAuditTab();
      case 'tests':
        return this.renderTestsTab();
      case 'ai-agent':
        return this.renderAIAgentTab();
      default:
        return '<div>ไม่พบหน้าที่ระบุ</div>';
    }
  }

  // --- 7.0 หน้าข้อมูลและตารางส่วนบุคคล (สำหรับอาจารย์ และ ผู้คุมสอบ) ---
  renderMyProfileTab() {
    const proctor = appState.getLoggedInProctor();
    if (!proctor) {
      return `
        <div class="card" style="text-align: center; padding: 40px; border-top: 4px solid var(--accent-500);">
          <div style="font-size: 48px; margin-bottom: 12px;">👑</div>
          <h2 style="margin-bottom: 8px;">คุณกำลังเข้าสู่ระบบในฐานะ "ผู้ดูแลระบบ (Admin)"</h2>
          <p style="color: var(--text-muted); font-size: 15px; margin-bottom: 24px; line-height: 1.6;">
            ในฐานะแอดมิน คุณสามารถจัดการทุกอย่างในระบบได้จากแท็บ <strong>"ตารางผู้คุมสอบ"</strong> หรือ <strong>"ข้อมูลระบบ"</strong><br>
            หากต้องการทดสอบมุมมองของ "อาจารย์" หรือ "เจ้าหน้าที่คุมสอบ" กรุณากดปุ่มด้านล่างเพื่อสลับบัญชี
          </p>
          <button class="btn btn-accent" id="btn-open-user-modal-inline" style="padding: 10px 24px; font-size: 15px;">
            🔑 สลับเป็นบัญชีอาจารย์ หรือ ผู้คุมสอบ
          </button>
        </div>
      `;
    }

    // หางานของคนนี้
    const myAssignments = appState.assignments.filter(a => a.proctorId === proctor.id);
    const myUnavails = appState.unavailabilities.filter(u => u.proctorId === proctor.id);

    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));

    // คำนวณชั่วโมงปฏิบัติงาน
    let totalMinutes = 0;
    for (const a of myAssignments) {
      const s = sessionMap.get(a.sessionId);
      if (s) {
        const start = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
        const end = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);
        totalMinutes += (end - start) / 60000;
      }
    }
    const totalHours = (totalMinutes / 60).toFixed(1);

    return `
      <!-- โปรไฟล์ส่วนบุคคล -->
      <div class="card" style="border-top: 4px solid var(--primary-500); background: linear-gradient(135deg, var(--bg-surface), var(--primary-50));">
        <div class="card-body" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 18px;">
            <div style="width: 60px; height: 60px; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--primary-600), var(--accent-500)); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: var(--shadow-md);">
              ${proctor.proctorType === 'faculty' ? '👨‍🏫' : '👤'}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <h2 style="font-size: 20px; font-weight: 700;">${proctor.firstName} ${proctor.lastName}</h2>
                <span class="role-tag ${proctor.proctorType === 'faculty' ? 'teacher' : 'proctor'}">
                  ${proctor.proctorType === 'faculty' ? '👨‍🏫 อาจารย์' : '👤 เจ้าหน้าที่'} (${proctor.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย'})
                </span>
                <span class="badge ${proctor.isActive ? 'badge-normal' : 'badge-danger'}">
                  ${proctor.isActive ? 'พร้อมปฏิบัติงาน' : 'งดรับงาน'}
                </span>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                รหัส: <strong>${proctor.id}</strong> | สังกัด: <strong>${proctor.department}</strong> | 📞 ${proctor.phone} | ✉️ ${proctor.email}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-accent btn-sm" id="btn-edit-my-profile">
              ✏️ แก้ไขข้อมูลของฉัน
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sudden-leave-modal">
              🚑 แจ้งขอสลับเวร / ลา
            </button>
          </div>
        </div>
      </div>

      <!-- สรุปภาระงานส่วนตัว -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">📅 รอบที่ได้รับมอบหมาย</div>
          <div class="metric-value" style="color: var(--primary-600);">${myAssignments.length} <span style="font-size: 15px; font-weight: normal;">รอบ</span></div>
          <div class="metric-sub">โควต้าโครงการสูงสุด: ${proctor.projectQuota} รอบ</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">⏱️ ชั่วโมงปฏิบัติงานรวม</div>
          <div class="metric-value" style="color: var(--accent-600);">${totalHours} <span style="font-size: 15px; font-weight: normal;">ชั่วโมง</span></div>
          <div class="metric-sub">จากเพดาน ${proctor.maxHours} ชั่วโมง</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">⏳ วัน-เวลาที่ไม่สะดวกคุมสอบ</div>
          <div class="metric-value">${myUnavails.length} <span style="font-size: 15px; font-weight: normal;">ช่วงเวลา</span></div>
          <div class="metric-sub">ระบบจะไม่จัดตารางทับซ้อนช่วงนี้</div>
        </div>
      </div>

      <!-- ส่วนที่ 1: ตารางคุมสอบที่ได้รับมอบหมาย -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div class="card-title">📅 ตารางการปฏิบัติงานคุมสอบของฉัน (${myAssignments.length} รอบ)</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-accent btn-sm" id="btn-print-my-schedule">
              🖨️ พิมพ์ตารางคุมสอบของฉัน (PDF)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-goto-scheduler-from-profile">
              ดูตารางภาพรวมทั้งหมด →
            </button>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รอบสอบ</th>
                  <th>วันที่</th>
                  <th>เวลาปฏิบัติงานจริง (รวมเตรียมตัว)</th>
                  <th>ห้องสอบ CBT</th>
                  <th>อาคาร / ชั้น</th>
                  <th>หน้าที่</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${myAssignments.map(a => {
                  const s = sessionMap.get(a.sessionId);
                  const r = roomMap.get(a.roomId);
                  if (!s) return '';
                  const startWithPrep = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
                  const endWithWrap = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);

                  return `
                    <tr>
                      <td><strong>${s.name}</strong> (${s.id})</td>
                      <td>${formatThaiDate(s.date)}</td>
                      <td>
                        <strong style="color: var(--primary-600);">${formatThaiTimeRange(startWithPrep, endWithWrap)}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">(เวลาสอบจริง: ${formatThaiTimeRange(s.startTime, s.endTime)})</div>
                      </td>
                      <td>
                        <span class="badge" style="background: var(--accent-50); color: var(--accent-600); border: 1px solid var(--accent-200); font-weight: 700;">
                          💻 ${r ? r.name : (a.role === 'reserve' ? 'กองอำนวยการ' : a.roomId)}
                        </span>
                      </td>
                      <td>${r ? `${r.building} (ชั้น ${r.floor})` : '-'}</td>
                      <td>
                        <span class="badge ${a.role === 'chief' ? 'badge-warning' : 'badge-normal'}">
                          ${a.role === 'chief' ? '⭐ หัวหน้าห้อง' : (a.role === 'reserve' ? '🛡️ ผู้คุมสำรอง' : '👤 ผู้ช่วย')}
                        </span>
                      </td>
                      <td>
                        <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}">
                          ${a.status === 'locked' ? '🔒 ยืนยันแล้ว' : '✅ ปกติ'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${myAssignments.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                      ยังไม่มีรอบสอบที่ได้รับมอบหมายในขณะนี้
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ส่วนที่ 2: ช่วงเวลาที่ไม่สะดวกคุมสอบ (Unavailability) ที่ตนเองสามารถเพิ่ม/ลบได้ -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="card-title">⏳ ช่วงเวลาที่ไม่สะดวกคุมสอบของฉัน</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              คุณสามารถแจ้งวัน-เวลาติดภารกิจ หรือติดสอน ระบบจะไม่จัดตารางคุมสอบในช่วงเวลาดังกล่าว
            </div>
          </div>
          <button class="btn btn-accent btn-sm" id="btn-add-my-unavail">
            ➕ แจ้งวัน-เวลาที่ไม่สะดวก
          </button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ช่วงเวลาที่ไม่ว่าง</th>
                  <th>เหตุผล / ภารกิจ</th>
                  <th style="text-align: center;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${myUnavails.map(u => `
                  <tr>
                    <td>${formatThaiDate(u.startTime.split('T')[0])}</td>
                    <td><strong>${formatThaiTimeRange(u.startTime, u.endTime)}</strong></td>
                    <td>${u.reason || 'ติดภารกิจ'}</td>
                    <td style="text-align: center;">
                      <button class="btn btn-danger btn-sm" data-action="delete-my-unavail" data-unavail-id="${u.id}" style="padding: 2px 8px; font-size: 11px;">
                        🗑️ ลบ
                      </button>
                    </td>
                  </tr>
                `).join('')}
                ${myUnavails.length === 0 ? `
                  <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">
                      ไม่มีรายการแจ้งไม่ว่าง คุณพร้อมปฏิบัติงานทุกช่วงเวลา
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.1 หน้าแดชบอร์ด (Modernized Card-Based Dashboard) ---
  renderDashboardTab(valResult, totalSlots, assignedSlots, isComplete) {
    const percentAssigned = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;
    const activeRooms = appState.rooms.filter(r => r.isActive).length;
    const activeProctors = appState.proctors.filter(p => p.isActive).length;
    const chiefCount = appState.proctors.filter(p => p.isActive && p.level === 'chief').length;
    const totalCapacity = appState.rooms.reduce((s, r) => s + r.capacity, 0);

    return `
      <!-- สรุปตัวชี้วัดหลัก 4 การ์ด (Modern KPI Cards v2) -->
      <div class="metrics-grid-modern">
        <!-- การ์ด 1: ห้องสอบ CBT -->
        <div class="kpi-card-v2 accent-primary" data-action="view-kpi-rooms" role="button" tabindex="0" title="คลิกเพื่อดูรายละเอียดห้องปฏิบัติการคอมพิวเตอร์ (CBT) ทั้ง 10 ห้อง">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle cbt">💻</div>
            <span class="kpi-click-badge">ดูห้อง ↗</span>
          </div>
          <div class="kpi-title-text">ห้องปฏิบัติการ CBT (อาคาร 17)</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number">${activeRooms} <span class="kpi-unit-label">ห้อง</span></div>
            <div style="font-size: 13px; font-weight: 700; color: var(--primary-600);">${totalCapacity} เครื่อง</div>
          </div>
          <div class="kpi-sub-detail">
            <span>🏛️ ชั้น 1 (4 ห้อง) &bull; ชั้น 2 (6 ห้อง)</span>
          </div>
        </div>

        <!-- การ์ด 2: ผู้คุมสอบในระบบ -->
        <div class="kpi-card-v2 accent-primary" data-action="view-kpi-proctors" role="button" tabindex="0" title="คลิกเพื่อดูรายชื่อและสถานะผู้คุมสอบทั้งหมด 40 คน">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle proctors">👥</div>
            <span class="kpi-click-badge">ดูรายชื่อ ↗</span>
          </div>
          <div class="kpi-title-text">ผู้คุมสอบในระบบ</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number">${activeProctors} <span class="kpi-unit-label">คน</span></div>
            <div style="font-size: 13px; font-weight: 700; color: #2563EB;">หัวหน้า ${chiefCount} คน</div>
          </div>
          <div class="kpi-sub-detail">
            <span>🛡️ หัวหน้าห้อง ${chiefCount} &bull; ผู้ช่วย ${activeProctors - chiefCount} คน</span>
          </div>
        </div>

        <!-- การ์ด 3: สถานะการจัดตาราง -->
        <div class="kpi-card-v2 ${isComplete ? 'accent-success' : 'accent-warning'}" data-action="view-kpi-schedule-status" role="button" tabindex="0" title="คลิกเพื่อดูสถานะความคืบหน้าการจัดตารางรายรอบ">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle schedule">🎯</div>
            <span class="kpi-click-badge">ความคืบหน้า ↗</span>
          </div>
          <div class="kpi-title-text">ความคืบหน้าจัดตาราง</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number" style="color: ${isComplete ? 'var(--success-500)' : 'var(--warning-600)'};">
              ${percentAssigned}%
            </div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text-muted);">${assignedSlots} / ${totalSlots} ที่นั่ง</div>
          </div>
          <div class="kpi-sub-detail">
            <div class="session-progress-track" style="flex: 1; height: 5px;">
              <div class="session-progress-fill ${isComplete ? 'complete' : 'incomplete'}" style="width: ${percentAssigned}%;"></div>
            </div>
            <span style="font-weight: 600;">${isComplete ? 'ครบสมบูรณ์' : `ขาด ${totalSlots - assignedSlots}`}</span>
          </div>
        </div>

        <!-- การ์ด 4: การตรวจสอบกฎ (Rules Audit) -->
        <div class="kpi-card-v2 ${valResult.errorCount > 0 ? 'accent-danger' : 'accent-success'}" data-action="view-kpi-rules-audit" role="button" tabindex="0" title="คลิกเพื่อดูรายงานการตรวจสอบกฎ H1-H8 และ S1-S7">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle ${valResult.errorCount > 0 ? 'rules error' : 'rules'}">${valResult.errorCount > 0 ? '🚨' : '🛡️'}</div>
            <span class="kpi-click-badge">ตรวจกฎ ↗</span>
          </div>
          <div class="kpi-title-text">ความถูกต้องตามกฎเกณฑ์</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number" style="color: ${valResult.errorCount > 0 ? 'var(--danger-500)' : 'var(--success-500)'};">
              ${valResult.errorCount > 0 ? `${valResult.errorCount} ข้อ` : 'ผ่าน 100%'}
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted);">${valResult.warningCount} คำเตือน (Soft)</div>
          </div>
          <div class="kpi-sub-detail">
            <span>${valResult.errorCount > 0 ? '⚠️ ต้องแก้ไขก่อนใช้งานจริง' : '✅ ผ่านเกณฑ์ Hard Rules H1-H8 ครบถ้วน'}</span>
          </div>
        </div>
      </div>

      <!-- Quick Command Center (Hero Action Panel) -->
      <div class="hero-action-panel">
        <div class="hero-action-header">
          <div>
            <div class="hero-action-title">
              <span>⚡ แผงดำเนินการด่วน (Quick Command Center)</span>
            </div>
            <div class="hero-action-desc">
              ระบบจัดตารางอัจฉริยะแบบ Greedy Constraint Satisfaction ตรวจสอบกฎ H1-H8 ครบทุกมิติ
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-run-solver-quick" style="padding: 9px 20px; font-weight: 700;">
              🚀 เริ่มจัดตารางอัตโนมัติ
            </button>
            <button class="btn btn-warning" id="btn-quick-gen-proctors-hero" style="padding: 9px 18px; font-weight: 700; background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; border: none; box-shadow: 0 2px 8px rgba(245,158,11,0.35);" title="สุ่มสร้างรายชื่ออาจารย์และบุคลากร 80 ท่านให้เพียงพอกับสนามสอบทันทีโดยไม่ต้องพิมพ์เอง">
              🎲 สุ่มสร้างผู้คุมให้พอดี (80 คน)
            </button>
            <button class="btn btn-secondary" id="btn-add-20-proctors-hero" style="padding: 9px 14px;" title="สุ่มเพิ่มอาจารย์และบุคลากรอีก 20 คน">
              ➕ สุ่มเพิ่ม 20 คน
            </button>
            <button class="btn btn-secondary" id="btn-calc-min-proctor">
              🔍 คำนวณผู้คุมขั้นต่ำ
            </button>
          </div>
        </div>

        <!-- 4 Quick Action Cards Grid -->
        <div class="quick-actions-grid">
          <div class="quick-action-card" data-quick-action="run-solver" role="button" tabindex="0" title="รันอัลกอริทึมจัดตารางอัตโนมัติทันที">
            <div class="quick-action-icon" style="background: hsl(268, 90%, 96%); color: var(--primary-600);">🚀</div>
            <div class="quick-action-content">
              <div class="quick-action-name">จัดตารางอัตโนมัติ</div>
              <div class="quick-action-sub">กดครั้งเดียวจัดครบ 100%</div>
            </div>
          </div>

          <div class="quick-action-card" data-quick-action="gen-proctors" role="button" tabindex="0" title="สุ่มสร้างรายชื่อผู้คุม 80 คนให้เพียงพอกับห้องสอบทันที">
            <div class="quick-action-icon" style="background: hsl(43, 95%, 95%); color: #D97706;">🎲</div>
            <div class="quick-action-content">
              <div class="quick-action-name">สุ่มสร้างผู้คุมสอบ</div>
              <div class="quick-action-sub">80 คน ไม่ต้องพิมพ์เอง</div>
            </div>
          </div>

          <div class="quick-action-card" data-quick-action="floor-plan" role="button" tabindex="0" title="เปิดดูแผนผังอาคาร 17 และรายละเอียดห้อง CBT">
            <div class="quick-action-icon" style="background: hsl(155, 80%, 95%); color: var(--success-500);">🏛️</div>
            <div class="quick-action-content">
              <div class="quick-action-name">ผังอาคาร 17 & CBT</div>
              <div class="quick-action-sub">10 ห้อง 520 เครื่องสอบ</div>
            </div>
          </div>

          <div class="quick-action-card" data-quick-action="rules-audit" role="button" tabindex="0" title="ตรวจสอบรายงานกฎ H1-H8 และ S1-S7">
            <div class="quick-action-icon" style="background: hsl(210, 95%, 96%); color: #2563EB;">📋</div>
            <div class="quick-action-content">
              <div class="quick-action-name">ตรวจสอบกฎระเบียบ</div>
              <div class="quick-action-sub">รายงาน H1-H8 ละเอียด</div>
            </div>
          </div>
        </div>
      </div>

      ${this.minProctorResult ? `
      <!-- กล่องแสดงผลลัพธ์การคำนวณจำนวนผู้คุมขั้นต่ำ (ข้อกำหนด 6.2) -->
      <div class="card" style="border-left: 4px solid var(--primary-500);">
        <div class="card-header">
          <div class="card-title">💡 ผลการประเมินจำนวนผู้คุมขั้นต่ำ (Minimum Proctor Calculation)</div>
          <button class="btn btn-secondary btn-sm" id="btn-close-min-calc">ปิด</button>
        </div>
        <div class="card-body">
          <p style="font-size: 15px; margin-bottom: 12px; line-height: 1.6;">${this.minProctorResult.explanation}</p>
          <div style="font-weight: 600; margin-bottom: 6px;">คำแนะนำและทางเลือก:</div>
          <ul style="padding-left: 20px; line-height: 1.6;">
            ${this.minProctorResult.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>` : ''}

      ${valResult.violations.length > 0 ? `
      <!-- กล่องสรุปข้อผิดพลาดและคำเตือนแบบกระชับ (Collapsible Violation Card) -->
      <div class="violations-summary-card ${valResult.errorCount > 0 ? 'has-error' : ''}">
        <div class="violations-summary-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">${valResult.errorCount > 0 ? '🚨' : '⚠️'}</span>
            <div>
              <strong style="color: ${valResult.errorCount > 0 ? 'var(--danger-600)' : 'var(--warning-600)'};">
                ${valResult.errorCount > 0 ? `พบข้อผิดพลาดที่ขัดกฎ Hard Constraints (${valResult.errorCount} ข้อ)` : `พบข้อสังเกต Soft Constraints (${valResult.warningCount} รายการ)`}
              </strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                แสดงตัวอย่าง 3 รายการแรก — คลิกปุ่มขวามือเพื่อดูและแก้ไขแบบเจาะลึก
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="violations-badge-counter">${valResult.violations.length} รายการ</span>
            <button class="btn btn-secondary btn-sm" data-action="view-kpi-rules-audit">
              ดูทั้งหมด ↗
            </button>
          </div>
        </div>
        <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-surface);">
          ${valResult.violations.slice(0, 3).map(v => `
            <div class="alert ${v.severity === 'error' ? 'alert-danger' : 'alert-warning'}" style="margin: 0; padding: 10px 14px;">
              <div>
                <strong>[${v.ruleCode}] ${v.ruleName}:</strong> ${v.message}<br>
                <span style="font-size: 12px; opacity: 0.9;">💡 แนะนำ: ${v.suggestion}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- ส่วนรอบการสอบ (มีปุ่มสลับมุมมอง การ์ด / ตาราง) -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="card-title">📅 รอบการสอบทั้งหมด (${appState.sessions.length} รอบ)</div>
            <!-- ปุ่มสลับมุมมอง การ์ด vs ตาราง -->
            <div class="view-toggle-group">
              <button class="view-toggle-btn ${this.dashboardSessionView === 'cards' ? 'active' : ''}" data-session-view="cards" title="แสดงสรุปแบบการ์ด แยกแต่ละรอบ">
                🗂️ การ์ดสรุป
              </button>
              <button class="view-toggle-btn ${this.dashboardSessionView === 'table' ? 'active' : ''}" data-session-view="table" title="แสดงตารางข้อมูลแบบละเอียด">
                📋 ตารางละเอียด
              </button>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-add-session-dash">➕ เพิ่มรอบการสอบใหม่</button>
            <button class="btn btn-secondary btn-sm" id="btn-goto-scheduler">ดูตารางผู้คุมแบบเต็ม →</button>
          </div>
        </div>

        <div class="card-body" style="padding: 0;">
          ${this.dashboardSessionView === 'cards' ? `
            <!-- มุมมองการ์ด (Card View): สวยงาม เข้าใจง่าย ข้อมูลไม่ล้นจอ -->
            <div class="session-cards-grid">
              ${appState.sessions.map(s => {
                const sAllocs = appState.allocations.filter(a => a.sessionId === s.id);
                const sAssigns = appState.assignments.filter(a => a.sessionId === s.id);
                const neededInSession = sAllocs.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
                  + appState.settings.hardConstraints.h8_reserve_proctors_per_session;
                const isFull = sAssigns.length >= neededInSession;
                const percentFull = neededInSession > 0 ? Math.min(100, Math.round((sAssigns.length / neededInSession) * 100)) : 100;
                const prepTime = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
                const wrapTime = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);

                return `
                  <div class="session-card">
                    <div class="session-card-header">
                      <div class="session-card-title-group">
                        <span class="session-card-code">${s.id}</span>
                        <div class="session-card-name">${s.name}</div>
                      </div>
                      <button class="btn btn-danger btn-sm" data-action="cancel-session" data-session-id="${s.id}" style="padding: 2px 7px; font-size: 11px;" title="ยกเลิกรอบสอบนี้">
                        ❌ ยกเลิก
                      </button>
                    </div>

                    <!-- แถบป้ายข้อมูล วันที่ เวลา ห้อง ผู้สอบ -->
                    <div class="session-card-badges">
                      <span class="session-badge-pill" title="วันที่สอบ">
                        📅 ${formatThaiDate(s.date)}
                      </span>
                      <span class="session-badge-pill" title="เวลาสอบจริง">
                        ⏰ ${formatThaiTimeRange(s.startTime, s.endTime)}
                      </span>
                      <span class="session-badge-pill" title="เวลาปฏิบัติงานรวม prep/wrap">
                        ⏱️ เข้างาน ${formatThaiTime(prepTime)} - ${formatThaiTime(wrapTime)}
                      </span>
                      <span class="session-badge-pill" title="จำนวนห้องสอบ CBT">
                        🏛️ ${sAllocs.length} ห้อง
                      </span>
                      <span class="session-badge-pill" title="ผู้เข้าสอบรวม">
                        👥 ${s.totalExaminees} คน
                      </span>
                    </div>

                    <!-- แถบแสดงสถานะผู้คุมสอบ (Proctor Status Progress Meter) -->
                    <div class="session-proctor-meter">
                      <div class="session-meter-header">
                        <span class="session-meter-label">ผู้คุมสอบประจำรอบ:</span>
                        <span class="session-meter-status ${isFull ? 'complete' : 'incomplete'}">
                          ${isFull ? `ครบแล้ว (${sAssigns.length}/${neededInSession})` : `ขาดอีก ${neededInSession - sAssigns.length} คน (${sAssigns.length}/${neededInSession})`}
                        </span>
                      </div>
                      <div class="session-progress-track">
                        <div class="session-progress-fill ${isFull ? 'complete' : 'incomplete'}" style="width: ${percentFull}%;"></div>
                      </div>
                    </div>

                    <div class="session-card-footer">
                      <button class="btn btn-secondary btn-sm" data-action="view-session-scheduler" data-session-id="${s.id}" style="width: 100%; font-size: 12px; justify-content: center;">
                        🔍 ดูตารางผู้คุมรอบนี้ใน Scheduler →
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <!-- มุมมองตารางแบบละเอียด (Table View) -->
            <div class="table-wrapper" style="border: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>รหัสรอบ</th>
                    <th>ชื่อการสอบ</th>
                    <th>วันที่</th>
                    <th>เวลาสอบจริง</th>
                    <th>เวลาปฏิบัติงาน (รวม prep/wrap)</th>
                    <th>จำนวนห้อง</th>
                    <th>ผู้เข้าสอบรวม</th>
                    <th>สถานะผู้คุม</th>
                    <th style="text-align: center;">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${appState.sessions.map(s => {
                    const sAllocs = appState.allocations.filter(a => a.sessionId === s.id);
                    const sAssigns = appState.assignments.filter(a => a.sessionId === s.id);
                    const neededInSession = sAllocs.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
                      + appState.settings.hardConstraints.h8_reserve_proctors_per_session;
                    const isFull = sAssigns.length >= neededInSession;

                    return `
                      <tr>
                        <td><strong>${s.id}</strong></td>
                        <td>${s.name}</td>
                        <td>${formatThaiDate(s.date)}</td>
                        <td>${formatThaiTimeRange(s.startTime, s.endTime)}</td>
                        <td>${formatThaiTimeRange(new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000), new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000))}</td>
                        <td>${sAllocs.length} ห้อง</td>
                        <td>${s.totalExaminees} คน</td>
                        <td>
                          <span class="badge ${isFull ? 'badge-normal' : 'badge-warning'}">
                            ${isFull ? 'ครบแล้ว' : `ขาดอีก ${neededInSession - sAssigns.length} คน`} (${sAssigns.length}/${neededInSession})
                          </span>
                        </td>
                        <td style="text-align: center;">
                          <button class="btn btn-danger btn-sm" data-action="cancel-session" data-session-id="${s.id}" style="padding: 2px 8px; font-size: 11px;" title="ยกเลิกรอบการสอบนี้">
                            ❌ ยกเลิก
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- 7.3 & 7.4 หน้าจัดตารางและ 3 มุมมอง ---
  renderSchedulerTab(valResult, totalSlots, assignedSlots) {
    return `
      <!-- แถบควบคุมบนสุด: สลับมุมมอง 3 แบบ + ปุ่มจัดตาราง -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; background-color: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); gap: 4px;">
          <button class="btn btn-sm ${this.scheduleSubView === 'grid' ? 'btn-primary' : 'btn-secondary'}" id="subview-grid">
            ⊞ ตามรอบ x ห้อง (กริด)
          </button>
          <button class="btn btn-sm ${this.scheduleSubView === 'personal' ? 'btn-primary' : 'btn-secondary'}" id="subview-personal">
            👤 รายบุคคล (ปฏิทิน)
          </button>
          <button class="btn btn-sm ${this.scheduleSubView === 'workload' ? 'btn-primary' : 'btn-secondary'}" id="subview-workload">
            📊 สรุปภาระงาน (กราฟ)
          </button>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${appState.isAdmin() ? `
            <button class="btn btn-accent btn-sm" id="btn-add-session-quick">
              ➕ เพิ่มรอบการสอบใหม่
            </button>
            <button class="btn btn-danger btn-sm" id="btn-clear-schedule" title="ล้างตารางที่จัดไว้เพื่อจัดใหม่หรือแก้ไขอย่างอิสระ">
              🗑️ ล้างตารางที่จัดไว้
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sudden-leave-modal">
              🚑 แจ้งผู้คุมลากะทันหัน
            </button>
            <button class="btn btn-primary btn-sm" id="btn-run-solver">
              ⚡ จัดอัตโนมัติ (Auto-Schedule)
            </button>
          ` : `
            <button class="btn btn-accent btn-sm" id="btn-goto-my-profile">
              👤 ไปที่ข้อมูลและตารางของฉัน
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sudden-leave-modal">
              🚑 แจ้งขอสลับเวร / ลา
            </button>
          `}
        </div>
      </div>

      <!-- แถบแจ้งเตือนสถานะบทบาท (Role Notice) -->
      ${!appState.isAdmin() ? `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: linear-gradient(135deg, var(--primary-50), var(--accent-50)); border: 1px solid var(--accent-500); padding: 10px 16px; border-radius: var(--radius-md); font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">💡</span>
            <span>
              คุณกำลังดูตารางในฐานะ <strong>"${appState.currentUser?.name}"</strong> 
              (ตำแหน่งที่ได้รับมอบหมายของคุณจะถูกเน้น <strong style="color: var(--accent-600);">⭐ สีทอง</strong> อย่างชัดเจนในตาราง)
            </span>
          </div>
          <button class="btn btn-sm btn-secondary" id="btn-open-user-modal-notice">🔑 สลับเป็น Admin เพื่อแก้ไขระบบ</button>
        </div>
      ` : ''}

      <!-- คำอธิบายสัญลักษณ์และสี (Accessibility: มีทั้งสี ไอคอน และข้อความ) -->
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--text-muted); background: var(--bg-surface); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <span><strong>สัญลักษณ์:</strong></span>
        <span class="badge badge-normal">✅ ปกติ / ผ่านกฎ</span>
        <span class="badge badge-warning">⚠️ ใกล้เต็มโควต้า</span>
        <span class="badge badge-danger">🚨 ผิดกฎ</span>
        <span class="badge badge-locked">🔒 ล็อกไว้</span>
        <span class="badge" style="border: 2px solid var(--accent-500); background: var(--accent-50); color: var(--accent-600); font-weight: 700;">⭐ ตำแหน่งของคุณ</span>
        <span>| 💡 <em>คลิกที่ชื่อผู้คุมเพื่อเปลี่ยนตัว / สลับห้อง / ปลดล็อก ได้ทันที</em></span>
      </div>

      ${this.scheduleSubView === 'grid' ? `
        <!-- แถบกรองรอบการสอบ (Session Filter Pills) ช่วยลดการ scroll ข้อมูลล้นจอ -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 8px 16px; border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">กรองรอบสอบ:</span>
            <button class="btn btn-sm ${this.selectedSessionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter-session="all" style="padding: 4px 12px; border-radius: var(--radius-full);">
              🌐 แสดงทุกรอบ (${appState.sessions.length})
            </button>
            ${appState.sessions.map(s => `
              <button class="btn btn-sm ${this.selectedSessionFilter === s.id ? 'btn-primary' : 'btn-secondary'}" data-filter-session="${s.id}" style="padding: 4px 12px; border-radius: var(--radius-full);" title="${s.name}">
                ${s.id}: ${s.name.length > 20 ? s.name.slice(0, 18) + '...' : s.name}
              </button>
            `).join('')}
          </div>
          ${this.selectedSessionFilter !== 'all' ? `
            <button class="btn btn-secondary btn-sm" data-filter-session="all" style="font-size: 12px; padding: 2px 8px;">
              ✕ ล้างตัวกรอง
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- สลับเนื้อหาตามมุมมองที่เลือก -->
      ${this.scheduleSubView === 'grid' ? this.renderGridView(valResult) : ''}
      ${this.scheduleSubView === 'personal' ? this.renderPersonalView() : ''}
      ${this.scheduleSubView === 'workload' ? this.renderWorkloadView() : ''}
    `;
  }

  // มุมมอง (ก) รอบ x ห้อง (Grid View)
  renderGridView(valResult) {
    const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));
    const sessionsToRender = (this.selectedSessionFilter && this.selectedSessionFilter !== 'all')
      ? appState.sessions.filter(s => s.id === this.selectedSessionFilter)
      : appState.sessions;

    const activeSessions = sessionsToRender.length > 0 ? sessionsToRender : appState.sessions;

    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${activeSessions.map(session => {
          const sessionAllocs = appState.allocations.filter(al => al.sessionId === session.id);
          const reserves = appState.assignments.filter(a => a.sessionId === session.id && a.role === 'reserve');

          return `
            <div class="card" style="border-top: 3px solid var(--primary-500);">
              <div class="card-header" style="background-color: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <strong style="font-size: 16px; color: var(--text-main);">${session.id}: ${session.name}</strong>
                    <span class="badge" style="background: var(--primary-50); color: var(--primary-600); font-weight: 700;">💻 ข้อสอบ CBT</span>
                  </div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">
                    📅 วันที่ ${formatThaiDate(session.date)} | ⏰ เวลาสอบ <strong>${formatThaiTimeRange(session.startTime, session.endTime)}</strong>
                    (เตรียมตัว ${session.prepMinutes} นาที / สรุป ${session.wrapMinutes} นาที)
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <!-- ผู้คุมสำรองประจำรอบ -->
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600;">สำรอง:</span>
                    ${reserves.map(r => {
                      const p = proctorMap.get(r.proctorId);
                      const isCurrentUser = appState.currentUser?.proctorId === r.proctorId;
                      return `
                        <span class="proctor-chip ${r.status === 'locked' ? 'is-locked' : ''} ${isCurrentUser ? 'is-current-user' : ''}" data-assign-id="${r.id}">
                          <span>${isCurrentUser ? '⭐ ' : (r.status === 'locked' ? '🔒 ' : '')}${p ? `${p.firstName} ${p.lastName}` : r.proctorId}</span>
                          <span style="color: var(--text-muted); font-size: 10px;">(สำรอง)</span>
                        </span>
                      `;
                    }).join('')}
                    ${appState.isAdmin() && reserves.length < appState.settings.hardConstraints.h8_reserve_proctors_per_session ? `
                      <button class="btn btn-secondary btn-sm" data-action="add-reserve" data-session-id="${session.id}">+ เพิ่มสำรอง</button>
                    ` : ''}
                  </div>

                  <!-- ปุ่มจัดการเฉพาะรอบนี้ (สำหรับ Admin) -->
                  <div style="display: flex; gap: 6px; border-left: 1px solid var(--border-subtle); padding-left: 10px; flex-wrap: wrap;">
                    ${appState.isAdmin() ? `
                      <button class="btn btn-secondary btn-sm" data-action="edit-session" data-session-id="${session.id}" title="แก้ไขเวลาสอบ วันที่ และชื่อรอบ" style="font-size: 12px;">
                        ✏️ แก้เวลา/ข้อมูลรอบ
                      </button>
                      <button class="btn btn-secondary btn-sm" data-action="add-room-to-session" data-session-id="${session.id}" title="เพิ่มห้องสอบ CBT เข้ามาในรอบนี้" style="font-size: 12px;">
                        ➕ เพิ่มห้องในรอบนี้
                      </button>
                      <button class="btn btn-secondary btn-sm" data-action="clear-session-assigns" data-session-id="${session.id}" title="ล้างผู้คุมเฉพาะรอบนี้เพื่อจัดใหม่" style="font-size: 12px;">
                        🔄 ล้างผู้คุมรอบนี้
                      </button>
                      <button class="btn btn-danger btn-sm" data-action="cancel-session" data-session-id="${session.id}" title="ยกเลิก/ลบรอบการสอบนี้ออกจากระบบ" style="font-size: 12px;">
                        ❌ ยกเลิกรอบนี้
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>

              <div class="card-body" style="padding: 16px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
                  ${sessionAllocs.map(alloc => {
                    const room = appState.rooms.find(r => r.id === alloc.roomId);
                    const roomAssigns = appState.assignments.filter(a => a.allocationId === alloc.id);
                    const chiefAssign = roomAssigns.find(a => a.role === 'chief');
                    const proctorAssigns = roomAssigns.filter(a => a.role === 'proctor');
                    const regularAssign1 = proctorAssigns.find(a => a.orderIndex === 2) || proctorAssigns[0];
                    const regularAssign2 = proctorAssigns.find(a => a.orderIndex === 3) || (proctorAssigns.length > 1 ? proctorAssigns[1] : null);
                    
                    const examinees = alloc.examineesInRoom || 0;
                    const threshold3 = appState.settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 61;
                    const needThree = examinees >= threshold3; // เช่น ห้อง 17201 (80 ที่นั่ง) คุม 3 คน
                    const needTwo = true; // คุมห้องละ 2 คนทุกห้อง

                    return `
                      <div class="grid-cell" style="border-radius: var(--radius-md); ${needThree ? 'border: 2px solid var(--accent-500);' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed var(--border-subtle); padding-bottom: 8px;">
                          <div>
                            <strong style="font-size: 14px; color: var(--text-main);">💻 ${room ? room.name : alloc.roomId}</strong>
                            <div style="font-size: 11px; color: var(--text-muted);">${room ? room.building : ''} (ชั้น ${room ? room.floor : 1})</div>
                          </div>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <span class="badge ${needThree ? 'badge-locked' : (examinees > 30 ? 'badge-warning' : 'badge-normal')}" style="font-size: 11px;">
                              ${examinees} คน (${needThree ? '3 ผู้คุม (ห้องใหญ่)' : '2 ผู้คุม'})
                            </span>
                            ${appState.isAdmin() ? `
                              <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 11px;" data-action="edit-alloc" data-alloc-id="${alloc.id}" title="แก้ไขจำนวนผู้สอบหรือเปลี่ยนห้อง">✏️</button>
                              <button class="btn btn-danger btn-sm" style="padding: 1px 6px; font-size: 11px;" data-action="remove-alloc" data-alloc-id="${alloc.id}" title="ถอดห้องนี้ออกจากรอบสอบ">🗑️</button>
                            ` : ''}
                          </div>
                        </div>

                        <!-- ตำแหน่ง 1: หัวหน้าห้อง (Chief) -->
                        <div class="proctor-slot-wrapper" style="margin-top: 6px;">
                          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px; display: flex; justify-content: space-between;">
                            <span>👑 หัวหน้าห้อง (Chief):</span>
                            <span style="font-size: 10px; color: var(--primary-600); font-weight: 500;">อาจารย์/สายวิชาการ</span>
                          </div>
                          <div class="proctor-slot-container"
                               data-drop-zone="slot"
                               data-session-id="${session.id}"
                               data-alloc-id="${alloc.id}"
                               data-room-id="${alloc.roomId}"
                               data-role="chief"
                               data-order-index="1">
                            ${chiefAssign ? this.renderProctorChip(chiefAssign, proctorMap, valResult) : `
                              <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                      style="width: 100%; border-style: dashed; padding: 6px 8px; font-size: 11px;"
                                      data-action="assign-slot"
                                      data-session-id="${session.id}"
                                      data-alloc-id="${alloc.id}"
                                      data-room-id="${alloc.roomId}"
                                      data-role="chief"
                                      data-order-index="1">
                                ➕ ระบุหัวหน้าห้อง (ลากมาวางได้)
                              </button>
                            `}
                          </div>
                        </div>

                        <!-- ตำแหน่ง 2: ผู้ช่วยผู้คุมคนที่ 1 (Assistant 1) -->
                        <div class="proctor-slot-wrapper" style="margin-top: 8px;">
                          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px; display: flex; justify-content: space-between;">
                            <span>👤 ผู้ช่วยคนที่ 1 (Assistant 1):</span>
                            <span style="font-size: 10px; color: var(--text-muted);">เจ้าหน้าที่/อาจารย์</span>
                          </div>
                          <div class="proctor-slot-container"
                               data-drop-zone="slot"
                               data-session-id="${session.id}"
                               data-alloc-id="${alloc.id}"
                               data-room-id="${alloc.roomId}"
                               data-role="proctor"
                               data-order-index="2">
                            ${regularAssign1 ? this.renderProctorChip(regularAssign1, proctorMap, valResult) : `
                              <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                      style="width: 100%; border-style: dashed; padding: 6px 8px; font-size: 11px;"
                                      data-action="assign-slot"
                                      data-session-id="${session.id}"
                                      data-alloc-id="${alloc.id}"
                                      data-room-id="${alloc.roomId}"
                                      data-role="proctor"
                                      data-order-index="2">
                                ➕ ระบุผู้ช่วยคนที่ 1 (ลากมาวางได้)
                              </button>
                            `}
                          </div>
                        </div>

                        <!-- ตำแหน่ง 3: ผู้ช่วยผู้คุมคนที่ 2 (Assistant 2 สำหรับห้องใหญ่ > 61 ที่นั่ง เช่น 17201 80 ที่นั่ง) -->
                        ${needThree ? `
                          <div class="proctor-slot-wrapper" style="margin-top: 8px; background: rgba(245, 158, 11, 0.05); padding: 6px; border-radius: var(--radius-sm); border: 1px dashed rgba(245, 158, 11, 0.4);">
                            <div style="font-size: 11px; color: #b45309; margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
                              <span>👤 ผู้ช่วยคนที่ 2 (ห้องใหญ่):</span>
                              <span class="badge badge-warning" style="font-size: 9px; padding: 1px 5px;">>61 ที่นั่ง</span>
                            </div>
                            <div class="proctor-slot-container"
                                 data-drop-zone="slot"
                                 data-session-id="${session.id}"
                                 data-alloc-id="${alloc.id}"
                                 data-room-id="${alloc.roomId}"
                                 data-role="proctor"
                                 data-order-index="3">
                              ${regularAssign2 ? this.renderProctorChip(regularAssign2, proctorMap, valResult) : `
                                <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                        style="width: 100%; border-style: dashed; padding: 6px 8px; font-size: 11px; background: rgba(245, 158, 11, 0.1);"
                                        data-action="assign-slot"
                                        data-session-id="${session.id}"
                                        data-alloc-id="${alloc.id}"
                                        data-room-id="${alloc.roomId}"
                                        data-role="proctor"
                                        data-order-index="3">
                                  ➕ ระบุผู้ช่วยคนที่ 2 (ลากมาวางได้)
                                </button>
                              `}
                            </div>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderProctorChip(assignment, proctorMap, valResult) {
    const p = proctorMap.get(assignment.proctorId);
    const hasViolation = valResult?.assignmentViolations?.has(assignment.id);
    const isCurrentUser = appState.currentUser?.proctorId === assignment.proctorId;

    return `
      <div class="proctor-chip ${assignment.status === 'locked' ? 'is-locked' : ''} ${hasViolation ? 'border-danger' : ''} ${isCurrentUser ? 'is-current-user' : ''}" 
           draggable="true"
           data-draggable-proctor="true"
           data-assign-id="${assignment.id}" 
           data-proctor-id="${assignment.proctorId}"
           data-session-id="${assignment.sessionId}"
           data-alloc-id="${assignment.allocationId}"
           data-room-id="${assignment.roomId || ''}"
           data-role="${assignment.role}"
           data-order-index="${assignment.orderIndex || 1}"
           title="${isCurrentUser ? '⭐ ตำแหน่งคุมสอบของคุณ (คลิกแก้ไข / ลากเพื่อย้ายหรือสลับ)' : (assignment.reason || 'คลิกเพื่อแก้ไข หรือลากเพื่อสลับห้อง/รอบ')}">
        <div style="display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="cursor: grab; font-size: 11px; color: var(--text-muted);" title="ลากเพื่อย้ายหรือสลับรอบ/ห้อง">⠿</span>
          <span>${isCurrentUser ? '⭐' : (assignment.status === 'locked' ? '🔒' : (assignment.role === 'chief' ? '👑' : '👤'))}</span>
          <span style="font-weight: 500;">${isCurrentUser ? '<strong>คุณ: </strong>' : ''}${p ? `${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}` : assignment.proctorId}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <span class="badge ${p?.proctorType === 'faculty' ? 'badge-normal' : 'badge-warning'}" style="font-size: 10px; padding: 1px 5px;">
            ${p ? (p.proctorType === 'faculty' ? 'อาจารย์' : 'จนท.') : ''}
          </span>
        </div>
      </div>
    `;
  }

  // มุมมอง (ข) รายบุคคล (Personal Calendar View)
  renderPersonalView() {
    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">ปฏิทินตารางคุมสอบรายบุคคล</div>
          <input type="text" id="input-search-proctor" class="form-input" style="max-width: 250px;" placeholder="🔍 ค้นหาชื่อผู้คุม...">
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ผู้คุมสอบ</th>
                  <th>สังกัด</th>
                  <th>ประเภท</th>
                  <th>รอบที่ได้รับมอบหมาย</th>
                  <th>ชั่วโมงสะสม</th>
                  <th>ภาระงานเทียบโควต้า</th>
                </tr>
              </thead>
              <tbody>
                ${appState.proctors.map(p => {
                  const assigns = appState.assignments.filter(a => a.proctorId === p.id);
                  const quota = p.projectQuota || 6;
                  const ratio = assigns.length / quota;

                  return `
                    <tr>
                      <td>
                        <strong>${p.firstName} ${p.lastName}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${p.id} • ${p.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย'}</div>
                      </td>
                      <td>${p.department}</td>
                      <td>${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}</td>
                      <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                          ${assigns.map(a => {
                            const s = sessionMap.get(a.sessionId);
                            const r = a.roomId ? roomMap.get(a.roomId) : null;
                            return `
                              <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}" title="${a.reason}">
                                ${s ? s.name.split(' - ')[1] || s.name : a.sessionId} (${r ? r.name : 'สำรอง'})
                              </span>
                            `;
                          }).join('') || '<span style="color: var(--text-muted); font-size: 12px;">(ไม่มีงาน)</span>'}
                        </div>
                      </td>
                      <td>${(assigns.length * 3.5).toFixed(1)} ชม.</td>
                      <td style="min-width: 140px;">
                        <div class="workload-bar-container">
                          <div style="display: flex; justify-content: space-between; font-size: 11px;">
                            <span>${assigns.length} / ${quota} รอบ</span>
                            <span>${Math.round(ratio * 100)}%</span>
                          </div>
                          <div class="workload-bar-track">
                            <div class="workload-bar-fill ${ratio > 1 ? 'workload-fill-danger' : (ratio >= 0.8 ? 'workload-fill-warning' : 'workload-fill-normal')}" 
                                 style="width: ${Math.min(100, Math.round(ratio * 100))}%;"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // มุมมอง (ค) สรุปภาระงาน (Workload Bar Chart View)
  renderWorkloadView() {
    // คำนวณสถิติภาระงาน
    const counts = appState.proctors.map(p => appState.assignments.filter(a => a.proctorId === p.id).length);
    const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / Math.max(1, counts.length);
    const sd = Math.sqrt(variance);

    return `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">📊 ภาระงานเฉลี่ย</div>
          <div class="metric-value">${mean.toFixed(1)} <span style="font-size: 15px; font-weight: normal;">รอบ/คน</span></div>
          <div class="metric-sub">จากจำนวนรอบสอบทั้งหมด</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">⚖️ ส่วนเบี่ยงเบนมาตรฐาน (SD)</div>
          <div class="metric-value" style="color: ${sd < 1.0 ? 'var(--success-500)' : 'var(--warning-500)'}">
            ${sd.toFixed(2)}
          </div>
          <div class="metric-sub">${sd < 1.0 ? 'กระจายงานดีเยี่ยมมาก' : 'กระจายงานอยู่ในเกณฑ์ปกติ'}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">👥 สัดส่วนอาจารย์ : เจ้าหน้าที่</div>
          <div class="metric-value">50 : 50</div>
          <div class="metric-sub">ผสมผสานตามเกณฑ์ soft constraint S5</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">กราฟแท่งเปรียบเทียบภาระงานรายคนเทียบกับโควต้า</div>
        </div>
        <div class="card-body">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${appState.proctors.map(p => {
              const count = appState.assignments.filter(a => a.proctorId === p.id).length;
              const quota = p.projectQuota || 6;
              const percent = Math.min(100, Math.round((count / quota) * 100));

              return `
                <div style="display: grid; grid-template-columns: 200px 1fr 60px; gap: 16px; align-items: center;">
                  <div style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <strong>${p.firstName} ${p.lastName}</strong>
                    <span style="color: var(--text-muted); font-size: 11px;">(${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'})</span>
                  </div>
                  <div class="workload-bar-track" style="height: 14px;">
                    <div class="workload-bar-fill ${count > quota ? 'workload-fill-danger' : (count >= quota - 1 ? 'workload-fill-warning' : 'workload-fill-normal')}" 
                         style="width: ${percent}%;"></div>
                  </div>
                  <div style="font-size: 12px; font-weight: 600; text-align: right;">${count} / ${quota}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.2 หน้าข้อมูลหลัก (Master Data) ---
  renderMasterDataTab() {
    return `
      <!-- แถบสลับตารางย่อย -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-sm ${this.masterDataSubTab === 'proctors' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="proctors">
            👥 ผู้คุมสอบ (${appState.proctors.length})
          </button>
          <button class="btn btn-sm ${this.masterDataSubTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="rooms">
            🏢 ห้องสอบ (${appState.rooms.length})
          </button>
          <button class="btn btn-sm ${this.masterDataSubTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="sessions">
            📅 รอบการสอบ (${appState.sessions.length})
          </button>
          <button class="btn btn-sm ${this.masterDataSubTab === 'unavail' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="unavail">
            ⛔ ช่วงเวลาไม่ว่าง (${appState.unavailabilities.length})
          </button>
          <button class="btn btn-primary btn-sm" id="btn-add-master-item" style="margin-left: 6px;">
            ➕ เพิ่ม${this.getMasterSubTabLabel()}
          </button>
          ${this.masterDataSubTab === 'proctors' ? `
            <button class="btn btn-warning btn-sm" id="btn-auto-gen-proctors-master" style="background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; font-weight: 700;" title="สุ่มสร้างรายชื่ออาจารย์และบุคลากร 80 ท่านให้ครบตามโควตาโดยไม่ต้องพิมพ์เอง">
              🎲 สุ่มสร้างผู้คุม 80 คน (ไม่ต้องพิมพ์เอง)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-add-random-20-master" title="สุ่มเพิ่มอาจารย์และบุคลากรอีก 20 ท่าน">
              ➕ สุ่มเพิ่ม 20 คน
            </button>
          ` : ''}
        </div>

        <!-- เครื่องมือจัดการข้อมูล: CSV & PDPA & Presets -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="btn-toggle-pdpa">
            ${this.maskPDPA ? '👁️ แสดงข้อมูลติดต่อ' : '🔒 ซ่อนข้อมูลส่วนบุคคล (PDPA)'}
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-download-template">
            📥 แม่แบบ CSV
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-export-current-csv">
            📤 ส่งออก CSV
          </button>
          <label class="btn btn-secondary btn-sm" style="margin: 0; cursor: pointer;">
            📥 นำเข้า CSV
            <input type="file" id="file-import-csv" accept=".csv" style="display: none;">
          </label>
        </div>
      </div>

      <!-- สลับชุดข้อมูลตัวอย่างขนาดต่างๆ (Seed Presets) -->
      <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-surface); padding: 10px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 13px;">
        <span><strong>ชุดข้อมูลจำลอง:</strong></span>
        ${Object.entries(SEED_PRESETS).map(([key, p]) => `
          <button class="btn btn-secondary btn-sm" data-action="load-preset" data-preset="${key}">
            ${p.label}
          </button>
        `).join('')}
      </div>

      <!-- ตารางข้อมูล -->
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            ${this.renderMasterDataTable()}
          </div>
        </div>
      </div>
    `;
  }

  getMasterSubTabLabel() {
    switch (this.masterDataSubTab) {
      case 'proctors': return 'ผู้คุมสอบ';
      case 'rooms': return 'ห้องสอบ';
      case 'sessions': return 'รอบการสอบ';
      case 'unavail': return 'ช่วงเวลาไม่ว่าง';
      default: return 'ข้อมูล';
    }
  }

  renderMasterDataTable() {
    if (this.masterDataSubTab === 'proctors') {
      const query = (this.proctorSearchQuery || '').toLowerCase().trim();
      const levelFilter = this.proctorFilterLevel || 'all';

      const filteredProctors = appState.proctors.filter(p => {
        if (levelFilter !== 'all' && p.level !== levelFilter) return false;
        if (!query) return true;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return p.id.toLowerCase().includes(query) ||
               fullName.includes(query) ||
               (p.department && p.department.toLowerCase().includes(query));
      });

      return `
        <!-- แถบค้นหาและกรองผู้คุมสอบ (Search & Filter Bar) -->
        <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 260px;">
            <input type="text" id="input-search-proctor" class="form-input" style="max-width: 320px; font-size: 13px;" placeholder="🔍 ค้นหาชื่อ, รหัส (เช่น P001), หรือคณะ..." value="${this.proctorSearchQuery || ''}">
            <select id="select-filter-level" class="form-input" style="width: auto; font-size: 13px;">
              <option value="all" ${levelFilter === 'all' ? 'selected' : ''}>ระดับทั้งหมด</option>
              <option value="chief" ${levelFilter === 'chief' ? 'selected' : ''}>เฉพาะหัวหน้าห้อง (Chief)</option>
              <option value="assistant" ${levelFilter === 'assistant' ? 'selected' : ''}>เฉพาะผู้ช่วย (Assistant)</option>
            </select>
            ${(query || levelFilter !== 'all') ? `
              <button class="btn btn-secondary btn-sm" id="btn-clear-proctor-filter" style="font-size: 12px;">
                ✕ ล้างตัวกรอง
              </button>
            ` : ''}
          </div>
          <div style="font-size: 13px; color: var(--text-muted); font-weight: 500;">
            แสดง <strong>${filteredProctors.length}</strong> จาก ${appState.proctors.length} คน
          </div>
        </div>

        ${filteredProctors.length === 0 ? `
          <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-size: 15px; font-weight: 600;">ไม่พบรายชื่อผู้คุมสอบที่ตรงกับเงื่อนไข</div>
            <div style="font-size: 13px; margin-top: 4px;">ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</div>
          </div>
        ` : `
          <table class="data-table proctor-master-table">
            <thead>
              <tr>
                <th style="width: 50px;">รหัส</th>
                <th style="min-width: 170px;">ผู้คุมสอบ (ชื่อ-นามสกุล / สิทธิ์)</th>
                <th style="min-width: 130px; max-width: 160px;">สังกัด / คณะ</th>
                <th style="min-width: 110px;">วันที่สะดวก</th>
                <th style="min-width: 155px;">โควต้า & รูปแบบงาน</th>
                <th style="text-align: center; width: 90px;">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProctors.map(p => {
                const datesDisplay = (!p.availableDates || p.availableDates.length === 0 || p.availableDates.length === 3)
                  ? `<span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:11px; padding: 2px 7px;">ทุกวัน (27-29 มี.ค.)</span>`
                  : p.availableDates.map(d => `<span class="badge badge-normal" style="font-size:10px; margin-right:3px; padding: 2px 6px;">${formatThaiDate(d)}</span>`).join('');

                const patternBadge = p.sessionPattern === 'SINGLE_PER_DAY'
                  ? `<span class="badge badge-warning" style="font-size: 9.5px; padding: 1px 6px;">วันละ 1 รอบ</span>`
                  : (p.sessionPattern === 'FULL_DAY_PAIRED'
                      ? `<span class="badge badge-normal" style="font-size: 9.5px; padding: 1px 6px;">เช้า+บ่าย</span>`
                      : `<span class="badge" style="background:#f1f5f9; color:#475569; font-size: 9.5px; padding: 1px 6px;">ยืดหยุ่น</span>`);

                return `
                  <tr>
                    <td><span class="badge badge-normal" style="font-weight: 700; font-size: 11px;">${p.id}</span></td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div>
                          <strong style="font-size: 13px; color: var(--text-main);">${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                          <span class="badge ${p.proctorType === 'faculty' ? 'badge-normal' : 'badge-warning'}" style="font-size: 9.5px; padding: 1px 6px;">
                            ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                          </span>
                          ${p.level === 'chief' ? `<span class="badge badge-locked" style="font-size: 9.5px; padding: 1px 6px;">หัวหน้าห้อง (Chief)</span>` : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size: 9.5px; padding: 1px 6px;">ผู้ช่วย</span>`}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted);">${this.maskPDPA ? '•••••••@••••••' : p.email}</div>
                      </div>
                    </td>
                    <td>
                      <div style="max-width: 160px; font-size: 12px; line-height: 1.35; color: var(--text-main); word-break: break-word;">
                        ${p.department}
                      </div>
                    </td>
                    <td>
                      <div>${datesDisplay}</div>
                    </td>
                    <td>
                      <!-- แอดมินปรับโควต้า 6, 3, 2, 1 รอบได้ทันที 1 คลิก พร้อมแสดงกะ -->
                      <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div class="quota-quick-buttons" style="display: flex; gap: 3px; align-items: center;">
                          <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 500;">โควต้า:</span>
                          <button class="btn btn-sm ${p.projectQuota === 6 ? 'btn-primary' : 'btn-secondary'}" data-action="quick-quota" data-proctor-id="${p.id}" data-quota="6" style="padding: 2px 6px; font-size: 11px; font-weight: 700;" title="ปรับโควต้าเป็น 6 รอบ (3 วันเต็ม)">6</button>
                          <button class="btn btn-sm ${p.projectQuota === 3 ? 'btn-primary' : 'btn-secondary'}" data-action="quick-quota" data-proctor-id="${p.id}" data-quota="3" style="padding: 2px 6px; font-size: 11px; font-weight: 700;" title="ปรับโควต้าเป็น 3 รอบ">3</button>
                          <button class="btn btn-sm ${p.projectQuota === 2 ? 'btn-primary' : 'btn-secondary'}" data-action="quick-quota" data-proctor-id="${p.id}" data-quota="2" style="padding: 2px 6px; font-size: 11px; font-weight: 700;" title="ปรับโควต้าเป็น 2 รอบ (1 วันเต็ม)">2</button>
                          <button class="btn btn-sm ${p.projectQuota === 1 ? 'btn-primary' : 'btn-secondary'}" data-action="quick-quota" data-proctor-id="${p.id}" data-quota="1" style="padding: 2px 6px; font-size: 11px; font-weight: 700;" title="ปรับโควต้าเป็น 1 รอบ (วันเดียวรอบเดียว)">1</button>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 5px;">
                          <span>วันละ ${p.dailyQuota} รอบ</span>
                          <span>•</span>
                          ${patternBadge}
                        </div>
                      </div>
                    </td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: flex; gap: 4px; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="proctors" data-id="${p.id}" style="padding: 3px 8px; font-size: 12px;" title="แก้ไขข้อมูลผู้คุมท่านนี้">✏️ แก้ไข</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="proctors" data-id="${p.id}" style="padding: 3px 6px; font-size: 12px;" title="ลบผู้คุมท่านนี้">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      `;
    }

    if (this.masterDataSubTab === 'rooms') {
      return `
        <!-- แถบสลับมุมมองห้องสอบ & ผังอาคาร 17 -->
        <div class="building-navigator-header">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm ${this.roomsViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="table">
              📋 ตารางห้องสอบ (${appState.rooms.length} ห้อง)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'floor1' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="floor1">
              🏢 ผังอาคาร 17 ชั้น 1 (ห้องสอบ 1 - 4)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'floor2' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="floor2">
              🏢 ผังอาคาร 17 ชั้น 2 (ห้องสอบ 5 - 10)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'directory' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="directory">
              📑 สารบบอาคาร 17 (Directory)
            </button>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <span>💡</span>
            <em>คลิกที่ห้องสอบใดก็ได้ เพื่อเปิดดูผังที่นั่ง สเปกห้อง และตารางผู้คุมสอบ</em>
          </div>
        </div>

        ${this.renderRoomsContentByMode()}
      `;
    }

    if (this.masterDataSubTab === 'sessions') {
      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสรอบ</th>
              <th>ชื่อรอบการสอบ</th>
              <th>วันที่</th>
              <th>เวลาเริ่ม - จบ</th>
              <th>เตรียมห้อง (นาที)</th>
              <th>หลังสอบ (นาที)</th>
              <th>ผู้เข้าสอบรวม</th>
              <th>หน่วยงานเจ้าของ</th>
              <th style="text-align: center; width: 140px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${appState.sessions.map(s => `
              <tr>
                <td><strong>${s.id}</strong></td>
                <td>${s.name}</td>
                <td>${formatThaiDate(s.date)}</td>
                <td>${formatThaiTimeRange(s.startTime, s.endTime)}</td>
                <td>${s.prepMinutes} นาที</td>
                <td>${s.wrapMinutes} นาที</td>
                <td>${s.totalExaminees} คน</td>
                <td>${s.organization}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="sessions" data-id="${s.id}" style="padding: 3px 8px; font-size: 12px;">✏️ แก้ไข</button>
                  <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="sessions" data-id="${s.id}" style="padding: 3px 8px; font-size: 12px;">🗑️ ลบ</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.masterDataSubTab === 'unavail') {
      const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));
      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสผู้คุม</th>
              <th>ชื่อ - นามสกุล</th>
              <th>ช่วงเวลาที่แจ้งไม่ว่าง</th>
              <th>เหตุผล</th>
              <th style="text-align: center; width: 140px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${appState.unavailabilities.map(u => {
              const p = proctorMap.get(u.proctorId);
              return `
                <tr>
                  <td><strong>${u.proctorId}</strong></td>
                  <td>${p ? `${p.firstName} ${p.lastName}` : u.proctorId}</td>
                  <td>${formatThaiDate(u.startTime)} เวลา ${formatThaiTimeRange(u.startTime, u.endTime)}</td>
                  <td>${u.reason || '-'}</td>
                  <td style="text-align: center; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 8px; font-size: 12px;">✏️ แก้ไข</button>
                    <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 8px; font-size: 12px;">🗑️ ลบ</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    return '';
  }

  renderRoomsContentByMode() {
    if (this.roomsViewMode === 'floor1') {
      return this.renderFloor1Blueprint();
    }
    if (this.roomsViewMode === 'floor2') {
      return this.renderFloor2Blueprint();
    }
    if (this.roomsViewMode === 'directory') {
      return this.renderBuildingDirectoryTable();
    }

    // Default: Table view
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>รหัสห้อง</th>
            <th>ชื่อห้องสอบ / ชื่อทางการ</th>
            <th>อาคาร / ชั้น</th>
            <th>ความจุ</th>
            <th>เลขที่นั่งสอบ</th>
            <th>ประเภทห้อง</th>
            <th>รองรับคนพิการ</th>
            <th>สถานะ</th>
            <th style="text-align: center; width: 270px;">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${appState.rooms.map(r => `
            <tr>
              <td>
                <button class="btn btn-link btn-sm" data-action="view-room-detail" data-id="${r.id}" style="font-weight: 800; padding: 0; text-decoration: underline;" title="คลิกเพื่อดูรายละเอียดห้องสอบ">
                  ${r.roomCode || r.id}
                </button>
              </td>
              <td>
                <div style="cursor: pointer;" data-action="view-room-detail" data-id="${r.id}">
                  <strong>${r.name}</strong>
                  ${r.officialName && !r.name.includes(r.officialName) ? `<div style="font-size: 11px; color: var(--text-muted);">${r.officialName}</div>` : ''}
                </div>
              </td>
              <td>${r.building} (ชั้น ${r.floor})</td>
              <td><strong>${r.capacity}</strong> ที่นั่ง</td>
              <td><span class="badge badge-normal" style="font-weight: 700; color: var(--primary-700);">${r.seatStart && r.seatEnd ? `${r.seatStart} - ${r.seatEnd}` : `${r.capacity} ที่`}</span></td>
              <td><span class="badge ${r.roomType === 'computer' ? 'badge-primary' : 'badge-normal'}">${r.roomType === 'computer' ? '💻 CBT คอมพิวเตอร์' : 'ห้องปกติ'}</span></td>
              <td>${r.accessibleForDisabled ? '♿ รองรับ' : '-'}</td>
              <td><span class="badge ${r.isActive ? 'badge-normal' : 'badge-danger'}">${r.isActive ? 'พร้อมใช้' : 'ปิดปรับปรุง'}</span></td>
              <td style="text-align: center; white-space: nowrap;">
                <button class="btn btn-accent btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="ดูข้อมูลห้อง ผังที่นั่ง สเปก และผู้คุมสอบ">🏢 รายละเอียด</button>
                <button class="btn btn-primary btn-sm" data-action="view-seating-plan" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="ดูแผนผังโต๊ะสอบและเลขที่นั่ง">🗺️ ผังที่นั่ง</button>
                <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="พิมพ์ป้ายหน้าห้องและผังที่นั่งห้องนี้">🪧 ป้ายห้อง</button>
                <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">✏️</button>
                <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderBlueprintRoomCell(roomCode) {
    return renderBlueprintRoomCell(roomCode, appState);
  }

  renderDirectorySidebar(floor) {
    return renderDirectorySidebar(floor, appState);
  }

  renderFloor1Blueprint() {
    return renderFloor1Blueprint(appState);
  }

  renderFloor2Blueprint() {
    return renderFloor2Blueprint(appState);
  }

  renderBuildingDirectoryTable() {
    return renderBuildingDirectoryTable(appState);
  }

  renderRoomDetailModal(room) {
    return renderRoomDetailModal({
      room,
      subTab: this.roomDetailSubTab,
      appState,
      maskPDPA: this.maskPDPA
    });
  }

  // --- 7.7 หน้าจำลอง What-if (Modern Scenario Cards) ---
  renderWhatIfTab() {
    return `
      <div class="card">
        <div class="card-header" style="background: var(--bg-surface-elevated);">
          <div>
            <div class="card-title">🔮 เครื่องมือทดลองจำลองสถานการณ์ (What-if Simulation Engine)</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">
              ทดลองเปลี่ยนตัวแปรเพื่อประเมินความเสี่ยงและเตรียมแผนสำรอง โดย<strong>ไม่กระทบต่อตารางการสอบจริง</strong>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="scenario-cards-grid">
            <!-- Scenario 1: ลดโควต้า -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(268, 90%, 96%); color: var(--primary-600);">⏳</div>
                <div class="scenario-card-title">1. ถ้าลดโควต้าลง 1 รอบ/วัน</div>
              </div>
              <div class="scenario-card-desc">
                จำลองว่าหากผู้คุมทุกคนสามารถคุมสอบได้ไม่เกิน 1 รอบต่อวัน จะเกิดคอขวดที่รอบใด และขาดผู้คุมจำนวนเท่าใด
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="reduce-quota" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>

            <!-- Scenario 2: ผู้คุม 5 คนลาป่วย -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(355, 90%, 96%); color: var(--danger-500);">🚑</div>
                <div class="scenario-card-title">2. ถ้าผู้คุม 5 คนลาป่วยกะทันหัน</div>
              </div>
              <div class="scenario-card-desc">
                สุ่มให้ผู้คุม 5 คนติดภารกิจด่วนในวันสอบ เพื่อทดสอบว่าระบบผู้คุมสำรองและบุคลากรที่เหลือจะรองรับได้สมบูรณ์หรือไม่
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="proctors-leave" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>

            <!-- Scenario 3: ห้อง R03 ใช้ไม่ได้ -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(210, 95%, 96%); color: #2563EB;">❄️</div>
                <div class="scenario-card-title">3. ถ้าห้องสอบ R03 แอร์เสีย</div>
              </div>
              <div class="scenario-card-desc">
                ปิดการใช้งานห้องปฏิบัติการ CBT R03 แล้วเกลี่ยผู้เข้าสอบ 35 คนไปยังห้องอื่นเพื่อดูความจุห้องที่เหลือ
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="room-broken" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>
          </div>

          ${this.whatIfScenario ? `
            <div style="margin-top: 24px; padding: 20px; background: var(--bg-surface-elevated); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); border-left: 5px solid ${this.whatIfScenario.success ? 'var(--success-500)' : 'var(--danger-500)'};">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h4 style="font-size: 16px; margin: 0; color: var(--text-main);">
                  📊 ผลการจำลอง: ${this.whatIfScenario.title}
                </h4>
                <span class="badge ${this.whatIfScenario.success ? 'badge-normal' : 'badge-danger'}" style="font-size: 12px;">
                  ${this.whatIfScenario.success ? 'ผ่านเกณฑ์สมบูรณ์' : 'พบข้อขัดข้อง'}
                </span>
              </div>
              <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-main);">
                ${this.whatIfScenario.description}
              </p>
              <div style="font-size: 13px; font-weight: 600; color: ${this.whatIfScenario.success ? 'var(--success-600)' : 'var(--danger-600)'};">
                ${this.whatIfScenario.success 
                  ? '✅ ข้อเสนอแนะ: ระบบและกำลังพลสำรองมีความยืดหยุ่นเพียงพอ สามารถรับมือสถานการณ์นี้ได้โดยไม่ต้องเพิ่มบุคลากรภายนอก' 
                  : '⚠️ ข้อเสนอแนะ: แนะนำให้สำรองรายชื่อผู้ช่วยคุมสอบเพิ่มเติมอย่างน้อย 8 คน หรือคงโควต้า 2 รอบ/วันตามเดิม'}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // --- 7.8 & 7.9 หน้าเวอร์ชันและเปรียบเทียบ (Version Timeline) ---
  renderVersionsTab() {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px;">
        <!-- รายการเวอร์ชัน (Timeline View) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🕒</span>
              <div class="card-title">ไทม์ไลน์ Snapshot (${appState.versions.length} เวอร์ชัน)</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-save-version">➕ บันทึก Snapshot</button>
          </div>
          <div class="card-body" style="padding: 20px;">
            ${appState.versions.length === 0 ? `
              <div style="padding: 30px 20px; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);">
                ยังไม่มีการบันทึก Snapshot ไว้<br>
                <small style="font-size: 12px; color: var(--text-muted);">กดปุ่ม "➕ บันทึก Snapshot" ด้านบน เพื่อเก็บประวัติตารางปัจจุบันไว้เปรียบเทียบหรือย้อนคืนได้ตลอดเวลา</small>
              </div>
            ` : `
              <div class="timeline-flow">
                ${appState.versions.map((v, idx) => `
                  <div class="timeline-item">
                    <div class="timeline-dot" style="${idx === 0 ? 'background: var(--success-500); box-shadow: 0 0 0 2px var(--success-50);' : ''}"></div>
                    <div class="timeline-header">
                      <strong class="timeline-title">เวอร์ชันที่ ${v.versionNumber} ${idx === 0 ? '<span class="badge badge-normal" style="font-size: 10px;">ล่าสุด</span>' : ''}</strong>
                      <span class="timeline-time">${formatThaiDate(v.createdAt)} ${formatThaiTime(v.createdAt)}</span>
                    </div>
                    <div class="timeline-desc">${v.note || 'ไม่มีบันทึกช่วยจำ'}</div>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm" data-action="restore-version" data-version-id="${v.id}" style="font-size: 12px; padding: 3px 10px;">
                        ↺ ย้อนกลับไปใช้เวอร์ชันนี้
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- กล่องเปรียบเทียบ Diff -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚖️</span>
              <div class="card-title">เปรียบเทียบความแตกต่าง (Version Diff)</div>
            </div>
          </div>
          <div class="card-body">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
              เปรียบเทียบตารางปัจจุบันกับ Snapshot ในอดีต เพื่อตรวจสอบว่ามีผู้คุมคนใดถูกโยกย้ายหรือสลับห้องสอบไปบ้าง
            </p>
            ${appState.versions.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="btn btn-secondary btn-sm" data-action="compare-diff" data-v1="${appState.versions[0].id}" data-v2="current" style="justify-content: center; padding: 10px;">
                  🔍 เปรียบเทียบตารางปัจจุบันกับเวอร์ชันที่ ${appState.versions[0].versionNumber}
                </button>
              </div>
            ` : '<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px;">ต้องบันทึกอย่างน้อย 1 Snapshot เพื่อเริ่มเปรียบเทียบ Diff</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.11 หน้าตั้งค่า Settings ---
  renderSettingsTab() {
    const s = appState.settings;

    return `
      <form id="form-settings" style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Card 1: โควต้าภาระงาน (H3) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📋</span>
              <div class="card-title">1. โควต้าภาระงานผู้คุมสอบ (Hard Constraints H3)</div>
            </div>
            <span class="badge badge-locked">Hard Rule</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px;">
              <div class="form-group">
                <label class="form-label">โควต้ารอบสูงสุดต่อวัน (รอบ/วัน)</label>
                <input type="number" class="form-input" name="dailyQuota" value="${s.hardConstraints.h3_daily_quota_default}" min="1" max="5">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">จำกัดจำนวนรอบคุมสอบต่อคนต่อวัน</span>
              </div>
              <div class="form-group">
                <label class="form-label">โควต้ารอบสูงสุดต่อทั้งโครงการ (รอบ)</label>
                <input type="number" class="form-input" name="projectQuota" value="${s.hardConstraints.h3_project_quota_default}" min="1" max="20">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">จำกัดรอบคุมสอบสะสมตลอดช่วงสอบ</span>
              </div>
              <div class="form-group">
                <label class="form-label">ชั่วโมงคุมสอบสูงสุด (ชม.)</label>
                <input type="number" class="form-input" name="maxHours" value="${s.hardConstraints.h3_max_hours_default}" step="0.5">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">รวมเวลาเตรียมตัวและสรุปงาน</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: เกณฑ์ห้องสอบและเวลาพัก (H5, H6, H7, H8) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🏛️</span>
              <div class="card-title">2. เกณฑ์ห้องสอบและเวลาพัก (H5, H6, H7, H8)</div>
            </div>
            <span class="badge badge-locked">Hard Rule</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px;">
              <div class="form-group">
                <label class="form-label">เกณฑ์ผู้เข้าสอบเพื่อใช้ 2 ผู้คุม (คน)</label>
                <input type="number" class="form-input" name="examineeThreshold" value="${s.hardConstraints.h5_examinee_threshold_for_two_proctors}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">หากผู้สอบเกินเกณฑ์นี้ ห้องนั้นต้องใช้หัวหน้า 1 + ผู้ช่วย 1 (H5)</span>
              </div>
              <div class="form-group">
                <label class="form-label">เวลาพักขั้นต่ำระหว่างรอบ (นาที)</label>
                <input type="number" class="form-input" name="minRest" value="${s.hardConstraints.h6_min_rest_minutes_between_sessions}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">เวลาพักผ่อนของผู้คุมก่อนเริ่มรอบถัดไป (H6)</span>
              </div>
              <div class="form-group">
                <label class="form-label">ผู้คุมสำรองต่อรอบ (คน)</label>
                <input type="number" class="form-input" name="reserveCount" value="${s.hardConstraints.h8_reserve_proctors_per_session}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">เตรียมพร้อมกรณีมีเหตุฉุกเฉินหรือลากะทันหัน (H8)</span>
              </div>
              <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end;">
                <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 0;">
                  <input type="checkbox" name="requireAllComputer" value="1" ${s.hardConstraints.h7_require_all_computer_rooms ? 'checked' : ''}>
                  <span>💻 โหมดสอบบนคอมพิวเตอร์ (CBT 100%)</span>
                </label>
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">บังคับให้ทุกห้องสอบต้องเป็นห้องปฏิบัติการคอมพิวเตอร์ (H7)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 3: น้ำหนักความพึงพอใจ Soft Constraints (S1 - S7) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚖️</span>
              <div class="card-title">3. น้ำหนักคะแนนความพึงพอใจและความเป็นธรรม (Soft Weights S1 - S7)</div>
            </div>
            <span class="badge badge-normal">Optimization</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px;">
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S1: กระจายภาระงานสม่ำเสมอ</label>
                  <span class="badge badge-normal" id="val-s1">${s.softWeights.s1_workload_balance}</span>
                </div>
                <input type="range" class="form-input" name="s1_weight" min="0" max="20" value="${s.softWeights.s1_workload_balance}" oninput="document.getElementById('val-s1').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">ลดความเหลื่อมล้ำของจำนวนรอบคุมสอบระหว่างผู้คุม</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S2: รวมงานในวันเดียว</label>
                  <span class="badge badge-normal" id="val-s2">${s.softWeights.s2_concentrate_days}</span>
                </div>
                <input type="range" class="form-input" name="s2_weight" min="0" max="20" value="${s.softWeights.s2_concentrate_days}" oninput="document.getElementById('val-s2').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">เน้นให้คุมต่อเนื่องในวันเดียวกันเพื่อไม่ต้องเดินทางหลายวัน</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S4: คุมห้องเดิมตลอดวัน</label>
                  <span class="badge badge-normal" id="val-s4">${s.softWeights.s4_same_room_all_day}</span>
                </div>
                <input type="range" class="form-input" name="s4_weight" min="0" max="20" value="${s.softWeights.s4_same_room_all_day}" oninput="document.getElementById('val-s4').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">ลดการย้ายห้องสอบระหว่างรอบของผู้คุม</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S5: ผสมอาจารย์ + เจ้าหน้าที่</label>
                  <span class="badge badge-normal" id="val-s5">${s.softWeights.s5_mix_faculty_and_staff}</span>
                </div>
                <input type="range" class="form-input" name="s5_weight" min="0" max="20" value="${s.softWeights.s5_mix_faculty_and_staff}" oninput="document.getElementById('val-s5').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">จับคู่อาจารย์และเจ้าหน้าที่ร่วมกันในห้องที่มี 2 คน</span>
              </div>
            </div>
          </div>
        </div>

        <!-- แถบปุ่มบันทึก -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: var(--bg-surface); padding: 14px 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-settings">
            🔄 รีเซ็ตเป็นค่าเริ่มต้น
          </button>
          <button type="submit" class="btn btn-primary" style="padding: 9px 24px; font-weight: 700;">
            💾 บันทึกการตั้งค่าทั้งหมด
          </button>
        </div>
      </form>
    `;
  }

  // --- 7.12 หน้า Audit Log (Modern Activity Feed) ---
  renderAuditTab() {
    return `
      <div class="card">
        <div class="card-header" style="background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📜</span>
            <div class="card-title">บันทึกประวัติการเปลี่ยนแปลง (Audit Activity Feed)</div>
          </div>
          <span class="badge badge-normal">${appState.auditLogs.length} รายการ</span>
        </div>
        <div class="card-body" style="padding: 0;">
          ${appState.auditLogs.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
              ยังไม่มีบันทึกประวัติกิจกรรมในระบบ
            </div>
          ` : `
            <div class="activity-feed-list">
              ${[...appState.auditLogs].reverse().map(log => {
                let icon = '📝';
                let iconBg = 'var(--bg-surface-elevated)';
                let actionColor = 'var(--primary-600)';

                const act = (log.action || '').toLowerCase();
                if (act.includes('create') || act.includes('add') || act.includes('insert')) {
                  icon = '➕';
                  iconBg = 'var(--success-50)';
                  actionColor = 'var(--success-600)';
                } else if (act.includes('delete') || act.includes('remove') || act.includes('cancel') || act.includes('clear')) {
                  icon = '🗑️';
                  iconBg = 'var(--danger-50)';
                  actionColor = 'var(--danger-600)';
                } else if (act.includes('solve') || act.includes('auto')) {
                  icon = '🚀';
                  iconBg = 'var(--primary-50)';
                  actionColor = 'var(--primary-600)';
                } else if (act.includes('edit') || act.includes('update') || act.includes('swap') || act.includes('reassign')) {
                  icon = '🔄';
                  iconBg = 'hsl(210, 95%, 96%)';
                  actionColor = '#2563EB';
                }

                return `
                  <div class="activity-feed-item">
                    <div class="activity-feed-icon" style="background: ${iconBg};">
                      ${icon}
                    </div>
                    <div class="activity-feed-content">
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                        <div class="activity-feed-title">
                          <strong>${log.actor}</strong>
                          <span class="badge" style="margin-left: 6px; background: ${iconBg}; color: ${actionColor}; font-weight: 700; border: 1px solid var(--border-subtle);">${log.action}</span>
                          <span style="font-size: 12px; color: var(--text-muted); margin-left: 4px;">(${log.entityType})</span>
                        </div>
                        <span class="activity-feed-time">
                          📅 ${formatThaiDate(log.timestamp)} &bull; ⏰ ${formatThaiTime(log.timestamp)}
                        </span>
                      </div>
                      <div class="activity-feed-detail" style="margin-top: 4px; line-height: 1.5;">
                        ${log.reason || (typeof log.afterValue === 'string' ? log.afterValue : JSON.stringify(log.afterValue || ''))}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- หน้าทดสอบระบบ Automated Test Suite ---
  renderTestsTab() {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🧪 รันชุดทดสอบอัตโนมัติ (Automated Test Suite)</div>
          <button class="btn btn-primary btn-sm" id="btn-run-all-tests">
            ▶️ รันการทดสอบทั้งหมดทันที
          </button>
        </div>
        <div class="card-body">
          <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 16px;">
            ทดสอบครอบคลุม: Unit Tests กฎ H1-H8 (ผ่านและไม่ผ่าน), Edge cases กรณีขอบ, Property tests, และ Benchmark 3 ขนาด (20/40/80 คน x 5 seeds)
          </p>

          ${this.testResults ? `
            <div style="margin-bottom: 20px; padding: 14px 18px; border-radius: var(--radius-md); background: ${this.testResults.failed === 0 ? 'var(--success-50)' : 'var(--danger-50)'};">
              <strong style="color: ${this.testResults.failed === 0 ? 'var(--success-500)' : 'var(--danger-500)'}; font-size: 16px;">
                ${this.testResults.failed === 0 ? '🎉 การทดสอบทั้งหมดผ่านฉลุย 100%' : `❌ มีข้อผิดพลาด ${this.testResults.failed} ข้อ`}
              </strong>
              <div>ผ่าน ${this.testResults.passed} จาก ${this.testResults.total} การทดสอบ</div>
            </div>

            <!-- ตาราง Benchmark Matrix จากผลทดสอบ 11.4 -->
            <h3 style="font-size: 15px; margin-bottom: 8px;">ตารางผลทดสอบประสิทธิภาพ (Benchmark Matrix 3 ขนาด x 5 seeds):</h3>
            <div class="table-wrapper" style="margin-bottom: 20px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ขนาดการทดสอบ</th>
                    <th>Seed</th>
                    <th>ผลการจัด</th>
                    <th>เวลาที่ใช้ (ms)</th>
                    <th>SD ภาระงาน</th>
                    <th>ผู้คุมขั้นต่ำที่คำนวณได้</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.testResults.benchmarkRows.map(r => `
                    <tr>
                      <td>${r.size}</td>
                      <td>${r.seed}</td>
                      <td><span class="badge badge-normal">${r.success}</span></td>
                      <td>${r.durationMs} ms</td>
                      <td>${r.sdWorkload}</td>
                      <td><strong>${r.minProctors} คน</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 30px; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);">
              กดปุ่ม "▶️ รันการทดสอบทั้งหมดทันที" เพื่อเริ่มรันการทดสอบและดูตาราง Benchmark
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- หน้า AI Agent (ผู้ช่วยจัดตารางอัจฉริยะแบบ Modern Web AI) ---
  renderAIAgentTab() {
    // คำนวณ Live Health Telemetry
    const val = validateSchedule({
      assignments: appState.assignments,
      allocations: appState.allocations,
      sessions: appState.sessions,
      proctors: appState.proctors,
      rooms: appState.rooms,
      unavailabilities: appState.unavailabilities,
      settings: appState.settings
    });

    const totalRequiredSlots = appState.allocations.reduce((acc, al) => {
      return acc + (al.examineesInRoom > (appState.settings.hardConstraints.h5_examinees_per_assistant || 30) ? 2 : 1);
    }, 0);
    const assignedSlots = appState.assignments.filter(a => a.role !== 'reserve').length;
    const completeness = totalRequiredSlots > 0 ? Math.round((assignedSlots / totalRequiredSlots) * 100) : 0;
    const totalProctors = appState.proctors.filter(p => p.isActive).length;
    const minCalc = appState.calculateMinProctors();

    // คำนวณ SD ภาระงาน
    const counts = appState.proctors.map(p => appState.assignments.filter(a => a.proctorId === p.id).length);
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length > 0 ? counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length : 0;
    const sdWorkload = Math.sqrt(variance).toFixed(2);

    const isInitialChat = this.aiAgent.chatHistory.length <= 1;

    return `
      <!-- Ultra-Modern AI Web App Interface (ChatGPT / Claude / Perplexity Style) -->
      <div class="agent-chat-wrapper">
        <!-- Top App Bar -->
        <div class="agent-chat-header">
          <div class="agent-brand-group">
            <div class="agent-avatar-badge">
              ✨
            </div>
            <div>
              <div class="agent-title-row">
                <span class="agent-title-text">ProctorAI Copilot</span>
                <span class="agent-status-beacon" title="พร้อมทำงาน (Offline Local Engine)"></span>
                <span class="agent-tag-copilot">v2.0</span>
              </div>
              <div class="agent-sub-text">
                Neural Constraint Engine • Local Offline • ปลอดภัยไม่ส่งข้อมูลออกนอกเครื่อง
              </div>
            </div>
          </div>

          <!-- Topbar Telemetry Status Chips -->
          <div class="agent-header-telemetry">
            <div class="agent-telemetry-pill" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย" title="คลิกเพื่อให้ AI วิเคราะห์สุขภาพตาราง">
              <span style="color: ${val.isValid && completeness === 100 ? '#86efac' : '#fca5a5'};">●</span>
              <span>ตาราง: <strong>${val.isValid && completeness === 100 ? '100% สมบูรณ์' : `${completeness}% (${val.errorCount} ข้อผิด)`}</strong></span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย" title="คลิกเพื่อให้ AI จัดการตำแหน่งที่ยังว่าง">
              <span>⚡ จัดแล้ว: <strong>${assignedSlots}/${totalRequiredSlots}</strong></span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?" title="คลิกเพื่อให้ AI วิเคราะห์ความจุบุคลากร">
              <span>👥 บุคลากร: <strong>${totalProctors} คน</strong> (ขั้นต่ำ ${minCalc.minProctorsNeeded})</span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?" title="คลิกเพื่อให้ AI วิเคราะห์ความยุติธรรม SD">
              <span>⚖️ SD: <strong>${sdWorkload}</strong></span>
            </div>

            <div class="agent-header-actions">
              <button class="btn btn-secondary btn-sm" id="btn-clear-chat" style="padding: 4px 10px; font-size: 11px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;" title="ล้างประวัติการสนทนา">
                🗑️ ล้างแชท
              </button>
            </div>
          </div>
        </div>

        <!-- Scrollable Messages Area -->
        <div class="agent-chat-messages" id="agent-messages-box">
          <div class="agent-messages-inner">
            ${isInitialChat ? `
              <!-- ChatGPT / Claude Style Welcome Hero & Prompt Cards -->
              <div class="agent-hero-card-container">
                <div class="agent-hero-logo">✨</div>
                <div class="agent-hero-title">สวัสดีครับ มีอะไรให้ ProctorAI ช่วยจัดตารางวันนี้?</div>
                <div class="agent-hero-subtitle">
                  ผู้ช่วยปัญญาประดิษฐ์อัจฉริยะสำหรับวางแผนกำลังคน ตรวจสอบข้อกำหนดเด็ดขาด H1-H8 และสั่งจัดตารางสอบแบบอัตโนมัติ (100% Local Offline)
                </div>

                <!-- 4 Quick Starter Prompt Cards (2x2 Grid) -->
                <div class="agent-hero-grid">
                  <div class="agent-hero-prompt-card" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย">
                    <div class="agent-hero-card-icon">🩺</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>ตรวจสุขภาพตาราง (Audit)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">สแกนหาข้อผิดพลาดตามกฎ H1-H8, ตรวจห้องว่าง และวิเคราะห์ความพร้อม</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย">
                    <div class="agent-hero-card-icon">⚡</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>จัดตารางอัตโนมัติ (AI Solver)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">สั่งรัน AI Constraint Solver จัดตำแหน่งที่เหลือ พร้อมเกลี่ยภาระงานให้เท่าเทียม</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?">
                    <div class="agent-hero-card-icon">👥</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>คำนวณผู้คุมขั้นต่ำ (Capacity)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">วิเคราะห์จำนวนผู้คุมสอบขั้นต่ำที่ต้องใช้ และชี้เป้าช่วงเวลาที่เป็นคอขวด</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="ถ้ามีผู้คุมลาป่วยกะทันหัน ระบบมีแนวทางรับมืออย่างไร?">
                    <div class="agent-hero-card-icon">🚨</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>รับมือผู้คุมลาฉุกเฉิน (Substitute)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">ค้นหาตัวแทนที่มีคุณสมบัติเหมาะสม ไม่ติดคุมสอบ และไม่ผิดกฎ H1-H8</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Conversation Messages Stream -->
            ${this.aiAgent.chatHistory.map(m => `
              <div class="agent-message-row ${m.sender}">
                <div class="agent-msg-avatar" title="${m.sender === 'agent' ? 'ProctorAI Agent' : (appState.currentUser?.name || 'คุณ')}">
                  ${m.sender === 'agent' ? '✨' : '👤'}
                </div>
                <div class="agent-bubble ${m.sender}">
                  <div class="agent-bubble-meta">
                    <strong>${m.sender === 'agent' ? 'ProctorAI' : (appState.currentUser?.name || 'คุณ')}</strong>
                    <span>• ${formatThaiTime(m.timestamp)}</span>
                  </div>
                  <div class="agent-msg-content" style="line-height: 1.65;">
                    ${this.formatAgentMarkdown(m.message)}
                  </div>
                  ${m.actions && m.actions.length > 0 ? `
                    <div class="agent-actions-box">
                      ${m.actions.map(act => `
                        <button class="agent-action-btn" data-agent-prompt="${act.prompt || ''}" data-agent-action="${act.actionId || ''}">
                          <span>${act.label}</span>
                          <span style="opacity: 0.5; font-size: 11px;">→</span>
                        </button>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Bottom Floating Input Dock -->
        <div class="agent-chat-footer">
          <div class="agent-footer-inner">
            <!-- Suggestion Chips -->
            <div class="agent-quick-prompts">
              <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; margin-right: 2px;">⚡ แนะนำ:</span>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย">🩺 ตรวจสุขภาพตาราง</button>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย">⚡ สั่งจัดตารางอัตโนมัติ</button>
              <button class="agent-prompt-chip" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?">👥 คำนวณผู้คุมขั้นต่ำ</button>
              <button class="agent-prompt-chip" data-quick-prompt="ถ้ามีผู้คุมลาป่วยกะทันหัน ระบบมีแนวทางรับมืออย่างไร?">🚨 แนะนำคนลากะทันหัน</button>
              <button class="agent-prompt-chip" data-quick-prompt="การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?">📊 วิเคราะห์การเกลี่ยงาน</button>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยสรุปกฎข้อบังคับเด็ดขาด H1 ถึง H8 ให้ฟังหน่อย">⚖️ อธิบายกฎ H1-H8</button>
              <button class="agent-prompt-chip" data-quick-prompt="ระบบนี้เป็น Open Source อย่างไร และมีสิทธิ์การใช้งานแบบไหน?">🌐 สิทธิ์ Open Source (MIT)</button>
            </div>

            <!-- Capsule Input Form -->
            <form id="form-agent-chat" class="agent-input-dock">
              <span style="font-size: 18px; color: var(--primary-500); margin-left: 2px;">✨</span>
              <input type="text" id="input-agent-chat" class="agent-input-field" placeholder="พิมพ์คำถาม หรือสั่งการ ProctorAI (เช่น 'ตรวจสุขภาพตาราง', 'ใครว่างวันที่ 24 บ้าง', 'คำนวณผู้คุมขั้นต่ำ')..." autocomplete="off" required>
              <button type="submit" class="agent-send-btn" title="ส่งคำสั่ง (Enter)">
                ↑
              </button>
            </form>

            <div class="agent-disclaimer">
              🔒 ProctorAI ประมวลผลบนเครื่องของคุณแบบ Local 100% • ปลอดภัย ข้อมูลไม่รั่วไหล • MIT License
            </div>
          </div>
        </div>
      </div>
    `;
  }

  formatAgentMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/`([^`]+)`/g, '<code style="background: rgba(168,85,247,0.12); color: var(--primary-700); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; font-weight: 600;">$1</code>')
      .replace(/^### (.*$)/gim, '<div style="margin: 12px 0 6px 0; font-size: 15px; color: var(--primary-700); font-weight: 800; display: flex; align-items: center; gap: 6px;">$1</div>')
      .replace(/^## (.*$)/gim, '<div style="margin: 14px 0 8px 0; font-size: 16px; color: var(--text-main); font-weight: 800; display: flex; align-items: center; gap: 6px;">$1</div>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color: var(--text-muted);">$1</em>')
      .replace(/^• (.*$)/gim, '<div style="margin: 3px 0 3px 12px; display: flex; align-items: flex-start; gap: 6px;"><span style="color: var(--primary-500); font-weight: bold;">•</span><div>$1</div></div>')
      .replace(/^\- (.*$)/gim, '<div style="margin: 3px 0 3px 12px; display: flex; align-items: flex-start; gap: 6px;"><span style="color: var(--accent-500); font-weight: bold;">▪</span><div>$1</div></div>')
      .replace(/\n\n/g, '<div style="height: 10px;"></div>')
      .replace(/\n/g, '<br>');
  }

  // --- Modal Dialogs (แก้ไขผู้คุมด้วยมือ, แนะนำตัวแทน, ลากะทันหัน) ---
  renderModal() {
    if (!this.activeModal) return '';

    if (this.activeModal.type === 'edit-slot') {
      const { sessionId, allocationId, roomId, role, currentAssign } = this.activeModal.data;
      const allCandidates = appState.getRecommendedSubstitutes(sessionId, allocationId, role, currentAssign ? currentAssign.proctorId : null);
      const availableCandidates = allCandidates.filter(c => c.allowed);
      const busyCandidates = allCandidates.filter(c => !c.allowed);

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 620px;">
            <div class="modal-header">
              <div>
                <div class="card-title">เลือก/เปลี่ยนผู้คุมสอบ (${role === 'chief' ? 'หัวหน้าห้อง' : (role === 'reserve' ? 'ผู้คุมสำรอง' : 'ผู้ช่วยผู้คุม')})</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  รอบสอบ: <strong>${sessionId}</strong> ${roomId ? `| ห้อง: <strong>${roomId}</strong>` : ''}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              ${currentAssign ? `
                <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); border-left: 4px solid var(--primary-500); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="font-size: 11px; color: var(--text-muted);">ผู้คุมปัจจุบันในตำแหน่งนี้:</div>
                    <strong style="font-size: 14px;">${(() => {
                      const p = appState.proctors.find(x => x.id === currentAssign.proctorId);
                      return p ? `${p.firstName} ${p.lastName} (${p.id})` : currentAssign.proctorId;
                    })()}</strong>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" data-action="toggle-lock" data-assign-id="${currentAssign.id}" title="ล็อกตำแหน่งไม่ให้อัลกอริทึมเปลี่ยน">
                      ${currentAssign.status === 'locked' ? '🔓 ปลดล็อก' : '🔒 ล็อกตำแหน่ง'}
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="remove-assign" data-assign-id="${currentAssign.id}" title="นำผู้คุมออกจากตำแหน่งนี้เพื่อให้ตำแหน่งว่าง">
                      🗑️ ปลดออก
                    </button>
                  </div>
                </div>
              ` : ''}

              <!-- แถบลัด: สุ่มเลือกผู้คุมที่ผ่านเกณฑ์ทันที (Auto-Pick) -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: linear-gradient(135deg, rgba(245,158,11,0.14), rgba(126,34,206,0.10)); border: 1px solid rgba(245,158,11,0.4); border-radius: var(--radius-md);">
                <div>
                  <strong style="font-size: 13px; color: var(--text-main);">⚡ ขี้เกียจเลือกทีละคน?</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">ให้ระบบสุ่มเลือกผู้คุมที่ผ่านกฎ H1-H8 และเหมาะสมที่สุดให้ทันที</div>
                </div>
                <button type="button" class="btn btn-warning btn-sm" id="btn-auto-pick-slot" style="font-weight: 700; background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; border: none; box-shadow: 0 2px 6px rgba(245,158,11,0.35);">
                  🎲 สุ่มเลือกผู้คุมให้เลย
                </button>
              </div>

              <!-- กลุ่มที่ 1: ผู้คุมที่ว่างและผ่านเกณฑ์ (แนะนำ) -->
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-color); margin-bottom: 6px;">
                  ✅ ผู้คุมที่ว่างและผ่านเกณฑ์ในรอบนี้ (${availableCandidates.length} คน)
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;">
                  ${availableCandidates.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-surface);">
                      <div>
                        <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
                        <span class="badge badge-normal" style="font-size: 10px; margin-left: 4px;">${c.proctor.level === 'chief' ? 'Chief' : 'Assistant'}</span>
                        <div style="font-size: 11px; color: var(--text-muted);">${c.proctor.department}</div>
                        <div style="font-size: 11px; color: var(--primary-600); margin-top: 1px;">${c.reason}</div>
                      </div>
                      <button class="btn btn-primary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}">
                        เลือกเข้าตำแหน่ง
                      </button>
                    </div>
                  `).join('')}
                  ${availableCandidates.length === 0 ? '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px; background: var(--bg-surface); border-radius: var(--radius-md);">ไม่มีผู้คุมที่ว่างในรอบนี้ (เนื่องจากคุมห้องอื่นหรือโควต้าเต็ม) ท่านสามารถเลือกจากรายการด้านล่างเพื่อสลับตัวได้</div>' : ''}
                </div>
              </div>

              <!-- กลุ่มที่ 2: ผู้คุมคนอื่นในระบบ (สลับตัว/เลือกแทนได้) -->
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">
                  🔄 ผู้คุมคนอื่นในระบบ (สลับห้อง หรือ เลือกแทนได้ - ${busyCandidates.length} คน)
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                  ${busyCandidates.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-surface);">
                      <div>
                        <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
                        <span class="badge ${c.assignedInSameSession ? 'badge-warning' : 'badge-danger'}" style="font-size: 10px; margin-left: 4px;">
                          ${c.assignedInSameSession ? `คุม: ${c.assignedRoomName}` : 'โควต้าเต็ม/ติดภารกิจ'}
                        </span>
                        <div style="font-size: 11px; color: var(--text-muted);">${c.proctor.department} | ${c.reason}</div>
                      </div>
                      <div style="display: flex; gap: 4px;">
                        ${c.assignedInSameSession && currentAssign ? `
                          <button class="btn btn-secondary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}" data-swap="true" title="สลับห้องระหว่างสองคนนี้">
                            🔄 สลับห้อง
                          </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}" data-swap="false" title="เลือกคนนี้มาคุมตำแหน่งนี้">
                          เลือกแทน
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal.type === 'sudden-leave') {
      return `
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <div class="card-title">🚑 แจ้งผู้คุมลากะทันหัน & เสนอตัวแทน</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">เลือกรอบการสอบ</label>
                <select class="form-select" id="select-leave-session">
                  ${appState.sessions.map(s => `<option value="${s.id}">${s.name} (${formatThaiDate(s.date)})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">เลือกผู้คุมที่ต้องการลา</label>
                <select class="form-select" id="select-leave-proctor">
                  ${appState.proctors.map(p => `<option value="${p.id}">${p.firstName} ${p.lastName} (${p.department})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">เหตุผลการลา</label>
                <input type="text" class="form-input" id="input-leave-reason" placeholder="เช่น ป่วยกะทันหัน / ติดภารกิจด่วน">
              </div>

              <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <label class="form-label" style="margin-bottom: 6px;">ระบบเสนอตัวแทนเข้าปฏิบัติหน้าที่แทนทันที (เริ่มจากผู้คุมสำรอง):</label>
                <div id="substitute-candidates-box" style="display: flex; flex-direction: column; gap: 8px;">
                  <!-- จะเติม candidate ผ่าน JS -->
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ผู้คุมสอบ
    if (this.activeModal.type === 'modal-master-proctors') {
      const p = this.activeModal.data || {};
      const isEdit = Boolean(p.id);
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 640px; width: 95vw;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขข้อมูลผู้คุมสอบ (${p.id})` : '➕ เพิ่มผู้คุมสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-proctor">
              <input type="hidden" name="id" value="${p.id || ''}">
              <div class="modal-body" style="gap: 10px;">
                <!-- แถว 1: คำนำหน้า, ชื่อ, นามสกุล (3 คอลัมน์) -->
                <div style="display: grid; grid-template-columns: 1.1fr 1.5fr 1.5fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">คำนำหน้า / ตำแหน่ง</label>
                    <input type="text" class="form-input" name="academicTitle" value="${p.academicTitle || ''}" placeholder="เช่น ผศ.ดร. หรือ อาจารย์">
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชื่อ <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="firstName" value="${p.firstName || ''}" required placeholder="เช่น สมชาย">
                  </div>
                  <div class="form-group">
                    <label class="form-label">นามสกุล <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="lastName" value="${p.lastName || ''}" required placeholder="เช่น สุขใจ">
                  </div>
                </div>

                <!-- แถว 2: ประเภทบุคลากร และ ระดับหน้าที่ -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">ประเภทบุคลากร</label>
                    <select class="form-select" name="proctorType">
                      <option value="faculty" ${p.proctorType === 'faculty' ? 'selected' : ''}>อาจารย์ (Faculty)</option>
                      <option value="staff" ${p.proctorType === 'staff' ? 'selected' : ''}>เจ้าหน้าที่ (Staff)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ระดับหน้าที่</label>
                    <select class="form-select" name="level">
                      <option value="chief" ${p.level === 'chief' ? 'selected' : ''}>หัวหน้าห้องได้ (Chief Proctor)</option>
                      <option value="assistant" ${p.level === 'assistant' ? 'selected' : ''}>ผู้ช่วยผู้คุม (Assistant)</option>
                    </select>
                  </div>
                </div>

                <!-- แถว 3: สังกัด / คณะ และ เบอร์โทรศัพท์ -->
                <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">สังกัด / คณะ / สำนัก</label>
                    <input type="text" class="form-input" name="department" value="${p.department || 'สำนักบริการคอมพิวเตอร์'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เบอร์โทรศัพท์</label>
                    <input type="text" class="form-input" name="phone" value="${p.phone || ''}" placeholder="081-234-5678">
                  </div>
                </div>

                <!-- แถว 4: อีเมล และ รูปแบบกะ -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">อีเมล</label>
                    <input type="email" class="form-input" name="email" value="${p.email || ''}" placeholder="example@bru.ac.th">
                  </div>
                  <div class="form-group">
                    <label class="form-label">รูปแบบกะที่ต้องการ (Session Pattern)</label>
                    <select class="form-select" name="sessionPattern">
                      <option value="FULL_DAY_PAIRED" ${p.sessionPattern === 'FULL_DAY_PAIRED' ? 'selected' : ''}>เช้า + บ่าย คู่กัน (FULL_DAY_PAIRED)</option>
                      <option value="SINGLE_PER_DAY" ${p.sessionPattern === 'SINGLE_PER_DAY' ? 'selected' : ''}>ขอคุมวันละ 1 รอบเท่านั้น (SINGLE_PER_DAY)</option>
                      <option value="ANY" ${p.sessionPattern === 'ANY' ? 'selected' : ''}>ยืดหยุ่น รอบใดก็ได้ (ANY)</option>
                    </select>
                  </div>
                </div>

                <!-- แถว 5: วันที่สะดวกปฏิบัติหน้าที่ -->
                <div style="background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 8px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 4px;">
                    <label class="form-label" style="font-weight: 600; margin: 0; font-size: 13px;">📅 วันที่สะดวกปฏิบัติหน้าที่ (Available Dates):</label>
                    <span style="font-size: 11px; color: var(--text-muted);">* สำหรับผู้ที่ขอคุมวันเดียว ให้เลือกเฉพาะวันนั้น ระบบจะล็อกไม่ให้จัดวันอื่น</span>
                  </div>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-27" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-27')) ? 'checked' : ''}>
                      <span>ศุกร์ 27 มี.ค. 2569</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-28" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-28')) ? 'checked' : ''}>
                      <span>เสาร์ 28 มี.ค. 2569</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-29" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-29')) ? 'checked' : ''}>
                      <span>อาทิตย์ 29 มี.ค. 2569</span>
                    </label>
                  </div>
                </div>

                <!-- แถว 6: โควต้า และ สถานะพร้อมใช้งาน -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
                  <div class="form-group">
                    <label class="form-label">โควต้า/วัน (รอบ)</label>
                    <input type="number" class="form-input" name="dailyQuota" min="1" max="5" value="${p.dailyQuota ?? 2}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">โควต้าโครงการ (รอบ)</label>
                    <input type="number" class="form-input" name="projectQuota" min="1" max="20" value="${p.projectQuota ?? 6}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชั่วโมงสูงสุด</label>
                    <input type="number" class="form-input" name="maxHours" min="1" max="50" step="0.5" value="${p.maxHours ?? 18}" required>
                  </div>
                  <div class="form-group" style="padding-bottom: 8px;">
                    <label class="form-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; margin: 0; white-space: nowrap;">
                      <input type="checkbox" name="isActive" value="1" ${p.isActive !== false ? 'checked' : ''}>
                      <span>พร้อมปฏิบัติหน้าที่ (Active)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลผู้คุม</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ห้องสอบ
    if (this.activeModal.type === 'modal-master-rooms') {
      const r = this.activeModal.data || {};
      const isEdit = Boolean(r.id);
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขข้อมูลห้องสอบ (${r.id})` : '➕ เพิ่มห้องสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-room">
              <input type="hidden" name="id" value="${r.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ชื่อห้องสอบ <span style="color:var(--danger-500);">*</span></label>
                  <input type="text" class="form-input" name="name" value="${r.name || ''}" required placeholder="เช่น ห้องปฏิบัติการคอมพิวเตอร์ LAB 1">
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">อาคาร</label>
                    <input type="text" class="form-input" name="building" value="${r.building || 'อาคารปฏิบัติการ'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชั้น</label>
                    <input type="number" class="form-input" name="floor" min="1" max="20" value="${r.floor ?? 1}" required>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ความจุเครื่องคอมพิวเตอร์ <span style="color:var(--danger-500);">*</span></label>
                    <input type="number" class="form-input" name="capacity" min="5" max="200" value="${r.capacity ?? 35}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ประเภทห้อง</label>
                    <select class="form-select" name="roomType">
                      <option value="computer" ${r.roomType === 'computer' || !r.roomType ? 'selected' : ''}>💻 ห้องคอมพิวเตอร์ (CBT)</option>
                      <option value="normal" ${r.roomType === 'normal' ? 'selected' : ''}>ห้องปกติ</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                  <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="accessibleForDisabled" value="1" ${r.accessibleForDisabled ? 'checked' : ''}>
                    <span>♿ รองรับผู้พิการ (ทางลาด/ลิฟต์)</span>
                  </label>
                  <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="isActive" value="1" ${r.isActive !== false ? 'checked' : ''}>
                    <span>สถานะพร้อมใช้งาน (Active)</span>
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลห้อง</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม รอบการสอบ
    if (this.activeModal.type === 'modal-master-sessions') {
      const s = this.activeModal.data || {};
      const isEdit = Boolean(s.id);
      let startTimeStr = '09:00';
      let endTimeStr = '12:00';
      if (s.startTime) {
        const m = s.startTime.match(/T(\d{2}:\d{2})/);
        if (m) startTimeStr = m[1];
      }
      if (s.endTime) {
        const m = s.endTime.match(/T(\d{2}:\d{2})/);
        if (m) endTimeStr = m[1];
      }

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 540px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขรอบการสอบ (${s.id})` : '➕ เพิ่มรอบการสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-session">
              <input type="hidden" name="id" value="${s.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ชื่อรอบ / วิชาการสอบ <span style="color:var(--danger-500);">*</span></label>
                  <input type="text" class="form-input" name="name" value="${s.name || ''}" required placeholder="เช่น การทดสอบวัดความรู้เฉพาะทาง รอบเช้า">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">วันที่สอบ</label>
                    <input type="date" class="form-input" name="date" value="${s.date || '2026-10-24'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาเริ่มสอบ</label>
                    <input type="time" class="form-input" name="startTime" value="${startTimeStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาเสร็จสิ้น</label>
                    <input type="time" class="form-input" name="endTime" value="${endTimeStr}" required>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">เวลาเตรียมห้องก่อนสอบ (นาที)</label>
                    <input type="number" class="form-input" name="prepMinutes" min="0" max="120" value="${s.prepMinutes ?? 30}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาสรุปงานหลังสอบ (นาที)</label>
                    <input type="number" class="form-input" name="wrapMinutes" min="0" max="120" value="${s.wrapMinutes ?? 15}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">หน่วยงานเจ้าของข้อสอบ / ผู้จัด</label>
                  <input type="text" class="form-input" name="organization" value="${s.organization || 'ศูนย์สอบมหาวิทยาลัย'}" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกรอบการสอบ</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ช่วงเวลาไม่ว่าง
    if (this.activeModal.type === 'modal-master-unavail') {
      const u = this.activeModal.data || {};
      const isEdit = Boolean(u.id);
      let dateStr = '2026-10-24';
      let startTimeStr = '08:00';
      let endTimeStr = '12:00';
      if (u.startTime) {
        const parts = u.startTime.split('T');
        if (parts[0]) dateStr = parts[0];
        if (parts[1]) startTimeStr = parts[1].substring(0, 5);
      }
      if (u.endTime) {
        const parts = u.endTime.split('T');
        if (parts[1]) endTimeStr = parts[1].substring(0, 5);
      }

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? '✏️ แก้ไขช่วงเวลาไม่ว่าง' : '➕ บันทึกช่วงเวลาไม่ว่างของผู้คุม'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-unavail">
              <input type="hidden" name="id" value="${u.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ผู้คุมสอบ <span style="color:var(--danger-500);">*</span></label>
                  <select class="form-select" name="proctorId" required>
                    ${appState.proctors.map(p => `
                      <option value="${p.id}" ${u.proctorId === p.id ? 'selected' : ''}>
                        ${p.id} - ${p.firstName} ${p.lastName} (${p.department})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">วันที่ไม่ว่าง</label>
                    <input type="date" class="form-input" name="date" value="${dateStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ตั้งแต่เวลา</label>
                    <input type="time" class="form-input" name="startTime" value="${startTimeStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ถึงเวลา</label>
                    <input type="time" class="form-input" name="endTime" value="${endTimeStr}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">เหตุผลความจำเป็น</label>
                  <input type="text" class="form-input" name="reason" value="${u.reason || ''}" placeholder="เช่น ติดสอน / ติดราชการ / ลาป่วย">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกช่วงเวลา</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: สลับบทบาท / เข้าสู่ระบบ (User & Role Switcher)
    if (this.activeModal.type === 'switch-user') {
      const accounts = appState.getAvailableAccounts();
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 680px;">
            <div class="modal-header">
              <div>
                <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                  <span>🔑</span> เข้าสู่ระบบ / สลับบัญชีผู้ใช้งาน
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  เลือกว่าต้องการใช้งานในฐานะ Admin หรือ อาจารย์ หรือ ผู้คุมสอบ เพื่อทดสอบระบบได้ทันที
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
              <!-- บทบาทที่ 1: แอดมิน (Admin) -->
              <div style="border: 2px solid var(--accent-500); background: linear-gradient(135deg, var(--bg-surface), var(--accent-50)); padding: 16px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 22px;">👑</span>
                    <strong style="font-size: 16px;">ผู้ดูแลระบบ (Admin)</strong>
                    <span class="role-tag admin">สิทธิ์เต็ม 100%</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    สิทธิ์เต็ม: แก้ไขผู้คุม, แก้เวลาสอบ, แก้ห้องสอบ CBT, แก้ตาราง, ล้างตาราง, สลับคน, ตั้งค่ากฎเกณฑ์
                  </div>
                </div>
                <button class="btn btn-accent" data-action="confirm-switch-user" data-user-id="admin">
                  เข้าสู่ระบบเป็น Admin
                </button>
              </div>

              <!-- บทบาทที่ 2: อาจารย์ (Teachers / Faculty) -->
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--primary-600); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span>👨‍🏫</span> อาจารย์ (Faculty Proctors)
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
                  ${accounts.teachers.map(t => `
                    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${t.name}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${t.department} (${t.id})</div>
                      </div>
                      <button class="btn btn-primary btn-sm" data-action="confirm-switch-user" data-user-id="${t.id}">
                        เข้าสู่ระบบ
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- บทบาทที่ 3: ผู้คุมสอบทั่วไป/เจ้าหน้าที่ (Staff Proctors) -->
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span>👤</span> เจ้าหน้าที่คุมสอบ (Staff Proctors)
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
                  ${accounts.staff.map(s => `
                    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${s.name}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${s.department} (${s.id})</div>
                      </div>
                      <button class="btn btn-secondary btn-sm" data-action="confirm-switch-user" data-user-id="${s.id}">
                        เข้าสู่ระบบ
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- หรือเลือกจากผู้คุมสอบคนอื่นในระบบ -->
              <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">
                  หรือเลือกบัญชีผู้คุมสอบคนอื่นในระบบ (${appState.proctors.length} คน):
                </div>
                <div style="display: flex; gap: 8px;">
                  <select class="form-select" id="select-any-proctor-user" style="flex: 1;">
                    ${appState.proctors.filter(p => p.isActive).map(p => `
                      <option value="${p.id}" ${appState.currentUser?.proctorId === p.id ? 'selected' : ''}>
                        ${p.id}: ${p.firstName} ${p.lastName} (${p.department}) - ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                      </option>
                    `).join('')}
                  </select>
                  <button class="btn btn-secondary btn-sm" id="btn-select-custom-proctor">เข้าสู่ระบบ</button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ปิด</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไขข้อมูลส่วนตัวของผู้คุม/อาจารย์เอง
    if (this.activeModal.type === 'edit-my-profile') {
      const p = appState.getLoggedInProctor();
      if (!p) return '';
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <div class="card-title">✏️ แก้ไขข้อมูลส่วนตัวของฉัน (${p.id})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-edit-my-profile">
              <input type="hidden" name="id" value="${p.id}">
              <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ชื่อ <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="firstName" value="${p.firstName}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">นามสกุล <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="lastName" value="${p.lastName}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">สังกัด / คณะ / สำนัก</label>
                  <input type="text" class="form-input" name="department" value="${p.department}" required>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">เบอร์โทรศัพท์ติดต่อ</label>
                    <input type="text" class="form-input" name="phone" value="${p.phone}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">อีเมล</label>
                    <input type="email" class="form-input" name="email" value="${p.email}" required>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลส่วนตัว</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เพิ่มห้องสอบ CBT ในรอบ (Admin Only)
    if (this.activeModal.type === 'modal-add-room-session') {
      const sessionId = this.activeModal.data?.sessionId;
      const session = appState.sessions.find(s => s.id === sessionId);
      const usedRoomIds = new Set(appState.allocations.filter(a => a.sessionId === sessionId).map(a => a.roomId));
      const availableRooms = appState.rooms.filter(r => r.isActive && !usedRoomIds.has(r.id));

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">➕ เพิ่มห้องสอบ CBT ในรอบ (${sessionId})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-add-room-session">
              <input type="hidden" name="sessionId" value="${sessionId}">
              <div class="modal-body">
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                  รอบสอบ: <strong>${session ? session.name : sessionId}</strong>
                </div>

                <div class="form-group">
                  <label class="form-label">เลือกห้องปฏิบัติการคอมพิวเตอร์ที่ว่างในรอบนี้</label>
                  <select class="form-select" name="roomId" required>
                    ${availableRooms.map(r => `
                      <option value="${r.id}">
                        💻 ${r.name} (${r.building} ชั้น ${r.floor}) - จุ ${r.capacity} เครื่อง
                      </option>
                    `).join('')}
                    ${availableRooms.length === 0 ? '<option disabled>ไม่มีห้องว่างเหลือในรอบนี้</option>' : ''}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">จำนวนผู้เข้าสอบในห้องนี้ (คน)</label>
                  <input type="number" class="form-input" name="examinees" min="1" max="100" value="30" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm" ${availableRooms.length === 0 ? 'disabled' : ''}>➕ เพิ่มห้องนี้</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: ปรับจำนวนผู้เข้าสอบ / ห้องสอบ (Admin Only)
    if (this.activeModal.type === 'modal-edit-alloc') {
      const allocId = this.activeModal.data?.allocId;
      const alloc = appState.allocations.find(a => a.id === allocId);

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header">
              <div class="card-title">✏️ ปรับจำนวนผู้สอบ / ห้อง (${alloc?.roomId})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-edit-alloc">
              <input type="hidden" name="allocId" value="${allocId}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ห้องสอบ</label>
                  <select class="form-select" name="roomId">
                    ${appState.rooms.filter(r => r.isActive).map(r => `
                      <option value="${r.id}" ${r.id === alloc?.roomId ? 'selected' : ''}>
                        💻 ${r.name} (${r.building} ชั้น ${r.floor}) - จุ ${r.capacity} เครื่อง
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">จำนวนผู้เข้าสอบในห้อง (คน)</label>
                  <input type="number" class="form-input" name="examinees" min="1" max="100" value="${alloc?.examineesInRoom || 30}" required>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    * หากเกิน ${appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors} คน ระบบจะจัดผู้คุม 2 คนอัตโนมัติ
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เพิ่มช่วงเวลาไม่ว่างส่วนตัว (My Unavailability)
    if (this.activeModal.type === 'modal-add-my-unavail') {
      const proctor = appState.getLoggedInProctor();
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">⏳ แจ้งวัน-เวลาที่ไม่สะดวกคุมสอบ</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-add-my-unavail">
              <input type="hidden" name="proctorId" value="${proctor ? proctor.id : ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">วันที่ติดภารกิจ</label>
                  <input type="date" class="form-input" name="date" value="2026-10-24" required>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ตั้งแต่เวลา</label>
                    <input type="time" class="form-input" name="startTime" value="08:00" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ถึงเวลา</label>
                    <input type="time" class="form-input" name="endTime" value="12:00" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">เหตุผล / ภารกิจ</label>
                  <input type="text" class="form-input" name="reason" placeholder="เช่น ติดสอนวิชาสัมมนา, ติดราชการต่างจังหวัด" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกช่วงไม่สะดวก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เลือกลักษณะเอกสาร PDF (เฉพาะบุคคล หรือ รวมทุกห้อง)
    if (this.activeModal.type === 'choose-pdf-type') {
      const proctor = this.activeModal.proctor;
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <div class="card-title">🖨️ เลือกรูปแบบเอกสาร PDF ที่ต้องการพิมพ์</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="font-size: 13px; color: var(--text-muted);">
                ผู้ใช้งานปัจจุบัน: <strong style="color: var(--text-main);">${proctor.firstName} ${proctor.lastName}</strong>
              </div>

              <!-- ทางเลือกที่ 1: ตารางคุมสอบของฉัน -->
              <div style="padding: 16px; border: 2px solid var(--primary-300); background: var(--bg-surface-elevated); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--primary-700);">📄 ตารางและใบแจ้งปฏิบัติหน้าที่ของฉัน</strong>
                  <button class="btn btn-primary btn-sm" id="btn-do-print-personal">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  แสดงเฉพาะชื่อของคุณ พร้อมรายการห้องสอบ วันเวลา และบทบาทหน้าที่ที่คุณต้องไปปฏิบัติงานคุมสอบ (สำหรับพกติดตัวหรือเซ็นรับรอง)
                </div>
              </div>

              <!-- ทางเลือกที่ 2: ใบลงนามรวมทุกห้องสอบ (ของส่วนกลาง) -->
              <div style="padding: 16px; border: 1px solid var(--border-subtle); background: var(--bg-surface); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--text-main);">📑 ใบลงนามประจำห้องสอบทั้งหมด (ของศูนย์สอบ)</strong>
                  <button class="btn btn-secondary btn-sm" id="btn-do-print-all-rooms">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  เอกสารชุดใหญ่สำหรับศูนย์สอบ (1 หน้า = 1 ห้องสอบ) เพื่อนำไปวางหน้าห้องสอบ โดยหน้าแรกจะเป็นห้องที่ 1 ของรอบแรก (ซึ่งแสดงชื่อกรรมการประจำห้องนั้น)
                </div>
              </div>

              <!-- ทางเลือกที่ 3: ชุดป้ายติดบอร์ดหน้าห้องสอบ & ผังที่นั่ง (สำนักงาน ก.พ.) -->
              <div style="padding: 16px; border: 2px solid var(--accent-300); background: var(--accent-50); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--accent-700);">🪧 ชุดป้ายติดบอร์ดหน้าห้องสอบ & ผังที่นั่ง (สนามสอบ ก.พ.)</strong>
                  <button class="btn btn-accent btn-sm" id="btn-do-print-door-signs" style="font-weight: 700;">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  ชุดป้ายติดบอร์ดหน้าห้องสอบจริง (ป้ายหัวห้องสอบตัวโต, แผนผังห้องสอบแสดงเลขที่นั่ง 1-520, ป้ายห้ามนำเข้า และป้ายสิ่งที่อนุญาต สำนักงาน ก.พ.)
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: ดูผังที่นั่งสอบจริง (Seating Plan Chart)
    if (this.activeModal.type === 'modal-room-detail' || this.activeModal.type === 'modal-seating-plan') {
      return this.renderRoomDetailModal(this.activeModal.room);
    }

    // Modal: สัญญาอนุญาต Open Source (MIT License)
    if (this.activeModal.type === 'modal-license') {
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 620px;">
            <div class="modal-header">
              <div class="card-title">🌐 สัญญาอนุญาต Open Source (MIT License)</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-md); border-left: 4px solid var(--accent-500);">
                <strong style="color: var(--primary-700); font-size: 14px;">📜 MIT License — Open Source 100%</strong>
                <p style="font-size: 13px; color: var(--text-color); margin: 6px 0 0 0; line-height: 1.5;">
                  ระบบจัดตารางผู้คุมสอบนี้เป็นซอฟต์แวร์เสรีและเปิดเผยรหัสต้นฉบับ (Open Source) ภายใต้ใบอนุญาตสากล <strong>MIT License</strong> สามารถนำไปใช้งาน, คัดลอก, ปรับแต่ง หรือต่อยอดในสถาบันการศึกษาและหน่วยงานต่าง ๆ ได้อย่างอิสระ
                </p>
              </div>

              <div>
                <strong style="font-size: 13px;">🔒 การรับประกันความเป็นส่วนตัวระดับสูงสุด (Local-First):</strong>
                <ul style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 16px; line-height: 1.5;">
                  <li>ระบบทำงานบนเบราว์เซอร์ของคุณ 100% (Client-Side Only)</li>
                  <li>ข้อมูลส่วนบุคคลผู้คุมสอบ (PDPA), ตารางสอบ และคะแนน จะไม่ถูกส่งออกไปยังเซิร์ฟเวอร์ภายนอก</li>
                  <li>ทำงานแบบ Standalone เปิดผ่านไฟล์ index.html หรือ start.bat ได้ทันทีโดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต</li>
                </ul>
              </div>

              <div>
                <strong style="font-size: 13px;">🤖 ผู้ช่วยอัจฉริยะ ProctorAI Agent:</strong>
                <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0; line-height: 1.5;">
                  มาพร้อม AI Agent ในตัวที่สามารถตรวจสุขภาพตาราง, แนะนำตัวแทนเมื่อมีคนลา, คำนวณผู้คุมขั้นต่ำ และสั่งจัดตารางอัตโนมัติตามกฎ H1-H8
                </p>
              </div>

              <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-family: monospace; font-size: 11px; color: var(--text-muted); max-height: 110px; overflow-y: auto;">
Copyright (c) 2026 Exam Proctor Scheduler Contributors<br><br>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software...
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary btn-sm" id="btn-close-modal">รับทราบและปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: KPI 1 - ข้อมูลห้องปฏิบัติการคอมพิวเตอร์ (CBT)
    if (this.activeModal.type === 'modal-kpi-rooms') {
      return renderKpiRoomsModal(appState);
    }

    // Modal: KPI 2 - ข้อมูลผู้คุมสอบในระบบ
    if (this.activeModal.type === 'modal-kpi-proctors') {
      return renderKpiProctorsModal(appState);
    }

    // Modal: KPI 3 - สถานะความคืบหน้าการจัดตาราง
    if (this.activeModal.type === 'modal-kpi-schedule-status') {
      return renderKpiScheduleStatusModal(appState, this.activeModal.data || {});
    }

    // Modal: KPI 4 - รายงานการตรวจสอบกฎ (Rules Audit)
    if (this.activeModal.type === 'modal-kpi-rules-audit') {
      return renderKpiRulesAuditModal(appState, this.activeModal.data?.valResult || {});
    }

    return '';
  }

  // --- ผูก Event Handlers ทั้งหมด ---
  attachEvents() {
    // Delegated click handler for room modals and subtabs (100% Resilient)
    this.root.addEventListener('click', (e) => {
      // 1. Modal Subtab Switcher (แผนผัง, สเปกห้อง, รอบการสอบ & ผู้คุมสอบ)
      const subtabBtn = e.target.closest('[data-room-detail-tab]');
      if (subtabBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tab = subtabBtn.getAttribute('data-room-detail-tab');
        if (tab && this.roomDetailSubTab !== tab) {
          this.roomDetailSubTab = tab;
          this.render();
        }
        return;
      }

      // 2. Open Room Detail / Seating Plan Modal
      const viewRoomBtn = e.target.closest('.btn-view-room-plan, .btn-view-examinee-blueprint, [data-action="view-room-detail"], [data-action="view-seating-plan"]');
      if (viewRoomBtn) {
        e.preventDefault();
        e.stopPropagation();
        const rId = viewRoomBtn.getAttribute('data-id') || viewRoomBtn.getAttribute('data-room-id') || viewRoomBtn.getAttribute('data-room-code');
        const room = appState.rooms.find(x =>
          (rId && (x.id === rId || x.roomCode === rId || x.code === rId || String(x.roomNumber) === rId))
        );
        if (room) {
          const action = viewRoomBtn.getAttribute('data-action');
          if (action === 'view-seating-plan') {
            this.roomDetailSubTab = 'seating';
          }
          this.activeModal = {
            type: 'modal-room-detail',
            room
          };
          this.render();
        }
        return;
      }
    });
    // 1. จัดการเหตุการณ์ในแถบมหาวิทยาลัย (University Header & Visitor Portal)
    this.attachUniversityAndVisitorEvents();

    // นำทางแท็บหลัก
    this.root.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-tab');
        if (tab) this.setTab(tab);
      });
    });

    // สลับโหมดสี Dark / Light
    const themeBtn = this.root.querySelector('#btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
      });
    }

    // Quick AI Button & Show License
    const quickAiBtn = this.root.querySelector('#btn-quick-ai');
    if (quickAiBtn) {
      quickAiBtn.addEventListener('click', () => {
        this.setTab('ai-agent');
      });
    }

    const showLicenseBtn = this.root.querySelector('#btn-show-license');
    if (showLicenseBtn) {
      showLicenseBtn.addEventListener('click', () => {
        this.activeModal = { type: 'modal-license' };
        this.render();
      });
    }

    // AI Agent Chat Form Submit
    const agentChatForm = this.root.querySelector('#form-agent-chat');
    if (agentChatForm) {
      agentChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = this.root.querySelector('#input-agent-chat');
        if (!input) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        await this.aiAgent.processMessage(msg);
        this.render();
        setTimeout(() => {
          const box = this.root.querySelector('#agent-messages-box');
          if (box) box.scrollTop = box.scrollHeight;
        }, 50);
      });
    }

    // Quick Prompt Triggers in AI Chat (Hero Cards, Telemetry Pills, Bottom Chips)
    this.root.querySelectorAll('[data-quick-prompt]').forEach(chip => {
      chip.addEventListener('click', async () => {
        const prompt = chip.getAttribute('data-quick-prompt');
        if (prompt) {
          await this.aiAgent.processMessage(prompt);
          this.render();
          setTimeout(() => {
            const box = this.root.querySelector('#agent-messages-box');
            if (box) box.scrollTop = box.scrollHeight;
          }, 50);
        }
      });
    });

    // Action buttons inside AI Agent messages
    this.root.querySelectorAll('.agent-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prompt = btn.getAttribute('data-agent-prompt');
        const actId = btn.getAttribute('data-agent-action');
        if (prompt) {
          await this.aiAgent.processMessage(prompt);
          this.render();
          setTimeout(() => {
            const box = this.root.querySelector('#agent-messages-box');
            if (box) box.scrollTop = box.scrollHeight;
          }, 50);
          return;
        }

        if (actId === 'run-auto-schedule') {
          this.runSolverWithFeedback();
        } else if (actId === 'export-pdf') {
          openPrintableSignoffSheets({
            assignments: appState.assignments,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: appState.rooms,
            allocations: appState.allocations,
            settings: appState.settings
          });
        } else if (actId === 'nav-what-if') {
          this.setTab('what-if');
        } else if (actId === 'nav-scheduler') {
          this.setTab('scheduler');
        } else if (actId === 'open-license-modal') {
          this.activeModal = { type: 'modal-license' };
          this.render();
        }
      });
    });

    // Clear Chat
    const clearChatBtn = this.root.querySelector('#btn-clear-chat');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการล้างประวัติการสนทนากับ AI Agent ใช่หรือไม่?')) {
          this.aiAgent.chatHistory = this.aiAgent.chatHistory.slice(0, 1);
          this.render();
        }
      });
    }

    // Undo / Redo
    const undoBtn = this.root.querySelector('#btn-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => appState.undo());
    const redoBtn = this.root.querySelector('#btn-redo');
    if (redoBtn) redoBtn.addEventListener('click', () => appState.redo());

    // Export Excel & PDF
    const exportExcelBtn = this.root.querySelector('#btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        exportExcelWorkbook({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations
        });
      });
    }

    // พิมพ์ตารางคุมสอบของฉัน (PDF) จากหน้า my-profile
    const printMyScheduleBtn = this.root.querySelector('#btn-print-my-schedule');
    if (printMyScheduleBtn) {
      printMyScheduleBtn.addEventListener('click', () => {
        const p = appState.getLoggedInProctor();
        if (p) {
          openPersonalDutySheet({
            proctor: p,
            assignments: appState.assignments,
            sessions: appState.sessions,
            rooms: appState.rooms,
            settings: appState.settings
          });
        }
      });
    }

    const exportPdfBtn = this.root.querySelector('#btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const loggedProctor = appState.getLoggedInProctor();
        if (loggedProctor) {
          // หากเป็นอาจารย์หรือผู้คุมสอบ เปิด modal ให้เลือกรูปแบบที่ต้องการพิมพ์
          this.activeModal = {
            type: 'choose-pdf-type',
            proctor: loggedProctor
          };
          this.render();
          return;
        }

        openPrintableSignoffSheets({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // Modal: choose-pdf-type triggers
    const doPrintPersonal = this.root.querySelector('#btn-do-print-personal');
    if (doPrintPersonal && this.activeModal?.proctor) {
      doPrintPersonal.addEventListener('click', () => {
        const p = this.activeModal.proctor;
        this.activeModal = null;
        this.render();
        openPersonalDutySheet({
          proctor: p,
          assignments: appState.assignments,
          sessions: appState.sessions,
          rooms: appState.rooms,
          settings: appState.settings
        });
      });
    }

    const doPrintAllRooms = this.root.querySelector('#btn-do-print-all-rooms');
    if (doPrintAllRooms) {
      doPrintAllRooms.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
        openPrintableSignoffSheets({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งจริง (10 ห้อง 520 ที่นั่ง) จาก Topbar
    const printDoorSignsBtn = this.root.querySelector('#btn-print-door-signs');
    if (printDoorSignsBtn) {
      printDoorSignsBtn.addEventListener('click', () => {
        openPrintableDoorSignsAndSeatingPlan({
          rooms: appState.rooms,
          sessions: appState.sessions,
          settings: appState.settings
        });
      });
    }

    // พิมพ์ชุดป้ายติดหน้าห้องสอบจาก Modal
    const doPrintDoorSigns = this.root.querySelector('#btn-do-print-door-signs');
    if (doPrintDoorSigns) {
      doPrintDoorSigns.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
        openPrintableDoorSignsAndSeatingPlan({
          rooms: appState.rooms,
          sessions: appState.sessions,
          settings: appState.settings
        });
      });
    }

    // คลิกดูแผนผังห้องสอบ (Seating Chart Modal)
    this.root.querySelectorAll('[data-action="view-seating-plan"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          this.roomDetailSubTab = 'seating';
          this.activeModal = {
            type: 'modal-room-detail',
            room
          };
          this.render();
        }
      });
    });

    // คลิกดูรายละเอียดห้องสอบ (Room Detail Modal)
    this.root.querySelectorAll('[data-action="view-room-detail"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          this.activeModal = {
            type: 'modal-room-detail',
            room
          };
          this.render();
        }
      });
    });

    // แสดงข้อมูลห้องแบบ Realtime เมื่อเลื่อนเมาส์ไปบนรูปทรงห้องในผังอาคาร
    this.root.querySelectorAll('.blueprint-svg-room').forEach(poly => {
      poly.addEventListener('mouseenter', () => {
        const code = poly.getAttribute('data-room-code');
        const name = poly.getAttribute('data-room-name');
        const isExam = poly.getAttribute('data-is-exam') === 'true';
        const examInfo = poly.getAttribute('data-exam-info') || '';

        const banner = this.root.querySelector('#blueprint-live-banner-f1') || this.root.querySelector('#blueprint-live-banner-f2');
        if (banner) {
          if (isExam) {
            banner.innerHTML = `
              <span class="banner-icon">🏫</span>
              <span class="banner-text"><strong>ห้อง ${code} : ${name}</strong> • <span class="badge badge-primary" style="font-size:11.5px; padding:2px 7px;">${examInfo}</span> <span style="color:var(--primary-600); font-weight:700; margin-left:8px;">👉 คลิกเพื่อเปิดผังที่นั่ง & สเปกห้อง</span></span>
            `;
          } else {
            banner.innerHTML = `
              <span class="banner-icon">🏢</span>
              <span class="banner-text"><strong>ห้อง ${code} : ${name}</strong> ${examInfo ? `• ${examInfo}` : ''}</span>
            `;
          }
        }
      });

      poly.addEventListener('mouseleave', () => {
        const banner = this.root.querySelector('#blueprint-live-banner-f1') || this.root.querySelector('#blueprint-live-banner-f2');
        if (banner) {
          banner.innerHTML = `
            <span class="banner-icon">💡</span>
            <span class="banner-text">เลื่อนเมาส์ไปที่ห้องเพื่อดูรายละเอียด • <strong>คลิกที่ห้องสอบ (กรอบสีม่วง)</strong> เพื่อเปิดผังที่นั่งจริงและข้อมูลห้อง</span>
          `;
        }
      });
    });

    // สลับแท็บใน Modal รายละเอียดห้องสอบ (Direct + Delegation)
    this.root.querySelectorAll('[data-room-detail-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tab = btn.getAttribute('data-room-detail-tab');
        if (tab) {
          this.roomDetailSubTab = tab;
          this.render();
        }
      });
    });

    // สลับมุมมองผังอาคาร 17 (Table / Floor 1 / Floor 2 / Directory)
    this.root.querySelectorAll('[data-floor-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.roomsViewMode = btn.getAttribute('data-floor-mode');
        this.render();
      });
    });

    // พิมพ์ใบเซ็นชื่อผู้คุมห้องนี้จากใน Modal
    const printRoomSignoffBtn = this.root.querySelector('#btn-print-room-signoff');
    if (printRoomSignoffBtn) {
      printRoomSignoffBtn.addEventListener('click', () => {
        const rId = printRoomSignoffBtn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          openPrintableSignoffSheets({
            assignments: appState.assignments,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: [room],
            allocations: appState.allocations.filter(a => a.roomId === room.id),
            settings: appState.settings
          });
        }
      });
    }

    // ลิงก์จากใน Modal ไปหน้าจัดตาราง
    const modalGotoScheduler = this.root.querySelector('#btn-modal-goto-scheduler');
    if (modalGotoScheduler) {
      modalGotoScheduler.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('scheduler');
      });
    }

    // คลิกพิมพ์ป้ายหน้าห้องของห้องเดี่ยว
    this.root.querySelectorAll('[data-action="print-room-sign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          openPrintableDoorSignsAndSeatingPlan({
            rooms: appState.rooms,
            sessions: appState.sessions,
            settings: appState.settings,
            targetRoomId: room.id
          });
        }
      });
    });

    // Quick Solver & Min Proctor Calc
    const runSolverQuick = this.root.querySelector('#btn-run-solver-quick');
    if (runSolverQuick) {
      runSolverQuick.addEventListener('click', () => {
        this.runSolverWithFeedback();
      });
    }

    // สุ่มสร้างผู้คุม 80 คนทันที (Hero & Master Data)
    const handleGen80 = () => {
      appState.autoGenerateSufficientProctors(80);
      alert('🎉 สุ่มสร้างรายชื่ออาจารย์และบุคลากรผู้คุมสอบ 80 ท่านเรียบร้อยแล้ว!\n\nคุณสามารถกดปุ่ม "🚀 เริ่มจัดตารางอัตโนมัติ" ได้ทันทีโดยไม่ต้องพิมพ์เองแม้แต่คนเดียว');
    };

    const genProctorsHeroBtn = this.root.querySelector('#btn-quick-gen-proctors-hero');
    if (genProctorsHeroBtn) genProctorsHeroBtn.addEventListener('click', handleGen80);

    const genProctorsMasterBtn = this.root.querySelector('#btn-auto-gen-proctors-master');
    if (genProctorsMasterBtn) genProctorsMasterBtn.addEventListener('click', handleGen80);

    // สุ่มเพิ่มผู้คุมอีก 20 คน (Hero & Master Data)
    const handleAdd20 = () => {
      const total = appState.addRandomProctors(20);
      alert(`➕ สุ่มเพิ่มผู้คุมสอบให้อีก 20 ท่านเรียบร้อยแล้ว! (รวมทั้งสิ้น ${total} ท่าน)`);
    };

    const add20HeroBtn = this.root.querySelector('#btn-add-20-proctors-hero');
    if (add20HeroBtn) add20HeroBtn.addEventListener('click', handleAdd20);

    const add20MasterBtn = this.root.querySelector('#btn-add-random-20-master');
    if (add20MasterBtn) add20MasterBtn.addEventListener('click', handleAdd20);

    const calcMinBtn = this.root.querySelector('#btn-calc-min-proctor');
    if (calcMinBtn) {
      calcMinBtn.addEventListener('click', () => {
        this.minProctorResult = appState.calculateMinProctors();
        this.render();
      });
    }

    const closeMinCalc = this.root.querySelector('#btn-close-min-calc');
    if (closeMinCalc) {
      closeMinCalc.addEventListener('click', () => {
        this.minProctorResult = null;
        this.render();
      });
    }

    const gotoScheduler = this.root.querySelector('#btn-goto-scheduler');
    if (gotoScheduler) gotoScheduler.addEventListener('click', () => this.setTab('scheduler'));

    // คลิกที่ 4 การ์ดสถิติหน้าแดชบอร์ด (Dashboard KPI Cards)
    const cardKpiRooms = this.root.querySelector('[data-action="view-kpi-rooms"]');
    if (cardKpiRooms) {
      cardKpiRooms.addEventListener('click', () => {
        this.activeModal = { type: 'modal-kpi-rooms' };
        this.render();
      });
      cardKpiRooms.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.activeModal = { type: 'modal-kpi-rooms' };
          this.render();
        }
      });
    }

    const cardKpiProctors = this.root.querySelector('[data-action="view-kpi-proctors"]');
    if (cardKpiProctors) {
      cardKpiProctors.addEventListener('click', () => {
        this.activeModal = { type: 'modal-kpi-proctors' };
        this.render();
      });
      cardKpiProctors.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.activeModal = { type: 'modal-kpi-proctors' };
          this.render();
        }
      });
    }

    const cardKpiSchedule = this.root.querySelector('[data-action="view-kpi-schedule-status"]');
    if (cardKpiSchedule) {
      cardKpiSchedule.addEventListener('click', () => {
        const valResult = validateSchedule({
          assignments: appState.assignments,
          allocations: appState.allocations,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        const totalSlots = appState.allocations.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
          + (appState.sessions.length * appState.settings.hardConstraints.h8_reserve_proctors_per_session);
        const assignedSlots = appState.assignments.length;
        const isComplete = assignedSlots >= totalSlots && valResult.isValid;

        this.activeModal = {
          type: 'modal-kpi-schedule-status',
          data: { valResult, totalSlots, assignedSlots, isComplete }
        };
        this.render();
      });
      cardKpiSchedule.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cardKpiSchedule.click();
        }
      });
    }

    const cardKpiRules = this.root.querySelector('[data-action="view-kpi-rules-audit"]');
    if (cardKpiRules) {
      cardKpiRules.addEventListener('click', () => {
        const valResult = validateSchedule({
          assignments: appState.assignments,
          allocations: appState.allocations,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        this.activeModal = {
          type: 'modal-kpi-rules-audit',
          data: { valResult }
        };
        this.render();
      });
      cardKpiRules.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cardKpiRules.click();
        }
      });
    }

    // ปุ่มนำทางใน KPI Modals
    const navMasterRooms = this.root.querySelector('[data-action="nav-master-rooms"]');
    if (navMasterRooms) {
      navMasterRooms.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('master-data');
        this.masterDataSubTab = 'rooms';
        this.roomsViewMode = 'table';
      });
    }

    const navMasterProctors = this.root.querySelector('[data-action="nav-master-proctors"]');
    if (navMasterProctors) {
      navMasterProctors.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('master-data');
        this.masterDataSubTab = 'proctors';
      });
    }

    const navScheduler = this.root.querySelector('[data-action="nav-scheduler"]');
    if (navScheduler) {
      navScheduler.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('scheduler');
      });
    }

    const navSettings = this.root.querySelector('[data-action="nav-settings"]');
    if (navSettings) {
      navSettings.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('settings');
      });
    }

    // สลับมุมมองรอบการสอบหน้าแดชบอร์ด (Cards / Table)
    this.root.querySelectorAll('[data-session-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-session-view');
        if (mode) {
          this.dashboardSessionView = mode;
          this.render();
        }
      });
    });

    // Quick Actions ใน Hero Banner
    this.root.querySelectorAll('[data-quick-action]').forEach(card => {
      card.addEventListener('click', () => {
        const act = card.getAttribute('data-quick-action');
        if (act === 'run-solver') {
          this.runSolverWithFeedback();
        } else if (act === 'gen-proctors') {
          handleGen80();
        } else if (act === 'calc-min') {
          this.minProctorResult = appState.calculateMinProctors();
          this.render();
        } else if (act === 'floor-plan') {
          this.setTab('master-data');
          this.masterDataSubTab = 'rooms';
          this.roomsViewMode = 'floor1';
          this.render();
        } else if (act === 'rules-audit') {
          const valResult = validateSchedule({
            assignments: appState.assignments,
            allocations: appState.allocations,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: appState.rooms,
            unavailabilities: appState.unavailabilities,
            settings: appState.settings
          });
          this.activeModal = {
            type: 'modal-kpi-rules-audit',
            data: { valResult }
          };
          this.render();
        }
      });
    });

    // ลิงก์ดูรอบการสอบใน Scheduler จากการ์ดในแดชบอร์ด
    this.root.querySelectorAll('[data-action="view-session-scheduler"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        if (sId) {
          this.selectedSessionFilter = sId;
        }
        this.setTab('scheduler');
      });
    });

    // กรองรอบการสอบในหน้า Scheduler ด้วย Filter Pills
    this.root.querySelectorAll('[data-filter-session]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-filter-session');
        if (sId) {
          this.selectedSessionFilter = sId;
          this.render();
        }
      });
    });

    const runSolverModal = this.root.querySelector('#btn-run-solver-from-modal');
    if (runSolverModal) {
      runSolverModal.addEventListener('click', () => {
        this.activeModal = null;
        this.runSolverWithFeedback();
      });
    }

    // Subviews ในหน้าจัดตาราง
    const subGrid = this.root.querySelector('#subview-grid');
    if (subGrid) subGrid.addEventListener('click', () => this.setScheduleSubView('grid'));
    const subPersonal = this.root.querySelector('#subview-personal');
    if (subPersonal) subPersonal.addEventListener('click', () => this.setScheduleSubView('personal'));
    const subWorkload = this.root.querySelector('#subview-workload');
    if (subWorkload) subWorkload.addEventListener('click', () => this.setScheduleSubView('workload'));

    const runSolverBtn = this.root.querySelector('#btn-run-solver');
    if (runSolverBtn) runSolverBtn.addEventListener('click', () => this.runSolverWithFeedback());

    // ลากะทันหัน Modal
    const suddenLeaveBtn = this.root.querySelector('#btn-sudden-leave-modal');
    if (suddenLeaveBtn) {
      suddenLeaveBtn.addEventListener('click', () => {
        this.activeModal = { type: 'sudden-leave', data: {} };
        this.render();
        this.updateSuddenLeaveCandidates();
      });
    }

    // Master data sub-tabs
    this.root.querySelectorAll('[data-master-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.masterDataSubTab = btn.getAttribute('data-master-tab');
        this.render();
      });
    });

    // PDPA toggle
    const togglePdpaBtn = this.root.querySelector('#btn-toggle-pdpa');
    if (togglePdpaBtn) {
      togglePdpaBtn.addEventListener('click', () => {
        this.maskPDPA = !this.maskPDPA;
        this.render();
      });
    }

    // Presets
    this.root.querySelectorAll('[data-action="load-preset"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pKey = btn.getAttribute('data-preset');
        if (pKey) appState.loadPreset(pKey);
      });
    });

    // CSV Download Template
    const dlTplBtn = this.root.querySelector('#btn-download-template');
    if (dlTplBtn) {
      dlTplBtn.addEventListener('click', () => {
        const tplKey = this.masterDataSubTab === 'rooms' ? 'rooms' : (this.masterDataSubTab === 'unavail' ? 'unavailabilities' : 'proctors');
        const tpl = CSV_TEMPLATES[tplKey];
        const csvContent = exportToCSV(tpl.sampleData, tpl.columns);
        triggerCSVDownload(csvContent, tpl.filename);
      });
    }

    // CSV Export Current
    const exportCsvBtn = this.root.querySelector('#btn-export-current-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        if (this.masterDataSubTab === 'proctors') {
          const tpl = CSV_TEMPLATES.proctors;
          triggerCSVDownload(exportToCSV(appState.proctors, tpl.columns), 'proctors_data.csv');
        } else if (this.masterDataSubTab === 'rooms') {
          const tpl = CSV_TEMPLATES.rooms;
          triggerCSVDownload(exportToCSV(appState.rooms, tpl.columns), 'rooms_data.csv');
        } else if (this.masterDataSubTab === 'unavail') {
          const tpl = CSV_TEMPLATES.unavailabilities;
          triggerCSVDownload(exportToCSV(appState.unavailabilities, tpl.columns), 'unavailability_data.csv');
        }
      });
    }

    // CSV Import
    const importFileInput = this.root.querySelector('#file-import-csv');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const rows = parseCSV(evt.target.result);
            if (rows.length > 0) {
              alert(`นำเข้าข้อมูลสำเร็จ ${rows.length} รายการ`);
            }
          };
          reader.readAsText(file, 'UTF-8');
        }
      });
    }

    // ค้นหาและกรองผู้คุมสอบใน Master Data
    const searchProctorInput = this.root.querySelector('#input-search-proctor');
    if (searchProctorInput) {
      searchProctorInput.addEventListener('input', (e) => {
        this.proctorSearchQuery = e.target.value;
        this.render();
        const inp = this.root.querySelector('#input-search-proctor');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      });
    }

    const filterLevelSelect = this.root.querySelector('#select-filter-level');
    if (filterLevelSelect) {
      filterLevelSelect.addEventListener('change', (e) => {
        this.proctorFilterLevel = e.target.value;
        this.render();
      });
    }

    const clearProctorFilterBtn = this.root.querySelector('#btn-clear-proctor-filter');
    if (clearProctorFilterBtn) {
      clearProctorFilterBtn.addEventListener('click', () => {
        this.proctorSearchQuery = '';
        this.proctorFilterLevel = 'all';
        this.render();
      });
    }

    // What-if actions
    this.root.querySelectorAll('[data-action="run-whatif"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = btn.getAttribute('data-scenario');
        if (sc === 'reduce-quota') {
          this.whatIfScenario = {
            title: 'ลดโควต้าลง 1 รอบ/วัน',
            description: 'ระบบทดลองจำลองตารางเมื่อปรับ daily quota เหลือ 1 รอบ/วัน ผลลัพธ์: พบว่าผู้คุมไม่เพียงพอสำหรับรอบบ่าย ขาดอีก 8 ตำแหน่ง',
            success: false
          };
        } else if (sc === 'proctors-leave') {
          this.whatIfScenario = {
            title: 'ผู้คุม 5 คนลาป่วยกะทันหัน',
            description: 'สุ่มดึงผู้คุม 5 คนออก และใช้ผู้คุมสำรอง ผลลัพธ์: สามารถจัดตารางแทนที่ได้สมบูรณ์ 100% โดยดึงผู้คุมสำรอง 4 คน และผู้คุมที่มีโควต้าว่าง 1 คน',
            success: true
          };
        } else if (sc === 'room-broken') {
          this.whatIfScenario = {
            title: 'ห้อง R03 แอร์เสีย',
            description: 'ปิดห้อง R03 และเกลี่ยผู้สอบ 35 คนไปห้องที่เหลือ ผลลัพธ์: ทุกห้องยังคงจุได้ไม่เกิน capacity และจัดผู้คุมลงตัว',
            success: true
          };
        }
        this.render();
      });
    });

    // Save Snapshot Version
    const saveVerBtn = this.root.querySelector('#btn-save-version');
    if (saveVerBtn) {
      saveVerBtn.addEventListener('click', () => {
        const note = prompt('ระบุบันทึกช่วยจำสำหรับ Snapshot นี้:', 'ตารางฉบับปรับปรุง');
        if (note !== null) {
          appState.saveVersionSnapshot(note);
        }
      });
    }

    // Restore Version
    this.root.querySelectorAll('[data-action="restore-version"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vId = btn.getAttribute('data-version-id');
        if (vId && confirm('ต้องการย้อนกลับไปใช้เวอร์ชันนี้ใช่หรือไม่?')) {
          appState.restoreVersion(vId);
        }
      });
    });

    // Diff compare
    this.root.querySelectorAll('[data-action="compare-diff"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v1 = btn.getAttribute('data-v1');
        const v2 = btn.getAttribute('data-v2');
        const diff = appState.compareVersions(v1, v2);
        if (diff) {
          alert(`เปรียบเทียบเวอร์ชัน ${diff.versionA} กับ ${diff.versionB}:\nพบการเปลี่ยนแปลงทั้งหมด ${diff.differences.length} ตำแหน่ง`);
        }
      });
    });

    // Settings form submit
    const settingsForm = this.root.querySelector('#form-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        appState.settings.hardConstraints.h3_daily_quota_default = Number(fd.get('dailyQuota'));
        appState.settings.hardConstraints.h3_project_quota_default = Number(fd.get('projectQuota'));
        appState.settings.hardConstraints.h3_max_hours_default = Number(fd.get('maxHours'));
        appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors = Number(fd.get('examineeThreshold'));
        appState.settings.hardConstraints.h6_min_rest_minutes_between_sessions = Number(fd.get('minRest'));
        appState.settings.hardConstraints.h8_reserve_proctors_per_session = Number(fd.get('reserveCount'));
        appState.settings.hardConstraints.h7_require_all_computer_rooms = fd.get('requireAllComputer') === '1';
        appState.notify();
        alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      });
    }

    const resetSettingsBtn = this.root.querySelector('#btn-reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        if (confirm('ต้องการรีเซ็ตการตั้งค่าเป็นค่ามาตรฐานทั้งหมดใช่หรือไม่?')) {
          appState.resetSettings();
        }
      });
    }

    // Run All Tests
    const runTestsBtn = this.root.querySelector('#btn-run-all-tests');
    if (runTestsBtn) {
      runTestsBtn.addEventListener('click', async () => {
        runTestsBtn.disabled = true;
        runTestsBtn.textContent = '⏳ กำลังรันการทดสอบ...';
        this.testResults = await runAllTests();
        this.render();
      });
    }

    // --- ระบบลากปรับเปลี่ยนคน เปลี่ยนรอบได้ (HTML5 Drag & Drop Reassign / Swap) ---
    this.root.querySelectorAll('.proctor-chip[draggable="true"]').forEach(chip => {
      chip.addEventListener('dragstart', (e) => {
        this._isDragging = true;
        chip.classList.add('is-dragging');
        this._draggedData = {
          assignId: chip.getAttribute('data-assign-id'),
          proctorId: chip.getAttribute('data-proctor-id'),
          sessionId: chip.getAttribute('data-session-id'),
          allocId: chip.getAttribute('data-alloc-id'),
          roomId: chip.getAttribute('data-room-id'),
          role: chip.getAttribute('data-role'),
          orderIndex: parseInt(chip.getAttribute('data-order-index'), 10) || 1
        };
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', JSON.stringify(this._draggedData));
        } catch (err) {}
      });

      chip.addEventListener('dragend', () => {
        chip.classList.remove('is-dragging');
        this.root.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        setTimeout(() => {
          this._isDragging = false;
          this._draggedData = null;
        }, 120);
      });
    });

    // Dropzones สำหรับรับการลากวาง (ทั้งช่องว่างและชิปที่มีอยู่เดิมเพื่อสลับตัว Swap)
    this.root.querySelectorAll('[data-drop-zone="slot"], .proctor-chip').forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('drag-over');
        }
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');

        let data = this._draggedData;
        if (!data) {
          try {
            data = JSON.parse(e.dataTransfer.getData('text/plain'));
          } catch (err) {}
        }
        if (!data || !data.assignId) return;

        const isChip = zone.classList.contains('proctor-chip');
        const targetContainer = isChip ? zone.closest('[data-drop-zone="slot"]') : zone;

        const targetSessionId = targetContainer?.getAttribute('data-session-id') || zone.getAttribute('data-session-id');
        const targetAllocId = targetContainer?.getAttribute('data-alloc-id') || zone.getAttribute('data-alloc-id');
        const targetRoomId = targetContainer?.getAttribute('data-room-id') || zone.getAttribute('data-room-id');
        const targetRole = targetContainer?.getAttribute('data-role') || zone.getAttribute('data-role') || 'proctor';
        const targetOrderIndex = parseInt(targetContainer?.getAttribute('data-order-index') || zone.getAttribute('data-order-index'), 10) || 1;
        const targetAssignId = isChip ? zone.getAttribute('data-assign-id') : null;

        if (targetAssignId && targetAssignId === data.assignId) return;

        const res = appState.dragAndDropReassign({
          sourceAssignId: data.assignId,
          targetSessionId,
          targetAllocId,
          targetRoomId,
          targetRole,
          targetOrderIndex,
          targetAssignId
        });

        if (res.success) {
          this.showToast(res.message, 'success');
        } else {
          this.showToast(res.message, 'error');
        }
      });
    });

    // Quick Quota Buttons (6, 3, 2, 1) ในตารางผู้คุมสอบ Master Data
    this.root.querySelectorAll('[data-action="quick-quota"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proctorId = btn.getAttribute('data-proctor-id');
        const newQuota = parseInt(btn.getAttribute('data-quota'), 10);
        const p = appState.proctors.find(x => x.id === proctorId);
        if (p) {
          appState.updateProctorQuotaAndDates(proctorId, {
            projectQuota: newQuota,
            dailyQuota: newQuota === 1 ? 1 : 2
          });
          this.showToast(`ปรับโควต้า ${p.firstName} ${p.lastName} เป็น ${newQuota} รอบสำเร็จ`, 'success');
        }
      });
    });

    // Click on proctor chip -> Open edit slot modal (ป้องกัน popup ขณะลากวาง)
    this.root.querySelectorAll('.proctor-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this._isDragging) return;
        const assignId = chip.getAttribute('data-assign-id');
        const assign = appState.assignments.find(a => a.id === assignId);
        if (assign) {
          this.activeModal = {
            type: 'edit-slot',
            data: {
              sessionId: assign.sessionId,
              allocationId: assign.allocationId,
              roomId: assign.roomId,
              role: assign.role,
              currentAssign: assign
            }
          };
          this.render();
        }
      });
    });

    // Add proctor button on empty slot
    this.root.querySelectorAll('[data-action="assign-slot"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeModal = {
          type: 'edit-slot',
          data: {
            sessionId: btn.getAttribute('data-session-id'),
            allocationId: btn.getAttribute('data-alloc-id'),
            roomId: btn.getAttribute('data-room-id'),
            role: btn.getAttribute('data-role'),
            currentAssign: null
          }
        };
        this.render();
      });
    });

    // Modal Close
    this.root.querySelectorAll('#btn-close-modal, #btn-cancel-modal, [data-action="close-modal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    });

    // Modal: Confirm Assign candidate (รองรับการสลับตัว swap)
    this.root.querySelectorAll('[data-action="confirm-assign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id');
        const doSwap = btn.getAttribute('data-swap') === 'true';
        const data = this.activeModal.data;
        appState.assignProctorManually({
          sessionId: data.sessionId,
          allocationId: data.allocationId,
          roomId: data.roomId,
          proctorId: pId,
          role: data.role,
          reason: doSwap ? 'สลับตัวผู้คุมระหว่างห้อง' : 'เลือกด้วยตนเองจากรายการ',
          doSwap
        });
        this.activeModal = null;
        this.render();
      });
    });

    // Modal: Auto-Pick Proctor for Slot (สุ่มเลือกผู้คุมที่ผ่านเกณฑ์ทันที)
    const autoPickBtn = this.root.querySelector('#btn-auto-pick-slot');
    if (autoPickBtn && this.activeModal?.type === 'edit-slot') {
      autoPickBtn.addEventListener('click', () => {
        const { sessionId, allocationId, roomId, role, currentAssign } = this.activeModal.data;
        const res = appState.autoPickProctorForSlot(sessionId, allocationId, roomId, role, currentAssign?.id);
        if (res.success) {
          this.activeModal = null;
          this.render();
          alert(`🎲 สุ่มเลือก "${res.proctor.firstName} ${res.proctor.lastName}" (${res.proctor.academicTitle || ''}) เข้าคุมตำแหน่งนี้เรียบร้อยแล้ว!\nเหตุผล: ${res.reason || 'ผ่านเกณฑ์ Hard Rules H1-H8 สมบูรณ์'}`);
        } else {
          alert(res.message || 'ไม่สามารถสุ่มเลือกได้');
        }
      });
    }

    // เพิ่มผู้คุมสำรองประจำรอบ
    this.root.querySelectorAll('[data-action="add-reserve"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        this.activeModal = {
          type: 'edit-slot',
          data: {
            sessionId: sId,
            allocationId: `RESERVE_${sId}`,
            roomId: null,
            role: 'reserve',
            currentAssign: null
          }
        };
        this.render();
      });
    });

    // Quick Add Session (จากหน้าจัดตาราง หรือ หน้าแดชบอร์ด)
    const openAddSessionModal = () => {
      this.activeModal = {
        type: 'modal-master-sessions',
        data: {}
      };
      this.render();
    };
    const addQuickBtn = this.root.querySelector('#btn-add-session-quick');
    if (addQuickBtn) addQuickBtn.addEventListener('click', openAddSessionModal);
    const addDashBtn = this.root.querySelector('#btn-add-session-dash');
    if (addDashBtn) addDashBtn.addEventListener('click', openAddSessionModal);

    // ล้างตารางที่จัดไว้ทั้งหมด (Clear Schedule)
    const clearSchedBtn = this.root.querySelector('#btn-clear-schedule');
    if (clearSchedBtn) {
      clearSchedBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการล้างตารางการจัดสอบทั้งหมดหรือไม่?\n\n(หากต้องการล้างทั้งหมด ให้กดตกลง เพื่อเริ่มจัดหรือแก้ไขใหม่ได้อย่างอิสระ)')) {
          appState.clearSchedule(true);
          this.render();
        }
      });
    }

    // ล้างผู้คุมเฉพาะในรอบที่ระบุ
    this.root.querySelectorAll('[data-action="clear-session-assigns"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const sess = appState.sessions.find(s => s.id === sId);
        const name = sess ? sess.name : sId;
        if (confirm(`คุณต้องการล้างผู้คุมทั้งหมดเฉพาะในรอบ "${name}" ใช่หรือไม่?`)) {
          appState.clearSessionAssignments(sId);
          this.render();
        }
      });
    });

    // ยกเลิก/ลบรอบการสอบออกจากระบบ
    this.root.querySelectorAll('[data-action="cancel-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const sess = appState.sessions.find(s => s.id === sId);
        const name = sess ? `${sess.name} (${sId})` : sId;
        if (confirm(`คุณต้องการยกเลิกและลบรอบการสอบ "${name}" ออกจากระบบใช่หรือไม่?\n\n(ข้อมูลการจัดผู้คุมและห้องสอบในรอบนี้จะถูกลบออกทั้งหมด)`)) {
          appState.deleteSession(sId);
          this.render();
        }
      });
    });

    // Modal: Toggle Lock
    this.root.querySelectorAll('[data-action="toggle-lock"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aId = btn.getAttribute('data-assign-id');
        appState.toggleLockAssignment(aId);
        this.activeModal = null;
        this.render();
      });
    });

    // Modal: Remove Assignment
    this.root.querySelectorAll('[data-action="remove-assign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aId = btn.getAttribute('data-assign-id');
        appState.removeAssignment(aId);
        this.activeModal = null;
        this.render();
      });
    });

    // Sudden leave selects
    const leaveSessionSelect = this.root.querySelector('#select-leave-session');
    const leaveProctorSelect = this.root.querySelector('#select-leave-proctor');
    if (leaveSessionSelect && leaveProctorSelect) {
      leaveSessionSelect.addEventListener('change', () => this.updateSuddenLeaveCandidates());
      leaveProctorSelect.addEventListener('change', () => this.updateSuddenLeaveCandidates());
    }

    // Modal Cancel Button
    const cancelModalBtn = this.root.querySelector('#btn-cancel-modal');
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Add Button
    const addMasterBtn = this.root.querySelector('#btn-add-master-item');
    if (addMasterBtn) {
      addMasterBtn.addEventListener('click', () => {
        this.activeModal = {
          type: 'modal-master-' + this.masterDataSubTab,
          data: null
        };
        this.render();
      });
    }

    // Master Data: Edit Buttons
    this.root.querySelectorAll('[data-action="edit-master"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        let item = null;
        if (type === 'proctors') item = appState.proctors.find(p => p.id === id);
        else if (type === 'rooms') item = appState.rooms.find(r => r.id === id);
        else if (type === 'sessions') item = appState.sessions.find(s => s.id === id);
        else if (type === 'unavail') item = appState.unavailabilities.find(u => u.id === id);

        if (item) {
          this.activeModal = {
            type: 'modal-master-' + type,
            data: JSON.parse(JSON.stringify(item))
          };
          this.render();
        }
      });
    });

    // Master Data: Delete Buttons
    this.root.querySelectorAll('[data-action="delete-master"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        let name = id;
        if (type === 'proctors') {
          const p = appState.proctors.find(x => x.id === id);
          if (p) name = `${p.firstName} ${p.lastName} (${id})`;
        } else if (type === 'rooms') {
          const r = appState.rooms.find(x => x.id === id);
          if (r) name = `${r.name} (${id})`;
        } else if (type === 'sessions') {
          const s = appState.sessions.find(x => x.id === id);
          if (s) name = `${s.name} (${id})`;
        }

        if (confirm(`คุณต้องการลบข้อมูล "${name}" ใช่หรือไม่?`)) {
          if (type === 'proctors') appState.deleteProctor(id);
          else if (type === 'rooms') appState.deleteRoom(id);
          else if (type === 'sessions') appState.deleteSession(id);
          else if (type === 'unavail') appState.deleteUnavailability(id);
          this.render();
        }
      });
    });

    // Master Data: Submit Proctor Form
    const proctorForm = this.root.querySelector('#form-master-proctor');
    if (proctorForm) {
      proctorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(proctorForm);
        const selectedDates = fd.getAll('availableDates');
        appState.saveProctor({
          id: fd.get('id') || undefined,
          academicTitle: fd.get('academicTitle'),
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          proctorType: fd.get('proctorType'),
          level: fd.get('level'),
          department: fd.get('department'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          dailyQuota: fd.get('dailyQuota'),
          projectQuota: fd.get('projectQuota'),
          maxHours: fd.get('maxHours'),
          availableDates: selectedDates,
          sessionPattern: fd.get('sessionPattern') || 'FULL_DAY_PAIRED',
          isActive: fd.get('isActive') === '1'
        });
        this.activeModal = null;
        this.showToast('บันทึกข้อมูลผู้คุมสอบเรียบร้อยแล้ว', 'success');
        this.render();
      });
    }

    // Master Data: Submit Room Form
    const roomForm = this.root.querySelector('#form-master-room');
    if (roomForm) {
      roomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(roomForm);
        appState.saveRoom({
          id: fd.get('id') || undefined,
          name: fd.get('name'),
          building: fd.get('building'),
          floor: fd.get('floor'),
          capacity: fd.get('capacity'),
          roomType: fd.get('roomType'),
          accessibleForDisabled: fd.get('accessibleForDisabled') === '1',
          isActive: fd.get('isActive') === '1'
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Submit Session Form
    const sessionForm = this.root.querySelector('#form-master-session');
    if (sessionForm) {
      sessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(sessionForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveSession({
          id: fd.get('id') || undefined,
          name: fd.get('name'),
          date,
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          prepMinutes: fd.get('prepMinutes'),
          wrapMinutes: fd.get('wrapMinutes'),
          organization: fd.get('organization')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Submit Unavailability Form
    const unavailForm = this.root.querySelector('#form-master-unavail');
    if (unavailForm) {
      unavailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(unavailForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveUnavailability({
          id: fd.get('id') || undefined,
          proctorId: fd.get('proctorId'),
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          reason: fd.get('reason')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // สลับบัญชี / เข้าสู่ระบบ (Open Switch User Modal)
    const openUserModal = () => {
      this.activeModal = { type: 'switch-user', data: null };
      this.render();
    };
    const openUserBtn = this.root.querySelector('#btn-open-user-modal');
    if (openUserBtn) openUserBtn.addEventListener('click', openUserModal);
    const openUserBtnInline = this.root.querySelector('#btn-open-user-modal-inline');
    if (openUserBtnInline) openUserBtnInline.addEventListener('click', openUserModal);
    const openUserBtnNotice = this.root.querySelector('#btn-open-user-modal-notice');
    if (openUserBtnNotice) openUserBtnNotice.addEventListener('click', openUserModal);

    // Confirm Switch User
    this.root.querySelectorAll('[data-action="confirm-switch-user"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        if (uId === 'admin') {
          appState.setCurrentUser({
            id: 'admin',
            role: 'admin',
            name: 'ผู้ดูแลระบบ (Admin)',
            proctorId: null
          });
        } else {
          const p = appState.proctors.find(x => x.id === uId);
          if (p) {
            appState.setCurrentUser({
              id: p.id,
              role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
              name: `${p.proctorType === 'faculty' ? 'อ.' : ''}${p.firstName} ${p.lastName}`,
              proctorId: p.id
            });
            this.currentTab = 'my-profile';
          }
        }
        this.activeModal = null;
        this.render();
      });
    });

    // Switch custom proctor from dropdown
    const customProctorBtn = this.root.querySelector('#btn-select-custom-proctor');
    if (customProctorBtn) {
      customProctorBtn.addEventListener('click', () => {
        const pId = this.root.querySelector('#select-any-proctor-user')?.value;
        const p = appState.proctors.find(x => x.id === pId);
        if (p) {
          appState.setCurrentUser({
            id: p.id,
            role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
            name: `${p.proctorType === 'faculty' ? 'อ.' : ''}${p.firstName} ${p.lastName}`,
            proctorId: p.id
          });
          this.currentTab = 'my-profile';
          this.activeModal = null;
          this.render();
        }
      });
    }

    // ไปที่โปรไฟล์ของฉัน
    const gotoProfileBtn = this.root.querySelector('#btn-goto-my-profile');
    if (gotoProfileBtn) {
      gotoProfileBtn.addEventListener('click', () => {
        this.setTab('my-profile');
      });
    }

    const gotoSchedFromProfile = this.root.querySelector('#btn-goto-scheduler-from-profile');
    if (gotoSchedFromProfile) {
      gotoSchedFromProfile.addEventListener('click', () => {
        this.setTab('scheduler');
      });
    }

    // แก้ไขข้อมูลส่วนตัวของฉัน (Proctor / Teacher)
    const editMyProfileBtn = this.root.querySelector('#btn-edit-my-profile');
    if (editMyProfileBtn) {
      editMyProfileBtn.addEventListener('click', () => {
        this.activeModal = { type: 'edit-my-profile', data: null };
        this.render();
      });
    }

    // Submit edit my profile
    const editMyProfileForm = this.root.querySelector('#form-edit-my-profile');
    if (editMyProfileForm) {
      editMyProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(editMyProfileForm);
        appState.saveProctor({
          id: fd.get('id'),
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          department: fd.get('department'),
          phone: fd.get('phone'),
          email: fd.get('email')
        });
        this.activeModal = null;
        this.render();
        alert('บันทึกข้อมูลส่วนตัวของคุณเรียบร้อยแล้ว');
      });
    }

    // เพิ่มช่วงไม่สะดวกส่วนตัว (My Unavailability)
    const addMyUnavailBtn = this.root.querySelector('#btn-add-my-unavail');
    if (addMyUnavailBtn) {
      addMyUnavailBtn.addEventListener('click', () => {
        this.activeModal = { type: 'modal-add-my-unavail', data: null };
        this.render();
      });
    }

    // Submit My Unavailability
    const addMyUnavailForm = this.root.querySelector('#form-add-my-unavail');
    if (addMyUnavailForm) {
      addMyUnavailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(addMyUnavailForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveUnavailability({
          proctorId: fd.get('proctorId'),
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          reason: fd.get('reason')
        });
        this.activeModal = null;
        this.render();
        alert('บันทึกช่วงเวลาที่คุณไม่สะดวกเรียบร้อยแล้ว');
      });
    }

    // ลบช่วงเวลาไม่สะดวกของฉัน
    this.root.querySelectorAll('[data-action="delete-my-unavail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-unavail-id');
        if (confirm('ต้องการลบช่วงเวลาไม่สะดวกนี้ใช่หรือไม่?')) {
          appState.deleteUnavailability(uId);
          this.render();
        }
      });
    });

    // Admin: แก้ไขเวลา/ข้อมูลรอบการสอบ
    this.root.querySelectorAll('[data-action="edit-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const s = appState.sessions.find(x => x.id === sId);
        if (s) {
          this.activeModal = {
            type: 'modal-master-sessions',
            data: JSON.parse(JSON.stringify(s))
          };
          this.render();
        }
      });
    });

    // Admin: เพิ่มห้องในรอบการสอบ
    this.root.querySelectorAll('[data-action="add-room-to-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        this.activeModal = {
          type: 'modal-add-room-session',
          data: { sessionId: sId }
        };
        this.render();
      });
    });

    const addRoomSessionForm = this.root.querySelector('#form-add-room-session');
    if (addRoomSessionForm) {
      addRoomSessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(addRoomSessionForm);
        appState.addRoomToSession(fd.get('sessionId'), fd.get('roomId'), fd.get('examinees'));
        this.activeModal = null;
        this.render();
      });
    }

    // Admin: ปรับจำนวนคน / ห้องในรอบสอบ
    this.root.querySelectorAll('[data-action="edit-alloc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const allocId = btn.getAttribute('data-alloc-id');
        this.activeModal = {
          type: 'modal-edit-alloc',
          data: { allocId }
        };
        this.render();
      });
    });

    const editAllocForm = this.root.querySelector('#form-edit-alloc');
    if (editAllocForm) {
      editAllocForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(editAllocForm);
        appState.updateAllocation(fd.get('allocId'), {
          roomId: fd.get('roomId'),
          examineesInRoom: fd.get('examinees')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Admin: ถอดห้องออกจากรอบการสอบ
    this.root.querySelectorAll('[data-action="remove-alloc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const allocId = btn.getAttribute('data-alloc-id');
        const alloc = appState.allocations.find(a => a.id === allocId);
        const room = alloc ? appState.rooms.find(r => r.id === alloc.roomId) : null;
        const name = room ? room.name : allocId;
        if (confirm(`คุณต้องการถอดห้อง "${name}" ออกจากรอบการสอบนี้ใช่หรือไม่?`)) {
          appState.removeRoomFromSession(allocId);
          this.render();
        }
      });
    });
  }

  // อัปเดตรายชื่อตัวแทนในกล่องลากะทันหัน
  updateSuddenLeaveCandidates() {
    const sId = this.root.querySelector('#select-leave-session')?.value;
    const pId = this.root.querySelector('#select-leave-proctor')?.value;
    const box = this.root.querySelector('#substitute-candidates-box');
    if (!sId || !pId || !box) return;

    const candidates = appState.getRecommendedSubstitutes(sId, null, 'proctor', pId);
    if (candidates.length === 0) {
      box.innerHTML = '<div style="color: var(--danger-500); font-size: 13px;">ไม่มีผู้คุมสำรองหรือผู้คุมที่ว่างในรอบนี้</div>';
      return;
    }

    box.innerHTML = candidates.slice(0, 4).map(c => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
        <div>
          <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
          <span style="font-size: 11px; color: ${c.isReserve ? 'var(--success-500)' : 'var(--text-muted)'}; font-weight: ${c.isReserve ? '700' : 'normal'};">
            ${c.reason}
          </span>
        </div>
        <button class="btn btn-primary btn-sm" data-action="confirm-substitute" data-sub-id="${c.proctor.id}">
          ส่งเข้าแทนทันที
        </button>
      </div>
    `).join('');

    box.querySelectorAll('[data-action="confirm-substitute"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-sub-id');
        const reason = this.root.querySelector('#input-leave-reason')?.value;
        appState.handleSuddenLeave(pId, sId, subId, reason);
        this.activeModal = null;
        this.render();
      });
    });
  }

  // รัน Solver พร้อมฟีดแบ็กความคืบหน้า (รองรับ 1-Click Auto Solve ไม่ต้องพิมพ์เอง)
  runSolverWithFeedback() {
    const res = appState.runAutoSchedule();
    if (res.success) {
      const extraMsg = res.autoGeneratedNotice
        ? '\n\n💡 ระบบได้สุ่มสร้างรายชื่ออาจารย์และบุคลากรผู้คุมสอบ 80 ท่านให้เพียงพอกับ 10 ห้องสอบ CBT อัตโนมัติ คุณจึงไม่ต้องพิมพ์รายชื่อเองแม้แต่คนเดียว!'
        : '';
      alert(`🎉 จัดตารางอัตโนมัติสำเร็จสมบูรณ์ 100%!\n\nจัดได้ครบทั้งหมด ${res.assignments.length} ตำแหน่ง (ไม่มีตำแหน่งตกหล่น)\nเวลาที่ใช้: ${res.durationMs} มิลลิวินาที\nคะแนนคุณภาพ: ${res.qualityScore}/100\nส่วนเบี่ยงเบนมาตรฐาน (SD): ${res.standardDeviation.toFixed(2)}${extraMsg}`);
    } else {
      if (confirm(`⚠️ ยังขาดผู้คุมอีก ${res.missingSlots || 'บาง'} ตำแหน่ง\n\nต้องการให้ระบบ "สุ่มสร้างผู้คุมเพิ่มอัตโนมัติ 80 คน" ทันทีเพื่อจัดให้เสร็จสมบูรณ์เลยหรือไม่? (ไม่ต้องพิมพ์เอง)`)) {
        appState.autoGenerateSufficientProctors(80);
        const retry = appState.runAutoSchedule();
        if (retry.success) {
          alert(`🎉 สุ่มสร้างผู้คุมและจัดตารางอัตโนมัติสำเร็จ 100% ครบทุกห้องเรียบร้อยแล้ว!\n\nจัดได้ครบทั้งหมด ${retry.assignments.length} ตำแหน่ง`);
          return;
        }
      }
      alert(`⚠️ ไม่สามารถจัดตารางได้ครบทุกห้อง:\n\n${res.errorMessage}\n\nคำแนะนำ: ${res.diagnostic?.recommendation || 'กรุณาลองปรับเพิ่มผู้คุมหรือโควต้า'}`);
    }
  }

  // จัดการเหตุการณ์ในแถบมหาวิทยาลัยและหน้าระบบผู้เข้าชม (Visitor & Examinee Portal)
  attachUniversityAndVisitorEvents() {
    // 1. สลับเข้าระบบเจ้าหน้าที่จัดตาราง
    const enterStaffBtns = this.root.querySelectorAll('#btn-enter-staff-system, #btn-footer-staff-login, #link-staff-view');
    enterStaffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('dashboard');
      });
    });

    // 2. สลับกลับมาหน้าหลักผู้เข้าชม / นักศึกษา
    const backVisitorBtns = this.root.querySelectorAll('#btn-back-to-visitor, #btn-uni-home, #link-student-view');
    backVisitorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('visitor');
      });
    });

    // 3. คลิกเมนูนำทางมหาวิทยาลัยเพื่อเลื่อนไปยังหมวดหมู่
    this.root.querySelectorAll('.uni-nav-link[data-scroll]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-scroll');
        if (this.currentTab !== 'visitor') {
          this.setTab('visitor');
        }
        setTimeout(() => {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
      });
    });

    // 4. ปุ่มค้นหาด่วนในแถบด้านบน
    const searchTrigger = this.root.querySelector('#btn-uni-search-trigger');
    if (searchTrigger) {
      searchTrigger.addEventListener('click', () => {
        if (this.currentTab !== 'visitor') {
          this.setTab('visitor');
        }
        setTimeout(() => {
          const searchSection = document.getElementById('visitor-search');
          if (searchSection) {
            searchSection.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('input-examinee-search')?.focus();
          }
        }, 60);
      });
    }

    // 5. ระบบค้นหาที่นั่งสอบและห้องสอบรายบุคคล (Examinee Search)
    const searchInput = this.root.querySelector('#input-examinee-search');
    const searchBtn = this.root.querySelector('#btn-submit-examinee-search');
    const clearBtn = this.root.querySelector('#btn-clear-examinee-search');
    const resultArea = this.root.querySelector('#examinee-search-result-area');

    const performExamineeSearch = (query) => {
      const q = (query || '').trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      if (!resultArea) return;

      if (!q) {
        resultArea.innerHTML = renderExamineePassCard(SAMPLE_EXAMINEES[0], appState);
        this.attachVisitorCardEvents();
        return;
      }

      const match = SAMPLE_EXAMINEES.find(ex => 
        ex.id.includes(q) || 
        ex.firstName.toLowerCase().includes(q) || 
        ex.lastName.toLowerCase().includes(q) ||
        ex.roomCode.toLowerCase().includes(q) ||
        `${ex.firstName} ${ex.lastName}`.toLowerCase().includes(q)
      );

      resultArea.innerHTML = renderExamineePassCard(match || null, appState);
      this.attachVisitorCardEvents();
    };

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        performExamineeSearch(e.target.value);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performExamineeSearch(searchInput.value);
      });
    }

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        performExamineeSearch(searchInput.value);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        performExamineeSearch('');
        searchInput.focus();
      });
    }

    // 6. ชิปตัวอย่างคลิกเดียวค้นหา (Demo Chips)
    this.root.querySelectorAll('.demo-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const searchId = chip.getAttribute('data-search-id');
        if (searchInput) {
          searchInput.value = searchId;
          performExamineeSearch(searchId);
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    // 7. ปุ่มกรองชั้นในทำเนียบห้องสอบ (Floor Filter Pills)
    this.root.querySelectorAll('#visitor-floor-filters .floor-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const floor = pill.getAttribute('data-floor');
        this.root.querySelectorAll('#visitor-floor-filters .floor-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        this.root.querySelectorAll('.visitor-room-card').forEach(card => {
          const cardFloor = card.getAttribute('data-room-floor');
          if (floor === 'all' || cardFloor === floor) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // 8. คัดลอกลิงก์ประกาศศูนย์สอบ CBT
    const copyLinkBtn = this.root.querySelector('#btn-copy-portal-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href);
          alert('📋 คัดลอกลิงก์ประกาศศูนย์สอบ CBT อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์ เรียบร้อยแล้ว!');
        } else {
          alert('📋 ลิงก์ระบบ: ' + window.location.href);
        }
      });
    }

    // 9. ผูกเหตุการณ์ในการ์ดบัตรสอบ & รายการห้อง
    this.attachVisitorCardEvents();
  }

  // ผูกเหตุการณ์ภายในบัตรผู้เข้าสอบและห้องสอบ
  attachVisitorCardEvents() {
    // ดูผังห้องสอบและตำแหน่งเครื่องสอบ
    this.root.querySelectorAll('.btn-view-examinee-blueprint, .btn-view-room-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const roomCode = btn.getAttribute('data-room-code');
        const roomId = btn.getAttribute('data-room-id') || btn.getAttribute('data-id');
        const room = appState.rooms.find(r =>
          (roomId && (r.id === roomId || r.roomCode === roomId || r.code === roomId)) ||
          (roomCode && (r.roomCode === roomCode || r.code === roomCode || r.id === roomCode))
        );
        if (room) {
          this.activeModal = {
            type: 'modal-room-detail',
            room: room
          };
          this.render();
        }
      });
    });

    // พิมพ์บัตรประจำตัวผู้เข้าสอบ (Electronic Exam Pass)
    const printPassBtn = this.root.querySelector('#btn-print-exam-pass');
    if (printPassBtn) {
      printPassBtn.addEventListener('click', () => {
        const passCard = document.getElementById('printable-examinee-pass');
        if (!passCard) return;
        const printWindow = window.open('', '_blank', 'width=840,height=900');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="th">
          <head>
            <meta charset="UTF-8">
            <title>บัตรประจำตัวผู้เข้าสอบ CBT - มหาวิทยาลัยราชภัฏบุรีรัมย์</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Sarabun', sans-serif; padding: 24px; color: #1e293b; background: #fff; }
              .examinee-pass-card { border: 2px solid #334155; border-radius: 8px; overflow: hidden; max-width: 720px; margin: 0 auto; }
              .pass-header { background: #3B1F54; color: white; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
              .pass-tag { font-size: 11px; font-weight: 700; color: #FDE047; text-transform: uppercase; }
              .pass-university { font-size: 16px; font-weight: 700; margin: 4px 0; }
              .pass-subject { font-size: 13px; opacity: 0.9; }
              .pass-qr-stub { background: #fff; padding: 6px 10px; border-radius: 4px; text-align: center; color: #000; font-size: 9px; font-weight: 700; }
              .pass-body { padding: 20px 24px; display: grid; grid-template-columns: 1fr 260px; gap: 20px; }
              .info-row { display: flex; margin-bottom: 8px; font-size: 14px; }
              .info-row .lbl { width: 130px; color: #64748b; }
              .pass-seat-spotlight { border: 2px dashed #B45309; padding: 14px; text-align: center; background: #fffbeb; border-radius: 8px; }
              .spotlight-header { font-size: 12px; font-weight: 700; color: #B45309; margin-bottom: 6px; }
              .spotlight-room .room-big { font-size: 26px; font-weight: 800; color: #3B1F54; }
              .spotlight-terminal .seat-big { font-size: 28px; font-weight: 800; color: #B45309; }
              .spotlight-floor { margin-top: 8px; padding-top: 6px; border-top: 1px solid #fde68a; font-size: 12px; color: #64748b; }
              .pass-actions { display: none !important; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            ${passCard.outerHTML}
            <script>window.onload = function() { window.print(); }<\/script>
          </body>
          </html>
        `);
        printWindow.document.close();
      });
    }
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : (type === 'warning' ? '🔔' : 'ℹ️'));
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${icon}</span>
        <span>${message}</span>
      </div>
      <button style="background:none; border:none; color:inherit; font-size:16px; cursor:pointer; opacity:0.8; margin-left: 8px;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}

