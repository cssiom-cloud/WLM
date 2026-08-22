import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Compass,
  Filter,
  MapPinned,
  Plus,
  Shield,
  Users
} from 'lucide-react';

const UNITS = [
  {
    id: 'u-alpha',
    callsign: 'ALPHA-1',
    status: 'Ready',
    sector: 'North',
    strength: 12,
    commander: 'SGT. Arthit',
    role: 'Watch detachment',
    x: 28,
    y: 24
  },
  {
    id: 'u-bravo',
    callsign: 'BRAVO-2',
    status: 'Deployed',
    sector: 'East',
    strength: 18,
    commander: 'LT. Niran Wongchai',
    role: 'Corridor escort',
    x: 72,
    y: 32
  },
  {
    id: 'u-charlie',
    callsign: 'CHARLIE-3',
    status: 'Standby',
    sector: 'West',
    strength: 8,
    commander: 'CPT. Mali Srisawat',
    role: 'Assessment cell',
    x: 18,
    y: 58
  },
  {
    id: 'u-delta',
    callsign: 'DELTA-4',
    status: 'Ready',
    sector: 'South',
    strength: 14,
    commander: 'WO1 Kittisak Boonmee',
    role: 'Signals post',
    x: 56,
    y: 74
  },
  {
    id: 'u-echo',
    callsign: 'ECHO-5',
    status: 'Deployed',
    sector: 'North',
    strength: 10,
    commander: 'MAJ. Anan Prasert',
    role: 'Command liaison',
    x: 44,
    y: 18
  },
  {
    id: 'u-foxtrot',
    callsign: 'FOXTROT-6',
    status: 'Standby',
    sector: 'East',
    strength: 6,
    commander: '2LT. Pimchanok Trairat',
    role: 'Medical reserve',
    x: 80,
    y: 56
  },
  {
    id: 'u-golf',
    callsign: 'GOLF-7',
    status: 'Ready',
    sector: 'West',
    strength: 16,
    commander: 'SFC. Siriporn Kaewmanee',
    role: 'Instruction party',
    x: 34,
    y: 46
  }
];

const INITIAL_AARS = [
  {
    id: 'aar-1',
    title: 'North ridge watch handover',
    unit: 'ALPHA-1',
    date: '21 Aug 2026',
    body: 'Night watch transferred to ALPHA-1 at 05:40. Perimeter lamps serviceable. No incident on the north road. Recommend retaining a second pair at the ridge until the morning courier has cleared the compound.'
  },
  {
    id: 'aar-2',
    title: 'East corridor movement',
    unit: 'BRAVO-2',
    date: '20 Aug 2026',
    body: 'Eighteen personnel escorted the sustainment wagons from the east gate to the depot. Road surface remains sound. One delay of twelve minutes at the river crossing while the timber span was inspected. No injury. Return to assigned sector at 16:10.'
  },
  {
    id: 'aar-3',
    title: 'West marsh communications check',
    unit: 'CHARLIE-3',
    date: '19 Aug 2026',
    body: 'Scheduled signals check completed with CHARLIE-3 on standby. All three posts answered on the first call. One spare handset issued to the west post. No further action required.'
  }
];

const STATUSES = ['Ready', 'Deployed', 'Standby'];
const SECTORS = ['North', 'East', 'South', 'West'];

const STATUS_TONE = {
  Ready: { pip: 'bg-gold', label: 'text-gold', plate: 'border-gold/45 bg-gold/10' },
  Deployed: { pip: 'bg-ivory', label: 'text-navy', plate: 'border-navy/15 bg-navy/[0.06]' },
  Standby: { pip: 'bg-slate-400', label: 'text-slate-500', plate: 'border-slate-300 bg-slate-100/80' }
};

const pinSpring = { type: 'spring', stiffness: 400, damping: 18 };
const panelSpring = { type: 'spring', stiffness: 260, damping: 28 };

function formatToday() {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());
}

function TacticalMapField() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ops-field" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B1F3A" />
          <stop offset="55%" stopColor="#12263A" />
          <stop offset="100%" stopColor="#0E2236" />
        </linearGradient>
        <radialGradient id="ops-vignette" cx="50%" cy="48%" r="68%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(7,16,30,0.45)" />
        </radialGradient>
      </defs>
      <rect width="1000" height="700" fill="url(#ops-field)" />
      <path
        d="M80 420 C 180 390, 240 470, 320 450 C 420 424, 480 510, 600 490 C 720 470, 800 540, 920 500"
        fill="none"
        stroke="#C4A35A"
        strokeOpacity="0.22"
        strokeWidth="2.2"
      />
      <path
        d="M40 390 C 160 360, 230 440, 330 420 C 430 400, 500 480, 620 460"
        fill="none"
        stroke="#F7F5F0"
        strokeOpacity="0.08"
        strokeWidth="8"
      />
      <path
        d="M120 80 L 180 220 L 260 300 L 340 360 L 500 420 L 640 390 L 780 430 L 900 380"
        fill="none"
        stroke="#F7F5F0"
        strokeOpacity="0.14"
        strokeWidth="1.4"
      />
      <path
        d="M220 640 L 280 520 L 360 440 L 500 360 L 620 240 L 700 160"
        fill="none"
        stroke="#F7F5F0"
        strokeOpacity="0.1"
        strokeWidth="1.2"
      />
      {[
        'M210 210 C 280 160, 360 150, 430 200 C 490 242, 470 310, 400 330 C 320 352, 250 300, 210 210 Z',
        'M560 140 C 630 110, 720 130, 760 190 C 790 236, 740 280, 670 270 C 600 260, 540 200, 560 140 Z',
        'M140 500 C 210 460, 300 470, 340 530 C 372 576, 310 620, 230 610 C 160 600, 120 550, 140 500 Z',
        'M640 500 C 720 470, 820 500, 860 560 C 886 600, 820 640, 740 630 C 670 620, 610 550, 640 500 Z'
      ].map((d) => (
        <path key={d} d={d} fill="none" stroke="#C4A35A" strokeOpacity="0.16" strokeWidth="1.1" />
      ))}
      <circle cx="500" cy="360" r="86" fill="none" stroke="#F7F5F0" strokeOpacity="0.08" />
      <circle cx="500" cy="360" r="34" fill="rgba(196,163,90,0.08)" stroke="#C4A35A" strokeOpacity="0.28" />
      <text
        x="500"
        y="356"
        textAnchor="middle"
        fill="#F7F5F0"
        fillOpacity="0.72"
        fontSize="11"
        letterSpacing="2.4"
        fontFamily="Source Sans 3, sans-serif"
      >
        HQ
      </text>
      <text
        x="500"
        y="372"
        textAnchor="middle"
        fill="#C4A35A"
        fillOpacity="0.7"
        fontSize="9"
        letterSpacing="1.6"
        fontFamily="Source Sans 3, sans-serif"
      >
        COMMAND COMPOUND
      </text>
      <text x="430" y="92" fill="#F7F5F0" fillOpacity="0.38" fontSize="11" letterSpacing="3" fontFamily="Source Sans 3, sans-serif">
        NORTH RIDGE
      </text>
      <text x="780" y="220" fill="#F7F5F0" fillOpacity="0.32" fontSize="11" letterSpacing="2.4" fontFamily="Source Sans 3, sans-serif">
        EAST CORRIDOR
      </text>
      <text x="120" y="660" fill="#F7F5F0" fillOpacity="0.32" fontSize="11" letterSpacing="2.4" fontFamily="Source Sans 3, sans-serif">
        WEST MARSH
      </text>
      <text x="620" y="670" fill="#F7F5F0" fillOpacity="0.32" fontSize="11" letterSpacing="2.4" fontFamily="Source Sans 3, sans-serif">
        SOUTH GATE
      </text>
      <rect width="1000" height="700" fill="url(#ops-vignette)" />
    </svg>
  );
}

function StatusPip({ status }) {
  const tone = STATUS_TONE[status] || STATUS_TONE.Standby;
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${tone.pip}`} />;
}

export default function OperationsBoard() {
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState(UNITS[0].id);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [aars, setAars] = useState(INITIAL_AARS);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const visibleUnits = useMemo(
    () =>
      UNITS.filter((unit) => {
        const statusOk = statusFilter === 'All' || unit.status === statusFilter;
        const sectorOk = sectorFilter === 'All' || unit.sector === sectorFilter;
        return statusOk && sectorOk;
      }),
    [sectorFilter, statusFilter]
  );

  const selected = useMemo(
    () => UNITS.find((unit) => unit.id === selectedId) || visibleUnits[0] || UNITS[0],
    [selectedId, visibleUnits]
  );

  const readyCount = UNITS.filter((unit) => unit.status === 'Ready').length;
  const deployedCount = UNITS.filter((unit) => unit.status === 'Deployed').length;

  function handleAddNote(event) {
    event.preventDefault();
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title || !body) {
      return;
    }

    setAars((current) => [
      {
        id: `aar-${Date.now()}`,
        title,
        unit: selected.callsign,
        date: formatToday(),
        body
      },
      ...current
    ]);
    setNoteTitle('');
    setNoteBody('');
  }

  const slideTransition = (delay) =>
    reduceMotion
      ? { duration: 0 }
      : { ...panelSpring, delay };

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-5 max-w-3xl">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">Operations Board</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Tactical overlay for the command compound. Unit marks, sector filters, and after-action notes
          are kept on this table for the duty officer.
        </p>
      </header>

      <div className="flex flex-col gap-4 lg:relative lg:h-[calc(100vh-12.5rem)] lg:min-h-[36rem]">
        <motion.div
          className="z-20 rounded-2xl border border-navy/10 bg-white/80 p-3 shadow-glass backdrop-blur-xl lg:absolute lg:left-3 lg:right-3 lg:top-3"
          initial={reduceMotion ? false : { y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={slideTransition(0.04)}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-h-10 min-w-[9rem] rounded-xl border border-navy/10 bg-white px-3 text-sm font-medium text-navy outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                >
                  <option value="All">All statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Sector
                <select
                  value={sectorFilter}
                  onChange={(event) => setSectorFilter(event.target.value)}
                  className="min-h-10 min-w-[9rem] rounded-xl border border-navy/10 bg-white px-3 text-sm font-medium text-navy outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                >
                  <option value="All">All sectors</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hidden items-center gap-2 pb-2 text-xs text-slate-500 sm:flex">
                <Filter className="h-3.5 w-3.5 text-gold" strokeWidth={1.75} />
                {visibleUnits.length} of {UNITS.length} marks shown
              </p>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Map legend">
              {STATUSES.map((status) => (
                <li
                  key={status}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[status].plate}`}
                >
                  <StatusPip status={status} />
                  {status}
                </li>
              ))}
              <li className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-2.5 py-1 text-xs font-medium text-navy">
                <Compass className="h-3.5 w-3.5 text-gold" strokeWidth={1.75} />
                Compound overlay
              </li>
            </ul>
          </div>
        </motion.div>

        <div className="relative min-h-[22rem] overflow-hidden rounded-2xl border border-navy/20 bg-navy-mid shadow-[0_24px_48px_rgba(11,31,58,0.18)] lg:h-full">
          <TacticalMapField />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.11]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(247,245,240,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,245,240,0.7) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute left-3 top-3 hidden rounded-lg border border-ivory/10 bg-navy/40 px-2.5 py-2 text-[0.62rem] uppercase tracking-[0.16em] text-ivory/70 lg:block">
            <span className="block text-gold/80">Scale</span>
            <span>1 : compound</span>
          </div>
          <div className="sr-only">
            Topographic operations table for the W.L.R command compound. Select a unit mark to review its roster entry.
          </div>
          {visibleUnits.map((unit, index) => {
            const isSelected = selected.id === unit.id;
            return (
              <motion.button
                key={unit.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${unit.callsign}, ${unit.status}, ${unit.sector} sector`}
                onClick={() => setSelectedId(unit.id)}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
                initial={reduceMotion ? false : { y: -36, opacity: 0, scale: 0.55 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { ...pinSpring, delay: 0.18 + index * 0.07 }
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`relative grid h-4 w-4 place-items-center rounded-full border-2 shadow-sm ${
                      isSelected ? 'border-gold bg-ivory' : 'border-gold/80 bg-navy'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[unit.status].pip}`} />
                  </span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[0.68rem] font-semibold tracking-[0.08em] shadow-sm ${
                      isSelected
                        ? 'border-gold bg-navy text-ivory'
                        : 'border-ivory/20 bg-ivory/92 text-navy'
                    }`}
                  >
                    {unit.callsign}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <motion.aside
          className="z-20 flex max-h-[28rem] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white/85 shadow-glass backdrop-blur-xl lg:absolute lg:bottom-36 lg:right-3 lg:top-24 lg:max-h-none lg:w-[20.5rem]"
          initial={reduceMotion ? false : { x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={slideTransition(0.12)}
          aria-label="Unit roster"
        >
          <div className="flex items-center gap-2 border-b border-navy/10 px-4 py-3">
            <Users className="h-4 w-4 text-gold" strokeWidth={1.75} />
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Roster</p>
              <h2 className="text-sm font-semibold text-navy">Selected unit</h2>
            </div>
          </div>
          <div className="border-b border-navy/10 px-4 py-3">
            <p className="text-lg font-semibold tracking-tight text-navy">{selected.callsign}</p>
            <p className="mt-0.5 text-xs text-slate-500">{selected.role}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-navy/10 bg-ivory/80 px-2.5 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">Status</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                  <StatusPip status={selected.status} />
                  {selected.status}
                </dd>
              </div>
              <div className="rounded-xl border border-navy/10 bg-ivory/80 px-2.5 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">Sector</dt>
                <dd className="mt-1 font-semibold text-navy">{selected.sector}</dd>
              </div>
              <div className="rounded-xl border border-navy/10 bg-ivory/80 px-2.5 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">Strength</dt>
                <dd className="mt-1 font-semibold text-navy">{selected.strength} personnel</dd>
              </div>
              <div className="rounded-xl border border-navy/10 bg-ivory/80 px-2.5 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">Officer</dt>
                <dd className="mt-1 font-semibold text-navy">{selected.commander}</dd>
              </div>
            </dl>
          </div>
          <ul className="flex-1 space-y-1 overflow-auto p-2">
            {visibleUnits.map((unit) => {
              const active = unit.id === selected.id;
              return (
                <li key={unit.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(unit.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                      active ? 'bg-navy/[0.07] text-navy' : 'text-slate-600 hover:bg-ivory'
                    }`}
                  >
                    <span>
                      <span className="block font-semibold">{unit.callsign}</span>
                      <span className="block text-[0.68rem] text-slate-400">
                        {unit.sector} · {unit.strength}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium">
                      <StatusPip status={unit.status} />
                      {unit.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-navy/10 px-4 py-2.5 text-[0.68rem] text-slate-400">
            {readyCount} ready · {deployedCount} deployed
          </p>
        </motion.aside>

        <motion.section
          className="z-20 rounded-2xl border border-navy/10 bg-white/85 shadow-glass backdrop-blur-xl lg:absolute lg:bottom-3 lg:left-3 lg:right-[22rem]"
          initial={reduceMotion ? false : { y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={slideTransition(0.2)}
          aria-labelledby="aar-heading"
        >
          <div className="flex items-center gap-2 border-b border-navy/10 px-4 py-3">
            <BookOpen className="h-4 w-4 text-gold" strokeWidth={1.75} />
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">After-action</p>
              <h2 id="aar-heading" className="text-sm font-semibold text-navy">
                Review notes
              </h2>
            </div>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
            <ol className="max-h-44 space-y-2 overflow-auto pr-1">
              {aars.map((note) => (
                <li key={note.id} className="rounded-xl border border-navy/10 bg-ivory/70 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-navy">{note.title}</p>
                    <p className="text-[0.68rem] uppercase tracking-[0.1em] text-slate-400">{note.date}</p>
                  </div>
                  <p className="mt-1 text-[0.68rem] font-medium text-gold">{note.unit}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{note.body}</p>
                </li>
              ))}
            </ol>
            <form onSubmit={handleAddNote} className="grid gap-2">
              <label className="grid gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Title
                <input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  required
                  maxLength={80}
                  placeholder={`Note for ${selected.callsign}`}
                  className="min-h-10 rounded-xl border border-navy/10 bg-white px-3 text-sm font-medium text-navy outline-none placeholder:text-slate-400 focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />
              </label>
              <label className="grid gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Body
                <textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  required
                  rows={3}
                  placeholder="Record the action, time, and recommendation."
                  className="resize-y rounded-xl border border-navy/10 bg-white px-3 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-3 text-sm font-semibold text-ivory transition-colors hover:bg-navy-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add note
              </button>
            </form>
          </div>
        </motion.section>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Shield className="h-3.5 w-3.5 text-gold" strokeWidth={1.75} />
        Marks are an institutional overlay for duty use. They do not replace a sealed movement order.
        <MapPinned className="hidden h-3.5 w-3.5 sm:inline" strokeWidth={1.75} />
      </p>
    </section>
  );
}
