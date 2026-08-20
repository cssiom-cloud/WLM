import { RANK_STRUCTURE, formatPersonnelName, rankSortOrder } from './domain.js';

const COMMAND_SORT_LIMIT = 2;

function asRankRow(entry) {
  return {
    rankTitle: entry.rankTitle || entry.rank_title || '',
    natoGrade: entry.natoGrade || entry.nato_grade || '',
    sortOrder: Number(entry.sortOrder ?? entry.sort_order)
  };
}

export function normalizeRankStructure(rankStructure) {
  const rows = (rankStructure || []).map(asRankRow).filter((row) => row.rankTitle);
  if (!rows.length) {
    return RANK_STRUCTURE.map(asRankRow);
  }
  return rows
    .map((row) => ({
      ...row,
      sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : rankSortOrder(row.rankTitle)
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function decoratePerson(record, ranks) {
  const match = ranks.find((row) => row.rankTitle === record.military_rank);
  return {
    ...record,
    _sort: match?.sortOrder ?? rankSortOrder(record.military_rank),
    _nato: match?.natoGrade || ''
  };
}

function sortPeople(left, right) {
  const rankDelta = left._sort - right._sort;
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return formatPersonnelName(left).localeCompare(formatPersonnelName(right));
}

function rankBandTree(members, ranks, branch) {
  const groups = new Map();
  members.forEach((person) => {
    const key = `${String(person._sort).padStart(4, '0')}|${person.military_rank || 'Unranked'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(person);
  });
  const keys = [...groups.keys()].sort();
  let child = null;
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const [sortValue, rank] = keys[index].split('|');
    const people = groups.get(keys[index]).slice().sort(sortPeople);
    child = {
      type: 'rank',
      branch,
      rank,
      natoGrade: ranks.find((row) => row.rankTitle === rank)?.natoGrade || people[0]?._nato || '',
      sortOrder: Number(sortValue),
      people,
      children: child ? [child] : []
    };
  }
  return child;
}

/**
 * Turns a flat oc_personnel roster into a nested org tree.
 * Root people are OF-10 / OF-9 command staff. Children split into Navy and Marines
 * rank bands nested by oc_rank_structure.sort_order (1 = highest).
 * There is no reports_to column, so the tree is rank-derived, not named-supervisor.
 */
export function buildHierarchyTree(personnelData, rankStructure) {
  const ranks = normalizeRankStructure(rankStructure);
  const people = (personnelData || []).map((record) => decoratePerson(record, ranks)).sort(sortPeople);

  if (!people.length) {
    return { type: 'root', people: [], children: [] };
  }

  let commandPeople = people.filter((person) => person._sort <= COMMAND_SORT_LIMIT);
  let remainder = people.filter((person) => person._sort > COMMAND_SORT_LIMIT);
  if (!commandPeople.length) {
    const topSort = people[0]._sort;
    commandPeople = people.filter((person) => person._sort === topSort);
    remainder = people.filter((person) => person._sort !== topSort);
  }

  const navy = remainder.filter((person) => person.military_branch === 'Navy');
  const marines = remainder.filter((person) => person.military_branch === 'Marines');
  const unassigned = remainder.filter(
    (person) => person.military_branch !== 'Navy' && person.military_branch !== 'Marines'
  );

  const children = [];
  const navyTree = rankBandTree(navy, ranks, 'Navy');
  const marinesTree = rankBandTree(marines, ranks, 'Marines');
  const unassignedTree = rankBandTree(unassigned, ranks, 'Unassigned');

  if (navyTree) {
    children.push({ type: 'branch', branch: 'Navy', people: [], children: [navyTree] });
  }
  if (marinesTree) {
    children.push({ type: 'branch', branch: 'Marines', people: [], children: [marinesTree] });
  }
  if (unassignedTree) {
    children.push({ type: 'branch', branch: 'Unassigned', people: [], children: [unassignedTree] });
  }

  return {
    type: 'root',
    people: commandPeople,
    children
  };
}
