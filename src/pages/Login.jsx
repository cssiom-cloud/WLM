import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'W.L.R Command Personnel',
    title: 'Official Access Portal',
    lead: 'Authorized personnel may enter the command system with Discord or issued credentials.',
    discord: 'Continue with Discord',
    discordHint: 'Preferred channel for command personnel.',
    or: 'or',
    secondary: 'Credential sign-in',
    id: 'Email / Command ID',
    password: 'Password',
    submit: 'Authenticate',
    authenticating: 'Establishing session',
    redirecting: 'Redirecting to Discord',
    granted: 'Clearance granted',
    denied: 'Credentials were not accepted. Verify your details and try again.',
    discordError: 'Discord authorization could not be completed.',
    langEn: 'EN',
    langTh: 'TH',
    unit: 'White Lion Regiment'
  },
  th: {
    kicker: 'W.L.R Command Personnel',
    title: 'พอร์ทัลเข้าสู่ระบบราชการ',
    lead: 'กำลังพลที่ได้รับสิทธิ์สามารถเข้าสู่ระบบบัญชาการด้วย Discord หรือข้อมูลประจำตัวที่ออกให้',
    discord: 'เข้าสู่ระบบด้วย Discord',
    discordHint: 'ช่องทางหลักสำหรับกำลังพลศูนย์บัญชาการ',
    or: 'หรือ',
    secondary: 'เข้าสู่ระบบด้วยข้อมูลประจำตัว',
    id: 'อีเมล / รหัสบัญชาการ',
    password: 'รหัสผ่าน',
    submit: 'ยืนยันสิทธิ์',
    authenticating: 'กำลังสร้างเซสชัน',
    redirecting: 'กำลังไปยัง Discord',
    granted: 'อนุมัติสิทธิ์แล้ว',
    denied: 'ข้อมูลไม่ถูกต้อง โปรดตรวจสอบแล้วลองอีกครั้ง',
    discordError: 'ไม่สามารถยืนยันตัวตนผ่าน Discord ได้',
    langEn: 'EN',
    langTh: 'TH',
    unit: 'กรมสิงห์ขาว'
  }
};

const ease = [0.22, 1, 0.36, 1];
const MAGNET_STRENGTH = 0.32;
const MAGNET_SPRING = { stiffness: 320, damping: 22, mass: 0.42 };

function resolveEmail(identifier) {
  const value = identifier.trim();
  if (!value) {
    return '';
  }
  return value.includes('@') ? value : `${value}@command.wlr`;
}

function oauthRedirectTo() {
  const origin = window.location.origin;
  const base = String(import.meta.env.BASE_URL || '/');
  if (base === '/' || base === './' || base === '.') {
    return `${origin}/`;
  }
  return `${origin}${base.startsWith('/') ? base : `/${base}`}`;
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035A19.7 19.7 0 0 0 3.677 4.37a.08.08 0 0 0-.037.027C.533 9.047-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.07.07 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.08.08 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.08.08 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.892.08.08 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  );
}

function AuroraField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(71,85,105,0.22),transparent_52%),linear-gradient(180deg,#0b1016_0%,#121821_46%,#0d1218_100%)]" />

      <motion.div
        className="absolute -left-28 top-[8%] h-[28rem] w-[28rem] rounded-full bg-slate-400/12 blur-3xl"
        animate={{
          y: [0, 36, -12, 0],
          x: [0, 18, -10, 0],
          opacity: [0.28, 0.5, 0.34, 0.28],
          scale: [1, 1.12, 0.96, 1]
        }}
        transition={{ duration: 12.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 top-[22%] h-[26rem] w-[26rem] rounded-full bg-indigo-400/10 blur-3xl"
        animate={{
          y: [0, -28, 16, 0],
          x: [0, -16, 12, 0],
          opacity: [0.22, 0.42, 0.3, 0.22],
          scale: [1.05, 0.92, 1.14, 1.05]
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-[28%] -bottom-32 h-[30rem] w-[30rem] rounded-full bg-sky-400/8 blur-3xl"
        animate={{
          y: [0, -22, 18, 0],
          opacity: [0.18, 0.36, 0.24, 0.18],
          scale: [0.94, 1.1, 1.02, 0.94]
        }}
        transition={{ duration: 10.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[12%] h-72 w-72 -translate-x-1/2 rounded-full bg-slate-200/6 blur-2xl"
        animate={{
          y: [0, 20, -8, 0],
          opacity: [0.12, 0.28, 0.16, 0.12],
          scale: [1, 1.18, 0.9, 1]
        }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute left-1/2 top-[18%] h-[min(72vw,38rem)] w-[min(72vw,38rem)] -translate-x-1/2 rounded-full border border-white/[0.04]"
        animate={{ opacity: [0.2, 0.42, 0.2], scale: [1, 1.035, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[18%] h-[min(52vw,26rem)] w-[min(52vw,26rem)] -translate-x-1/2 rounded-full border border-white/[0.035]"
        animate={{ opacity: [0.16, 0.34, 0.16], scale: [1.02, 0.97, 1.02] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[18%] h-[min(72vw,38rem)] w-[min(72vw,38rem)] origin-center -translate-x-1/2"
        style={{
          background:
            'conic-gradient(from 210deg, transparent 0deg, rgba(148,163,184,0.09) 28deg, transparent 62deg, transparent 360deg)'
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function MagneticDiscordButton({ label, hint, disabled, onClick }) {
  const buttonRef = useRef(null);
  const pullX = useMotionValue(0);
  const pullY = useMotionValue(0);
  const x = useSpring(pullX, MAGNET_SPRING);
  const y = useSpring(pullY, MAGNET_SPRING);

  function handlePointerMove(event) {
    const node = buttonRef.current;
    if (!node || disabled) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    pullX.set(offsetX * MAGNET_STRENGTH);
    pullY.set(offsetY * MAGNET_STRENGTH);
  }

  function handlePointerLeave() {
    pullX.set(0);
    pullY.set(0);
  }

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ x, y }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-[#5865F2]/45 bg-[#5865F2] px-4 text-sm font-semibold tracking-[0.04em] text-white shadow-[0_0_0_1px_rgba(88,101,242,0.28),0_12px_36px_rgba(88,101,242,0.22)] transition disabled:cursor-wait disabled:opacity-70"
    >
      <motion.span
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.22),transparent_46%)]"
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <DiscordMark />
      <span className="relative">{label}</span>
      <span className="sr-only">{hint}</span>
    </motion.button>
  );
}

export default function Login({ onAuthenticated } = {}) {
  const { lang, setLang, supabase, refresh } = useCommand();
  const navigate = useNavigate();
  const copy = COPY[lang] || COPY.en;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const brandSrc = useMemo(() => `${import.meta.env.BASE_URL}assets/1.jpg`, []);

  async function finishSuccess() {
    await refresh?.();
    if (typeof onAuthenticated === 'function') {
      await onAuthenticated();
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleDiscord() {
    if (busy) {
      return;
    }
    setError('');
    setStatus(copy.redirecting);
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: oauthRedirectTo(),
          scopes: 'identify email'
        }
      });
      if (authError) {
        throw authError;
      }
    } catch (authError) {
      setBusy(false);
      setStatus('');
      setError(authError?.message || copy.discordError);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      return;
    }

    const email = resolveEmail(identifier);
    if (!email || !password.trim()) {
      setError(copy.denied);
      return;
    }

    setError('');
    setStatus(copy.authenticating);
    setBusy(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) {
        throw authError;
      }
      setStatus(copy.granted);
      await finishSuccess();
    } catch (authError) {
      setBusy(false);
      setStatus('');
      setError(authError?.message || copy.denied);
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-slate-100">
      <AuroraField />

      <div className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/40 p-1 backdrop-blur-xl">
        {['th', 'en'].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang?.(code)}
            className={`min-h-9 rounded-lg px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition ${
              lang === code ? 'bg-white/12 text-slate-50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {code === 'th' ? copy.langTh : copy.langEn}
          </button>
        ))}
      </div>

      <motion.section
        className="relative z-10 w-full max-w-[26.5rem] overflow-hidden rounded-3xl border border-white/15 bg-slate-950/42 p-8 shadow-[0_0_0_1px_rgba(148,163,184,0.12),0_0_48px_rgba(100,116,139,0.12),0_28px_80px_rgba(8,12,20,0.42)] backdrop-blur-xl"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.62, ease }}
      >
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/45 to-transparent"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        <header className="mb-7 flex items-start gap-3">
          <img
            src={brandSrc}
            alt=""
            className="h-12 w-12 rounded-xl border border-white/15 bg-slate-900 object-contain p-0.5"
          />
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.kicker}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-wide text-slate-50">{copy.title}</h1>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">{copy.unit}</p>
          </div>
        </header>

        <p className="mb-6 text-sm leading-6 text-slate-300/88">{copy.lead}</p>

        <MagneticDiscordButton
          label={copy.discord}
          hint={copy.discordHint}
          disabled={busy}
          onClick={handleDiscord}
        />
        <p className="mt-2 text-center text-[0.7rem] text-slate-500">{copy.discordHint}</p>

        <div className="my-6 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          {copy.or}
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.secondary}</p>
          <label className="grid gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {copy.id}
            <input
              className="min-h-11 rounded-xl border border-white/10 bg-slate-950/45 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-slate-300/50 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.16)]"
              type="text"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="grid gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {copy.password}
            <input
              className="min-h-11 rounded-xl border border-white/10 bg-slate-950/45 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-slate-300/50 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.16)]"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
            />
          </label>

          {error ? (
            <p className="text-sm text-rose-200/90" role="alert">
              {error}
            </p>
          ) : null}
          {status && !error ? (
            <p className="text-sm text-slate-300" role="status">
              {status}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl border border-white/12 bg-white/[0.06] text-sm font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-70"
          >
            {busy && status === copy.authenticating ? copy.authenticating : copy.submit}
          </button>
        </form>
      </motion.section>
    </div>
  );
}
