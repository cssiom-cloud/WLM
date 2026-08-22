import { useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { displayRankName, formatPersonnelName, useAuth } from '../components/GlobalLayout.jsx';

const listVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.18
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] }
  }
};

function initialsFromPerson(row) {
  if (row?.initials) {
    return row.initials;
  }
  return (
    formatPersonnelName(row)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'WL'
  );
}

function ProfileSelectCard({ row, dimmed, reducedMotion, onHoverChange, onSelect }) {
  const cardRef = useRef(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 220, damping: 22, mass: 0.4 });
  const springY = useSpring(rotateY, { stiffness: 220, damping: 22, mass: 0.4 });
  const name = formatPersonnelName(row);
  const rankName = displayRankName(row);

  function handlePointerMove(event) {
    if (reducedMotion || !cardRef.current) {
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateX.set((0.5 - py) * 8);
    rotateY.set((px - 0.5) * 10);
  }

  function resetTilt() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div variants={cardVariants} className="h-full">
      <motion.div
        animate={{ opacity: dimmed ? 0.7 : 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="h-full"
      >
        <motion.button
          ref={cardRef}
          type="button"
          onClick={() => onSelect(row.id)}
          onPointerEnter={() => onHoverChange(row.id)}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            resetTilt();
            onHoverChange(null);
          }}
          onFocus={() => onHoverChange(row.id)}
          onBlur={() => {
            resetTilt();
            onHoverChange(null);
          }}
          style={{
            rotateX: reducedMotion ? 0 : springX,
            rotateY: reducedMotion ? 0 : springY,
            transformPerspective: 800,
            transformStyle: 'preserve-3d'
          }}
          className="group flex h-full min-h-[22rem] w-full flex-col rounded-2xl border border-navy/10 bg-white/75 px-7 py-8 text-left shadow-glass backdrop-blur-xl transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          aria-label={`Select ${rankName}, ${row.organization_role || 'personnel'}`}
        >
          <span
            aria-hidden="true"
            className="grid h-20 w-20 place-items-center rounded-2xl border border-gold/40 bg-navy text-lg font-semibold tracking-[0.14em] text-ivory shadow-sm"
            style={{ transform: 'translateZ(18px)' }}
          >
            {initialsFromPerson(row)}
          </span>
          <p
            className="mt-8 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold"
            style={{ transform: 'translateZ(12px)' }}
          >
            {row.military_rank || 'Personnel'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-navy" style={{ transform: 'translateZ(14px)' }}>
            {name || rankName}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500" style={{ transform: 'translateZ(10px)' }}>
            {row.organization_role || 'Command assignment'}
          </p>
          <span
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-navy/10 bg-ivory/80 px-4 text-sm font-semibold text-navy transition-colors duration-200 group-hover:border-gold/40 group-hover:bg-white"
            style={{ transform: 'translateZ(16px)' }}
          >
            Continue as this officer
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default function CharacterSelect() {
  const { profiles, selectProfile, logout } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  async function handleSelect(personnelId) {
    if (pendingId) {
      return;
    }
    setPendingId(personnelId);
    await selectProfile(personnelId);
    navigate('/dashboard', { replace: true });
  }

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-ivory">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(11,31,58,0.06),transparent_62%)]" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-gold/[0.07] blur-[90px]" />
        <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-navy/[0.05] blur-[100px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-navy/10 bg-navy text-[0.62rem] font-semibold tracking-[0.14em] text-ivory shadow-sm">
            WLR
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[0.08em] text-navy">W.L.R</p>
            <p className="truncate text-xs font-medium text-slate-500">Command Personnel</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-navy/10 bg-white/75 px-3.5 text-sm font-semibold text-navy shadow-sm backdrop-blur-xl transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign out
        </button>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-6 sm:pt-10">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-gold">Session authority</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          Select the officer of record
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
          Choose a command profile before opening Eridian deployments. Records, clearances, and
          correspondence will be issued under the selected officer.
        </p>

        <motion.div
          className="mt-10 grid gap-5 sm:grid-cols-2"
          variants={listVariants}
          initial={reducedMotion ? false : 'hidden'}
          animate="show"
          onPointerLeave={() => setHoveredId(null)}
        >
          {profiles.map((row) => (
            <ProfileSelectCard
              key={row.id}
              row={row}
              dimmed={Boolean(hoveredId && hoveredId !== row.id)}
              reducedMotion={Boolean(reducedMotion)}
              onHoverChange={setHoveredId}
              onSelect={handleSelect}
            />
          ))}
        </motion.div>

        {pendingId ? (
          <p className="sr-only" role="status" aria-live="polite">
            Opening the personnel directory.
          </p>
        ) : null}
      </section>
    </main>
  );
}
