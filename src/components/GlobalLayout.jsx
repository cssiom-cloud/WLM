import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ClipboardList, FileText, LogOut, Settings, UserRoundCog, Users } from 'lucide-react';

const AUTH_STORAGE_KEY = 'wlr-command-auth-v1';
const spring = { type: 'spring', stiffness: 300, damping: 30 };
const pageTransition = { duration: 0.4, ease: 'easeInOut' };
const zenFade = { duration: 0.4, ease: 'easeInOut' };

const ZenModeContext = createContext(null);

export function useZenMode() {
  const value = useContext(ZenModeContext);
  if (!value) {
    throw new Error('useZenMode must be used inside GlobalLayout.');
  }
  return value;
}

const PLACEHOLDER_ROSTER = [
  {
    id: 'p-somchai',
    first_name: 'Somchai',
    middle_name: '',
    last_name: '',
    military_rank: 'CPL.',
    organization_role: 'Personnel',
    initials: 'CS',
    avatar_url: '',
    is_dev: false,
    owner_user_id: 'local-command'
  },
  {
    id: 'p-arthit',
    first_name: 'Arthit',
    middle_name: '',
    last_name: '',
    military_rank: 'SGT.',
    organization_role: 'Operations',
    initials: 'SA',
    avatar_url: '',
    is_dev: false,
    owner_user_id: 'local-command'
  }
];

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', detail: 'Personnel', icon: Users, end: true },
  { to: '/operations', label: 'Operations Board', detail: 'Operations', icon: ClipboardList },
  { to: '/documents', label: 'Official Documents', detail: 'Archive', icon: FileText },
  { to: '/settings', label: 'Settings', detail: 'Command', icon: Settings }
];

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') {
      return { isAuthenticated: false, activePersonnelId: null };
    }
    return {
      isAuthenticated: Boolean(parsed.isAuthenticated),
      activePersonnelId: parsed.activePersonnelId || null
    };
  } catch {
    return { isAuthenticated: false, activePersonnelId: null };
  }
}

function persistAuth(next) {
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      isAuthenticated: next.isAuthenticated,
      activePersonnelId: next.activePersonnelId
    })
  );
}

export function formatPersonnelName(row) {
  if (!row) {
    return '';
  }
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim();
}

export function displayRankName(row) {
  if (!row) {
    return 'Personnel';
  }
  return [row.military_rank, formatPersonnelName(row)].filter(Boolean).join(' ');
}

function initialsFromPerson(row) {
  if (row?.initials) {
    return row.initials;
  }
  return formatPersonnelName(row)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'WL';
}

function createRosterClient(roster) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            order() {
              return Promise.resolve({ data: roster, error: null });
            }
          };
        }
      };
    }
  };
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}

export function useCommand() {
  const auth = useAuth();
  return {
    bootstrapping: auth.bootstrapping,
    session: auth.isAuthenticated ? { user: auth.user } : null,
    profiles: auth.profiles,
    activePersonnel: auth.activePersonnel,
    lang: 'en',
    theme: 'light',
    formatPersonnelName,
    signOut: auth.logout,
    supabase: auth.supabase,
    setActivePersonnel: auth.selectProfile,
    refresh: auth.refresh
  };
}

export function AuthProvider({ children }) {
  const stored = readStoredAuth();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(stored.isAuthenticated);
  const [profiles] = useState(PLACEHOLDER_ROSTER);
  const [activePersonnelId, setActivePersonnelId] = useState(stored.activePersonnelId);

  useEffect(() => {
    setBootstrapping(false);
  }, []);

  useEffect(() => {
    persistAuth({ isAuthenticated, activePersonnelId });
  }, [activePersonnelId, isAuthenticated]);

  const activePersonnel = useMemo(
    () => profiles.find((row) => row.id === activePersonnelId) || null,
    [activePersonnelId, profiles]
  );

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setActivePersonnelId(null);
    persistAuth({ isAuthenticated: false, activePersonnelId: null });
  }, []);

  const selectProfile = useCallback((personnelId) => {
    setActivePersonnelId(personnelId);
    return Promise.resolve();
  }, []);

  const refresh = useCallback(() => Promise.resolve(), []);

  const supabase = useMemo(() => createRosterClient(profiles), [profiles]);

  const user = useMemo(
    () => ({
      rank: activePersonnel?.military_rank || 'CPL.',
      name: formatPersonnelName(activePersonnel) || 'Somchai',
      initials: initialsFromPerson(activePersonnel || PLACEHOLDER_ROSTER[0])
    }),
    [activePersonnel]
  );

  const value = useMemo(
    () => ({
      bootstrapping,
      isAuthenticated,
      profiles,
      activePersonnel,
      user,
      supabase,
      login,
      logout,
      selectProfile,
      refresh,
      formatPersonnelName
    }),
    [activePersonnel, bootstrapping, isAuthenticated, login, logout, profiles, refresh, selectProfile, supabase, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function BrandMark({ compact = false }) {
  return (
    <NavLink
      to="/dashboard"
      className="group flex min-w-0 items-center gap-3 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-navy/10 bg-navy text-[0.62rem] font-semibold tracking-[0.14em] text-ivory shadow-sm">
        WLR
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold tracking-[0.08em] text-navy ${compact ? 'text-xs' : 'text-sm'}`}>
          W.L.R
        </span>
        <span className={`block truncate font-medium text-slate-500 ${compact ? 'text-[0.68rem]' : 'text-xs'}`}>
          Command Personnel
        </span>
      </span>
    </NavLink>
  );
}

function SidebarNav({ onNavigate }) {
  return (
    <nav aria-label="Command navigation" className="flex flex-1 flex-col gap-6">
      <div className="grid gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end)}
              onClick={onNavigate}
              className="block rounded-xl no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {({ isActive }) => (
                <span
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    isActive ? 'bg-navy/[0.06] text-navy' : 'text-slate-600 hover:bg-white/70 hover:text-navy'
                  }`}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gold"
                    />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className="block text-[0.68rem] font-medium tracking-[0.06em] text-slate-400">
                      {item.detail}
                    </span>
                  </span>
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className="border-t border-navy/10 pt-4">
        <NavLink
          to="/select"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 no-underline transition-colors duration-200 hover:bg-white/70 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <UserRoundCog className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Switch profile
        </NavLink>
      </div>
    </nav>
  );
}

function HamburgerButton({ open, onToggle }) {
  return (
    <button
      type="button"
      className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-navy/10 bg-white/70 shadow-sm backdrop-blur-xl lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      aria-expanded={open}
      aria-controls="command-drawer"
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      onClick={onToggle}
    >
      <span className="relative block h-3.5 w-[18px]" aria-hidden="true">
        <motion.span
          className="absolute left-0 top-0 block h-0.5 w-full origin-center rounded-full bg-navy"
          animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }}
          transition={spring}
        />
        <motion.span
          className="absolute left-0 top-[6px] block h-0.5 w-full rounded-full bg-navy"
          animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={spring}
        />
        <motion.span
          className="absolute left-0 top-[12px] block h-0.5 w-full origin-center rounded-full bg-navy"
          animate={open ? { y: -6, rotate: -45 } : { y: 0, rotate: 0 }}
          transition={spring}
        />
      </span>
    </button>
  );
}

function UserChip({ person }) {
  const label = displayRankName(person);
  const initials = initialsFromPerson(person);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/40 bg-navy text-[0.7rem] font-semibold tracking-[0.08em] text-ivory"
      >
        {initials}
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-sm font-semibold text-navy">{label}</span>
        <span className="block text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-400">
          Active personnel
        </span>
      </span>
    </div>
  );
}

export function GlobalLayout() {
  const { activePersonnel, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [zen, setZen] = useState(false);
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const zenValue = useMemo(() => ({ zen, setZen }), [zen]);
  const chromeOpacity = { opacity: zen ? 0.38 : 1 };
  const chromeFade = reduceMotion ? { duration: 0 } : zenFade;

  useEffect(() => {
    setOpen(false);
    setZen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <ZenModeContext.Provider value={zenValue}>
    <div className="min-h-screen bg-ivory lg:pl-[280px] print:pl-0" data-zen={zen ? 'true' : 'false'}>
      <motion.aside
        className="hidden print:hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[280px] lg:flex-col lg:border-r lg:border-navy/10 lg:bg-white/55 lg:px-4 lg:py-5 lg:shadow-glass lg:backdrop-blur-xl"
        animate={chromeOpacity}
        transition={chromeFade}
        style={{ pointerEvents: zen ? 'none' : 'auto' }}
      >
        <div className="mb-6 border-b border-navy/10 pb-5">
          <BrandMark compact />
        </div>
        <SidebarNav />
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-white/70 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign out
        </button>
      </motion.aside>

      <motion.header
        className="sticky top-0 z-40 flex h-[72px] items-center justify-between gap-4 border-b border-navy/10 bg-white/55 px-4 shadow-[0_8px_24px_rgba(11,31,58,0.04)] backdrop-blur-xl print:hidden sm:px-6"
        animate={chromeOpacity}
        transition={chromeFade}
        style={{ pointerEvents: zen ? 'none' : 'auto' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HamburgerButton open={open} onToggle={() => setOpen((value) => !value)} />
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <p className="hidden truncate text-sm font-medium text-slate-500 lg:block">
            Personnel command portal
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <UserChip person={activePersonnel} />
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-3 text-sm font-semibold text-navy backdrop-blur-xl transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="drawer-backdrop"
              type="button"
              aria-label="Close navigation menu"
              className="fixed inset-0 z-40 bg-navy/25 backdrop-blur-sm print:hidden lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              id="command-drawer"
              key="drawer-panel"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col border-r border-navy/10 bg-white/75 px-4 py-5 shadow-glass backdrop-blur-xl print:hidden lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={spring}
            >
              <div className="mb-6 border-b border-navy/10 pb-5">
                <BrandMark compact />
              </div>
              <SidebarNav onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-4 inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-white/70 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                Sign out
              </button>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="px-4 py-6 sm:px-6 lg:px-8 print:p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={pageTransition}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
    </ZenModeContext.Provider>
  );
}
