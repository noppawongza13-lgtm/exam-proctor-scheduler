/**
 * โมดูลหน้าต่างป๊อปอัปแสดงรายละเอียดสำหรับ 4 การ์ดสถิติหลัก (Dashboard KPI Modals)
 * 1. ห้องปฏิบัติการคอมพิวเตอร์ (CBT)
 * 2. ผู้คุมสอบในระบบ
 * 3. สถานะการจัดตาราง
 * 4. การตรวจสอบกฎ (Rules)
 */

import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';

/**
 * 1. Modal: สรุปห้องปฏิบัติการคอมพิวเตอร์ CBT อาคาร 17
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderKpiRoomsModal(appState) {
  const rooms = appState.rooms || [];
  const floor1Rooms = rooms.filter(r => r.floor === 1);
  const floor2Rooms = rooms.filter(r => r.floor === 2);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);

  return `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 860px;">
        <div class="modal-header">
          <div>
            <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <span>💻 ห้องปฏิบัติการคอมพิวเตอร์ (CBT) อาคาร 17</span>
              <span class="badge badge-primary">${rooms.length} ห้อง</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              รองรับผู้เข้าสอบพร้อมกันรวม ${totalCapacity} เครื่องคอมพิวเตอร์ • ครบครันด้วยระบบสำรองไฟ กล้อง CCTV และระบบปรับอากาศ
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body" style="padding: 16px; max-height: 65vh; overflow-y: auto;">
          <!-- 4 Stats Cards in Modal -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">🏢 ชั้น 1 (4 ห้องสอบ)</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--primary-600);">${floor1Rooms.reduce((s, r) => s + r.capacity, 0)} ที่นั่ง</div>
              <div style="font-size: 11px; color: var(--text-muted);">ห้อง 17108, 17109, 17110, 17111</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">🏢 ชั้น 2 (6 ห้องสอบ)</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--primary-600);">${floor2Rooms.reduce((s, r) => s + r.capacity, 0)} ที่นั่ง</div>
              <div style="font-size: 11px; color: var(--text-muted);">ห้อง 17201, 17205, 17206, 17211, 17212, 17213</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">👥 เกณฑ์ผู้คุมสอบ (ELMS H5)</div>
              <div style="font-size: 20px; font-weight: 700; color: #16a34a;">21 คน / รอบ</div>
              <div style="font-size: 11px; color: var(--text-muted);">ห้อง 17201 (80 ที่นั่ง) 3 คน, อีก 9 ห้อง 2 คน</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">♿ สิ่งอำนวยความสะดวก</div>
              <div style="font-size: 20px; font-weight: 700; color: #0284c7;">100% ครบ</div>
              <div style="font-size: 11px; color: var(--text-muted);">มีลิฟต์ ทางลาด และห้องน้ำคนพิการ</div>
            </div>
          </div>

          <!-- Room List Cards Grid -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${rooms.map(r => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-surface); transition: all 0.2s; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(124, 58, 237, 0.08); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    💻
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong style="font-size: 15px; color: var(--primary-700);">${r.roomCode || r.id}</strong>
                      <span style="font-size: 14px; font-weight: 600;">${r.officialName || r.name}</span>
                      <span class="badge badge-primary" style="font-size: 10px;">ห้องสอบที่ ${r.roomNumber || r.id.replace('R','')}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                      📍 ชั้น ${r.floor} (${r.wing || 'อาคาร 17'}) • ความจุ ${r.capacity} เครื่อง • ${r.seatStart && r.seatEnd ? `เลขที่นั่งสอบ [${r.seatStart} - ${r.seatEnd}]` : ''}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="btn btn-accent btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 5px 12px; font-size: 12px; font-weight: 700;">
                    🏢 ดูผัง & ข้อมูลห้อง
                  </button>
                  <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 5px 10px; font-size: 12px;">
                    🪧 ป้ายห้อง
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button class="btn btn-primary btn-sm" data-action="nav-master-rooms" style="font-weight: 600;">
            🗂️ ไปยังหน้าจัดการห้องสอบ & ผังอาคาร 17
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 2. Modal: รายชื่อและสถานะผู้คุมสอบในระบบ
 * @param {import('../store/state.js').AppState} appState 
 * @returns {string}
 */
export function renderKpiProctorsModal(appState) {
  const proctors = appState.proctors || [];
  const facultyCount = proctors.filter(p => p.proctorType === 'faculty').length;
  const staffCount = proctors.filter(p => p.proctorType === 'staff').length;
  const chiefCount = proctors.filter(p => p.level === 'chief').length;
  const assistantCount = proctors.filter(p => p.level === 'assistant').length;

  return `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 900px;">
        <div class="modal-header">
          <div>
            <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <span>👥 ผู้คุมสอบในระบบ (Proctor Roster)</span>
              <span class="badge badge-primary">${proctors.length} คน</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              อาจารย์ ${facultyCount} คน • เจ้าหน้าที่ ${staffCount} คน • สิทธิ์หัวหน้าห้อง ${chiefCount} คน • ผู้ช่วย ${assistantCount} คน
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body" style="padding: 16px; max-height: 65vh; overflow-y: auto;">
          <!-- 4 Stats Cards in Modal -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">👨‍🏫 ฝ่ายอาจารย์ (Faculty)</div>
              <div style="font-size: 20px; font-weight: 700; color: #7c3aed;">${facultyCount} คน</div>
              <div style="font-size: 11px; color: var(--text-muted);">อาจารย์ผู้ทรงคุณวุฒิ</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">👤 ฝ่ายเจ้าหน้าที่ (Staff)</div>
              <div style="font-size: 20px; font-weight: 700; color: #2563eb;">${staffCount} คน</div>
              <div style="font-size: 11px; color: var(--text-muted);">เจ้าหน้าที่สนับสนุนวิชาการ</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">⭐ หัวหน้าห้อง (Chief)</div>
              <div style="font-size: 20px; font-weight: 700; color: #d97706;">${chiefCount} คน</div>
              <div style="font-size: 11px; color: var(--text-muted);">รับผิดชอบคุมภาพรวมห้อง</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted);">🛡️ ผู้ช่วย (Assistant)</div>
              <div style="font-size: 20px; font-weight: 700; color: #16a34a;">${assistantCount} คน</div>
              <div style="font-size: 11px; color: var(--text-muted);">ผู้ช่วยตรวจเอกสารและดูแล</div>
            </div>
          </div>

          <!-- Table of proctors -->
          <div class="table-wrapper">
          <!-- Table of proctors -->
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ - นามสกุล (ตำแหน่งทางวิชาการ)</th>
                  <th>ประเภท</th>
                  <th>ความอาวุโส (Rank)</th>
                  <th>กลุ่มบุคลากร</th>
                  <th>สิทธิ์บทบาท</th>
                  <th style="text-align: center;">ภาระงาน</th>
                  <th>รูปแบบกะ</th>
                </tr>
              </thead>
              <tbody>
                ${proctors.map(p => {
                  const assignedCount = appState.assignments.filter(a => a.proctorId === p.id).length;
                  const rankBadgeColor = p.seniorityRank >= 8 ? '#7c3aed' : (p.seniorityRank >= 7 ? '#2563eb' : '#059669');
                  return `
                    <tr>
                      <td><span style="font-family: monospace; font-weight: 700;">${p.id}</span></td>
                      <td>
                        <strong>${p.academicTitle ? `<span style="color: var(--primary-700); font-weight: 700;">${p.academicTitle}</span> ` : ''}${p.firstName} ${p.lastName}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${p.department || '-'}</div>
                      </td>
                      <td>
                        <span class="role-tag ${p.proctorType === 'faculty' ? 'teacher' : 'proctor'}">
                          ${p.proctorType === 'faculty' ? '👨‍🏫 สายวิชาการ' : '👤 สายสนับสนุน'}
                        </span>
                      </td>
                      <td>
                        <span class="badge" style="background: rgba(124,58,237,0.1); color: ${rankBadgeColor}; font-weight: 700; font-size: 11px;">
                          ⭐ Rank ${p.seniorityRank || 3}
                        </span>
                      </td>
                      <td>
                        <span class="badge" style="font-size: 10px; ${p.pool === 'core' ? 'background: rgba(22,163,74,0.1); color: #16a34a;' : 'background: rgba(217,119,6,0.1); color: #d97706;'}">
                          ${p.pool === 'core' ? '🟢 กลุ่มหลัก (Core)' : '🟡 สำรอง (Reserve)'}
                        </span>
                      </td>
                      <td>
                        <span class="badge ${p.level === 'chief' ? 'badge-warning' : 'badge-normal'}">
                          ${p.level === 'chief' ? '⭐ หัวหน้าห้อง' : 'ผู้ช่วย'}
                        </span>
                      </td>
                      <td style="text-align: center;">
                        <span class="badge ${assignedCount > 0 ? 'badge-primary' : 'badge-normal'}" style="font-weight: 700;">
                          ${assignedCount} / ${p.projectQuota || 6} รอบ
                        </span>
                      </td>
                      <td>
                        <span style="font-size: 11px; color: var(--text-muted);">
                          ${p.sessionPattern === 'FULL_DAY_PAIRED' ? '☀️ เช้า+บ่าย (ห้องเดิม)' : (p.sessionPattern === 'SINGLE_PER_DAY' ? '1️⃣ วันละ 1 รอบ' : '🔄 ยืดหยุ่น')}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button class="btn btn-primary btn-sm" data-action="nav-master-proctors" style="font-weight: 600;">
            🗂️ ไปยังหน้าจัดการข้อมูลผู้คุมสอบ (Master Data)
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 3. Modal: สถานะความคืบหน้าการจัดตาราง
 * @param {import('../store/state.js').AppState} appState 
 * @param {{ valResult: any, totalSlots: number, assignedSlots: number, isComplete: boolean }} params 
 * @returns {string}
 */
export function renderKpiScheduleStatusModal(appState, { totalSlots, assignedSlots, isComplete }) {
  const percentAssigned = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;
  const sessions = appState.sessions || [];

  // Count by role according to ELMS specification
  const threshold3 = appState.settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;

  const chiefSlots = appState.allocations.length;
  const chiefAssigned = appState.assignments.filter(a => a.role === 'chief').length;

  const assistantSlots = appState.allocations.reduce((sum, al) => {
    const ex = al.examineesInRoom || 0;
    const need = ex >= threshold3 ? 2 : (ex > threshold2 ? 1 : 0);
    return sum + need;
  }, 0);
  const assistantAssigned = appState.assignments.filter(a => a.role === 'proctor' || a.role === 'assistant').length;

  const reserveSlots = sessions.length * appState.settings.hardConstraints.h8_reserve_proctors_per_session;
  const reserveAssigned = appState.assignments.filter(a => a.role === 'reserve').length;

  // คำนวณ Jain's Fairness Index (J) และสัดส่วนอาจารย์คุมหลัก (Faculty Lead Ratio)
  const countsMap = new Map();
  for (const a of appState.assignments) {
    countsMap.set(a.proctorId, (countsMap.get(a.proctorId) || 0) + 1);
  }
  const countsList = (appState.proctors || []).map(p => countsMap.get(p.id) || 0);
  const sumWorkload = countsList.reduce((a, b) => a + b, 0);
  const sumSqWorkload = countsList.reduce((a, b) => a + b * b, 0);
  const jIndex = (countsList.length > 0 && sumSqWorkload > 0) ? ((sumWorkload * sumWorkload) / (countsList.length * sumSqWorkload)).toFixed(2) : '1.00';

  const facultyChiefs = appState.assignments.filter(a => a.role === 'chief' && appState.proctors.find(p => p.id === a.proctorId)?.proctorType === 'faculty').length;
  const facultyChiefPct = chiefAssigned > 0 ? Math.round((facultyChiefs / chiefAssigned) * 100) : 100;

  return `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 860px;">
        <div class="modal-header">
          <div>
            <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <span>🎯 สถานะความคืบหน้าการจัดตาราง (Schedule Progress)</span>
              <span class="badge ${isComplete ? 'badge-normal' : 'badge-warning'}" style="${isComplete ? 'background: #dcfce7; color: #15803d;' : ''}">
                ${isComplete ? '✅ จัดครบ 100%' : '⏳ ยังจัดไม่ครบ'}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              จัดแล้ว ${assignedSlots} จากทั้งหมด ${totalSlots} ตำแหน่ง (${percentAssigned}%) • Jain's Index: <strong>${jIndex}</strong> (เกณฑ์ ≥ 0.85) • อาจารย์คุมหลัก: <strong>${facultyChiefPct}%</strong>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body" style="padding: 16px; max-height: 65vh; overflow-y: auto;">
          <!-- Big Progress Bar -->
          <div style="background: var(--bg-surface-elevated); padding: 18px; border-radius: 10px; border: 1px solid var(--border-subtle); margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 700;">ความคืบหน้ารวม</span>
              <span style="font-size: 20px; font-weight: 800; color: ${isComplete ? '#16a34a' : 'var(--primary-600)'};">${percentAssigned}%</span>
            </div>
            <div style="width: 100%; height: 14px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; position: relative;">
              <div style="width: ${percentAssigned}%; height: 100%; background: linear-gradient(90deg, var(--primary-500), var(--accent-500)); border-radius: 9999px; transition: width 0.3s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 8px;">
              <span>จัดสำเร็จแล้ว ${assignedSlots} ตำแหน่ง</span>
              <span>ยังขาดอีก ${Math.max(0, totalSlots - assignedSlots)} ตำแหน่ง</span>
            </div>
          </div>

          <!-- 4 Role & Quality Metric Boxes -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px;">
            <div style="border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; background: var(--bg-surface);">
              <div style="font-size: 12px; color: var(--text-muted);">⭐ หัวหน้าห้องสอบ (Chief)</div>
              <div style="font-size: 22px; font-weight: 700; color: #d97706; margin-top: 4px;">
                ${chiefAssigned} / ${chiefSlots}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                อาจารย์ ${facultyChiefs} คน (${facultyChiefPct}%)
              </div>
            </div>

            <div style="border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; background: var(--bg-surface);">
              <div style="font-size: 12px; color: var(--text-muted);">👤 กรรมการร่วมคุมสอบ (Co-Proctors)</div>
              <div style="font-size: 22px; font-weight: 700; color: #2563eb; margin-top: 4px;">
                ${assistantAssigned} / ${assistantSlots}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${assistantAssigned >= assistantSlots ? '✅ ครบทุกห้อง' : `⚠️ ขาดอีก ${assistantSlots - assistantAssigned} คน`}
              </div>
            </div>

            <div style="border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; background: var(--bg-surface);">
              <div style="font-size: 12px; color: var(--text-muted);">🛡️ ผู้คุมสำรองประจำรอบ (Reserve)</div>
              <div style="font-size: 22px; font-weight: 700; color: #16a34a; margin-top: 4px;">
                ${reserveAssigned} / ${reserveSlots}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${reserveAssigned >= reserveSlots ? '✅ ครบทุกรอบ' : `⚠️ ขาดอีก ${reserveSlots - reserveAssigned} คน`}
              </div>
            </div>

            <div style="border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; background: var(--bg-surface);">
              <div style="font-size: 12px; color: var(--text-muted);">⚖️ ความเป็นธรรม (Jain's Index)</div>
              <div style="font-size: 22px; font-weight: 700; color: ${Number(jIndex) >= 0.85 ? '#16a34a' : '#d97706'}; margin-top: 4px;">
                ${jIndex}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${Number(jIndex) >= 0.85 ? '✅ ผ่านเกณฑ์มาตรฐาน (≥ 0.85)' : '⚠️ ควรเกลี่ยภาระงานเพิ่ม'}
              </div>
            </div>
          </div>

          <!-- Per-Session Breakdown Table -->
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">📅 ความคืบหน้าแยกตามรอบสอบ (${sessions.length} รอบ)</div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รอบการสอบ</th>
                  <th>วันที่ & เวลา</th>
                  <th>จำนวนห้องสอบ</th>
                  <th>ความต้องการผู้คุม</th>
                  <th>จัดแล้ว</th>
                  <th>สถานะรอบ</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map(s => {
                  const sAllocs = appState.allocations.filter(a => a.sessionId === s.id);
                  const sAssigns = appState.assignments.filter(a => a.sessionId === s.id);
                  const sNeeded = sAllocs.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
                    + appState.settings.hardConstraints.h8_reserve_proctors_per_session;
                  const sDone = sAssigns.length >= sNeeded;

                  return `
                    <tr>
                      <td><strong>${s.name}</strong> (${s.id})</td>
                      <td>${formatThaiDate(s.date)} <span style="color: var(--text-muted); font-size: 11px;">(${formatThaiTimeRange(s.startTime, s.endTime)})</span></td>
                      <td>${sAllocs.length} ห้อง</td>
                      <td>${sNeeded} ตำแหน่ง</td>
                      <td>
                        <strong style="color: ${sDone ? '#16a34a' : '#d97706'};">${sAssigns.length} / ${sNeeded}</strong>
                      </td>
                      <td>
                        <span class="badge ${sDone ? 'badge-normal' : 'badge-warning'}" style="${sDone ? 'background: #dcfce7; color: #15803d;' : ''}">
                          ${sDone ? '✅ ครบแล้ว' : `ขาด ${sNeeded - sAssigns.length} คน`}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-run-solver-from-modal" style="font-weight: 700;">
              🚀 เริ่มจัดตารางอัตโนมัติทันที
            </button>
            <button class="btn btn-secondary btn-sm" data-action="nav-scheduler">
              📅 ไปที่หน้าตารางผู้คุมสอบ
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 4. Modal: รายงานการตรวจสอบกฎ (Rules Validation Audit)
 * @param {import('../store/state.js').AppState} appState 
 * @param {any} valResult 
 * @returns {string}
 */
export function renderKpiRulesAuditModal(appState, valResult) {
  const violations = (valResult && valResult.violations) || [];
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  return `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 860px;">
        <div class="modal-header">
          <div>
            <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <span>⚠️ การตรวจสอบกฎเกณฑ์ (Rules Validation Audit)</span>
              <span class="badge ${errors.length > 0 ? 'badge-danger' : 'badge-normal'}" style="${errors.length === 0 ? 'background: #dcfce7; color: #15803d;' : ''}">
                ${errors.length > 0 ? `${errors.length} ข้อผิดพลาด` : '✅ ผ่านเกณฑ์สมบูรณ์'}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              ตรวจสอบกฎบังคับ H1-H8 (Hard Constraints) และเกณฑ์ความพึงพอใจ S1-S7 (Soft Constraints)
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body" style="padding: 16px; max-height: 65vh; overflow-y: auto;">
          <!-- 3 Status summary cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="background: ${errors.length > 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${errors.length > 0 ? '#fca5a5' : '#86efac'}; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">🚨 กฎบังคับ (Hard H1-H8)</div>
              <div style="font-size: 22px; font-weight: 800; color: ${errors.length > 0 ? 'var(--danger-500)' : '#16a34a'};">${errors.length} ข้อผิดพลาด</div>
              <div style="font-size: 11px; color: var(--text-muted);">${errors.length === 0 ? 'ไม่มีการละเมิดกฎบังคับ' : 'ต้องแก้ไขให้เป็น 0 จึงจะเผยแพร่ได้'}</div>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">⚠️ คำเตือน (Soft S1-S7)</div>
              <div style="font-size: 22px; font-weight: 800; color: #d97706;">${warnings.length} รายการ</div>
              <div style="font-size: 11px; color: var(--text-muted);">แนะนำปรับเพื่อความพึงพอใจสูงสุด</div>
            </div>

            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">📋 สถานะความพร้อมเผยแพร่</div>
              <div style="font-size: 20px; font-weight: 700; color: ${valResult.isValid ? '#16a34a' : '#dc2626'};">
                ${valResult.isValid ? 'พร้อมเผยแพร่' : 'ยังไม่พร้อม'}
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">${valResult.isValid ? 'ผ่านเกณฑ์ Hard Constraints ทั้งหมด' : 'กรุณากดจัดตารางอัตโนมัติ'}</div>
            </div>
          </div>

          <!-- Violation list -->
          ${violations.length === 0 ? `
            <div style="padding: 32px; text-align: center; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
              <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
              <h3 style="color: #166534; font-size: 16px; margin-bottom: 4px;">ยอดเยี่ยม! ตารางสอบผ่านเกณฑ์สมบูรณ์ 100%</h3>
              <p style="color: #15803d; font-size: 13px; margin: 0;">
                ไม่พบข้อผิดพลาดตามกฎเกณฑ์ H1-H8 สามารถพิมพ์เอกสารหรือเผยแพร่ตารางได้ทันที
              </p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${violations.map(v => `
                <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid ${v.severity === 'error' ? 'var(--danger-200)' : 'var(--warning-200)'}; background: ${v.severity === 'error' ? 'var(--danger-50)' : 'var(--warning-50)'};">
                  <span style="font-size: 18px; margin-top: -2px;">${v.severity === 'error' ? '🚨' : '⚠️'}</span>
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="badge ${v.severity === 'error' ? 'badge-danger' : 'badge-warning'}" style="font-size: 10px; font-weight: 700;">
                        ${v.ruleId || 'RULE'}
                      </span>
                      <strong style="font-size: 13px; color: var(--text-main);">${v.message}</strong>
                    </div>
                    ${v.details ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${v.details}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-run-solver-from-modal" style="font-weight: 700;">
              🚀 แก้ไขอัตโนมัติด้วยคลิกเดียว (Auto-Solve)
            </button>
            <button class="btn btn-secondary btn-sm" data-action="nav-settings">
              ⚙️ ตั้งค่ากฎ & โควต้า
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
}
