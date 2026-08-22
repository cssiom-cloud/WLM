import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { Search } from 'lucide-react';
import AnimatedCard, { DossierModal } from '../components/AnimatedCard.jsx';
import { formatPersonnelName, useCommand } from '../components/GlobalLayout.jsx';

const DIRECTORY_ROSTER = [
  {
    id: 'p-somchai',
    first_name: 'Somchai',
    middle_name: '',
    last_name: '',
    military_rank: 'CPL.',
    organization_role: 'Personnel',
    initials: 'CS',
    avatar_url: '',
    unit: 'Personnel Affairs, Command Wing',
    status: 'Active',
    enlisted_on: '12 Mar 2019',
    assignment_since: '4 Jan 2024',
    clearance: 'Internal',
    notes: 'Corporal Somchai maintains the living personnel register and prepares session authority for command correspondence.'
  },
  {
    id: 'p-arthit',
    first_name: 'Arthit',
    middle_name: '',
    last_name: '',
    military_rank: 'SGT.',
    organization_role: 'Operations',
    initials: 'SA',
    avatar_url: '',
    unit: 'Operations Detachment Alpha',
    status: 'On assignment',
    enlisted_on: '8 Aug 2017',
    assignment_since: '19 Nov 2023',
    clearance: 'Restricted',
    notes: 'Sergeant Arthit coordinates field tasking and daily operational summaries for the command watch.'
  },
  {
    id: 'p-niran',
    first_name: 'Niran',
    middle_name: '',
    last_name: 'Wongchai',
    military_rank: 'LT.',
    organization_role: 'Logistics',
    initials: 'NW',
    avatar_url: '',
    unit: 'Sustainment Office',
    status: 'Active',
    enlisted_on: '2 Feb 2016',
    assignment_since: '11 Jun 2022',
    clearance: 'Internal',
    notes: 'Lieutenant Wongchai oversees materiel accountability and movement orders for Eridian deployments.'
  },
  {
    id: 'p-mali',
    first_name: 'Mali',
    middle_name: '',
    last_name: 'Srisawat',
    military_rank: 'CPT.',
    organization_role: 'Intelligence',
    initials: 'MS',
    avatar_url: '',
    unit: 'Assessment Cell',
    status: 'Active',
    enlisted_on: '21 Sep 2014',
    assignment_since: '3 Mar 2023',
    clearance: 'Restricted',
    notes: 'Captain Srisawat prepares situational assessments and briefings for the command staff.'
  },
  {
    id: 'p-kittisak',
    first_name: 'Kittisak',
    middle_name: '',
    last_name: 'Boonmee',
    military_rank: 'WO1',
    organization_role: 'Communications',
    initials: 'KB',
    avatar_url: '',
    unit: 'Signals Section',
    status: 'Active',
    enlisted_on: '14 May 2011',
    assignment_since: '27 Aug 2021',
    clearance: 'Internal',
    notes: 'Warrant Officer Boonmee maintains secure channels and the official message log.'
  },
  {
    id: 'p-pimchanok',
    first_name: 'Pimchanok',
    middle_name: '',
    last_name: 'Trairat',
    military_rank: '2LT.',
    organization_role: 'Medical',
    initials: 'PT',
    avatar_url: '',
    unit: 'Medical Detachment',
    status: 'Leave',
    enlisted_on: '30 Jan 2020',
    assignment_since: '16 Oct 2024',
    clearance: 'Internal',
    notes: 'Second Lieutenant Trairat is the medical liaison for personnel fitness and deployment clearance.'
  },
  {
    id: 'p-anan',
    first_name: 'Anan',
    middle_name: '',
    last_name: 'Prasert',
    military_rank: 'MAJ.',
    organization_role: 'Command Staff',
    initials: 'AP',
    avatar_url: '',
    unit: 'Headquarters, Command Wing',
    status: 'Active',
    enlisted_on: '6 Apr 2009',
    assignment_since: '1 Jul 2022',
    clearance: 'Command',
    notes: 'Major Prasert advises the commanding officer on personnel policy and official orders.'
  },
  {
    id: 'p-siriporn',
    first_name: 'Siriporn',
    middle_name: '',
    last_name: 'Kaewmanee',
    military_rank: 'SFC.',
    organization_role: 'Training',
    initials: 'SK',
    avatar_url: '',
    unit: 'Instruction Branch',
    status: 'Active',
    enlisted_on: '18 Nov 2013',
    assignment_since: '9 Feb 2023',
    clearance: 'Internal',
    notes: 'Sergeant First Class Kaewmanee administers qualification records and continuation training.'
  },
  {
    id: 'p-thanawat',
    first_name: 'Thanawat',
    middle_name: '',
    last_name: 'Chaiyaporn',
    military_rank: 'PFC.',
    organization_role: 'Security',
    initials: 'TC',
    avatar_url: '',
    unit: 'Installation Security',
    status: 'Active',
    enlisted_on: '22 Jul 2022',
    assignment_since: '5 Jan 2025',
    clearance: 'Internal',
    notes: 'Private First Class Chaiyaporn is assigned to gate and archive security for the command compound.'
  },
  {
    id: 'p-wilaiwan',
    first_name: 'Wilaiwan',
    middle_name: '',
    last_name: 'Mekchai',
    military_rank: '1LT.',
    organization_role: 'Administration',
    initials: 'WM',
    avatar_url: '',
    unit: 'Secretariat',
    status: 'Active',
    enlisted_on: '9 Dec 2015',
    assignment_since: '14 Sep 2023',
    clearance: 'Internal',
    notes: 'First Lieutenant Mekchai prepares official documents and maintains the sealed correspondence file.'
  }
];

function searchableText(row) {
  return [formatPersonnelName(row), row.military_rank, row.organization_role, row.unit]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function Dashboard() {
  const { lang, activePersonnel } = useCommand();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return DIRECTORY_ROSTER;
    }
    return DIRECTORY_ROSTER.filter((row) => searchableText(row).includes(needle));
  }, [query]);

  const selected = useMemo(
    () => DIRECTORY_ROSTER.find((row) => row.id === selectedId) || null,
    [selectedId]
  );

  const thai = lang === 'th';

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold">
            {thai ? 'กำลังพล' : 'Personnel'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">
            {thai ? 'ทำเนียบกำลังพล' : 'Personnel Directory'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {thai
              ? 'บันทึกเจ้าหน้าที่ที่ได้รับมอบหมายประจำหน่วย สำหรับการมอบหมายงานและการออกเอกสารราชการ'
              : 'Authorized officers of this installation. Open a dossier to review assignment, status, and official actions.'}
          </p>
        </div>
        <label className="block w-full lg:max-w-sm">
          <span className="sr-only">{thai ? 'ค้นหา' : 'Search personnel'}</span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={thai ? 'ค้นหาชื่อ ยศ หน่วยงาน' : 'Search name, rank, or role'}
              className="min-h-11 w-full rounded-xl border border-navy/10 bg-white/80 py-2 pl-10 pr-3 text-sm text-navy outline-none backdrop-blur-xl placeholder:text-slate-400 focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
            />
          </span>
        </label>
      </div>

      <LayoutGroup>
        {filtered.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((row) => (
              <AnimatedCard
                key={row.id}
                person={row}
                isSelected={selectedId === row.id}
                isActive={activePersonnel?.id === row.id}
                onOpen={() => setSelectedId(row.id)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-navy/10 bg-white/70 px-5 py-8 text-sm text-slate-500 shadow-glass">
            {thai ? 'ไม่พบกำลังพลที่ตรงกับการค้นหา' : 'No personnel matched the search.'}
          </p>
        )}

        <AnimatePresence>
          {selected ? <DossierModal person={selected} onClose={() => setSelectedId(null)} /> : null}
        </AnimatePresence>
      </LayoutGroup>
    </section>
  );
}
