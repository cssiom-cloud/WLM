import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Building2,
  FileText,
  FolderOpen,
  Home,
  KeyRound,
  LogOut,
  Map,
  Megaphone,
  Network,
  PlusCircle,
  ScrollText,
  Settings,
  Shield,
  Ticket,
  Users,
  Zap,
  AlertTriangle,
  Download
} from 'lucide-react';
import CommandAtmosphere from './CommandAtmosphere.jsx';
import TacticalDock from './TacticalDock.jsx';
import { SITE_LOGO } from '../lib/brand.js';
import { isAdmin as roleIsAdmin, isDev, markLoginSeal } from '../lib/access.js';
import { t as translate } from '../lib/i18n.js';
import { createPersonnelProfile as createPersonnelProfileRow, fetchOwnSettings, saveOwnSettings } from '../lib/services.js';
import { supabase } from '../lib/supabase.js';
import { writeUiMode } from '../../js/ui-mode.js';
import { startAnnouncementWatcher } from '../../js/notification-service.js';
import { checkStartupUpdate } from '../../js/app-updater.js';
import { applyLiveHotPatch } from '../../js/hot-updater.js';
import { openUpdateLink } from '../../js/updater.js';
import {
  applyPrefsToDom,
  mergeRemoteSettings,
  readLocalPrefs,
  savePrefsOrOmitScale,
  setPrefsOwner,
  writeLocalPrefs
} from '../../js/user-prefs.js';

export { supabase };

const ACTIVE_PERSONNEL_KEY = 'wlr-active-personnel-id';

function layoutCopy(lang) {
  const tx = (key) => translate(lang, key);
  return {
    brand: 'WHITE LION REGIMENT',
    menu: tx('nav.menu'),
    close: lang === 'th' ? 'ปิดเมนู' : 'Close menu',
    signOut: tx('nav.signOut'),
    personnel: tx('nav.group.personnel'),
    operations: tx('nav.group.operations'),
    archive: tx('nav.group.archive'),
    support: tx('nav.group.support'),
    command: tx('nav.group.command'),
    dashboard: tx('nav.directory'),
    board: tx('nav.operations'),
    announcements: tx('nav.announcements'),
    documents: tx('nav.memo'),
    settings: tx('nav.settings'),
    switch: tx('nav.profiles'),
    home: tx('nav.home')
  };
}

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

export function CommandProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [session, setSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activePersonnel, setActivePersonnelState] = useState(null);
  const [lang, setLangState] = useState(() => readLocalPrefs().locale);
  const [theme, setThemeState] = useState(() => readLocalPrefs().color_theme);
  const [rain, setRainState] = useState(() => readLocalPrefs().rain);
  const [glassVisible, setGlassVisibleState] = useState(() => readLocalPrefs().glass_visible);
  const [glassMotion, setGlassMotionState] = useState(() => readLocalPrefs().glass_motion);
  const [uiScale, setUiScaleState] = useState(() => readLocalPrefs().ui_scale);
  const [zenMode, setZenMode] = useState(false);
  const [authHold, setAuthHold] = useState(false);
  const [startupUpdate, setStartupUpdate] = useState(null);
  const [hotpatching, setHotpatching] = useState(false);
  const [hotpatchStatus, setHotpatchStatus] = useState('');
  const [hotpatchPct, setHotpatchPct] = useState(0);
  const rosterGen = useRef(0);
  const skipPersist = useRef(true);

  const hydratePersonnelPrefs = useCallback(async (personnelId) => {
    if (!personnelId) {
      return;
    }
    skipPersist.current = true;
    setPrefsOwner(personnelId);
    const cached = readLocalPrefs(personnelId);
    applyPrefsToDom(cached);
    setLangState(cached.locale);
    setThemeState(cached.color_theme);
    setRainState(cached.rain);
    setGlassVisibleState(cached.glass_visible);
    setGlassMotionState(cached.glass_motion);
    setUiScaleState(cached.ui_scale);
    try {
      const settings = await fetchOwnSettings(supabase, personnelId);
      const prefs = mergeRemoteSettings(settings, cached);
      writeLocalPrefs(personnelId, prefs);
      applyPrefsToDom(prefs);
      setLangState(prefs.locale);
      setThemeState(prefs.color_theme);
      setRainState(prefs.rain);
      setGlassVisibleState(prefs.glass_visible);
      setGlassMotionState(prefs.glass_motion);
      setUiScaleState(prefs.ui_scale);
      writeUiMode(prefs.ui_skin);
      if (!settings?.prefs_synced) {
        savePrefsOrOmitScale((payload) => saveOwnSettings(supabase, personnelId, payload), prefs).catch(() => {});
      }
    } catch {
      writeLocalPrefs(personnelId, cached);
    } finally {
      skipPersist.current = false;
    }
  }, []);

  const loadRoster = useCallback(async (authSession) => {
    const gen = ++rosterGen.current;
    if (!authSession?.user) {
      if (gen === rosterGen.current) {
        setProfiles([]);
        setActivePersonnelState(null);
      }
      return null;
    }
    let owned = [];
    const ownedResult = await supabase
      .from('oc_personnel')
      .select('*')
      .eq('owner_user_id', authSession.user.id)
      .order('first_name', { ascending: true });
    if (!ownedResult.error) {
      owned = ownedResult.data || [];
    }
    if (!owned.length) {
      const { data: legacy, error: legacyError } = await supabase
        .from('oc_personnel')
        .select('*')
        .eq('id', authSession.user.id)
        .maybeSingle();
      if (legacyError && ownedResult.error) {
        throw ownedResult.error;
      }
      owned = legacy ? [legacy] : [];
    }
    if (gen !== rosterGen.current) {
      return null;
    }
    setProfiles(owned);
    const preferred = window.localStorage.getItem(ACTIVE_PERSONNEL_KEY);
    const { data: state } = await supabase
      .from('oc_auth_state')
      .select('active_personnel_id')
      .eq('auth_user_id', authSession.user.id)
      .maybeSingle();
    const activeId = state?.active_personnel_id || preferred;
    const selected = owned.find((row) => row.id === activeId) || owned[0] || null;
    if (selected) {
      window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, selected.id);
      await hydratePersonnelPrefs(selected.id);
    }
    if (gen === rosterGen.current) {
      setActivePersonnelState(selected);
    }
    return selected;
  }, [hydratePersonnelPrefs]);

  useEffect(() => {
    let cancelled = false;
    async function consumeOAuthCode() {
      const url = new URL(window.location.href);
      const hasCode = Boolean(url.searchParams.get('code')) || /access_token|refresh_token/.test(url.hash);
      if (!hasCode) {
        return;
      }
      const first = await supabase.auth.getSession();
      if (!first.data.session) {
        try {
          await supabase.auth.exchangeCodeForSession(url.href);
        } catch {
          /* detectSessionInUrl may already have consumed the code */
        }
      }
      const clean = new URL(window.location.href);
      ['code', 'state', 'error', 'error_description', 'error_code'].forEach((key) => {
        clean.searchParams.delete(key);
      });
      if (/access_token|refresh_token|error/.test(clean.hash)) {
        clean.hash = '';
      }
      window.history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`);
      const { data: authed } = await supabase.auth.getSession();
      const onLogin = /\/login$/.test(clean.pathname.replace(/\/+$/, ''));
      if (authed.session && onLogin) {
        markLoginSeal();
        setAuthHold(true);
      }
    }
    async function boot() {
      await consumeOAuthCode();
      const { data } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }
      setSession(data.session);
      try {
        await loadRoster(data.session);
      } finally {
        if (!cancelled) {
          skipPersist.current = false;
          setBootstrapping(false);
        }
      }
    }
    boot();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
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
    applyPrefsToDom(readLocalPrefs());
    if (supabase) {
      startAnnouncementWatcher(supabase);
      checkStartupUpdate(supabase).then((info) => {
        if (info?.updateAvailable && !info.dismissed) {
          setStartupUpdate(info);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const prefs = applyPrefsToDom({
      locale: lang,
      color_theme: theme,
      rain,
      glass_visible: glassVisible,
      glass_motion: glassMotion,
      ui_scale: uiScale,
      theme_accent: readLocalPrefs(activePersonnel?.id || '').theme_accent,
      ui_skin: readLocalPrefs(activePersonnel?.id || '').ui_skin
    });
    if (skipPersist.current) {
      return undefined;
    }
    writeLocalPrefs(activePersonnel?.id || '', prefs);
    if (!activePersonnel?.id) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      savePrefsOrOmitScale((payload) => saveOwnSettings(supabase, activePersonnel.id, payload), prefs).catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [lang, theme, rain, glassVisible, glassMotion, uiScale, activePersonnel]);

  const setActivePersonnel = useCallback(
    async (personnelId) => {
      window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, personnelId);
      const { error } = await supabase.rpc('set_active_personnel', { p_personnel_id: personnelId });
      if (error) {
        throw error;
      }
      setActivePersonnelState(profiles.find((row) => row.id === personnelId) || null);
      await hydratePersonnelPrefs(personnelId);
    },
    [hydratePersonnelPrefs, profiles]
  );

  const createPersonnelProfile = useCallback(
    async ({ firstName = '', lastName = '' } = {}) => {
      const row = await createPersonnelProfileRow(supabase, { firstName, lastName });
      window.localStorage.setItem(ACTIVE_PERSONNEL_KEY, row.id);
      await loadRoster(session);
      return row;
    },
    [loadRoster, session]
  );

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(ACTIVE_PERSONNEL_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setProfiles([]);
    setActivePersonnelState(null);
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);

  const handleStartupHotPatch = useCallback(async () => {
    setHotpatching(true);
    try {
      await applyLiveHotPatch((p) => {
        if (p.stage === 'downloading') {
          const pct = Math.round((p.current / p.total) * 100);
          setHotpatchStatus(`Downloading ${p.fileName}...`);
          setHotpatchPct(pct);
        } else if (p.stage === 'applying') {
          setHotpatchStatus(t('hotUpdate.applying'));
        } else if (p.stage === 'success') {
          setHotpatchStatus(t('hotUpdate.success'));
          setHotpatchPct(100);
        }
      });
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err) {
      setHotpatchStatus(err.message);
      setHotpatching(false);
    }
  }, [t]);

  const value = useMemo(
    () => ({
      bootstrapping,
      session,
      profiles,
      activePersonnel,
      lang,
      theme,
      rain,
      glassVisible,
      glassMotion,
      uiScale,
      zenMode,
      authHold,
      startupUpdate,
      setStartupUpdate,
      hotpatching,
      hotpatchStatus,
      hotpatchPct,
      handleStartupHotPatch,
      copy: layoutCopy(lang),
      t,
      isAdmin: roleIsAdmin(activePersonnel),
      isDev: isDev(activePersonnel),
      formatPersonnelName,
      setLang: setLangState,
      setTheme: setThemeState,
      setRain: setRainState,
      setGlassVisible: setGlassVisibleState,
      setGlassMotion: setGlassMotionState,
      setUiScale: setUiScaleState,
      setZenMode,
      setAuthHold,
      setActivePersonnel,
      createPersonnelProfile,
      refresh: async (sessionOverride) => {
        let next = sessionOverride;
        if (!next?.user) {
          const { data } = await supabase.auth.getSession();
          next = data.session;
        }
        setSession(next);
        return loadRoster(next);
      },
      signOut,
      supabase
    }),
    [
      activePersonnel,
      bootstrapping,
      createPersonnelProfile,
      lang,
      loadRoster,
      profiles,
      session,
      setActivePersonnel,
      signOut,
      t,
      theme,
      rain,
      glassVisible,
      glassMotion,
      uiScale,
      zenMode,
      authHold
    ]
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

const NAV_ICONS = {
  '/': Home,
  '/directory': Users,
  '/org': Network,
  '/units': Building2,
  '/operations': Map,
  '/announcements': Megaphone,
  '/announcements/create': PlusCircle,
  '/lore': BookOpen,
  '/library': FolderOpen,
  '/memo': FileText,
  '/tickets': Ticket,
  '/admin': Shield,
  '/accounts': KeyRound,
  '/settings': Settings,
  '/logs': ScrollText
};

const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
};

function navGroupsFor(person, session) {
  const authed = Boolean(session);
  const admin = roleIsAdmin(person);
  const personnel = [
    { to: '/', labelKey: 'nav.home', end: true },
    { to: '/directory', labelKey: 'nav.directory' },
    { to: '/org', labelKey: 'nav.org' }
  ];
  if (authed) {
    personnel.push({ to: '/units', labelKey: 'nav.units' });
  }
  const operations = [
    { to: '/operations', labelKey: 'nav.operations' },
    { to: '/announcements', labelKey: 'nav.announcements' }
  ];
  if (admin) {
    operations.push({ to: '/announcements/create', labelKey: 'nav.createAnnouncement' });
  }
  const archive = [
    { to: '/lore', labelKey: 'nav.lore' },
    { to: '/library', labelKey: 'nav.documents' }
  ];
  if (authed) {
    archive.push({ to: '/memo', labelKey: 'nav.memo' });
  }
  const support = [{ to: '/tickets', labelKey: 'nav.tickets' }];
  const command = [];
  if (admin) {
    command.push({ to: '/admin', labelKey: 'nav.adminPage' });
    command.push({ to: '/accounts', labelKey: 'nav.accounts' });
  }
  if (authed) {
    command.push({ to: '/settings', labelKey: 'nav.settings' });
    command.push({ to: '/logs', labelKey: 'nav.logs' });
  }
  return [
    { id: 'personnel', labelKey: 'nav.group.personnel', links: personnel },
    { id: 'operations', labelKey: 'nav.group.operations', links: operations },
    { id: 'archive', labelKey: 'nav.group.archive', links: archive },
    { id: 'support', labelKey: 'nav.group.support', links: support },
    { id: 'command', labelKey: 'nav.group.command', links: command }
  ];
}

function BrandMark({ compact = false }) {
  const { copy } = useCommand();
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-3 no-underline">
      <img
        src={SITE_LOGO}
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

function allNavLinks(person, session) {
  return navGroupsFor(person, session).flatMap((group) => group.links);
}

function NavGroups({ onNavigate, compact = false }) {
  const { t, session, activePersonnel } = useCommand();
  const groups = navGroupsFor(activePersonnel, session);
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {groups.map((group) =>
        group.links.length ? (
          <section key={group.id}>
            {compact ? null : (
              <h2 className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t(group.labelKey)}
              </h2>
            )}
            <div className="grid gap-1">
              {group.links.map((link) => {
                const Icon = NAV_ICONS[link.to] || FileText;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={Boolean(link.end)}
                    onClick={onNavigate}
                    title={t(link.labelKey)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition duration-300 ${
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm'
                          : 'text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden="true" />
                    <span className="truncate">{t(link.labelKey)}</span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function IconRail({ onSignOut, signOutLabel }) {
  const { t, session, activePersonnel } = useCommand();
  const links = allNavLinks(activePersonnel, session);
  return (
    <aside className="fixed inset-y-0 left-0 z-[90] hidden w-[72px] flex-col border-r border-[var(--border)] bg-[var(--glass-bg)] py-4 text-[var(--text)] backdrop-blur-xl lg:flex">
      <NavLink to="/" className="mb-3 grid place-items-center px-2" title={t('nav.home')} aria-label={t('nav.home')}>
        <img src={SITE_LOGO} alt="" className="h-11 w-11 rounded-xl border border-[var(--border)] bg-white object-contain p-0.5 dark:bg-slate-900" />
      </NavLink>
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
        {links.map((link) => {
          const Icon = NAV_ICONS[link.to] || FileText;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={Boolean(link.end)}
              title={t(link.labelKey)}
              aria-label={t(link.labelKey)}
              className={({ isActive }) =>
                `grid h-11 w-11 place-items-center rounded-xl no-underline transition ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/5'
                }`
              }
            >
              <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.85} aria-hidden="true" />
            </NavLink>
          );
        })}
      </nav>
      <button
        type="button"
        title={signOutLabel}
        aria-label={signOutLabel}
        onClick={onSignOut}
        className="mx-auto mt-2 grid h-11 w-11 place-items-center rounded-xl text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <LogOut className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.85} aria-hidden="true" />
      </button>
    </aside>
  );
}

function MenuGlyph({ open = false }) {
  return (
    <span className="relative block h-3.5 w-4 text-current">
      <motion.span
        className="menu-glyph-bar absolute left-0 top-0 block h-0.5 w-4 origin-center rounded-full"
        animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      />
      <motion.span
        className="menu-glyph-bar absolute left-0 top-[6px] block h-0.5 w-4 rounded-full"
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      />
      <motion.span
        className="menu-glyph-bar absolute left-0 top-[12px] block h-0.5 w-4 origin-center rounded-full"
        animate={open ? { y: -6, rotate: -45 } : { y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      />
    </span>
  );
}

function HamburgerButton({ open, onToggle, labels }) {
  return (
    <button
      type="button"
      className="relative z-50 grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--glass-bg)] text-[var(--text)] shadow-sm backdrop-blur-xl"
      aria-expanded={open}
      aria-controls="command-drawer"
      aria-label={open ? labels.close : labels.menu}
      onClick={onToggle}
    >
      <MenuGlyph open={open} />
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
            className={`min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-500 ${
              lang === code ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {code}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="min-h-11 rounded-xl border border-stone-200/80 bg-white/80 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 backdrop-blur-xl transition-colors duration-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  );
}

function ThemeFlash({ theme }) {
  const [flash, setFlash] = useState(0);
  const previous = useRef(theme);

  useEffect(() => {
    if (previous.current !== theme) {
      previous.current = theme;
      setFlash((value) => value + 1);
    }
  }, [theme]);

  return (
    <AnimatePresence>
      {flash ? (
        <motion.div
          key={flash}
          className="pointer-events-none fixed inset-0 z-[90]"
          initial={{ opacity: 0.42 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: theme === 'dark' ? '#0b0d12' : '#f4f1ea' }}
        />
      ) : null}
    </AnimatePresence>
  );
}

function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <AnimatePresence>
      <motion.div key={location.pathname} className="min-h-full" {...pageMotion}>
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

export function GlobalLayout() {
  const {
    copy,
    t,
    activePersonnel,
    formatPersonnelName,
    signOut,
    zenMode,
    theme,
    rain,
    glassVisible,
    glassMotion,
    startupUpdate,
    setStartupUpdate,
    hotpatching,
    hotpatchStatus,
    hotpatchPct,
    handleStartupHotPatch
  } = useCommand();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
    document.documentElement.classList.remove('overlay-lock');
  }, [location.pathname]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative min-h-screen lg:pl-[72px]">
      <CommandAtmosphere theme={theme} rain={rain} glassVisible={glassVisible} glassMotion={glassMotion} />
      <ThemeFlash theme={theme} />

      <IconRail onSignOut={handleSignOut} signOutLabel={copy.signOut} />

      <motion.header
        className="sticky top-0 z-[90] flex h-[72px] items-center justify-between gap-4 border-b border-stone-200/70 bg-white/55 px-4 backdrop-blur-xl sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/55"
        animate={{ opacity: zenMode ? 0.22 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HamburgerButton open={open} onToggle={() => setOpen((value) => !value)} labels={copy} />
          <BrandMark compact />
          <p className="hidden min-w-0 truncate text-sm font-medium text-slate-600 lg:block dark:text-slate-300">
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
              className="fixed inset-0 z-[94] bg-slate-950/35 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              id="command-drawer"
              key="drawer-panel"
              className="fixed left-0 top-0 z-[95] flex h-dvh w-[min(320px,92vw)] flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-elevated)] p-4 pt-[88px] text-[var(--text)] shadow-[0_28px_80px_rgba(28,25,23,0.16)] backdrop-blur-xl"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <BrandMark compact />
              <NavGroups onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--text)] hover:bg-white/60 dark:hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
                {copy.signOut}
              </button>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>

      <main className="relative z-[1] px-4 pb-36 pt-6 sm:px-6 lg:px-8 lg:pb-40">
        <AnimatedOutlet />
      </main>

      <TacticalDock copy={copy} zenMode={zenMode} />

      <motion.nav
        className="fixed inset-x-0 bottom-0 z-[85] grid grid-cols-4 border-t border-stone-200/80 bg-white/80 py-2 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-950/80"
        animate={{ opacity: zenMode ? 0.18 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {[
          { to: '/', label: copy.home, end: true, icon: Home },
          { to: '/directory', label: copy.dashboard, icon: Users },
          { to: '/announcements', label: t('nav.announcements'), icon: Megaphone },
          { to: '/settings', label: copy.settings, icon: Settings }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end) || item.to === '/announcements'}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.to);
              }}
              className={({ isActive }) =>
                `grid min-h-12 place-items-center gap-1 rounded-xl px-1 text-center text-[0.68rem] font-semibold no-underline ${
                  isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </motion.nav>

      {/* Supabase Startup Auto-Update Notification Modal */}
      <AnimatePresence>
        {startupUpdate ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!startupUpdate.isCritical) {
                  sessionStorage.setItem(`wlr_dismissed_update_${startupUpdate.latestVersion}`, 'true');
                  setStartupUpdate(null);
                }
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95"
            >
              <div className="flex items-center gap-3 text-[var(--accent)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('settings.updateAvailableTitle')}</h3>
                  <p className="text-xs text-slate-500">Supabase Cloud Registry • Official Release</p>
                </div>
              </div>

              {startupUpdate.isCritical ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{t('update.criticalRequired')}</span>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/50">
                <div>
                  <small className="block text-[11px] uppercase tracking-wider text-slate-400">Current</small>
                  <strong className="text-sm font-semibold text-slate-900 dark:text-slate-100">v{startupUpdate.currentVersion}</strong>
                </div>
                <span className="text-slate-400">→</span>
                <div>
                  <small className="block text-[11px] uppercase tracking-wider text-slate-400">New Version</small>
                  <strong className="text-sm font-semibold text-[var(--accent)]">v{startupUpdate.latestVersion}</strong>
                </div>
              </div>

              {startupUpdate.releaseNotes ? (
                <div className="mt-3 max-h-28 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400 whitespace-pre-line">
                  {startupUpdate.releaseNotes}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  disabled={hotpatching}
                  onClick={handleStartupHotPatch}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Zap className={`h-4 w-4 ${hotpatching ? 'animate-bounce' : ''}`} />
                  <span>{hotpatching ? t('hotUpdate.applying') : t('hotUpdate.btn')}</span>
                </button>

                {hotpatching ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/50">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{hotpatchStatus || 'Downloading...'}</span>
                      <span>{hotpatchPct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${hotpatchPct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => openUpdateLink(startupUpdate.downloadUrl)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  <span>{t('settings.downloadSetup')}</span>
                </button>
              </div>

              {!startupUpdate.isCritical ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem(`wlr_dismissed_update_${startupUpdate.latestVersion}`, 'true');
                      setStartupUpdate(null);
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {t('update.remindLater')}
                  </button>
                </div>
              ) : null}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
