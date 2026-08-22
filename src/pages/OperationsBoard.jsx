import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'Operations',
    title: 'Tactical Board',
    lead: 'Official theatre plot for assigned units. Pins mark current stationing on the command chart.',
    tools: 'Command tools',
    toolsLead: 'Filter the plot, inspect a unit, and review filed operations.',
    operations: 'Filed operations',
    units: 'Stationed units',
    selected: 'Selected unit',
    none: 'Select a pin on the chart to inspect the unit file.',
    status: 'Status',
    all: 'All',
    refresh: 'Refresh plot',
    mock: 'Official stand-in chart — live operations could not be loaded.',
    live: 'Live command channel',
    empty: 'No operations are filed for this watch.'
  },
  th: {
    kicker: 'ปฏิบัติการ',
    title: 'บอร์ดปฏิบัติการ',
    lead: 'แผนที่ราชการสำหรับหน่วยที่ได้รับมอบหมาย จุดหมุดแสดงที่ตั้งปัจจุบันบนแผนบัญชาการ',
    tools: 'เครื่องมือบัญชาการ',
    toolsLead: 'กรองแผนที่ ตรวจสอบหน่วย และตรวจปฏิบัติการที่บันทึกไว้',
    operations: 'ปฏิบัติการที่บันทึก',
    units: 'หน่วยที่ประจำการ',
    selected: 'หน่วยที่เลือก',
    none: 'เลือกจุดหมุดบนแผนเพื่อเปิดแฟ้มหน่วย',
    status: 'สถานะ',
    all: 'ทั้งหมด',
    refresh: 'รีเฟรชแผน',
    mock: 'แผนสำรองราชการ — ไม่สามารถโหลดปฏิบัติการสดได้',
    live: 'ช่องบัญชาการสด',
    empty: 'ยังไม่มีปฏิบัติการในเวรนี้'
  }
};

const MOCK_OPERATIONS = [
  {
    id: 'mock-op-harbor',
    title: 'Harbor Defense Drill',
    status: 'active',
    briefing: 'Combined Navy and Marines harbor watch. Report to the assigned staging area on time.'
  },
  {
    id: 'mock-op-fleet',
    title: 'Joint Fleet Training Exercise',
    status: 'planning',
    briefing: 'Formation and escort evaluation under White Lion Regiment charter.'
  },
  {
    id: 'mock-op-academy',
    title: 'Naval Academy Open Evaluation',
    status: 'completed',
    briefing: 'Evaluation session for academy students and trainers. Seats were limited.'
  }
];

const MOCK_UNITS = [
  { id: 'qld', name: "The Queen's Lion Divisions", code: 'QLD', x: 22, y: 28, status: 'ready' },
  { id: 'nmrs', name: 'Naval Medical and Rescue Service', code: 'NMRS', x: 48, y: 34, status: 'standby' },
  { id: 'sub9', name: '9TH Submarine Fleet', code: '9TH', x: 68, y: 22, status: 'deployed' },
  { id: 'hr220', name: '220TH Heavy Recon Royal Marines', code: '220TH', x: 34, y: 58, status: 'ready' },
  { id: 'sawa', name: 'Anti-Submarine Warfare', code: 'SAWA', x: 72, y: 56, status: 'standby' },
  { id: 'csgf', name: 'Carrier Strike Group Fleet', code: 'CSGF', x: 54, y: 72, status: 'deployed' }
];

const STATUS_FILTERS = ['all', 'planning', 'active', 'completed'];

function placePins(rows) {
  return rows.map((unit, index) => {
    if (Number.isFinite(unit.x) && Number.isFinite(unit.y)) {
      return unit;
    }
    const angle = (index / Math.max(rows.length, 1)) * Math.PI * 1.75 + 0.35;
    const radius = 18 + (index % 4) * 8;
    return {
      ...unit,
      code: unit.code || unit.name?.match(/\(([^)]+)\)/)?.[1] || `U${index + 1}`,
      x: Math.min(88, Math.max(10, 50 + Math.cos(angle) * radius * 1.2)),
      y: Math.min(82, Math.max(14, 48 + Math.sin(angle) * radius * 0.82)),
      status: unit.status || (index % 3 === 0 ? 'deployed' : index % 3 === 1 ? 'ready' : 'standby')
    };
  });
}

export default function OperationsBoard() {
  const { supabase, lang, activePersonnel } = useCommand();
  const copy = COPY[lang] || COPY.en;
  const [operations, setOperations] = useState([]);
  const [units, setUnits] = useState([]);
  const [source, setSource] = useState('live');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const [opsResult, unitsResult] = await Promise.all([
        supabase
          .from('oc_operations')
          .select('id, title, briefing, status, map_url, created_at')
          .order('created_at', { ascending: false })
          .limit(16),
        supabase.from('command_units').select('id, name, content, sort_order').order('sort_order', { ascending: true })
      ]);

      const liveOps = !opsResult.error && Array.isArray(opsResult.data) ? opsResult.data : [];
      const liveUnits = !unitsResult.error && Array.isArray(unitsResult.data) ? unitsResult.data : [];
      const usedMock = Boolean(opsResult.error || unitsResult.error) || (!liveOps.length && !liveUnits.length);

      setOperations(liveOps.length ? liveOps : MOCK_OPERATIONS);
      setUnits(placePins(liveUnits.length ? liveUnits : MOCK_UNITS));
      setSource(usedMock ? 'mock' : 'live');
    } catch {
      setOperations(MOCK_OPERATIONS);
      setUnits(placePins(MOCK_UNITS));
      setSource('mock');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const filteredOperations = useMemo(() => {
    if (statusFilter === 'all') {
      return operations;
    }
    return operations.filter((row) => String(row.status || '').toLowerCase() === statusFilter);
  }, [operations, statusFilter]);

  const selectedUnit = units.find((unit) => unit.id === selectedId) || null;
  const isAdmin = activePersonnel?.role === 'admin';

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.kicker}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy.lead}</p>
        <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {source === 'mock' ? copy.mock : copy.live}
        </p>
      </header>

      <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative min-h-[34rem] overflow-hidden rounded-3xl border border-slate-200/80 bg-[#e8e4d8] shadow-[0_24px_60px_rgba(28,25,23,0.08)] dark:border-white/10 dark:bg-[#1b212b]">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(rgba(71,85,105,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(71,85,105,0.12) 1px, transparent 1px)',
              backgroundSize: '36px 36px'
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-6 rounded-2xl border border-slate-400/20 dark:border-white/8"
          />
          <div className="absolute left-6 top-6 z-10 rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300">
            {copy.units} · {units.length}
          </div>

          <div className="absolute inset-0">
            {units.map((unit, index) => (
              <motion.div
                key={unit.id}
                className="absolute z-10"
                style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.6, delay: index * 0.05 }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(unit.id)}
                  className={`-translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] shadow-lg backdrop-blur-xl transition ${
                    selectedId === unit.id
                      ? 'border-indigo-400 bg-indigo-700 text-white'
                      : 'border-white/70 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100'
                  }`}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current opacity-70" />
                  {unit.code || unit.name}
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.aside
          className="relative z-20 mt-4 flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:mt-0 lg:rounded-l-none dark:border-white/10 dark:bg-slate-950/70"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isAdmin ? copy.tools : copy.tools}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{copy.tools}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{copy.toolsLead}</p>
          </div>

          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.status}</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`min-h-9 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.1em] ${
                    statusFilter === status
                      ? 'bg-indigo-700 text-white dark:bg-indigo-300 dark:text-slate-900'
                      : 'border border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {status === 'all' ? copy.all : status}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={loadBoard}
            disabled={loading}
            className="min-h-11 rounded-xl border border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            {copy.refresh}
          </button>

          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.selected}</p>
            {selectedUnit ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{selectedUnit.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{selectedUnit.code}</p>
                <p className="mt-2 text-sm text-slate-500">{selectedUnit.content || selectedUnit.status || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{copy.none}</p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.operations}</p>
            {filteredOperations.length ? (
              <ul className="grid gap-2">
                {filteredOperations.map((operation) => (
                  <li
                    key={operation.id}
                    className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{operation.title}</p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                      {operation.status || 'filed'}
                    </p>
                    {operation.briefing ? (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-500">{operation.briefing}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{copy.empty}</p>
            )}
          </div>
        </motion.aside>
      </div>
    </section>
  );
}
