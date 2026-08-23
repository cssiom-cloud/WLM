import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  SKILL_KEYS,
  dossierSkills,
  dossierTimeline,
  personnelBiography,
  ribbonPalette,
  unitNameFor,
  unitRankFor
} from '../lib/dossier.js';

const ease = [0.22, 1, 0.36, 1];

export function originFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function overlayFrame() {
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  const leftNav = desktop ? 72 : 0;
  const topNav = 16;
  const bottomNav = desktop ? 16 : 76;
  const pad = 20;
  const availW = window.innerWidth - leftNav - pad * 2;
  const availH = window.innerHeight - topNav - bottomNav - pad;
  const width = Math.min(1120, availW);
  const height = Math.max(320, availH);
  return {
    left: leftNav + pad + Math.max(0, (availW - width) / 2),
    top: topNav,
    width,
    height
  };
}

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function AvatarFace({ name, avatarUrl, className }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={className} />;
  }

  return (
    <div
      className={`grid place-items-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 text-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:text-slate-300 ${className}`}
    >
      <span className="text-3xl font-semibold tracking-[0.12em]">{initialsFromName(name) || 'WLR'}</span>
    </div>
  );
}

function SkillRadar({ record, units, t }) {
  const skills = dossierSkills(record, units);
  const size = 268;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const axes = SKILL_KEYS.map((key, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / SKILL_KEYS.length;
    const value = skills[key] / 100;
    return {
      key,
      label: t(`dir.skill.${key}`),
      value: skills[key],
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
      ax: cx + Math.cos(angle) * radius,
      ay: cy + Math.sin(angle) * radius,
      lx: cx + Math.cos(angle) * (radius + 26),
      ly: cy + Math.sin(angle) * (radius + 26)
    };
  });
  const rings = [0.33, 0.66, 1].map((scale) =>
    SKILL_KEYS.map((_, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / SKILL_KEYS.length;
      return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
    }).join(' ')
  );
  const plot = axes.map((axis) => `${axis.x},${axis.y}`).join(' ');

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('dir.skills')}</h3>
      <svg className="mt-2 w-full max-w-xs" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('dir.skills')}>
        {rings.map((points) => (
          <polygon key={points} points={points} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" />
        ))}
        {axes.map((axis) => (
          <line key={axis.key} x1={cx} y1={cy} x2={axis.ax} y2={axis.ay} stroke="currentColor" className="text-slate-300 dark:text-slate-700" />
        ))}
        <polygon points={plot} fill="rgba(79,70,229,0.28)" stroke="#4f46e5" strokeWidth="2" />
        {axes.map((axis) => (
          <text key={axis.key} x={axis.lx} y={axis.ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[10px]">
            {axis.label}
          </text>
        ))}
      </svg>
    </section>
  );
}

function Ribbon({ name, kind }) {
  const [left, center, right] = ribbonPalette(name);
  return (
    <li className="flex items-center gap-2 rounded-xl border border-stone-300/80 bg-white/80 px-3 py-2 text-sm text-stone-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
      <span
        className="h-3 w-10 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${left} 0 28%, ${center} 28% 72%, ${right} 72% 100%)` }}
      />
      <span className="font-medium">{name}</span>
      <span className="ml-auto text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">{kind}</span>
    </li>
  );
}

export function DossierOverlay({
  record,
  person,
  origin = null,
  lang = 'en',
  t,
  units = [],
  ranks = [],
  bioPublic = true,
  canEdit = false,
  onClose,
  onEdit,
  onExport
}) {
  const row = record || person;
  const translate = t || ((key) => key);
  const name = person?.name || [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(' ').trim() || 'Unassigned name';
  const rank = person?.rank || row?.military_rank || '';
  const role = person?.role || row?.organization_role || '';
  const avatarUrl = person?.avatarUrl || row?.avatar_url || '';
  const cover = row?.cover_url || row?.banner_url || '';
  const history = row ? personnelBiography(row, bioPublic) : { paragraphIdentity: '', paragraphService: '' };
  const medals = Array.isArray(row?.medals) ? row.medals : [];
  const honors = Array.isArray(row?.honor_ranks) ? row.honor_ranks : [];
  const missions = Array.isArray(row?.completed_missions) ? row.completed_missions : [];
  const timeline = row ? dossierTimeline(row, translate) : [];
  const fleet = row ? unitNameFor(row, units) : '';
  const unitRank = row ? unitRankFor(row, ranks) : '';

  useEffect(() => {
    if (!row) {
      return undefined;
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    document.documentElement.classList.add('overlay-lock');
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.documentElement.classList.remove('overlay-lock');
    };
  }, [onClose, row]);

  const hostRef = useRef(null);
  const panelRef = useRef(null);
  const frame = useMemo(() => (typeof window === 'undefined' ? { left: 16, top: 16, width: 720, height: 640 } : overlayFrame()), [row?.id]);
  const start = origin && origin.width ? origin : { left: frame.left + 48, top: frame.top + 48, width: 240, height: 160 };
  const lift = {
    x: start.left - frame.left,
    y: start.top - frame.top,
    sx: start.width / Math.max(frame.width, 1),
    sy: start.height / Math.max(frame.height, 1)
  };
  const copy =
    lang === 'th'
      ? { close: 'ปิดแฟ้ม', dossier: 'แฟ้มกำลังพล', acknowledge: 'รับทราบ' }
      : { close: 'Close dossier', dossier: 'Personnel dossier', acknowledge: 'Acknowledge' };

  useEffect(() => {
    if (!row) {
      return undefined;
    }
    const node = panelRef.current || hostRef.current;
    if (node) {
      node.scrollTop = 0;
    }
    return undefined;
  }, [row]);

  function closeOverlay(event) {
    event?.stopPropagation?.();
    onClose?.();
  }

  return createPortal(
    <AnimatePresence>
      {row ? (
        <div key={row.id} ref={hostRef} className="pointer-events-none fixed inset-0 z-[110]">
          <motion.button
            type="button"
            aria-label={copy.close}
            className="pointer-events-auto absolute inset-0 bg-slate-950/60 backdrop-blur-sm lg:left-[72px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            onClick={closeOverlay}
          />
          <motion.article
            ref={panelRef}
            className="command-scroll pointer-events-auto z-10 overflow-y-auto overscroll-contain rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
            initial={{ x: lift.x, y: lift.y, scaleX: lift.sx, scaleY: lift.sy, opacity: 0.88 }}
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.42, ease }}
            style={{
              position: 'fixed',
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              transformOrigin: 'top left'
            }}
            onClick={(event) => event.stopPropagation()}
          >
              <div className="relative z-20">
                <div className="aspect-[16/9] overflow-hidden bg-stone-900">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover object-center" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <AvatarFace
                  name={name}
                  avatarUrl={avatarUrl}
                  className="absolute left-6 top-full z-20 h-28 w-28 -translate-y-1/2 rounded-2xl border-4 border-[var(--bg-elevated)] object-cover shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
                />
              </div>
              <div className="px-6 pb-8 pt-20 sm:px-8">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-stone-600 dark:text-slate-300">{copy.dossier}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-slate-50">{name}</h2>
                <p className="mt-1 text-sm text-stone-700 dark:text-slate-300">
                  {rank || '—'}
                  {role ? ` · ${role}` : ''}
                </p>
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_18rem]">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{translate('dir.assignment')}</h3>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          [translate('dir.fleet'), fleet || translate('units.unassigned')],
                          [translate('dir.unitRank'), unitRank || '—'],
                          [translate('units.serviceRank'), row.military_rank || '—'],
                          [translate('dir.deployment'), row.nationality || '—'],
                          ['Agency', row.wlc_agency || '—'],
                          [translate('dir.orgRole'), row.organization_role || '—']
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-stone-600 dark:text-slate-400">{label}</dt>
                            <dd className="mt-1 text-sm font-medium text-stone-800 dark:text-slate-200">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                    <section>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{translate('home.biography')}</h3>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-stone-700 dark:text-slate-300">
                        <p>{history.paragraphIdentity}</p>
                        {history.paragraphService ? <p>{history.paragraphService}</p> : null}
                      </div>
                    </section>
                    <section>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{translate('dir.timeline')}</h3>
                      {timeline.length ? (
                        <ol className="mt-3 space-y-3 border-l border-stone-300 pl-4 dark:border-white/10">
                          {timeline.map((event, index) => (
                            <li key={`${event.title}-${index}`}>
                              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-stone-600 dark:text-slate-400">
                                {event.detail || event.kind}
                                {event.date ? ` · ${event.date}` : ''}
                              </p>
                              <h4 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{event.title}</h4>
                              {event.description ? <p className="text-sm text-stone-700 dark:text-slate-300">{event.description}</p> : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-sm text-stone-600 dark:text-slate-400">{translate('dir.timelineEmpty')}</p>
                      )}
                    </section>
                  </div>
                  <div className="space-y-6">
                    <SkillRadar record={row} units={units} t={translate} />
                    <section>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{translate('dir.medals')}</h3>
                      {medals.length || honors.length ? (
                        <ul className="mt-2 grid gap-2">
                          {medals.map((medal) => (
                            <Ribbon key={medal} name={medal} kind={translate('dir.medals')} />
                          ))}
                          {honors.map((item) => (
                            <Ribbon key={item} name={item} kind={translate('dir.honorRanks')} />
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-stone-600 dark:text-slate-400">{translate('dir.noRecord')}</p>
                      )}
                    </section>
                    <section>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-slate-100">{translate('dir.missions')}</h3>
                      {missions.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700 dark:text-slate-300">
                          {missions.map((mission) => (
                            <li key={mission}>{mission}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-stone-600 dark:text-slate-400">{translate('dir.noRecord')}</p>
                      )}
                    </section>
                    {row.training_course ? (
                      <p className="text-sm text-stone-700 dark:text-slate-300">
                        {translate('dir.trainingCourse')}: {row.training_course}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3 border-t border-stone-200 pt-5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeOverlay}
                    className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)]"
                  >
                    {copy.acknowledge}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit?.();
                      }}
                      className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      {translate('common.edit')}
                    </button>
                  ) : null}
                  {onExport && row?.id ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onExport(row);
                      }}
                      className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      {translate('dir.export')}
                    </button>
                  ) : null}
                  <button type="button" onClick={closeOverlay} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-stone-700 dark:text-slate-300">
                    {copy.close}
                  </button>
                </div>
              </div>
            </motion.article>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
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
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [8, -8]), { stiffness: 220, damping: 18, mass: 0.38 });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-10, 10]), { stiffness: 220, damping: 18, mass: 0.38 });

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <motion.article
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
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 980 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.28, ease }}
      className="group relative isolate cursor-pointer overflow-hidden rounded-2xl border border-stone-300/80 bg-[var(--bg-elevated)] text-[var(--text)] shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
    >
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-stone-200 via-stone-100 to-stone-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
        <AvatarFace name={name} avatarUrl={avatarUrl} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/85 via-stone-950/35 to-transparent p-4 pt-12 text-white">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-indigo-200">{rank || 'Unassigned rank'}</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{name}</h2>
        </div>
      </div>
      <div className="relative z-10 space-y-3 p-4">
        <p className="text-sm font-medium text-stone-700 dark:text-slate-300">{role || 'Personnel file'}</p>
        <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
          {actionLabel}
        </span>
      </div>
    </motion.article>
  );
}
