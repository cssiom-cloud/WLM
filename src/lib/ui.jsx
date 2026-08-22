import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ImagePlus } from 'lucide-react';
import { SITE_LOGO } from './brand.js';

export const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-800 outline-none backdrop-blur-xl transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_32%,transparent)] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100';

export const labelClass = 'grid gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate-500';

export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70';

export const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200';

export const btnDanger =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/70 bg-rose-50 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-70 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-200';

export const glassClass =
  'rounded-2xl border border-slate-200/80 bg-white/75 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55';

export function FileUploadButton({
  label,
  hint,
  accept = 'image/*',
  onChange,
  fileName = '',
  variant = 'ghost'
}) {
  const id = useId();
  const tone = variant === 'primary' ? btnPrimary : btnGhost;
  return (
    <div className="grid gap-1">
      {label ? <span className={labelClass}>{label}</span> : null}
      <label htmlFor={id} className={`${tone} cursor-pointer`}>
        <ImagePlus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        <span className="max-w-[16rem] truncate">{fileName || hint || 'Upload image'}</span>
      </label>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={onChange} />
    </div>
  );
}

export function PageHeader({ kicker, title, lead, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {kicker ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{kicker}</p>
        ) : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {lead ? <p className="mt-2 text-sm leading-6 text-slate-500">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`${labelClass} ${className}`}>
      {label}
      {children}
      {hint ? <span className="normal-case tracking-normal text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function CommandSelect({
  value,
  onChange,
  options = [],
  placeholder = '—',
  disabled = false,
  className = '',
  required = false,
  name,
  id
}) {
  const autoId = useId();
  const selectId = id || autoId;
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const selected = options.find((row) => String(row.value) === String(value));

  function close() {
    setOpen(false);
  }

  function toggle() {
    if (disabled) {
      return;
    }
    if (open) {
      close();
      return;
    }
    const box = btnRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const menuHeight = Math.min(320, options.length * 42 + 12);
    const spaceBelow = window.innerHeight - box.bottom;
    const top = spaceBelow < menuHeight && box.top > menuHeight ? box.top - menuHeight - 6 : box.bottom + 6;
    setRect({
      top,
      left: Math.max(8, Math.min(box.left, window.innerWidth - Math.max(box.width, 180) - 8)),
      width: Math.max(box.width, 160)
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={`cmd-select ${className}`.trim()}>
      {required ? (
        <select
          id={selectId}
          name={name}
          required
          value={value}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((row) => (
            <option key={`req-${String(row.value)}`} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        ref={btnRef}
        type="button"
        className="cmd-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className={`cmd-select-value${selected ? '' : ' is-placeholder'}`}>{selected?.label || placeholder}</span>
        <ChevronDown className="cmd-select-caret" aria-hidden="true" />
      </button>
      {open && rect
        ? createPortal(
            <>
              <div className="cmd-select-backdrop" onClick={close} />
              <ul className="cmd-select-menu" role="listbox" style={{ top: rect.top, left: rect.left, width: rect.width }}>
                {options.map((row) => {
                  const active = String(row.value) === String(value);
                  return (
                    <li key={String(row.value)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`cmd-select-option${active ? ' is-active' : ''}`}
                        onClick={() => {
                          onChange(row.value);
                          close();
                        }}
                      >
                        <span>{row.label}</span>
                        {active ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

export function CommandCheck({ checked, onChange, children, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={`cmd-check ${className}`.trim()}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
    >
      <span className={`cmd-check-box${checked ? ' is-checked' : ''}`} aria-hidden="true">
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="cmd-check-label">{children}</span>
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[170] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-label={cancelLabel} onClick={onCancel} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wlr-confirm-title"
            className={`${glassClass} relative z-10 w-full max-w-md p-6 shadow-[0_24px_60px_rgba(15,23,42,0.28)]`}
            initial={{ y: 28, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <img src={SITE_LOGO} alt="" className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" />
            <h2 id="wlr-confirm-title" className="text-center text-xl font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {message ? <p className="mt-2 text-center text-sm leading-6 text-slate-500">{message}</p> : null}
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" className={btnGhost} onClick={onCancel}>
                {cancelLabel}
              </button>
              <button type="button" className={btnDanger} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function EmptyState({ children }) {
  return <p className="rounded-2xl border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10">{children}</p>;
}

export function StatusBadge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-200/80 text-slate-700 dark:bg-white/10 dark:text-slate-200',
    open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
    full: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
    closed: 'bg-slate-300/80 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    planning: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
    active: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'
  };
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className={`${btnGhost} no-underline`}>
      {children}
    </Link>
  );
}

export function SignatureBlock({ t, name, status }) {
  const signed = Boolean(String(name || '').trim());
  const approved = status === 'completed' && signed;
  const stampText = approved ? t('ops.auth.approved') : t('ops.auth.restricted');
  return (
    <section className="ops-auth-grid">
      <div className="ops-sign-block">
        <p className="ops-auth-kicker">{t('ops.auth.sign')}</p>
        <p className={signed ? 'ops-signature' : 'ops-unsigned'}>{signed ? name : '................................'}</p>
        <p className="ops-sign-name">({signed ? name : '....................'})</p>
        <p className="ops-auth-role">{t('ops.auth.signer')}</p>
      </div>
      <div className={`ops-stamp ${approved ? 'ops-stamp-approved' : 'ops-stamp-restricted'}`}>
        <span className="ops-stamp-copy">{stampText}</span>
      </div>
    </section>
  );
}

export function UnitLogo({ unit, className = 'h-16 w-16' }) {
  if (unit?.logo_url) {
    const image = <img src={unit.logo_url} alt={unit.name || unit.code || ''} className={`${className} rounded-xl object-contain`} />;
    if (unit.logo_link) {
      return (
        <a href={unit.logo_link} target="_blank" rel="noopener noreferrer">
          {image}
        </a>
      );
    }
    return image;
  }
  return (
    <div className={`${className} grid place-items-center rounded-xl bg-slate-200 text-xs font-semibold tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
      {unit?.code || 'WLR'}
    </div>
  );
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || '').split('\n');
  const nodes = [];
  let list = [];
  const flushList = () => {
    if (!list.length) {
      return;
    }
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        {list.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
    list = [];
  };
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      nodes.push(
        <h3 key={index} className="mb-2 mt-5 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      nodes.push(
        <h2 key={index} className="mb-3 mt-6 text-xl font-semibold text-slate-900 dark:text-slate-50">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith('- ')) {
      list.push(line.slice(2));
    } else {
      flushList();
      nodes.push(
        <p key={index} className="mb-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          {line}
        </p>
      );
    }
  });
  flushList();
  return nodes;
}
