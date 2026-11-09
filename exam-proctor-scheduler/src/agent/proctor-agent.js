/**
 * โมดูล AI Agent ผู้ช่วยจัดตารางคุมสอบอัจฉริยะ (ProctorAI Scheduling Agent)
 * ระบบ AI อัจฉริยะระดับ Open Source ที่ทำงานแบบ Local ในเบราว์เซอร์ 100% (Offline & Privacy-Preserving)
 * สามารถวิเคราะห์สุขภาพตาราง, ตรวจสอบกฎ H1-H8, ค้นหาคอขวด, แนะนำตัวแทน และสั่งจัดตารางอัตโนมัติ
 */

import { validateSchedule } from '../rules/validator.js';
import { calculateMinimumProctors } from '../solver/min-proctor-calc.js';
import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';

export class ProctorAIAgent {
  constructor(appState) {
    this.appState = appState;
    this.chatHistory = [
      {
        sender: 'agent',
        timestamp: new Date().toISOString(),
        message: 'สวัสดีครับ! ผมคือ **ProctorAI Agent** ผู้ช่วยอัจฉริยะสำหรับระบบจัดตารางคุมสอบ 🤖✨\n\nผมสามารถช่วยคุณวิเคราะห์สุขภาพตาราง, ตรวจสอบข้อผิดพลาดตามกฎ H1-H8, แนะนำตัวแทนเมื่อมีคนลา, คำนวณผู้คุมขั้นต่ำ หรือสั่งจัดตารางอัตโนมัติให้ได้ทันทีครับ! ลองเลือกคำสั่งด่วนด้านล่างหรือพิมพ์คำถามได้เลยครับ',
        actions: [
          { label: '🩺 ตรวจสุขภาพตารางตอนนี้', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' },
          { label: '⚡ สั่งจัดตารางอัตโนมัติ', prompt: 'ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย' },
          { label: '👥 คำนวณผู้คุมขั้นต่ำ', prompt: 'โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?' },
          { label: '📜 สิทธิ์ Open Source', prompt: 'ระบบนี้เป็น Open Source อย่างไร และมีสิทธิ์การใช้งานแบบไหน?' }
        ]
      }
    ];
  }

  /**
   * ประมวลผลข้อความจากผู้ใช้และสร้างคำตอบจาก AI Agent
   * @param {string} userMessage
   * @returns {Promise<Object>}
   */
  async processMessage(userMessage) {
    const text = (userMessage || '').trim();
    if (!text) return null;

    // บันทึกข้อความผู้ใช้
    this.chatHistory.push({
      sender: 'user',
      timestamp: new Date().toISOString(),
      message: text
    });

    const lower = text.toLowerCase();
    let response = null;

    // 1. ตรวจสุขภาพตาราง / วินิจฉัยข้อผิดพลาด (Diagnose / Health Check)
    if (lower.includes('สุขภาพ') || lower.includes('วิเคราะห์') || lower.includes('ตรวจสอบ') || lower.includes('ข้อผิดพลาด') || lower.includes('ตรวจ') || lower.includes('ผิด')) {
      response = this.diagnoseSchedule();
    }
    // 2. จัดตารางอัตโนมัติ / สุ่มตาราง (Auto Schedule / Solve)
    else if (lower.includes('จัดตาราง') || lower.includes('สุ่ม') || lower.includes('รัน') || lower.includes('แก้ตาราง') || lower.includes('จัดใหม่')) {
      response = this.handleAutoSchedule();
    }
    // 3. คำนวณจำนวนผู้คุมขั้นต่ำ (Minimum Proctors)
    else if (lower.includes('ขั้นต่ำ') || lower.includes('กี่คน') || lower.includes('พอไหม') || lower.includes('ขาด') || lower.includes('จำนวนผู้คุม')) {
      response = this.handleMinProctors();
    }
    // 4. ลากะทันหัน / หาคนแทน (Sudden Leave / Substitution)
    else if (lower.includes('ลา') || lower.includes('แทน') || lower.includes('ป่วย') || lower.includes('ไม่ว่าง') || lower.includes('สลับ')) {
      response = this.handleSubstitutionAdvice();
    }
    // 5. สอบถามเรื่อง Open Source และความปลอดภัย (Open Source / Security / Privacy)
    else if (lower.includes('open source') || lower.includes('โอเพ่นซอร์ส') || lower.includes('ลิขสิทธิ์') || lower.includes('license') || lower.includes('mit') || lower.includes('ฟรี')) {
      response = this.handleOpenSourceInfo();
    }
    // 6. กฎข้อบังคับ H1-H8 (Rules explanation)
    else if (lower.includes('กฎ') || lower.includes('h1') || lower.includes('h2') || lower.includes('h3') || lower.includes('h4') || lower.includes('h5') || lower.includes('h6') || lower.includes('h7') || lower.includes('h8') || lower.includes('ข้อบังคับ')) {
      response = this.handleRulesExplanation();
    }
    // 7. เกลี่ยงาน / โควต้า / ความเป็นธรรม (Workload & Fairness)
    else if (lower.includes('เกลี่ย') || lower.includes('โควต้า') || lower.includes('ภาระงาน') || lower.includes('เท่ากัน') || lower.includes('ยุติธรรม')) {
      response = this.handleWorkloadAnalysis();
    }
    // 8. ค่าเริ่มต้นทั่วไป (General Domain Intelligence)
    else {
      response = this.handleGeneralConversation(text);
    }

    const agentMessage = {
      sender: 'agent',
      timestamp: new Date().toISOString(),
      ...response
    };

    this.chatHistory.push(agentMessage);
    return agentMessage;
  }

  /**
   * 1. ตรวจสุขภาพตารางและข้อผิดพลาด
   */
  diagnoseSchedule() {
    const val = validateSchedule({
      assignments: this.appState.assignments,
      allocations: this.appState.allocations,
      sessions: this.appState.sessions,
      proctors: this.appState.proctors,
      rooms: this.appState.rooms,
      unavailabilities: this.appState.unavailabilities,
      settings: this.appState.settings
    });

    const totalAllocations = this.appState.allocations.length;
    const totalRequiredSlots = this.appState.allocations.reduce((acc, al) => {
      return acc + (al.examineesInRoom > (this.appState.settings.hardConstraints.h5_examinees_per_assistant || 30) ? 2 : 1);
    }, 0);
    const assignedSlots = this.appState.assignments.filter(a => a.role !== 'reserve').length;
    const completeness = totalRequiredSlots > 0 ? Math.round((assignedSlots / totalRequiredSlots) * 100) : 0;

    let statusEmoji = val.isValid && completeness === 100 ? '✅ สมบูรณ์แบบ' : (completeness > 50 ? '⚠️ มีข้อต้องปรับปรุง' : '❌ ตารางยังไม่สมบูรณ์');

    let reply = `### 🩺 รายงานผลการตรวจสุขภาพตาราง (Schedule Diagnosis)\n\n`;
    reply += `• **สถานะรวม:** ${statusEmoji}\n`;
    reply += `• **ความคืบหน้าการจัดตำแหน่ง:** ${assignedSlots} / ${totalRequiredSlots} ตำแหน่ง (${completeness}%)\n`;
    reply += `• **ข้อผิดพลาดตามกฎบังคับ (Hard Constraints):** ${val.errorCount} ข้อ\n`;
    reply += `• **ข้อควรระวัง (Soft Warnings):** ${val.warningCount} ข้อ\n\n`;

    if (val.errorCount === 0 && completeness === 100) {
      reply += `🎉 **ยอดเยี่ยมมากครับ!** ตารางคุมสอบปัจจุบันผ่านกฎบังคับ H1-H8 ครบถ้วน 100% ไม่มีเวลาชนกัน ไม่เกินโควต้า และจัดห้องสอบ CBT ได้ถูกต้องทั้งหมดครับ`;
      return {
        message: reply,
        actions: [
          { label: '📊 วิเคราะห์การเกลี่ยภาระงาน', prompt: 'การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?' },
          { label: '📑 พิมพ์ใบลงนาม PDF', actionId: 'export-pdf' }
        ]
      };
    } else {
      reply += `**จุดที่ต้องดำเนินการแก้ไข:**\n`;
      if (val.violations && val.violations.length > 0) {
        val.violations.slice(0, 4).forEach((v, idx) => {
          reply += `${idx + 1}. [${v.rule}] ${v.message}\n`;
        });
        if (val.violations.length > 4) {
          reply += `*(และมีอีก ${val.violations.length - 4} รายการ)*\n`;
        }
      } else if (completeness < 100) {
        reply += `- ยังมีห้องสอบที่ยังไม่ได้จัดผู้คุมอีก ${totalRequiredSlots - assignedSlots} ตำแหน่ง\n`;
      }

      reply += `\n💡 **คำแนะนำจาก AI Agent:** คุณสามารถกดปุ่มสั่งให้ผมจัดตารางอัตโนมัติ เพื่อแก้ไขข้อผิดพลาดและเติมผู้คุมให้เต็มทุกห้องได้ทันทีครับ`;

      return {
        message: reply,
        actions: [
          { label: '⚡ จัดตารางอัตโนมัติทันที', actionId: 'run-auto-schedule' },
          { label: '👥 ตรวจดูว่าผู้คุมพอหรือไม่', prompt: 'โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?' }
        ]
      };
    }
  }

  /**
   * 2. สั่งรัน Solver จัดตาราง
   */
  handleAutoSchedule() {
    const result = this.appState.runAutoSchedule();
    if (result.success) {
      return {
        message: `🎉 **จัดตารางอัตโนมัติสำเร็จเรียบร้อยครับ!**\n\n` +
          `• จัดผู้คุมได้ครบทั้งหมด: **${result.assignments.length} ตำแหน่ง**\n` +
          `• คะแนนคุณภาพตาราง (Quality Score): **${result.qualityScore} / 100**\n` +
          `• ค่าความเบี่ยงเบนภาระงาน (SD): **${result.standardDeviation.toFixed(2)}** (ยิ่งน้อยยิ่งเกลี่ยเท่ากัน)\n` +
          `• เวลาที่ใช้ประมวลผล: **${result.durationMs} ms**\n\n` +
          `ตารางในหน้าเว็บได้รับการอัปเดตเรียบร้อยแล้วครับ คุณสามารถตรวจดูตารางรายวัน หรือส่งออกเอกสารได้เลยครับ`,
        actions: [
          { label: '🩺 ตรวจสุขภาพตารางอีกครั้ง', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' },
          { label: '📊 ดูการเกลี่ยภาระงาน', prompt: 'การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?' }
        ]
      };
    } else {
      return {
        message: `⚠️ **ไม่สามารถจัดตารางให้ครบทุกตำแหน่งได้:**\n\n` +
          `• **สาเหตุ:** ${result.errorMessage}\n` +
          `• **ข้อเสนอแนะจาก AI:** ${result.diagnostic?.recommendation || 'ผู้คุมอาจติดช่วงเวลาไม่ว่าง หรือมีหัวหน้าห้อง (Chief) ไม่เพียงพอกับจำนวนห้องสอบ'}\n\n` +
          `ท่านต้องการให้ผมช่วยคำนวณผู้คุมขั้นต่ำที่จำเป็นต้องมีไหมครับ?`,
        actions: [
          { label: '👥 คำนวณผู้คุมขั้นต่ำที่ต้องใช้', prompt: 'โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?' }
        ]
      };
    }
  }

  /**
   * 3. คำนวณผู้คุมขั้นต่ำ
   */
  handleMinProctors() {
    const minCalc = this.appState.calculateMinProctors();
    const totalProctors = this.appState.proctors.filter(p => p.isActive).length;
    const chiefs = this.appState.proctors.filter(p => p.isActive && p.level === 'chief').length;

    let reply = `### 👥 รายงานการวิเคราะห์จำนวนผู้คุมสอบขั้นต่ำ (Capacity Analysis)\n\n`;
    reply += `• จำนวนผู้คุมสอบทั้งหมดในระบบ: **${totalProctors} คน** (เป็นหัวหน้าห้องได้ ${chiefs} คน)\n`;
    reply += `• จำนวนผู้คุมสอบ **ขั้นต่ำที่จำเป็นต้องมี**: **${minCalc.minProctorsNeeded} คน**\n`;
    reply += `• จำนวนตำแหน่งคุมสอบที่ต้องการพร้อมกันสูงสุดในหนึ่งรอบ: **${minCalc.maxConcurrentRequired} คน** (หัวหน้าห้อง ${minCalc.maxConcurrentChiefs} คน, ผู้ช่วย ${minCalc.maxConcurrentAssistants} คน)\n`;
    reply += `• ผู้คุมสำรองประจำรอบ: **${minCalc.reservePerSession} คน/รอบ**\n\n`;

    if (totalProctors >= minCalc.minProctorsNeeded && chiefs >= minCalc.maxConcurrentChiefs) {
      reply += `✅ **ผลสรุป:** จำนวนบุคลากรปัจจุบัน **เพียงพอต่อการจัดสอบ** และสามารถหมุนเวียนคุมสอบได้ตามโควต้าโดยไม่เกินเพดานภาระงานครับ`;
    } else {
      reply += `⚠️ **แจ้งเตือน:** จำนวนบุคลากรอาจ **ไม่เพียงพอ** หรือมีคอขวดในรอบที่มีห้องสอบจำนวนมาก แนะนำให้เพิ่มผู้คุมสอบ หรือปรับลดจำนวนห้องสอบต่อรอบครับ`;
    }

    return {
      message: reply,
      actions: [
        { label: '⚡ สั่งจัดตารางอัตโนมัติ', actionId: 'run-auto-schedule' },
        { label: '🩺 ตรวจสุขภาพตาราง', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' }
      ]
    };
  }

  /**
   * 4. แนะนำการหาผู้คุมแทน / ลากะทันหัน
   */
  handleSubstitutionAdvice() {
    return {
      message: `### 🚨 ระบบรับมือเหตุการณ์ลากะทันหัน (Sudden Leave Protocol)\n\n` +
        `เมื่อมีอาจารย์หรือผู้คุมสอบแจ้งลาป่วย/ติดภารกิจกะทันหัน AI Agent มีขั้นตอนแนะนำดังนี้ครับ:\n\n` +
        `1. **ใช้ผู้คุมสำรองประจำรอบ (Reserve Proctor):** ระบบได้จัดผู้คุมสำรองไว้ที่ห้องกองกลางรอบละ 1-2 คนอยู่แล้ว สามารถเรียกเข้าปฏิบัติหน้าที่แทนได้ทันทีโดยไม่มีผลกระทบต่อตารางรอบอื่น\n` +
        `2. **ระบบจับคู่ตัวแทนอัตโนมัติ (Intelligent Matching):** ในหน้า **"สถานการณ์จำลอง (What-If)"** หรือการกดที่ช่องผู้คุมสอบในตารางกริช จะมีปุ่มแนะนำรายชื่อผู้คุมที่ว่างในรอบนั้น โดยเรียงลำดับจาก:\n` +
        `   • สังกัดเดียวกันหรือใกล้เคียงกัน\n` +
        `   • มีทักษะห้องคอมพิวเตอร์ (CBT Certified)\n` +
        `   • ภาระงานสะสมยังน้อย เพื่อความเป็นธรรม\n\n` +
        `คุณต้องการไปที่หน้าสถานการณ์จำลองเพื่อทดสอบการลาตอนนี้เลยไหมครับ?`,
      actions: [
        { label: '🔀 ไปที่หน้าสถานการณ์จำลอง (What-If)', actionId: 'nav-what-if' },
        { label: '📅 ดูตารางคุมสอบภาพรวม', actionId: 'nav-scheduler' }
      ]
    };
  }

  /**
   * 5. ข้อมูล Open Source & License
   */
  handleOpenSourceInfo() {
    return {
      message: `### 🌐 ข้อมูลสิทธิ์การใช้งานแบบ Open Source\n\n` +
        `ระบบจัดตารางผู้คุมสอบนี้พัฒนาขึ้นภายใต้สัญญาอนุญาต **MIT Open Source License** ซึ่งเป็นสัญญาอนุญาตสากลที่เปิดกว้างที่สุด:\n\n` +
        `• **สิทธิ์ในการใช้งาน:** คุณสามารถนำระบบนี้ไปใช้งาน, คัดลอก, ดัดแปลง, ผสานเข้ากับระบบอื่น หรือใช้งานเชิงพาณิชย์ได้ฟรี 100%\n` +
        `• **ความโปร่งใส (Transparency):** โค้ดทั้งหมดเปิดเผย (Open Codebase) สามารถตรวจสอบอัลกอริทึมการคำนวณคะแนนและความยุติธรรมได้\n` +
        `• **ความเป็นส่วนตัวระดับสูงสุด (Local-First & Zero Data Leak):** ข้อมูลผู้คุมสอบ, ตารางสอบ, และคะแนนทั้งหมด ถูกประมวลผลอยู่บนเครื่องเบราว์เซอร์ของคุณ 100% ไม่มีการส่งข้อมูลส่วนบุคคลออกไปยังเซิร์ฟเวอร์ภายนอก\n` +
        `• **มาตรฐานสากล:** ออกแบบให้รันได้แบบ Standalone ผ่านไฟล์เดียว หรือเปิดผ่าน GitHub ได้ทันทีครับ`,
      actions: [
        { label: '📜 ดูใบอนุญาต MIT License', actionId: 'open-license-modal' },
        { label: '🩺 ตรวจสุขภาพตาราง', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' }
      ]
    };
  }

  /**
   * 6. อธิบายกฎ H1-H8
   */
  handleRulesExplanation() {
    return {
      message: `### ⚖️ กฎบังคับเด็ดขาด 8 ข้อ (Hard Constraints H1 - H8)\n\n` +
        `ระบบและ AI Agent ยึดหลักการจัดตารางตามกฎเกณฑ์สากลดังนี้:\n\n` +
        `• **H1 (No Time Overlap):** ห้ามผู้คุมคนเดียวกันมีเวลาปฏิบัติหน้าที่ทับซ้อนกัน (รวมเวลาเตรียมตัว 30 นาที และส่งข้อสอบ 15 นาที)\n` +
        `• **H2 (Room Overlap & Capacity):** ห้ามใช้ห้องสอบเดียวกันในเวลาเดียวกัน และจำนวนผู้สอบต้องไม่เกินความจุห้อง\n` +
        `• **H3 (Quota Limits):** ห้ามจัดเกินโควต้ารอบสูงสุดต่อวัน (ปกติ 2 รอบ) และต่อโครงการ (ปกติ 6 รอบ)\n` +
        `• **H4 (Unavailability):** ห้ามจัดในวัน-เวลาที่อาจารย์แจ้งไม่สะดวกหรือติดภารกิจ\n` +
        `• **H5 (Required Proctors):** ทุกห้องต้องมีหัวหน้าห้อง (Chief) 1 คน และหากผู้เข้าสอบเกิน 30 คน ต้องมีผู้ช่วย (Assistant) เพิ่มอีก 1 คน\n` +
        `• **H6 (Rest Period):** ต้องมีเวลาพักระหว่างรอบสอบอย่างน้อย 30 นาที\n` +
        `• **H7 (Special Needs):** การสอบบนเครื่องคอมพิวเตอร์ (CBT) ต้องจัดในห้องปฏิบัติการคอมพิวเตอร์เท่านั้น\n` +
        `• **H8 (Reserve Rules):** ผู้คุมคนเดียวกันต้องไม่เป็นทั้งผู้คุมหลักและผู้คุมสำรองในรอบเดียวกัน`,
      actions: [
        { label: '🩺 ตรวจสอบว่าตารางผ่านกฎครบไหม', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' }
      ]
    };
  }

  /**
   * 7. การเกลี่ยงานและความยุติธรรม
   */
  handleWorkloadAnalysis() {
    const proctorWorkloads = this.appState.proctors.map(p => {
      const count = this.appState.assignments.filter(a => a.proctorId === p.id).length;
      return { proctor: p, count };
    });

    const counts = proctorWorkloads.map(w => w.count);
    const maxDuties = Math.max(...counts, 0);
    const minDuties = Math.min(...counts, 0);
    const avg = counts.length > 0 ? (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1) : 0;

    // คำนวณ Standard Deviation (SD)
    const variance = counts.length > 0 ? counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length : 0;
    const sd = Math.sqrt(variance).toFixed(2);

    return {
      message: `### 📊 การวิเคราะห์ความสมดุลและการเกลี่ยภาระงาน (Workload Balance)\n\n` +
        `• ค่าเฉลี่ยรอบคุมสอบต่อคน: **${avg} รอบ**\n` +
        `• คุมสอบมากที่สุด: **${maxDuties} รอบ** | คุมสอบน้อยที่สุด: **${minDuties} รอบ**\n` +
        `• ค่าเบี่ยงเบนมาตรฐาน (SD): **${sd}** ${sd < 1.0 ? '*(ยอดเยี่ยม มีการเกลี่ยงานที่ใกล้เคียงกันมาก)*' : '*(กระจายตัวปานกลาง)*'}\n\n` +
        `💡 อัลกอริทึมของระบบมีการคิดคะแนน Soft Constraints (S1) เพื่อลงโทษการกระจุกตัวของงาน และพยายามดันให้ทุกคนมีภาระงานใกล้เคียงกันที่สุดครับ`,
      actions: [
        { label: '⚡ จัดตารางใหม่ให้สมดุลยิ่งขึ้น', actionId: 'run-auto-schedule' },
        { label: '🩺 ตรวจสุขภาพตาราง', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' }
      ]
    };
  }

  /**
   * 8. การสนทนาทั่วไป / ถามตอบระบบ
   */
  handleGeneralConversation(query) {
    return {
      message: `ผมเข้าใจคำถามของคุณเกี่ยวกับ: **"${query}"** ครับ 🤖\n\n` +
        `ในฐานะ **ProctorAI Agent** ผมถูกออกแบบมาเพื่อช่วยบริหารจัดการการจัดตารางคุมสอบอย่างรอบด้าน คุณสามารถให้ผมช่วยเรื่องต่าง ๆ เหล่านี้ได้ทันทีครับ:\n\n` +
        `1. **ตรวจสุขภาพตาราง (Audit & Diagnostics):** เช็กว่ามีจุดใดขัดต่อกฎ H1-H8 หรือไม่\n` +
        `2. **สั่งจัดตารางอัตโนมัติ (Constraint Solver):** รันระบบสุ่มจัดตารางที่เกลี่ยงานเท่าเทียมและไม่ชนเวลา\n` +
        `3. **คำนวณผู้คุมขั้นต่ำ (Capacity Planning):** เช็กว่ามีคนพอสำหรับจำนวนห้องและรอบสอบหรือไม่\n` +
        `4. **สิทธิ์ Open Source (MIT License):** ความโปร่งใสของโค้ดและความปลอดภัยของข้อมูลในเครื่อง\n\n` +
        `คุณต้องการให้ผมดำเนินการในเรื่องใดเป็นพิเศษไหมครับ?`,
      actions: [
        { label: '🩺 ตรวจสุขภาพตารางตอนนี้', prompt: 'ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย' },
        { label: '⚡ สั่งจัดตารางอัตโนมัติ', prompt: 'ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย' },
        { label: '👥 คำนวณผู้คุมขั้นต่ำ', prompt: 'โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?' }
      ]
    };
  }
}
