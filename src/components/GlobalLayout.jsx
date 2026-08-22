import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ltfiluaddwebijhbipdb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window === 'undefined' ? undefined : window.localStorage
  }
});

const ACTIVE_PERSONNEL_KEY = 'wlr-active-personnel-id';
const LANG_KEY = 'wlr-command-lang';
const THEME_KEY = 'wlr-command-theme';

const COPY = {
  en: {
    brand: 'WHITE LION REGIMENT',
    menu: 'Open menu',
    close: 'Close menu',
    signOut: 'Sign Out',
    personnel: 'Personnel',
    operations: 'Operations',
    archive: 'Archive',
    command: 'Command',
    dashboard: 'Directory',
    board: 'Tactical Board',
    documents: 'Official Documents',
    settings: 'Settings',
    switch: 'Switch personnel',
    home: 'Command Home'
  },
  th: {
    brand: 'WHITE LION REGIMENT',
    menu: 'เปิดเมนู',
    close: 'ปิดเมนู',
    signOut: 'ออกจากระบบ',
    personnel: 'กำลังพล',
    operations: 'ปฏิบัติการ',
    archive: 'คลังเอกสาร',
    command: 'ศูนย์บัญชาการ',
    dashboard: 'ทำเนียบ',
    board: 'บอร์ดปฏิบัติการ',
    documents: 'เอกสารราชการ',
    settings: 'การตั้งค่า',
    switch: 'สลับแฟ้มกำลังพล',
    home: 'หน้าหลัก'
  }
};

const CommandContext = createContext(null);

export function useCommand() {
  const value = useContext(CommandContext);
  if (!value) {
    throw new Error('useCommand must be used inside CommandProvider.');
  }
  return value;
}

function formatPersonnelName(row) {
  if (!row) {
    return '';
  }
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim();
}

function readStoredTheme() {
  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function CommandProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [session, setSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activePersonnel, setActivePersonnelState] = useState(null);
  const [lang, setLangState] = useState(() => (window.localStorage.getItem(LANG_KEY) === 'th' ? 'th' : 'en'));
  const [theme, setThemeState] = useState(readStoredTheme);
  const [zenMode, setZenMode] = useState(false);

  const loadRoster = useCallback(async (authSession) => {
    if (!authSession?.user) {
      setProfiles([]);
      setActivePersonnelState(null);
      return;
    }
    const { data, error } = await supabase
      .from('oc_personnel')
      .select('*')
      .eq('owner_user_id', authSession.user.id)
      .order('first_name', { ascending: true });
    if (error) {
      throw error;
    }
    const owned = data || [];
    setProfiles(owned);
    const preferred = window.localStorage.getItem(ACTIVE_PERSONNEL_KEY);
    const { data: state } = await supabase
      .from('oc_auth_state')
      .select('active_personnel_id')
      .eq('auth_user_id', authSession.user.id)
      .maybeSingle();
    const activeId = state?.active_personnel_id || preferred;
    const selected = owned.find((row) => row.id === activeId) || (owned.length === 1 ? owned[0] : null);
    if (selected) {
      window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, selected.id);
    }
    setActivePersonnelState(selected);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }
      setSession(data.session);
      try {
        await loadRoster(data.session);
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }
    boot();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadRoster(nextSession).catch(() => {
        setProfiles([]);
        setActivePersonnelState(null);
      });
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadRoster]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(LANG_KEY, lang);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [lang, theme]);

  const setActivePersonnel = useCallback(
    async (personnelId) => {
      window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, personnelId);
      const { error } = await supabase.rpc('set_active_personnel', { p_personnel_id: personnelId });
      if (error) {
        throw error;
      }
      setActivePersonnelState(profiles.find((row) => row.id === personnelId) || null);
    },
    [profiles]
  );

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(ACTIVE_PERSONNEL_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfiles([]);
    setActivePersonnelState(null);
  }, []);

  const value = useMemo(
    () => ({
      bootstrapping,
      session,
      profiles,
      activePersonnel,
      lang,
      theme,
      zenMode,
      copy: COPY[lang],
      formatPersonnelName,
      setLang: setLangState,
      setTheme: setThemeState,
      setZenMode,
      setActivePersonnel,
      refresh: () => loadRoster(session),
      signOut,
      supabase
    }),
    [activePersonnel, bootstrapping, lang, loadRoster, profiles, session, setActivePersonnel, signOut, theme, zenMode]
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

const NAV = [
  {
    id: 'personnel',
    labelKey: 'personnel',
    links: [
      { to: '/', labelKey: 'dashboard', end: true },
      { to: '/select', labelKey: 'switch' }
    ]
  },
  {
    id: 'operations',
    labelKey: 'operations',
    links: [{ to: '/operations', labelKey: 'board' }]
  },
  {
    id: 'archive',
    labelKey: 'archive',
    links: [{ to: '/documents', labelKey: 'documents' }]
  },
  {
    id: 'command',
    labelKey: 'command',
    links: [{ to: '/settings', labelKey: 'settings' }]
  }
];

function BrandMark({ compact = false }) {
  const { copy } = useCommand();
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-3 no-underline">
      <img
        src={`${import.meta.env.BASE_URL}assets/1.jpg`}
        alt={copy.brand}
        className="h-12 w-12 rounded-xl border border-stone-200/80 bg-white object-contain p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <span
        className={`font-semibold tracking-[0.14em] text-slate-800 dark:text-slate-100 ${
          compact ? 'max-w-[9.5rem] text-xs leading-snug' : 'truncate text-sm'
        }`}
      >
        {copy.brand}
      </span>
    </NavLink>
  );
}

function NavGroups({ onNavigate }) {
  const { copy } = useCommand();
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {NAV.map((group) => (
        <section key={group.id}>
          <h2 className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {copy[group.labelKey]}
          </h2>
          <div className="grid gap-1">
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={Boolean(link.end)}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition duration-300 ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-800 shadow-sm dark:bg-indigo-400/15 dark:text-indigo-200'
                      : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/5'
                  }`
                }
              >
                {copy[link.labelKey]}
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HamburgerButton({ open, onToggle, labels }) {
  return (
    <button
      type="button"
      className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-stone-200/80 bg-white/70 shadow-sm backdrop-blur-xl lg:hidden dark:border-slate-700/80 dark:bg-slate-900/75"
      aria-expanded={open}
      aria-controls="command-drawer"
      aria-label={open ? labels.close : labels.menu}
      onClick={onToggle}
    >
      <span className="relative block h-3.5 w-4">
        <motion.span
          className="absolute left-0 top-0 block h-0.5 w-4 origin-center rounded-full bg-slate-800 dark:bg-slate-100"
          animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        />
        <motion.span
          className="absolute left-0 top-[6px] block h-0.5 w-4 rounded-full bg-slate-800 dark:bg-slate-100"
          animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        />
        <motion.span
          className="absolute left-0 top-[12px] block h-0.5 w-4 origin-center rounded-full bg-slate-800 dark:bg-slate-100"
          animate={open ? { y: -6, rotate: -45 } : { y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        />
      </span>
    </button>
  );
}

function LangThemeControls() {
  const { lang, setLang, theme, setTheme } = useCommand();
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-xl border border-stone-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80">
        {['th', 'en'].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.08em] transition ${
              lang === code ? 'bg-indigo-700 text-white dark:bg-indigo-300 dark:text-slate-900' : 'text-slate-500'
            }`}
          >
            {code}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="min-h-11 rounded-xl border border-stone-200/80 bg-white/80 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  );
}

export function GlobalLayout() {
  const { copy, activePersonnel, formatPersonnelName, signOut, zenMode } = useCommand();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen lg:pl-[268px]">
      <motion.aside
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[268px] lg:flex-col lg:border-r lg:border-stone-200/70 lg:bg-white/55 lg:px-4 lg:py-5 lg:backdrop-blur-xl dark:lg:border-slate-800/80 dark:lg:bg-slate-950/55"
        animate={{ opacity: zenMode ? 0.28 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 border-b border-stone-200/80 pb-5 dark:border-slate-800">
          <BrandMark compact />
        </div>
        <NavGroups />
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {copy.signOut}
        </button>
      </motion.aside>

      <motion.header
        className="sticky top-0 z-40 flex h-[72px] items-center justify-between gap-4 border-b border-stone-200/70 bg-white/55 px-4 backdrop-blur-xl sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/55"
        animate={{ opacity: zenMode ? 0.22 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HamburgerButton open={open} onToggle={() => setOpen((value) => !value)} labels={copy} />
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <p className="hidden min-w-0 truncate text-sm font-medium text-slate-500 lg:block">
            {formatPersonnelName(activePersonnel) || copy.home}
          </p>
        </div>
        <LangThemeControls />
      </motion.header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="drawer-backdrop"
              type="button"
              aria-label={copy.close}
              className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              id="command-drawer"
              key="drawer-panel"
              className="fixed left-0 top-[72px] z-50 flex max-h-[min(78dvh,calc(100dvh-72px))] w-[min(320px,100%)] flex-col gap-4 overflow-y-auto rounded-br-2xl border-b border-r border-white/50 bg-white/70 p-4 shadow-[0_28px_80px_rgba(28,25,23,0.16)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-slate-900/80"
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <NavGroups onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {copy.signOut}
              </button>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>

      <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <motion.nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-stone-200/80 bg-white/80 py-1 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-950/80"
        animate={{ opacity: zenMode ? 0.18 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {[
          { to: '/', label: copy.dashboard, end: true },
          { to: '/operations', label: copy.board },
          { to: '/documents', label: copy.documents },
          { to: '/settings', label: copy.settings }
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={Boolean(item.end)}
            className={({ isActive }) =>
              `grid min-h-11 place-items-center px-1 text-center text-[0.7rem] font-semibold no-underline ${
                isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </motion.nav>
    </div>
  );
}
