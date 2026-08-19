export const MILITARY_BRANCHES = ['Navy', 'Marines'];

export const NATIONALITIES = ['Aquilish', 'Renjima', 'Schwartland'];

export const RACES = ['Human', 'Neko', 'Elf', 'Demon'];

export const GENDERS = ['Male', 'Female'];

export const TICKET_CATEGORIES = [
  { id: 'forgot_password', en: 'Forgot password', th: 'ลืมรหัสผ่าน' },
  { id: 'bug', en: 'Bug report', th: 'แจ้งบัค' },
  { id: 'missing_rank', en: 'Missing rank', th: 'ยศหาย' },
  { id: 'other', en: 'Other', th: 'อื่นๆ' }
];

export const COMMAND_UNITS = [
  { code: 'QLD', name: "(QLD) The Queen's Lion Divisions", sort_order: 1 },
  { code: 'NMRS', name: '(NMRS) NAVAL MEDICAL AND RESCUE SERVICE', sort_order: 2 },
  { code: '9TH Sub', name: '(9TH Sub) 9TH SUBMARINE FLEET', sort_order: 3 },
  { code: '220TH HR', name: '(220TH HR) 220TH HEAVY RECON ROYAL MARINES', sort_order: 4 },
  { code: 'SAWA', name: '(SAWA) ANTI SUBMARINE WARFARE AND UNDER WARTER ATTACKING', sort_order: 5 },
  { code: 'NCD +', name: '(NCD +) NAVAL COMBAT DIVISION PLUS', sort_order: 6 },
  { code: 'SLAA', name: '(SLAA) SEA LION AIR ARMS', sort_order: 7 },
  { code: 'SLMF', name: '(SLMF) SUPPORT LION MARINES FLEET', sort_order: 8 },
  { code: 'RFA', name: '(RFA) WLR LOGISTICS FLEET AUXILIARY', sort_order: 9 },
  { code: '11TH', name: '(11TH) WLR 11TH Rapier Lion division', sort_order: 10 },
  { code: 'SNS', name: '(SNS) SPECIAL NEPTUNE SERVICES', sort_order: 11 },
  { code: 'ANMF', name: '(ANMF) ANTI NAVAL MINE FLEET', sort_order: 12 },
  { code: 'EWD', name: '(EWD) ELECTRONICS WARFARE DIVISION', sort_order: 13 },
  { code: '6TH FGF', name: '(6TH FGF) WLR 6TH frigate fleet division', sort_order: 14 },
  { code: 'CSGF', name: '(CSGF) CARRIER STRIKE GROUP FLEET', sort_order: 15 },
  { code: 'NDS', name: '(NDS) NAVAL DOCKYARD SERVICS', sort_order: 16 },
  { code: 'ACP', name: '(ACP) COMBAT PARATROOPSER', sort_order: 17 }
];

export const RANK_STRUCTURE = [
  { rankTitle: 'Admiral of the Fleet', natoGrade: 'OF-10', sortOrder: 1 },
  { rankTitle: 'Admiral', natoGrade: 'OF-9', sortOrder: 2 },
  { rankTitle: 'Vice admiral', natoGrade: 'OF-8', sortOrder: 3 },
  { rankTitle: 'Rear admiral', natoGrade: 'OF-7', sortOrder: 4 },
  { rankTitle: 'Commodore', natoGrade: 'OF-6', sortOrder: 5 },
  { rankTitle: 'Captain', natoGrade: 'OF-5', sortOrder: 6 },
  { rankTitle: 'Lieutenant', natoGrade: 'OF-1 — OF-4', sortOrder: 7 },
  { rankTitle: 'Master Sergeant', natoGrade: 'OR-9', sortOrder: 8 },
  { rankTitle: 'Sergeant Major', natoGrade: 'OR-8', sortOrder: 9 },
  { rankTitle: 'Sergeant', natoGrade: 'OR-5', sortOrder: 10 },
  { rankTitle: 'Corporal', natoGrade: 'OR-4', sortOrder: 11 },
  { rankTitle: 'Private', natoGrade: 'OR-1 — OR-3', sortOrder: 12 },
  { rankTitle: 'Naval academy Trainer', natoGrade: 'TR', sortOrder: 13 },
  { rankTitle: 'Naval academy student', natoGrade: 'NS', sortOrder: 14 }
];

export const AGE_BRACKETS = [
  { label: '17-20', min: 17, max: 20 },
  { label: '21-25', min: 21, max: 25 },
  { label: '26-30', min: 26, max: 30 },
  { label: '31-40', min: 31, max: 40 },
  { label: '41+', min: 41, max: null }
];

const RANK_ORDER_MAP = Object.fromEntries(
  RANK_STRUCTURE.map((entry) => [entry.rankTitle, entry.sortOrder])
);

export function rankSortOrder(rankTitle) {
  return RANK_ORDER_MAP[rankTitle] ?? Number.MAX_SAFE_INTEGER;
}

export function comparePersonnelByRank(left, right) {
  const rankDelta = rankSortOrder(left.military_rank) - rankSortOrder(right.military_rank);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return formatPersonnelName(left).localeCompare(formatPersonnelName(right));
}

export function formatPersonnelName(record) {
  return [record.first_name, record.middle_name, record.last_name]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(' ')
    .trim();
}

export function parsePersonnelName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return { first_name: null, middle_name: null, last_name: null };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], middle_name: null, last_name: null };
  }
  if (parts.length === 2) {
    return { first_name: parts[0], middle_name: null, last_name: parts[1] };
  }
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    last_name: parts[parts.length - 1]
  };
}

export function biographyParagraphs(record, allowPrivateBio = true) {
  if (!allowPrivateBio) {
    return {
      paragraphIdentity: 'Biography is private.',
      paragraphService: ''
    };
  }
  const raw = String(record.biography || '').trim();
  if (raw) {
    const parts = raw.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    return {
      paragraphIdentity: parts[0] || raw,
      paragraphService: parts.slice(1).join(' ') || composePersonnelHistory(record).paragraphService
    };
  }
  return composePersonnelHistory(record);
}

export function composePersonnelHistory(record) {
  const identityName = formatPersonnelName(record) || 'Unassigned name';
  const paragraphIdentity = [
    `Name: ${identityName}.`,
    record.age != null ? `Age: ${record.age}.` : null,
    record.gender ? `Gender: ${record.gender}.` : null,
    record.race ? `Race: ${record.race}.` : null,
    record.nationality ? `Nationality: ${record.nationality}.` : null,
    record.religion ? `Religion: ${record.religion}.` : null
  ]
    .filter(Boolean)
    .join(' ');

  const paragraphService = [
    record.military_rank ? `Military rank: ${record.military_rank}.` : null,
    record.military_branch ? `Branch: ${record.military_branch}.` : null,
    record.wlc_agency ? `Agency: ${record.wlc_agency}.` : null,
    record.training_course ? `Training course: ${record.training_course}.` : null,
    record.organization_role ? `Organization role: ${record.organization_role}.` : null
  ]
    .filter(Boolean)
    .join(' ');

  return {
    paragraphIdentity: paragraphIdentity || 'General record is incomplete.',
    paragraphService: paragraphService || 'Service record is incomplete.'
  };
}
