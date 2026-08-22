import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function AvatarFace({ id, name, avatarUrl, className }) {
  if (avatarUrl) {
    return <motion.img layoutId={`avatar-${id}`} src={avatarUrl} alt="" className={className} />;
  }

  return (
    <motion.div
      layoutId={`avatar-${id}`}
      className={`grid place-items-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 text-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:text-slate-300 ${className}`}
    >
      <span className="text-3xl font-semibold tracking-[0.12em]">{initialsFromName(name) || 'WLR'}</span>
    </motion.div>
  );
}

export function DossierOverlay({ person, lang = 'en', onClose }) {
  useEffect(() => {
    if (!person) {
      return undefined;
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, person]);

  const copy =
    lang === 'th'
      ? {
          close: 'ปิดแฟ้ม',
          dossier: 'แฟ้มกำลังพล',
          rank: 'ยศ',
          role: 'ตำแหน่ง',
          name: 'ชื่อ',
          acknowledge: 'รับทราบ',
          archive: 'จัดเก็บสำเนา'
        }
      : {
          close: 'Close dossier',
          dossier: 'Personnel dossier',
          rank: 'Rank',
          role: 'Role',
          name: 'Name',
          acknowledge: 'Acknowledge',
          archive: 'File a copy'
        };

  return (
    <AnimatePresence>
      {person ? (
        <div key={person.id} className="fixed inset-0 z-40">
          <motion.button
            type="button"
            aria-label={copy.close}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            onClick={onClose}
          />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <motion.article
              layoutId={`card-${person.id}`}
              className="pointer-events-auto relative w-[min(94vw,64rem)] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/92 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88"
            >
              <AvatarFace
                id={person.id}
                name={person.name}
                avatarUrl={person.avatarUrl}
                className="absolute left-6 top-6 h-28 w-28 rounded-2xl object-cover shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
              />

              <motion.div
                className="min-h-[22rem] px-6 pb-7 pl-[10.5rem] pr-7 pt-7 sm:pl-44"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.36, ease }}
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.dossier}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {person.name}
                </h2>

                <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.name}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{person.name}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.rank}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {person.rank || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.role}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {person.role || '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white dark:bg-indigo-300 dark:text-slate-900"
                  >
                    {copy.acknowledge}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    {copy.archive}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-slate-500"
                  >
                    {copy.close}
                  </button>
                </div>
              </motion.div>
            </motion.article>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export default function AnimatedCard({
  id,
  name = 'Unassigned name',
  rank = '',
  role = '',
  avatarUrl = '',
  onClick,
  actionLabel = 'Open dossier'
}) {
  return (
    <motion.article
      layoutId={`card-${id}`}
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
      whileHover={{ y: -5 }}
      transition={{ duration: 0.28, ease }}
      className="group relative isolate cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
    >
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
        <AvatarFace id={id} name={name} avatarUrl={avatarUrl} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent p-4 pt-12 text-white">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-indigo-200">
            {rank || 'Unassigned rank'}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{name}</h2>
        </div>
      </div>
      <div className="relative z-10 space-y-3 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{role || 'Personnel file'}</p>
        <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {actionLabel}
        </span>
      </div>
    </motion.article>
  );
}
