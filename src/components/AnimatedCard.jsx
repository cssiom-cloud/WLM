import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, FileText, X } from 'lucide-react';
import { formatPersonnelName } from './GlobalLayout.jsx';

const easeOut = [0.22, 1, 0.36, 1];

function initialsFromPerson(person) {
  if (person?.initials) {
    return person.initials;
  }
  return (
    formatPersonnelName(person)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'WL'
  );
}

function cardLayoutId(id) {
  return `dossier-card-${id}`;
}

function avatarLayoutId(id) {
  return `dossier-avatar-${id}`;
}

function PersonnelAvatar({ person, layoutId, size = 'card' }) {
  const plateClass =
    size === 'modal'
      ? 'h-20 w-20 text-lg sm:h-24 sm:w-24 sm:text-xl'
      : 'h-16 w-16 text-sm';
  const sharedClass = `grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold/40 bg-navy font-semibold tracking-[0.12em] text-ivory shadow-sm ${plateClass}`;

  if (person.avatar_url) {
    return (
      <motion.img
        layoutId={layoutId}
        src={person.avatar_url}
        alt=""
        className={`${sharedClass} object-cover`}
      />
    );
  }

  return (
    <motion.div layoutId={layoutId} className={sharedClass} aria-hidden="true">
      {initialsFromPerson(person)}
    </motion.div>
  );
}

function CardFace({ person, showAvatarLayout = false, isActive = false }) {
  const name = formatPersonnelName(person) || 'Unassigned name';

  return (
    <div className="flex h-full flex-col p-5">
      <PersonnelAvatar
        person={person}
        layoutId={showAvatarLayout ? avatarLayoutId(person.id) : undefined}
      />
      <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-gold">
        {person.military_rank || 'Personnel'}
      </p>
      <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-navy">{name}</h2>
      <p className="mt-1 text-sm text-slate-500">{person.organization_role || 'Command assignment'}</p>
      {person.unit ? <p className="mt-3 text-xs font-medium text-slate-400">{person.unit}</p> : null}
      {isActive ? (
        <p className="mt-auto pt-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gold">
          Active session
        </p>
      ) : (
        <p className="mt-auto pt-4 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-400">
          Open dossier
        </p>
      )}
    </div>
  );
}

function DossierStat({ label, value }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-ivory/80 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

export function DossierModal({ person, onClose }) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const titleId = useId();
  const [detailsReady, setDetailsReady] = useState(Boolean(reducedMotion));
  const name = formatPersonnelName(person) || 'Unassigned name';

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (reducedMotion) {
      setDetailsReady(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setDetailsReady(true), 420);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  function revealDetails() {
    setDetailsReady(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
      <motion.button
        type="button"
        aria-label="Close dossier"
        className="absolute inset-0 bg-navy/35 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        onClick={onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        layoutId={cardLayoutId(person.id)}
        onLayoutAnimationComplete={revealDetails}
        onAnimationComplete={revealDetails}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-glass outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5 sm:px-8">
          <div className="flex min-w-0 items-start gap-4">
            <PersonnelAvatar person={person} layoutId={avatarLayoutId(person.id)} size="modal" />
            <div className="min-w-0 pt-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold">
                {person.military_rank || 'Personnel'}
              </p>
              <h2 id={titleId} className="mt-1 truncate text-2xl font-semibold tracking-tight text-navy">
                {name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{person.organization_role || 'Command assignment'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-navy/10 bg-ivory text-navy transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            aria-label="Close dossier"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <motion.div
          initial={false}
          animate={detailsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.36, ease: easeOut }}
          className="px-6 py-6 sm:px-8"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DossierStat label="Unit" value={person.unit || 'Command Personnel'} />
            <DossierStat label="Status" value={person.status || 'Active'} />
            <DossierStat label="Service entered" value={person.enlisted_on || 'On file'} />
            <DossierStat label="Current assignment" value={person.assignment_since || 'Current tour'} />
          </div>

          <div className="mt-6 rounded-2xl border border-navy/10 bg-ivory/70 px-5 py-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Service record
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {person.notes ||
                `${name} is carried on the command personnel register. Correspondence and operational tasking issued from this session will cite the rank and assignment on file.`}
            </p>
            {person.clearance ? (
              <p className="mt-3 text-xs font-medium text-slate-500">
                Record classification: {person.clearance}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/operations');
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-navy-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
              View operations
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/documents');
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-navy/10 bg-white px-4 text-sm font-semibold text-navy transition-colors duration-200 hover:bg-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Official document
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-navy/10 bg-ivory px-5 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-white hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AnimatedCard({ person, isSelected = false, isActive = false, onOpen }) {
  const name = formatPersonnelName(person) || 'Unassigned name';
  const reducedMotion = useReducedMotion();

  if (isSelected) {
    return (
      <div className="invisible pointer-events-none" aria-hidden="true">
        <div className="min-h-[17.5rem] rounded-2xl border border-navy/10 bg-white/80">
          <CardFace person={person} isActive={isActive} />
        </div>
      </div>
    );
  }

  return (
    <motion.article
      layoutId={cardLayoutId(person.id)}
      role="button"
      tabIndex={0}
      aria-label={`Open dossier for ${person.military_rank || ''} ${name}`.trim()}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      whileHover={reducedMotion ? undefined : { y: -5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="min-h-[17.5rem] cursor-pointer overflow-hidden rounded-2xl border border-navy/10 bg-white/80 shadow-glass backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <CardFace person={person} showAvatarLayout isActive={isActive} />
    </motion.article>
  );
}
