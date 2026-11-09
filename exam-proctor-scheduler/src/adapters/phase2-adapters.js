/**
 * Phase 2 Extension Points & Adapters
 * จุดเชื่อมต่อสำหรับต่อยอดเป็นระบบจริงในระยะถัดไป
 */

// 1. Adapter ระบบยืนยันตัวตน (Authentication Adapter)
export const AuthAdapter = {
  /**
   * เข้าสู่ระบบด้วย SSO มหาวิทยาลัย (Phase 2: LDAP / OAuth 2.0 / SAML)
   * @param {string} username 
   * @param {string} password 
   */
  async login(username, password) {
    console.info('[Phase 2 Interface] AuthAdapter.login called');
    return {
      userId: 'admin_1',
      name: 'ผู้ประสานงานสอบ',
      role: 'admin' // 'admin' | 'proctor' | 'viewer'
    };
  },

  getCurrentUser() {
    return { userId: 'admin_1', name: 'ผู้ประสานงานสอบ', role: 'admin' };
  }
};

// 2. Adapter บันทึกข้อมูลถาวร (Storage Adapter)
export const StorageAdapter = {
  /**
   * ดึงข้อมูลตารางและบุคลากรจากฐานข้อมูลจริง (Phase 2: REST API / PostgreSQL / MongoDB)
   */
  async fetchAll() {
    console.info('[Phase 2 Interface] StorageAdapter.fetchAll called');
    return null;
  },

  /**
   * บันทึกสถานะไปยังเซิร์ฟเวอร์
   * @param {Object} data 
   */
  async saveAll(data) {
    console.info('[Phase 2 Interface] StorageAdapter.saveAll called');
    return true;
  }
};

// 3. Adapter แจ้งเตือน (Notification Adapter)
export const NotificationAdapter = {
  /**
   * ส่งการแจ้งเตือนทาง LINE Official Account หรือ Email
   * @param {string} proctorId 
   * @param {string} messageTemplate 
   * @param {Object} params 
   */
  async sendNotification(proctorId, messageTemplate, params) {
    console.info(`[Phase 2 Interface] Sending notification to ${proctorId}:`, messageTemplate);
    return { success: true };
  }
};
