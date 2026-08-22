import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { Check, Umbrella } from 'lucide-react';
import { useCommand } from '../components/GlobalLayout.jsx';
import CommandAtmosphere from '../components/CommandAtmosphere.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { oauthRedirectTo } from '../lib/access.js';
import { SITE_LOGO } from '../lib/brand.js';

const EASE = [0.22, 1, 0.36, 1];
const MAGNET_STRENGTH = 0.32;
const MAGNET_SPRING = { stiffness: 320, damping: 22, mass: 0.42 };
const MORPH_TRANSITION = { duration: 0.55, ease: EASE };
const SCAN_MS = 1800;
const SUCCESS_HOLD_MS = 900;
const ENTER_MS = 320;
const ERROR_HOLD_MS = 2400;

const morphByState = {
  idle: { width: 'min(26.5rem, 100%)', height: 'auto', minHeight: '24rem', borderRadius: '16px', opacity: 1 },
  scanning: { width: '5.5rem', height: '5.5rem', minHeight: '5.5rem', borderRadius: '50%', opacity: 1 },
  success: { width: '5.5rem', height: '5.5rem', minHeight: '5.5rem', borderRadius: '50%', opacity: 1 },
  enter: { width: '2.2rem', height: '2.2rem', minHeight: '2.2rem', borderRadius: '50%', opacity: 0 },
  error: { width: 'min(24rem, calc(100vw - 2rem))', height: 'auto', minHeight: '8.5rem', borderRadius: '24px', opacity: 1 }
};

const innerMotion = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: 0.28, ease: EASE }
};

const LOCAL_TEST_ACCOUNTS = [
  { email: 'admin@local.test', password: 'admin', label: 'Admin' },
  { email: 'officer@local.test', password: 'officer', label: 'Officer' }
];

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLocalHost() {
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function clarifySignupError(error, t) {
  const message = String(error?.message || '');
  const code = String(error?.code || error?.name || '');
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'This email is already registered. Sign in instead.';
  }
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(message)) {
    return t('auth.emailHint');
  }
  return error?.message || t('auth.discordError');
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
    pullX.set((event.clientX - (rect.left + rect.width / 2)) * MAGNET_STRENGTH);
    pullY.set((event.clientY - (rect.top + rect.height / 2)) * MAGNET_STRENGTH);
  }

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pullX.set(0);
        pullY.set(0);
      }}
      style={{ x, y }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-[#5865F2]/45 bg-[#5865F2] px-4 text-sm font-semibold tracking-[0.04em] text-white shadow-[0_0_0_1px_rgba(88,101,242,0.28),0_12px_36px_rgba(88,101,242,0.22)] transition disabled:cursor-wait disabled:opacity-70"
    >
      <DiscordMark />
      <span className="relative">{label}</span>
      <span className="sr-only">{hint}</span>
    </motion.button>
  );
}

export default function Login({ onAuthenticated } = {}) {
  const { lang, setLang, t, supabase, refresh, rain, glassVisible, glassMotion, setAuthHold } = useCommand();
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loginState, setLoginState] = useState('idle');
  const brandSrc = SITE_LOGO;
  const showLocal = isLocalHost();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
    const redirectError =
      params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error') || '';
    if (redirectError) {
      setError(redirectError);
    }
  }, []);

  async function spinThen(task) {
    setAuthHold?.(true);
    setLoginState('scanning');
    const started = Date.now();
    const reduced = prefersReducedMotion();
    try {
      const result = await task();
      if (!reduced) {
        await sleep(Math.max(0, SCAN_MS - (Date.now() - started)));
      }
      return result;
    } catch (authError) {
      if (!reduced) {
        await sleep(Math.max(0, Math.min(700, SCAN_MS - (Date.now() - started))));
      }
      throw authError;
    }
  }

  async function showAuthError(message) {
    setError(message);
    setLoginState('error');
    setAuthHold?.(false);
    await sleep(prefersReducedMotion() ? 0 : ERROR_HOLD_MS);
    setLoginState('idle');
    setBusy(false);
  }

  async function finishSuccess(sessionOverride) {
    setLoginState('success');
    await sleep(prefersReducedMotion() ? 0 : SUCCESS_HOLD_MS);
    setLoginState('enter');
    await sleep(prefersReducedMotion() ? 0 : ENTER_MS);
    await refresh?.(sessionOverride);
    if (typeof onAuthenticated === 'function') {
      setAuthHold?.(false);
      await onAuthenticated();
      return;
    }
    navigate('/', { replace: true });
    setAuthHold?.(false);
  }

  async function handleDiscord() {
    if (busy) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { error: authError } = await spinThen(() =>
        supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: { redirectTo: oauthRedirectTo('/login'), scopes: 'identify email' }
        })
      );
      if (authError) {
        throw authError;
      }
      setAuthHold?.(false);
      setLoginState('idle');
      setBusy(false);
    } catch (authError) {
      await showAuthError(authError?.message || t('auth.discordError'));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!email.trim() || !password) {
      setError(t('auth.emailHint'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await spinThen(() => supabase.auth.signUp({ email: email.trim(), password }));
        if (authError) {
          throw authError;
        }
        if (data.session) {
          await finishSuccess(data.session);
          return;
        }
        setLoginState('idle');
        setBusy(false);
        setAuthHold?.(false);
        setMode('signin');
        setStatus(t('auth.created'));
        toast.success(t('auth.created'));
        return;
      }
      const { data, error: authError } = await spinThen(() => supabase.auth.signInWithPassword({ email: email.trim(), password }));
      if (authError) {
        throw authError;
      }
      await finishSuccess(data.session);
    } catch (authError) {
      await showAuthError(clarifySignupError(authError, t));
    }
  }

  const inputClass =
    'min-h-11 rounded-xl border border-white/10 bg-slate-950/45 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-slate-300/50 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.16)]';

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0b1016_0%,#121821_46%,#0d1218_100%)]" />
      <CommandAtmosphere theme="dark" rain={rain !== false} glassVisible={glassVisible !== false} glassMotion={glassMotion !== false} />
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
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <motion.section
        className={`relative z-10 flex items-center justify-center border border-white/15 bg-slate-950/42 shadow-[0_0_0_1px_rgba(148,163,184,0.12),0_0_48px_rgba(100,116,139,0.12),0_28px_80px_rgba(8,12,20,0.42)] backdrop-blur-xl ${
          loginState === 'idle' || loginState === 'error' ? 'overflow-hidden' : 'overflow-visible'
        }`}
        animate={morphByState[loginState]}
        transition={MORPH_TRANSITION}
        style={{ padding: loginState === 'idle' ? '2rem' : loginState === 'error' ? '1.25rem 1.5rem' : 0 }}
      >
        <AnimatePresence mode="wait">
          {loginState === 'idle' ? (
            <motion.div key="idle" className="w-full max-w-[22.5rem]" {...innerMotion}>
              <header className="mb-6 flex items-start gap-3">
                <img src={brandSrc} alt="" className="h-12 w-12 rounded-xl border border-white/15 bg-slate-900 object-contain p-0.5" />
                <div>
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{t('auth.kicker')}</p>
                  <h1 className="mt-1 text-xl font-semibold tracking-wide text-slate-50">
                    {mode === 'signup' ? t('auth.signupTitle') : t('auth.signinTitle')}
                  </h1>
                </div>
              </header>

              {status && !error ? (
                <p className="mb-4 text-sm text-slate-300" role="status">
                  {status}
                </p>
              ) : null}
              {error ? (
                <p className="mb-4 text-sm text-rose-200/90" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="grid gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Email
                  <input
                    className={inputClass}
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                {mode === 'signup' ? <p className="text-[0.72rem] leading-5 text-slate-500">{t('auth.emailHint')}</p> : null}
                <label className="grid gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Password
                  <input
                    className={inputClass}
                    type="password"
                    name="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-slate-100 text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
                >
                  {mode === 'signup' ? t('auth.signupSubmit') : t('auth.signinSubmit')}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                {t('auth.or')}
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <MagneticDiscordButton label={t('auth.discord')} hint={t('auth.discord')} disabled={busy} onClick={handleDiscord} />

              <p className="mt-5 text-center text-sm">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
                    setError('');
                    setStatus('');
                  }}
                  className="text-slate-300 underline-offset-4 hover:underline"
                >
                  {mode === 'signup' ? t('auth.switchSignin') : t('auth.switchSignup')}
                </button>
              </p>
              <p className="mt-3 text-center text-sm">
                <Link to="/tickets" className="text-slate-400 no-underline hover:text-slate-200">
                  {t('nav.tickets')}
                </Link>
              </p>

              {showLocal ? (
                <div className="mt-6 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Local test accounts</p>
                  {LOCAL_TEST_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      className="rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-300"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                      }}
                    >
                      {account.label}: {account.email} / {account.password}
                    </button>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : null}

          {loginState === 'scanning' || loginState === 'success' || loginState === 'enter' ? (
            <motion.div key="lock" className="relative grid h-full w-full place-items-center" {...innerMotion}>
              {loginState === 'scanning'
                ? [0, 1, 2].map((ring) => (
                    <motion.span
                      key={`scan-${ring}`}
                      className="absolute rounded-full border border-sky-200/70"
                      style={{ inset: '-38%' }}
                      animate={{ scale: [0.22, 2.35], opacity: [0.7, 0] }}
                      transition={{ duration: 1.55, delay: ring * 0.38, repeat: Infinity, ease: 'linear' }}
                      aria-hidden="true"
                    />
                  ))
                : [0, 1].map((ring) => (
                    <motion.span
                      key={`found-${ring}`}
                      className="absolute rounded-full border border-emerald-300/75"
                      style={{ inset: '-38%' }}
                      initial={{ scale: 0.35, opacity: 0.75 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.85, delay: ring * 0.12, ease: EASE }}
                      aria-hidden="true"
                    />
                  ))}
              {loginState === 'scanning' ? (
                <motion.span
                  className="relative z-10 h-12 w-12 rounded-full border-2 border-slate-500/30 border-t-slate-100 shadow-[0_0_18px_rgba(226,232,240,0.35)]"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                  aria-hidden="true"
                />
              ) : (
                <motion.span
                  className="relative z-10 grid place-items-center"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  <Check className="h-7 w-7 text-emerald-200" strokeWidth={2.5} aria-hidden="true" />
                </motion.span>
              )}
              <span className="sr-only">{loginState === 'scanning' ? t('auth.scanning') : t('auth.clearanceGranted')}</span>
            </motion.div>
          ) : null}

          {loginState === 'error' ? (
            <motion.div key="error" className="flex w-full flex-col items-center gap-3 px-2 text-center" {...innerMotion}>
              <motion.span
                className="grid h-14 w-14 place-items-center rounded-full bg-sky-400/10 text-sky-200"
                initial={{ scaleY: 0.18, scaleX: 0.55, opacity: 0.35 }}
                animate={{ scaleY: 1, scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.48, ease: EASE }}
                style={{ transformOrigin: 'bottom center' }}
              >
                <Umbrella className="h-7 w-7" strokeWidth={1.9} aria-hidden="true" />
              </motion.span>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-sky-100/90">{t('auth.denied')}</p>
              <p className="max-w-[20rem] text-sm leading-6 text-slate-200" role="alert">
                {error}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}
