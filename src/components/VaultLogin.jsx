import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useSpring } from 'framer-motion';
import { ChevronLeft, Lock, Unlock } from 'lucide-react';

const FLIP_EASE = [0.22, 1, 0.36, 1];
const FLIP_MS = 800;
const CARD_HEIGHT = 456;
const LOCK_SIZE = 80;

const IDLE_SHADOW = '0 18px 48px rgba(11, 31, 58, 0.22), 0 0 0 1px rgba(196, 163, 90, 0.14)';
const VERIFY_SHADOW_A =
  '0 0 0 1px rgba(196, 163, 90, 0.28), 0 10px 28px rgba(11, 31, 58, 0.32), 0 0 22px rgba(196, 163, 90, 0.18)';
const VERIFY_SHADOW_B =
  '0 0 0 1px rgba(196, 163, 90, 0.42), 0 10px 28px rgba(11, 31, 58, 0.36), 0 0 30px rgba(196, 163, 90, 0.26)';
const SUCCESS_SHADOW =
  '0 0 0 1px rgba(90, 138, 138, 0.42), 0 10px 28px rgba(11, 31, 58, 0.3), 0 0 26px rgba(74, 122, 122, 0.24)';

const faceSurface =
  'flex h-full flex-col rounded-[24px] border border-ivory/10 bg-[linear-gradient(165deg,rgba(18,38,58,0.88),rgba(11,31,58,0.92))] px-8 py-8 text-left sm:px-10';

const fieldClass =
  'mt-2 min-h-11 w-full rounded-xl border border-ivory/10 bg-navy/40 px-3.5 text-sm text-ivory outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ivory/35 focus:border-gold/55 focus:ring-2 focus:ring-gold/20';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function DiscordMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19.27 5.33A17.4 17.4 0 0 0 15.73 4.4l-.2.36c1.68.46 2.61 1.12 2.61 1.12a10.7 10.7 0 0 0-4.28-1.37 10.9 10.9 0 0 0-4.32.02S8.61 4.8 7 5.88c0 0 .9-.62 2.5-1.1l-.18-.32A16.5 16.5 0 0 0 5.7 5.35C3.12 9.05 2.5 12.64 2.64 16.18c1.86 1.37 3.66 2.2 5.42 2.75l.69-.95c-.74-.28-1.44-.63-2.1-1.04l.5-.4c3.93 1.82 8.18 1.82 12.07 0l.5.4c-.66.41-1.36.76-2.1 1.04l.69.95c1.76-.55 3.56-1.38 5.42-2.75.2-4.1-.62-7.66-3.16-10.85ZM9.4 14.52c-.86 0-1.56-.8-1.56-1.77s.69-1.77 1.56-1.77 1.58.8 1.56 1.77-.7 1.77-1.56 1.77Zm5.2 0c-.86 0-1.56-.8-1.56-1.77s.69-1.77 1.56-1.77 1.58.8 1.56 1.77-.69 1.77-1.56 1.77Z" />
    </svg>
  );
}

function MagneticDiscordButton({ onClick, disabled }) {
  const buttonRef = useRef(null);
  const pullX = useSpring(0, { stiffness: 280, damping: 22, mass: 0.4 });
  const pullY = useSpring(0, { stiffness: 280, damping: 22, mass: 0.4 });

  function handleMove(event) {
    if (disabled || prefersReducedMotion() || !buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    pullX.set((event.clientX - (rect.left + rect.width / 2)) * 0.18);
    pullY.set((event.clientY - (rect.top + rect.height / 2)) * 0.18);
  }

  function handleLeave() {
    pullX.set(0);
    pullY.set(0);
  }

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ x: pullX, y: pullY }}
      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-ivory/10 bg-ivory/[0.04] px-4 text-sm font-semibold text-ivory/80 transition-colors duration-200 hover:border-gold/30 hover:bg-ivory/[0.07] hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50"
    >
      <DiscordMark className="h-4 w-4 text-gold" />
      Continue with Discord
    </motion.button>
  );
}

export default function VaultLogin({ onLoginSuccess, className = '' }) {
  const identityId = useId();
  const passwordId = useId();
  const identityErrorId = useId();
  const passwordErrorId = useId();
  const statusId = useId();

  const identityRef = useRef(null);
  const passwordRef = useRef(null);
  const slotRef = useRef(null);
  const timersRef = useRef([]);
  const verifyingLockRef = useRef(false);

  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [idleWidth, setIdleWidth] = useState(448);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) {
      return undefined;
    }

    function measure() {
      if (verifyingLockRef.current) {
        return;
      }
      setIdleWidth(slot.clientWidth);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function schedule(fn, delay) {
    const id = window.setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }

  function beginUnlock() {
    if (verifyingLockRef.current) {
      return;
    }

    verifyingLockRef.current = true;
    setIdentityError('');
    setPasswordError('');
    setIsVerifying(true);
    setIsUnlocked(false);

    const reduced = prefersReducedMotion();
    const verifyDelay = reduced ? 180 : 1000;
    const settleDelay = reduced ? 80 : 560;

    schedule(() => {
      setIsUnlocked(true);
      schedule(() => {
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess();
        }
      }, settleDelay);
    }, verifyDelay);
  }

  function handleIdentitySubmit(event) {
    event.preventDefault();
    if (verifyingLockRef.current) {
      return;
    }

    const value = identity.trim();
    if (!value) {
      setIdentityError('Enter your email or command ID to continue.');
      identityRef.current?.focus();
      return;
    }

    setIdentityError('');
    setFlipped(true);
    schedule(() => {
      passwordRef.current?.focus();
    }, prefersReducedMotion() ? 40 : FLIP_MS);
  }

  function handleReturnToIdentity() {
    if (verifyingLockRef.current) {
      return;
    }

    setPasswordError('');
    setFlipped(false);
    schedule(() => {
      identityRef.current?.focus();
    }, prefersReducedMotion() ? 40 : FLIP_MS);
  }

  function handlePasswordSubmit(event) {
    event.preventDefault();
    if (verifyingLockRef.current) {
      return;
    }

    if (!password.trim()) {
      setPasswordError('Enter your password or security key.');
      passwordRef.current?.focus();
      return;
    }

    setPasswordError('');
    beginUnlock();
  }

  const shellWidth = isVerifying ? LOCK_SIZE : idleWidth;
  const shellHeight = isVerifying ? LOCK_SIZE : CARD_HEIGHT;
  const shellRadius = isVerifying ? LOCK_SIZE / 2 : 24;

  return (
    <div className={`w-full ${className}`.trim()}>
      <div ref={slotRef} className="relative flex min-h-[28.5rem] w-full items-center justify-center">
        <motion.div
          aria-busy={isVerifying}
          aria-describedby={statusId}
          animate={{
            width: shellWidth,
            height: shellHeight,
            borderRadius: shellRadius,
            boxShadow: isUnlocked ? SUCCESS_SHADOW : isVerifying ? VERIFY_SHADOW_A : IDLE_SHADOW,
            background: isUnlocked
              ? 'linear-gradient(160deg, rgba(26, 58, 66, 0.96), rgba(11, 31, 58, 0.96))'
              : 'linear-gradient(165deg, rgba(18, 38, 58, 0.9), rgba(11, 31, 58, 0.94))'
          }}
          initial={false}
          transition={{ duration: 0.8, ease: FLIP_EASE }}
          className={`relative backdrop-blur-xl ${isVerifying ? 'overflow-hidden' : 'w-full'}`}
        >
          {!isUnlocked ? (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              animate={
                isVerifying
                  ? { boxShadow: [VERIFY_SHADOW_A, VERIFY_SHADOW_B, VERIFY_SHADOW_A] }
                  : { boxShadow: IDLE_SHADOW }
              }
              transition={
                isVerifying
                  ? { duration: 1.7, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.4 }
              }
              style={{ borderRadius: 'inherit' }}
            />
          ) : null}

          <motion.div
            className="h-full w-full"
            animate={{ opacity: isVerifying ? 0 : 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{ pointerEvents: isVerifying ? 'none' : 'auto' }}
          >
            <div className="h-full w-full" style={{ perspective: 1200 }}>
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.8, ease: FLIP_EASE }}
                className="relative h-full w-full"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div
                  className={faceSurface}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    position: 'relative',
                    pointerEvents: flipped ? 'none' : 'auto'
                  }}
                >
                  <form className="flex h-full flex-col" onSubmit={handleIdentitySubmit} noValidate>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">Identity</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ivory">Command access</h2>
                    <p className="mt-2 text-sm leading-relaxed text-ivory/60">
                      Confirm your email or command ID to open the clearance vault.
                    </p>

                    <label htmlFor={identityId} className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ivory/70">
                      Email / Command ID
                    </label>
                    <input
                      ref={identityRef}
                      id={identityId}
                      name="username"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={identity}
                      disabled={isVerifying}
                      aria-invalid={Boolean(identityError)}
                      aria-describedby={identityError ? identityErrorId : undefined}
                      placeholder="name@command or CS-014"
                      onChange={(event) => {
                        setIdentity(event.target.value);
                        if (identityError) {
                          setIdentityError('');
                        }
                      }}
                      className={`${fieldClass} ${identityError ? 'border-gold/50' : ''}`}
                    />
                    <div className="min-h-6 pt-1.5">
                      <AnimatePresence>
                        {identityError ? (
                          <motion.p
                            id={identityErrorId}
                            role="alert"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[0.78rem] text-[#E4D2A0]"
                          >
                            {identityError}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="mt-auto min-h-11 w-full rounded-xl bg-ivory text-sm font-semibold text-navy transition-colors duration-200 hover:bg-ivory/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60"
                    >
                      Next
                    </button>
                  </form>
                </div>

                <div
                  className={faceSurface}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: flipped ? 'auto' : 'none'
                  }}
                >
                  <form className="flex h-full flex-col" onSubmit={handlePasswordSubmit} noValidate>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={handleReturnToIdentity}
                      className="inline-flex w-fit items-center gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ivory/55 transition-colors duration-200 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Back
                    </button>

                    <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">Clearance</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ivory">Security key</h2>
                    {identity.trim() ? (
                      <p className="mt-2 truncate text-sm text-ivory/55">
                        Clearance for: <span className="text-ivory/80">{identity.trim()}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-ivory/55">Enter the assigned password or security key.</p>
                    )}

                    <label htmlFor={passwordId} className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ivory/70">
                      Password / Security Key
                    </label>
                    <input
                      ref={passwordRef}
                      id={passwordId}
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      disabled={isVerifying}
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby={passwordError ? passwordErrorId : undefined}
                      placeholder="••••••••"
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (passwordError) {
                          setPasswordError('');
                        }
                      }}
                      className={`${fieldClass} ${passwordError ? 'border-gold/50' : ''}`}
                    />
                    <div className="min-h-6 pt-1.5">
                      <AnimatePresence>
                        {passwordError ? (
                          <motion.p
                            id={passwordErrorId}
                            role="alert"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[0.78rem] text-[#E4D2A0]"
                          >
                            {passwordError}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="mt-auto min-h-11 w-full rounded-xl bg-ivory text-sm font-semibold text-navy transition-colors duration-200 hover:bg-ivory/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60"
                    >
                      Authenticate
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <AnimatePresence>
            {isVerifying ? (
              <motion.div
                key="vault-lock"
                className="absolute inset-0 grid place-items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: isUnlocked ? [1, 1.12, 1] : 1 }}
                exit={{ opacity: 0 }}
                transition={
                  isUnlocked
                    ? { scale: { type: 'spring', stiffness: 380, damping: 16 } }
                    : { duration: 0.25 }
                }
              >
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-[6px] rounded-full border border-gold/25"
                  animate={
                    isUnlocked
                      ? { borderColor: 'rgba(90, 138, 138, 0.45)', opacity: 1 }
                      : { opacity: [0.28, 0.55, 0.28], scale: [1, 1.04, 1] }
                  }
                  transition={isUnlocked ? { duration: 0.35 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  animate={isUnlocked ? { rotate: 0 } : { rotate: 360 }}
                  transition={
                    isUnlocked
                      ? { duration: 0.28, ease: 'easeOut' }
                      : { duration: 2.4, repeat: Infinity, ease: 'linear' }
                  }
                >
                  {isUnlocked ? (
                    <Unlock className="h-8 w-8 text-[#8FB8B0]" strokeWidth={1.6} />
                  ) : (
                    <Lock className="h-8 w-8 text-gold" strokeWidth={1.6} />
                  )}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {isUnlocked ? 'Access granted.' : isVerifying ? 'Verifying clearance.' : ''}
      </p>

      <AnimatePresence>
        {!flipped && !isVerifying ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.28 }}
          >
            <MagneticDiscordButton disabled={isVerifying} onClick={beginUnlock} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
