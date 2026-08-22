import { RANK_STRUCTURE, biographyParagraphs, rankSortOrder } from '../../js/domain.js';

export const SKILL_KEYS = ['tactical', 'engineering', 'combat', 'command', 'logistics', 'discipline'];
export const TIMELINE_KINDS = ['training', 'promotion', 'mission', 'current', 'other'];
export const RIBBON_PRESETS = [
  'Meritorious Service Medal',
  'Fleet Command Ribbon',
  'Distinguished Command Cross',
  'Long Service Medal',
  'Marksmanship Badge',
  'Basic Training Honor'
];

const RIBBON_PALETTES = [
  ['#1e4e8c', '#c9a227', '#1e4e8c'],
  ['#7a1f2b', '#d8c7a2', '#7a1f2b'],
  ['#1c6b46', '#e4d3a1', '#1c6b46'],
  ['#3d4a63', '#c5ccd8', '#3d4a63'],
  ['#6b4e16', '#f0e2b4', '#6b4e16']
];

function clampScore(value) {
  return Math.max(28, Math.min(98, Math.round(value)));
}

function clampSkill(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function parseJsonObject(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function normalizeTimeline(entry) {
  return {
    date: String(entry?.date || '').trim(),
    title: String(entry?.title || '').trim(),
    description: String(entry?.description || entry?.detail || '').trim(),
    kind: TIMELINE_KINDS.includes(entry?.kind) ? entry.kind : 'other'
  };
}

export function parseTimeline(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(normalizeTimeline).filter((entry) => entry.title);
}

export function unitNameFor(record, units = []) {
  return units.find((unit) => unit.id === record?.unit_id)?.name || record?.wlc_agency || '';
}

export function unitRankFor(record, ranks = []) {
  return ranks.find((rank) => rank.id === record?.unit_rank_id)?.title || '';
}

export function natoGradeFor(rank) {
  return RANK_STRUCTURE.find((item) => item.rankTitle === rank)?.natoGrade || '';
}

export function dossierSkills(record, units = []) {
  const rank = rankSortOrder(record?.military_rank);
  const rankScore = rank >= 99 ? 34 : 100 - (rank - 1) * 5.2;
  const missions = (Array.isArray(record?.completed_missions) ? record.completed_missions : []).length;
  const medals = (Array.isArray(record?.medals) ? record.medals : []).length;
  const honors = (Array.isArray(record?.honor_ranks) ? record.honor_ranks : []).length;
  const unit = unitNameFor(record, units).toUpperCase();
  const combatUnit = /MARINE|COMBAT|STRIKE|SUBMARINE|NEPTUNE|RAPIER|PARATROOP|HEAVY RECON/i.test(unit);
  const engineerUnit = /DOCKYARD|ELECTRONIC|MEDICAL|LOGISTIC|SUPPORT|AUXILIARY/i.test(unit);
  const trained = Boolean(record?.training_course);
  const derived = {
    tactical: clampScore(rankScore * 0.68 + missions * 8 + (record?.military_branch === 'Navy' ? 10 : 5)),
    engineering: clampScore(42 + (trained ? 16 : 0) + (engineerUnit ? 20 : 6) + medals * 4),
    combat: clampScore(36 + missions * 12 + (record?.military_branch === 'Marines' ? 16 : 6) + (combatUnit ? 14 : 0)),
    command: clampScore(rankScore * 0.82 + honors * 7 + (rank <= 6 ? 14 : 0)),
    logistics: clampScore(38 + (engineerUnit ? 18 : 7) + (record?.organization_role ? 10 : 0) + medals * 3),
    discipline: clampScore(44 + medals * 9 + honors * 8 + (trained ? 8 : 0))
  };
  const stored = parseJsonObject(record?.service_skills);
  SKILL_KEYS.forEach((key) => {
    const value = Number(stored[key]);
    if (Number.isFinite(value)) {
      derived[key] = clampSkill(value);
    }
  });
  return derived;
}

export function derivedTimeline(record, t) {
  const events = [];
  if (record?.training_course) {
    events.push({
      date: '',
      kind: 'training',
      title: record.training_course,
      description: '',
      detail: t('dir.trainingCourse')
    });
  }
  (Array.isArray(record?.honor_ranks) ? record.honor_ranks : []).forEach((rank) => {
    events.push({ date: '', kind: 'promotion', title: rank, description: '', detail: t('dir.honorRanks') });
  });
  (Array.isArray(record?.completed_missions) ? record.completed_missions : []).forEach((mission) => {
    events.push({ date: '', kind: 'mission', title: mission, description: '', detail: t('dir.missions') });
  });
  return events;
}

export function dossierTimeline(record, t) {
  const stored = parseTimeline(record?.service_timeline);
  if (stored.length) {
    return stored.map((entry) => ({
      ...entry,
      detail: t(`dir.kind.${entry.kind}`)
    }));
  }
  return derivedTimeline(record, t);
}

export function editorTimeline(record) {
  const stored = parseTimeline(record?.service_timeline);
  const rows = stored.length ? stored : derivedTimeline(record, (key) => key).map(normalizeTimeline);
  if (!rows.some((entry) => !entry.title)) {
    rows.push({ date: '', kind: 'other', title: '', description: '' });
  }
  return rows;
}

export function ribbonPalette(name) {
  let hash = 0;
  for (const ch of String(name)) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return RIBBON_PALETTES[hash % RIBBON_PALETTES.length];
}

export function personnelBiography(record, bioPublic = true) {
  return biographyParagraphs(record, bioPublic !== false);
}

export function uniqueAgencyValues(records) {
  return [...new Set((records || []).map((record) => record.wlc_agency).filter(Boolean))].sort();
}
