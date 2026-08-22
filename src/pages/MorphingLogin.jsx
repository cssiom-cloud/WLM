import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];
const MORPH_TRANSITION = { duration: 0.55, ease: EASE };

const morphByState = {
  idle: { width: "24rem", height: "24rem", borderRadius: "16px" },
  scanning: { width: "5rem", height: "5rem", borderRadius: "50%" },
  success: { width: "20rem", height: "4rem", borderRadius: "9999px" },
};

const innerMotion = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: 0.28, ease: EASE },
};

export default function MorphingLogin() {
  const [loginState, setLoginState] = useState("idle");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  function handleAuthenticate(event) {
    event.preventDefault();
    setLoginState("scanning");
    window.setTimeout(() => {
      setLoginState("success");
    }, 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <motion.div
        className="relative flex items-center justify-center overflow-hidden border border-white/10 bg-slate-800/80 shadow-[0_24px_64px_rgba(2,6,23,0.45)] backdrop-blur-md"
        animate={morphByState[loginState]}
        transition={MORPH_TRANSITION}
      >
        <AnimatePresence mode="wait">
          {loginState === "idle" ? (
            <motion.form
              key="idle"
              onSubmit={handleAuthenticate}
              className="flex h-full w-full flex-col justify-center gap-5 px-8 py-8"
              initial={innerMotion.initial}
              animate={innerMotion.animate}
              exit={innerMotion.exit}
              transition={innerMotion.transition}
            >
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Authorization
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-wide text-slate-50">
                  Command Access
                </h1>
              </div>

              <label className="grid gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Email / Command ID
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-slate-300/60 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.18)]"
                  type="text"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Password
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm font-medium tracking-normal text-slate-100 outline-none transition focus:border-slate-300/60 focus:shadow-[0_0_0_3px_rgba(148,163,184,0.18)]"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <button
                type="submit"
                className="min-h-11 rounded-xl bg-slate-100 text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 transition hover:bg-white"
              >
                Authenticate
              </button>
            </motion.form>
          ) : null}

          {loginState === "scanning" ? (
            <motion.div
              key="scanning"
              className="grid h-full w-full place-items-center"
              initial={innerMotion.initial}
              animate={innerMotion.animate}
              exit={innerMotion.exit}
              transition={innerMotion.transition}
            >
              <motion.span
                className="h-12 w-12 rounded-full border-2 border-slate-500/30 border-t-slate-100 shadow-[0_0_18px_rgba(226,232,240,0.35)]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                aria-hidden="true"
              />
              <span className="sr-only">Verifying clearance</span>
            </motion.div>
          ) : null}

          {loginState === "success" ? (
            <motion.div
              key="success"
              className="flex h-full w-full items-center justify-center gap-3 px-6"
              initial={innerMotion.initial}
              animate={innerMotion.animate}
              exit={innerMotion.exit}
              transition={innerMotion.transition}
            >
              <Check className="h-5 w-5 text-emerald-300" strokeWidth={2.5} aria-hidden="true" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-100">
                CLEARANCE GRANTED
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
