const LANG_STORAGE_KEY = 'wlr-command-lang';

// Central dictionary: every user-facing string swaps between English and Thai.
export const DICTIONARY = {
  en: {
    'nav.home': 'Home',
    'nav.announcements': 'Announcements',
    'nav.directory': 'Directory',
    'nav.createAnnouncement': 'Create Announcement',
    'nav.adminPage': 'Admin Page',
    'nav.settings': 'Settings',
    'nav.logs': 'System Logs',
    'nav.signOut': 'Sign Out',
    'ann.kicker': 'Operations',
    'ann.title': 'Announcements Hub',
    'ann.create': 'Create Announcement',
    'ann.empty': 'No announcements yet.',
    'ann.signedUp': 'Signed-up',
    'ann.max': 'Max',
    'ann.join': 'Join',
    'ann.withdraw': 'Withdraw',
    'ann.full': 'Full',
    'ann.open': 'Open',
    'ann.delete': 'Delete',
    'ann.signin': 'Sign in to register',
    'ann.joined': 'Registered successfully.',
    'ann.withdrawn': 'Registration withdrawn.',
    'ann.deleted': 'Announcement deleted.',
    'ann.confirmDelete': 'Delete this announcement?',
    'ann.close': 'Close event',
    'ann.closed': 'Closed',
    'ann.confirmClose': 'Close this announcement? Personnel who remain signed up will receive the special rank if it is enabled.',
    'ann.closedOk': 'Announcement closed.',
    'ann.closedWithHonor': 'Announcement closed and special ranks awarded.',
    'ann.honorPending': 'Special rank on close',
    'ann.honorAwarded': 'Special rank awarded',
    'create.kicker': 'Command',
    'create.title': 'Announcement Creation Room',
    'create.back': 'Back to Announcements',
    'create.titleLabel': 'Title',
    'create.contentLabel': 'Content',
    'create.capacityLabel': 'Max Capacity',
    'create.imageLabel': 'Cover Image',
    'create.publish': 'Publish Announcement',
    'create.clear': 'Clear',
    'create.published': 'Announcement published.',
    'create.invalid': 'Complete the title, content, and a capacity of at least 1.',
    'create.honorToggle': 'Award a special rank when this event is closed',
    'create.honorTitleLabel': 'Special rank name',
    'create.honorHint': 'Personnel who remain signed up when an administrator closes the announcement receive this rank. Leave this off if the event should not award a rank.',
    'create.honorRequired': 'Enter a special rank name, or turn the award off.',
    'dir.kicker': 'Personnel',
    'dir.title': 'Personnel Directory',
    'dir.search': 'Search name, rank, branch',
    'dir.view': 'View Profile',
    'dir.empty': 'No personnel matched the search.',
    'dir.loaded': 'personnel records loaded.',
    'dir.record': 'Service Record & Achievements',
    'dir.trainingCourse': 'Training course',
    'dir.missions': 'Completed missions',
    'dir.medals': 'Medals',
    'dir.honorRanks': 'Special ranks',
    'dir.noRecord': 'No records yet.',
    'nav.lore': 'Lore Archive',
    'nav.documents': 'Documents',
    'lore.kicker': 'Archive',
    'lore.title': 'Lore & Asset Archive',
    'docs.kicker': 'Reference',
    'docs.title': 'Document & Manual Center',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirmDelete': 'Delete this item?',
    'lore.addTopic': 'Add New Topic',
    'docs.create': 'Create New Document'
  },
  th: {
    'nav.home': 'หน้าหลัก',
    'nav.announcements': 'รวมประกาศ',
    'nav.directory': 'ทำเนียบกำลังพล',
    'nav.createAnnouncement': 'สร้างประกาศ',
    'nav.adminPage': 'หน้าผู้ดูแลระบบ',
    'nav.settings': 'การตั้งค่า',
    'nav.logs': 'บันทึกระบบ',
    'nav.signOut': 'ออกจากระบบ',
    'ann.kicker': 'ปฏิบัติการ',
    'ann.title': 'รวมประกาศ',
    'ann.create': 'สร้างประกาศ',
    'ann.empty': 'ยังไม่มีประกาศ',
    'ann.signedUp': 'ลงชื่อแล้ว',
    'ann.max': 'รับทั้งหมด',
    'ann.join': 'เข้าร่วม',
    'ann.withdraw': 'ถอนชื่อ',
    'ann.full': 'เต็ม',
    'ann.open': 'เปิดรับ',
    'ann.delete': 'ลบ',
    'ann.signin': 'เข้าสู่ระบบเพื่อลงชื่อ',
    'ann.joined': 'ลงชื่อสำเร็จ',
    'ann.withdrawn': 'ถอนชื่อแล้ว',
    'ann.deleted': 'ลบประกาศแล้ว',
    'ann.confirmDelete': 'ต้องการลบประกาศนี้หรือไม่',
    'ann.close': 'สั่งจบประกาศ',
    'ann.closed': 'จบแล้ว',
    'ann.confirmClose': 'ต้องการสั่งจบประกาศนี้หรือไม่ ผู้ที่ยังลงชื่ออยู่จะได้รับยศพิเศษหากเปิดการมอบยศไว้',
    'ann.closedOk': 'สั่งจบประกาศแล้ว',
    'ann.closedWithHonor': 'สั่งจบประกาศแล้ว และมอบยศพิเศษให้ผู้ที่อยู่จนจบ',
    'ann.honorPending': 'ยศพิเศษเมื่อจบงาน',
    'ann.honorAwarded': 'มอบยศพิเศษแล้ว',
    'create.kicker': 'ศูนย์บัญชาการ',
    'create.title': 'ห้องสร้างประกาศ',
    'create.back': 'กลับไปหน้ารวมประกาศ',
    'create.titleLabel': 'หัวข้อ',
    'create.contentLabel': 'เนื้อหา',
    'create.capacityLabel': 'จำนวนรับสูงสุด',
    'create.imageLabel': 'รูปภาพหน้าปก',
    'create.publish': 'เผยแพร่ประกาศ',
    'create.clear': 'ล้างฟอร์ม',
    'create.published': 'เผยแพร่ประกาศแล้ว',
    'create.invalid': 'กรอกหัวข้อ เนื้อหา และจำนวนรับอย่างน้อย 1',
    'create.honorToggle': 'มอบยศพิเศษเมื่อสั่งจบประกาศนี้',
    'create.honorTitleLabel': 'ชื่อยศพิเศษ',
    'create.honorHint': 'กำลังพลที่ยังลงชื่ออยู่เมื่อแอดมินสั่งจบประกาศจะได้รับยศนี้ ปิดได้หากงานนี้ไม่มอบยศ',
    'create.honorRequired': 'กรอกชื่อยศพิเศษ หรือปิดการมอบยศ',
    'dir.kicker': 'กำลังพล',
    'dir.title': 'ทำเนียบกำลังพล',
    'dir.search': 'ค้นหาชื่อ ยศ เหล่าทัพ',
    'dir.view': 'ดูโปรไฟล์',
    'dir.empty': 'ไม่พบกำลังพลที่ค้นหา',
    'dir.loaded': 'รายการกำลังพลโหลดแล้ว',
    'dir.record': 'ประวัติราชการและความสำเร็จ',
    'dir.trainingCourse': 'หลักสูตรฝึก',
    'dir.missions': 'ภารกิจที่สำเร็จ',
    'dir.medals': 'เหรียญตรา',
    'dir.honorRanks': 'ยศพิเศษ',
    'dir.noRecord': 'ยังไม่มีบันทึก',
    'nav.lore': 'คลังข้อมูลโลก',
    'nav.documents': 'เอกสารและคู่มือ',
    'lore.kicker': 'คลังข้อมูล',
    'lore.title': 'คลังข้อมูลโลกและยุทโธปกรณ์',
    'docs.kicker': 'อ้างอิง',
    'docs.title': 'ศูนย์เอกสารและคู่มือ',
    'common.add': 'เพิ่ม',
    'common.edit': 'แก้ไข',
    'common.delete': 'ลบ',
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.confirmDelete': 'ต้องการลบรายการนี้หรือไม่',
    'lore.addTopic': 'เพิ่มหัวข้อใหม่',
    'docs.create': 'สร้างเอกสารใหม่'
  }
};

export function getLang() {
  return window.localStorage.getItem(LANG_STORAGE_KEY) === 'th' ? 'th' : 'en';
}

export function t(key) {
  const lang = getLang();
  return DICTIONARY[lang][key] ?? DICTIONARY.en[key] ?? key;
}

// Static HTML opts in with data-i18n / data-i18n-placeholder attributes.
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder')));
  });
}

export function setLang(lang) {
  window.localStorage.setItem(LANG_STORAGE_KEY, lang === 'th' ? 'th' : 'en');
  document.documentElement.lang = getLang();
  applyTranslations();
  // Pages with dynamic content re-render their cached data on this event.
  window.dispatchEvent(new CustomEvent('wlr-lang-changed', { detail: { lang: getLang() } }));
}
