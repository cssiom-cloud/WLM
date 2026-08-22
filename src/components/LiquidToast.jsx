import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { SITE_LOGO } from '../lib/brand.js';
import { useCommand } from './GlobalLayout.jsx';

const ToastContext = createContext(null);
const TOAST_SPRING = { type: 'spring', stiffness: 400, damping: 25 };
const DEFAULT_DURATION = 4200;

const TONE = {
  success: {
    glow: 'shadow-[0_12px_36px_rgba(16,185,129,0.16)]',
    ring: 'bg-emerald-500',
    icon: 'text-emerald-600 dark:text-emerald-300',
    Icon: CheckCircle2
  },
  info: {
    glow: 'shadow-[0_12px_36px_rgba(56,189,248,0.14)]',
    ring: 'bg-sky-500',
    icon: 'text-sky-600 dark:text-sky-300',
    Icon: Info
  },
  alert: {
    glow: 'shadow-[0_12px_36px_rgba(244,63,94,0.16)]',
    ring: 'bg-rose-500',
    icon: 'text-rose-600 dark:text-rose-300',
    Icon: AlertTriangle
  }
};

const PAGE_KEYS = [
  ['/announcements/create', 'nav.createAnnouncement'],
  ['/announcements', 'nav.announcements'],
  ['/operations/new', 'nav.operations'],
  ['/operations', 'nav.operations'],
  ['/directory', 'nav.directory'],
  ['/org', 'nav.org'],
  ['/units', 'nav.units'],
  ['/memo', 'nav.memo'],
  ['/library', 'nav.documents'],
  ['/lore', 'nav.lore'],
  ['/tickets', 'nav.tickets'],
  ['/admin', 'nav.adminPage'],
  ['/accounts', 'nav.accounts'],
  ['/settings', 'nav.settings'],
  ['/logs', 'nav.logs'],
  ['/select', 'nav.profiles'],
  ['/login', 'auth.signinTitle'],
  ['/', 'nav.home']
];

function pageKeyFromPath(pathname) {
  const path = String(pathname || '/');
  const match = PAGE_KEYS.find(([prefix]) => path === prefix || (prefix !== '/' && path.startsWith(prefix)));
  return match?.[1] || 'nav.home';
}

function normalizeToast(type, titleOrOptions, message) {
  if (titleOrOptions && typeof titleOrOptions === 'object') {
    return {
      type: titleOrOptions.type || type,
      title: titleOrOptions.title || '',
      message: titleOrOptions.message || '',
      duration: titleOrOptions.duration
    };
  }
  return {
    type,
    title: titleOrOptions || '',
    message: message || '',
    duration: undefined
  };
}

function ActorMark({ name, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return <img src={SITE_LOGO} alt="" className="h-9 w-9 rounded-full object-contain bg-white p-0.5" />;
}

function ToastCard({ toast, onDismiss }) {
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(0);
  const timerRef = useRef(0);
  const tone = TONE[toast.type] || TONE.info;
  const Icon = tone.Icon;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const armTimer = useCallback(() => {
    clearTimer();
    if (remainingRef.current <= 0) {
      onDismiss(toast.id);
      return;
    }
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      onDismiss(toast.id);
    }, remainingRef.current);
  }, [clearTimer, onDismiss, toast.id]);

  useEffect(() => {
    remainingRef.current = toast.duration;
    armTimer();
    return clearTimer;
  }, [armTimer, clearTimer, toast.duration]);

  function handlePointerEnter() {
    clearTimer();
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  }

  return (
    <motion.li
      layout
      role="status"
      initial={{ y: 50, scale: 0.8, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={{ y: 50, scale: 0.8, opacity: 0 }}
      transition={TOAST_SPRING}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={armTimer}
      className={`pointer-events-auto relative flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] ${tone.glow}`}
    >
      <ActorMark name={toast.actorName} avatarUrl={toast.actorAvatar} />
      <div className="min-w-0 flex-1 pr-6">
        <p className="flex items-center gap-2 text-[0.78rem] font-semibold tracking-wide text-[var(--text)]">
          <span className="truncate">{toast.actorName || 'W.L.R'}</span>
        </p>
        <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">{toast.pageLabel}</p>
        {toast.title ? <p className="mt-1 text-[0.78rem] font-semibold text-[var(--text)]">{toast.title}</p> : null}
        {toast.message ? <p className="mt-0.5 text-[0.72rem] leading-5 text-[var(--text-muted)]">{toast.message}</p> : null}
      </div>
      <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] ${tone.icon}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span className={`pointer-events-none absolute inset-y-2 left-1.5 w-1 rounded-full ${tone.ring}`} aria-hidden="true" />
    </motion.li>
  );
}

export function LiquidToast() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[120] flex w-auto justify-end lg:bottom-5">
      <ul className="m-0 flex list-none flex-col-reverse items-end gap-2.5 p-0" aria-live="polite" aria-relevant="additions text">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const location = useLocation();
  const { t, activePersonnel, formatPersonnelName } = useCommand();

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ type = 'info', title = '', message = '', duration = DEFAULT_DURATION } = {}) => {
      const resolvedType = TONE[type] ? type : 'info';
      const id = `toast-${++seq.current}`;
      const actorName = formatPersonnelName(activePersonnel) || 'W.L.R Command';
      setToasts((current) => [
        {
          id,
          type: resolvedType,
          title,
          message,
          pageLabel: t(pageKeyFromPath(location.pathname)),
          actorName,
          actorAvatar: activePersonnel?.avatar_url || SITE_LOGO,
          duration: typeof duration === 'number' ? duration : DEFAULT_DURATION
        },
        ...current
      ]);
      return id;
    },
    [activePersonnel, formatPersonnelName, location.pathname, t]
  );

  const success = useCallback(
    (titleOrOptions, message) => push(normalizeToast('success', titleOrOptions, message)),
    [push]
  );
  const info = useCallback(
    (titleOrOptions, message) => push(normalizeToast('info', titleOrOptions, message)),
    [push]
  );
  const alert = useCallback(
    (titleOrOptions, message) => push(normalizeToast('alert', titleOrOptions, message)),
    [push]
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss, success, info, alert }),
    [alert, dismiss, info, push, success, toasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <LiquidToast />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return value;
}

export default ToastProvider;
