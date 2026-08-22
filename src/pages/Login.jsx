import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'Authorization',
    title: 'Command Access',
    lead: 'Present your command credentials to enter the personnel system.',
    id: 'Email / Command ID',
    password: 'Password',
    submit: 'Authenticate',
    scanning: 'Verifying clearance',
    granted: 'Clearance Granted',
    denied: 'Clearance denied. Check your credentials and try again.'
  },
  th: {
    kicker: 'การยืนยันสิทธิ์',
    title: 'เข้าสู่ระบบบัญชาการ',
    lead: 'กรอกข้อมูลสิทธิ์เพื่อเข้าสู่ระบบกำลังพล',
    id: 'อีเมล / รหัสบัญชาการ',
    password: 'รหัสผ่าน',
    submit: 'ยืนยันสิทธิ์',
    scanning: 'กำลังตรวจสอบสิทธิ์',
    granted: 'อนุมัติสิทธิ์แล้ว',
    denied: 'ไม่ผ่านการตรวจสอบ โปรดตรวจข้อมูลแล้วลองอีกครั้ง'
  }
};

const ease = [0.22, 1, 0.36, 1];
const SCAN_MS = 1500;
const GRANT_MS = 900;

function resolveEmail(identifier) {
  const value = identifier.trim();
  if (!value) {
    return '';
  }
  return value.includes('@') ? value : `${value}@command.wlr`;
}

function SealCheck() {
  return (
    <svg viewBox="0 0 72 72" className="h-10 w-10" aria-hidden="true">
      <motion.circle
        cx="36"
        cy="36"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease }}
      />
      <motion.path
        d="M22 37.5 L32 47 L51 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.18, ease }}
      />
    </svg>
  );
}

export default function Login({ onAuthenticated } = {}) {
  const { lang, supabase, refresh } = useCommand();
  const navigate = useNavigate();
  const copy = COPY[lang] || COPY.en;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState('form');
  const [error, setError] = useState('');

  const isForm = phase === 'form';
  const brandSrc = useMemo(() => `${import.meta.env.BASE_URL}assets/1.jpg`, []);

  async function finishSuccess() {
    await refresh?.();
    if (typeof onAuthenticated === 'function') {
      await onAuthenticated();
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isForm) {
      return;
    }

    const email = resolveEmail(identifier);
    if (!email || !password.trim()) {
      setError(copy.denied);
      return;
    }

    setError('');
    setPhase('scanning');
    const started = Date.now();

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      const wait = Math.max(0, SCAN_MS - (Date.now() - started));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      if (authError) {
        throw authError;
      }
      setPhase('granted');
      window.setTimeout(() => {
        finishSuccess().catch(() => {
          setPhase('form');
          setError(copy.denied);
        });
      }, GRANT_MS);
    } catch (authError) {
      const wait = Math.max(0, SCAN_MS - (Date.now() - started));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      setPhase('form');
      setError(authError?.message || copy.denied);
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(79,70,229,0.16),transparent_42%),linear-gradient(180deg,#10141c_0%,#1b2230_52%,#12161e_100%)]" />
      <motion.div
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        animate={{ y: [0, 16, 0], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"
        animate={{ y: [0, -14, 0], opacity: [0.28, 0.5, 0.28] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.section
        layout
        className="relative z-10 overflow-hidden border border-white/15 bg-slate-950/45 shadow-[0_24px_80px_rgba(8,12,20,0.38)] backdrop-blur-md"
        animate={{
          width: isForm ? 420 : 168,
          minHeight: isForm ? 460 : 168,
          height: isForm ? 'auto' : 168,
          borderRadius: isForm ? 24 : 999,
          padding: isForm ? 32 : 0
        }}
        transition={{ layout: { duration: 0.55, ease }, duration: 0.55, ease }}
        style={{ maxWidth: '100%' }}
      >
        <AnimatePresence mode="wait">
          {isForm ? (
            <motion.form
              key="login-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center gap-3">
                <img src={brandSrc} alt="" className="h-12 w-12 rounded-xl border border-white/15 bg-slate-900 object-contain p-0.5" />
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">{copy.kicker}</p>
                  <h1 className="text-xl font-semibold tracking-wide text-slate-50">{copy.title}</h1>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-300/85">{copy.lead}</p>
              <label className="grid gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {copy.id}
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-indigo-300/70 focus:shadow-[0_0_0_3px_rgba(165,180,252,0.16)]"
                  type="text"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {copy.password}
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-indigo-300/70 focus:shadow-[0_0_0_3px_rgba(165,180,252,0.16)]"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {error ? <p className="text-sm text-rose-200">{error}</p> : null}
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-indigo-600 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-indigo-500"
              >
                {copy.submit}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="login-seal"
              className="flex h-full min-h-[168px] w-full flex-col items-center justify-center text-indigo-100"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease }}
            >
              {phase === 'scanning' ? (
                <>
                  <span className="relative grid h-20 w-20 place-items-center">
                    <motion.span
                      className="absolute inset-0 rounded-full border border-indigo-200/25"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.7, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.span
                      className="absolute inset-[6px] rounded-full border-2 border-transparent border-t-indigo-200 border-r-indigo-300/40"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.15, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-200 shadow-[0_0_18px_rgba(199,210,254,0.8)]" />
                  </span>
                  <p className="mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-indigo-100/80">
                    {copy.scanning}
                  </p>
                </>
              ) : (
                <>
                  <motion.div
                    className="text-indigo-100"
                    initial={{ scale: 0.86 }}
                    animate={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <SealCheck />
                  </motion.div>
                  <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-indigo-100">
                    {copy.granted}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}
