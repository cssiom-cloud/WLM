import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'W.L.R Command Personnel',
    title: 'Select a personnel file',
    lead: 'Choose the official record that will represent you inside the command portal.',
    emptyTitle: 'No personnel files are assigned',
    emptyLead:
      'This account has no owned personnel records. Return to the portal or request assignment from command administration.',
    back: 'Return to the official portal',
    active: 'Active file',
    select: 'Assume this file',
    selecting: 'Confirming assignment',
    denied: 'The personnel file could not be assigned. Try again.'
  },
  th: {
    kicker: 'W.L.R Command Personnel',
    title: 'เลือกแฟ้มกำลังพล',
    lead: 'เลือกแฟ้มราชการที่จะใช้เป็นตัวแทนของท่านในพอร์ทัลศูนย์บัญชาการ',
    emptyTitle: 'ยังไม่มีแฟ้มกำลังพลในบัญชีนี้',
    emptyLead: 'บัญชีนี้ยังไม่มีแฟ้มกำลังพลในครอบครอง โปรดกลับสู่พอร์ทัลหรือแจ้งฝ่ายบริหารกำลังพล',
    back: 'กลับสู่พอร์ทัลราชการ',
    active: 'แฟ้มที่ใช้อยู่',
    select: 'ใช้แฟ้มนี้',
    selecting: 'กำลังยืนยันการมอบหมาย',
    denied: 'ไม่สามารถกำหนดแฟ้มกำลังพลได้ โปรดลองอีกครั้ง'
  }
};

const ease = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.48, ease } }
};

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function PersonnelCard({ row, name, isActive, isDimmed, copy, busy, onSelect, onHoverChange }) {
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [11, -11]), {
    stiffness: 220,
    damping: 18,
    mass: 0.38
  });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-13, 13]), {
    stiffness: 220,
    damping: 18,
    mass: 0.38
  });

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
    onHoverChange(null);
  }

  return (
    <motion.div variants={cardVariants}>
      <motion.article
        animate={{ opacity: isDimmed ? 0.3 : 1 }}
        transition={{ duration: 0.28, ease }}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 980 }}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => onHoverChange(row.id)}
        onPointerLeave={handlePointerLeave}
        className="group relative overflow-hidden rounded-3xl border border-white/12 bg-slate-950/40 shadow-[0_0_0_1px_rgba(148,163,184,0.1),0_24px_60px_rgba(8,12,20,0.28)] backdrop-blur-xl"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelect(row.id)}
          className="flex w-full flex-col text-left disabled:cursor-wait"
        >
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
            {row.avatar_url ? (
              <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-4xl font-semibold tracking-[0.14em] text-slate-300">
                {initialsFromName(name) || 'WLR'}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-5 pt-16">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {row.military_rank || '—'}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-50">{name}</h2>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-400">{row.organization_role || copy.select}</p>
            <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-sm font-semibold text-slate-100">
              {busy ? copy.selecting : isActive ? copy.active : copy.select}
            </span>
          </div>
        </button>
      </motion.article>
    </motion.div>
  );
}

export default function CharacterSelect() {
  const { profiles, activePersonnel, setActivePersonnel, formatPersonnelName, lang } = useCommand();
  const navigate = useNavigate();
  const copy = COPY[lang] || COPY.en;
  const [hoveredId, setHoveredId] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function handleSelect(personnelId) {
    if (busyId) {
      return;
    }
    setError('');
    setBusyId(personnelId);
    try {
      await setActivePersonnel(personnelId);
      navigate('/', { replace: true });
    } catch (selectError) {
      setBusyId('');
      setError(selectError?.message || copy.denied);
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#10151c] px-4 py-10 text-slate-100 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(100,116,139,0.18),transparent_48%),linear-gradient(180deg,#0c1117_0%,#141b24_100%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-10 max-w-2xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.kicker}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{copy.lead}</p>
        </header>

        {error ? (
          <p className="mb-6 text-sm text-rose-200/90" role="alert">
            {error}
          </p>
        ) : null}

        {profiles.length ? (
          <motion.div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            style={{ perspective: 1200 }}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {profiles.map((row) => {
              const name = formatPersonnelName(row) || 'Unassigned name';
              return (
                <PersonnelCard
                  key={row.id}
                  row={row}
                  name={name}
                  isActive={activePersonnel?.id === row.id}
                  isDimmed={Boolean(hoveredId) && hoveredId !== row.id}
                  copy={copy}
                  busy={Boolean(busyId)}
                  onSelect={handleSelect}
                  onHoverChange={setHoveredId}
                />
              );
            })}
          </motion.div>
        ) : (
          <motion.section
            className="max-w-xl rounded-3xl border border-white/12 bg-slate-950/40 p-8 shadow-[0_24px_60px_rgba(8,12,20,0.28)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <h2 className="text-xl font-semibold text-slate-50">{copy.emptyTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{copy.emptyLead}</p>
            <Link
              to="/"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 no-underline"
            >
              {copy.back}
            </Link>
          </motion.section>
        )}
      </div>
    </div>
  );
}
