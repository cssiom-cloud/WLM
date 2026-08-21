import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function AnimatedCard({
  name = 'Unassigned name',
  rank = '',
  role = '',
  avatarUrl = '',
  onClick,
  actionLabel = 'Open dossier'
}) {
  const cardRef = useRef(null);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer =
    typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [14, -14]), {
    stiffness: 180,
    damping: 18,
    mass: 0.4
  });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-16, 16]), {
    stiffness: 180,
    damping: 18,
    mass: 0.4
  });
  const glareX = useTransform(pointerX, [0, 1], ['78%', '18%']);
  const glareY = useTransform(pointerY, [0, 1], ['72%', '22%']);
  const glareBackground = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.34), transparent 46%)`;

  function handlePointerMove(event) {
    if (reduceMotion || coarsePointer || !cardRef.current) {
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <motion.article
      ref={cardRef}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        rotateX: reduceMotion || coarsePointer ? 0 : rotateX,
        rotateY: reduceMotion || coarsePointer ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 920
      }}
      className="group relative isolate cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
    >
      <motion.div
        aria-hidden="true"
        style={{ background: glareBackground }}
        className="pointer-events-none absolute inset-0 z-20 mix-blend-soft-light opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" style={{ transform: 'translateZ(24px)' }} />
        ) : (
          <div className="grid h-full place-items-center text-4xl font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-300">
            {initialsFromName(name) || 'WLR'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent p-4 pt-12 text-white">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-indigo-200">
            {rank || 'Unassigned rank'}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{name}</h2>
        </div>
      </div>
      <div className="relative z-10 space-y-3 p-4" style={{ transform: 'translateZ(18px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400">{role || 'Personnel file'}</p>
        <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {actionLabel}
        </span>
      </div>
    </motion.article>
  );
}
