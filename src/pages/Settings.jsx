import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { initialsFromName, oauthRedirectTo } from '../lib/access.js';
import { fetchOwnSettings, saveOwnSettings, writeActivityLog } from '../lib/services.js';
import { applyUiMode, persistUiSkin, readUiMode, reactUiAvailable } from '../../js/ui-mode.js';
import { applyAccent } from '../../js/theme.js';
import { resolvedUiScale } from '../../js/user-prefs.js';
import { btnGhost, btnPrimary, fieldClass, glassClass, CommandCheck } from '../lib/ui.jsx';

const ACCENT_KEY = 'wlr-command-accent';

function DiscordMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.07.07 0 0 0-.079.035c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.035A19.7 19.7 0 0 0 3.677 4.37a.08.08 0 0 0-.037.027C.533 9.047-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.07.07 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.08.08 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.08.08 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.892.08.08 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  );
}

function findDiscordIdentity(user) {
  return (user?.identities || []).find((item) => item.provider === 'discord') || null;
}

function discordDisplay(identity, user) {
  const data = identity?.identity_data || {};
  const meta = user?.user_metadata || {};
  const claims = data.custom_claims || meta.custom_claims || {};
  return {
    username:
      claims.global_name || data.full_name || data.name || data.preferred_username || meta.full_name || meta.name || meta.preferred_username || 'Discord',
    avatar: data.avatar_url || meta.avatar_url || ''
  };
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function SpringToggle({ on, onToggle, label, hint }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-4 text-left dark:border-white/10 dark:bg-slate-950/55">
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="mt-1 block text-sm text-slate-500">{hint}</span>
      </span>
      <span className={`flex h-8 w-14 items-center rounded-full px-1 ${on ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-slate-300 dark:bg-slate-700'}`}>
        <motion.div layout transition={{ type: 'spring', stiffness: 520, damping: 32 }} className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

export default function Settings() {
  const { session, supabase, lang, setLang, theme, setTheme, rain, setRain, glassVisible, setGlassVisible, glassMotion, setGlassMotion, uiScale, setUiScale, t, profiles, activePersonnel, formatPersonnelName, setActivePersonnel, createPersonnelProfile, refresh } =
    useCommand();
  const toast = useToast();
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accent, setAccent] = useState(window.localStorage.getItem(ACCENT_KEY) || '#1E4E8C');
  const [bioPublic, setBioPublic] = useState(true);
  const [uiMode, setUiMode] = useState(() => readUiMode() || 'html');
  const [authUser, setAuthUser] = useState(session?.user || null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creating, setCreating] = useState(false);
  const [resolvedScale, setResolvedScale] = useState(() => resolvedUiScale(uiScale));
  const identity = findDiscordIdentity(authUser);
  const discord = useMemo(() => discordDisplay(identity, authUser), [authUser, identity]);
  const canUnlink = (authUser?.identities || []).length > 1;

  const loadSettings = useCallback(async () => {
    if (!activePersonnel) {
      return;
    }
    const settings = await fetchOwnSettings(supabase, activePersonnel.id);
    setBioPublic(settings.bio_public !== false);
    setUiMode(settings.ui_skin === 'jsx' || settings.ui_skin === 'html' ? settings.ui_skin : readUiMode() || 'html');
    if (settings.theme_accent) {
      setAccent(settings.theme_accent);
      applyAccent(settings.theme_accent);
    }
    const { data } = await supabase.auth.getUser();
    setAuthUser(data.user || session?.user || null);
  }, [activePersonnel, session, supabase]);

  useEffect(() => {
    loadSettings().catch((error) => toast.alert(error.message));
  }, [loadSettings, toast]);

  useEffect(() => {
    function syncResolved() {
      setResolvedScale(resolvedUiScale(uiScale));
    }
    syncResolved();
    window.addEventListener('resize', syncResolved);
    return () => window.removeEventListener('resize', syncResolved);
  }, [uiScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pickerOpen) {
      return;
    }
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outer = size / 2 - 6;
    const inner = outer - 28;
    ctx.clearRect(0, 0, size, size);
    for (let angle = 0; angle < 360; angle += 1) {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${angle} 100% 50%)`;
      ctx.lineWidth = outer - inner;
      ctx.arc(cx, cy, (outer + inner) / 2, ((angle - 90) * Math.PI) / 180, ((angle - 89) * Math.PI) / 180);
      ctx.stroke();
    }
  }, [pickerOpen]);

  function pickFromWheel(event) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scale - canvas.width / 2;
    const y = (event.clientY - rect.top) * scale - canvas.height / 2;
    const distance = Math.hypot(x, y);
    const outer = canvas.width / 2 - 6;
    const inner = outer - 28;
    if (distance < inner - 4 || distance > outer + 4) {
      return;
    }
    let hue = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (hue < 0) {
      hue += 360;
    }
    const hex = hslToHex(hue, 100, 50);
    setAccent(hex);
    applyAccent(hex);
  }

  async function handleLinkDiscord() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'discord',
        options: { redirectTo: oauthRedirectTo('/settings'), scopes: 'identify email' }
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      setBusy(false);
      toast.alert(error.message);
    }
  }

  async function handleUnlinkDiscord() {
    if (!window.confirm(t('settings.discordUnlinkConfirm'))) {
      return;
    }
    try {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) {
        throw error;
      }
      const identities = data?.identities || [];
      if (identities.length < 2) {
        throw new Error(t('settings.discordNeedOther'));
      }
      const discordIdentity = identities.find((item) => item.provider === 'discord');
      if (!discordIdentity) {
        throw new Error(t('settings.discordMissing'));
      }
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(discordIdentity);
      if (unlinkError) {
        throw unlinkError;
      }
      await loadSettings();
      toast.success(t('settings.discordUnlinked'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function saveTheme() {
    if (!activePersonnel) {
      return;
    }
    try {
      applyAccent(accent);
      await saveOwnSettings(supabase, activePersonnel.id, { theme_accent: accent });
      await writeActivityLog(supabase, {
        userId: activePersonnel.id,
        roleSnapshot: activePersonnel.role,
        actionType: 'theme_update',
        details: `Updated theme accent to ${accent}`
      });
      toast.success(t('common.save'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function saveUiMode() {
    if (!activePersonnel) {
      return;
    }
    try {
      await persistUiSkin((payload) => saveOwnSettings(supabase, activePersonnel.id, payload), uiMode);
      const result = applyUiMode(uiMode);
      if (result.unavailable) {
        toast.info(t('settings.uiUnavailable'));
        return;
      }
      if (!result.navigated) {
        toast.success(t('settings.uiSaved'));
      }
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function savePrivacy(next) {
    setBioPublic(next);
    if (!activePersonnel) {
      return;
    }
    try {
      await saveOwnSettings(supabase, activePersonnel.id, { bio_public: next });
      await writeActivityLog(supabase, {
        userId: activePersonnel.id,
        roleSnapshot: activePersonnel.role,
        actionType: 'privacy_update',
        details: next ? 'Biography set to public' : 'Biography set to private'
      });
      toast.success(t('common.save'));
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('settings.kicker')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('settings.title')}</h1>
      </header>

      <div className="grid gap-6">
        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.connected')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.connectedHint')}</p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
            {identity && discord.avatar ? (
              <img src={discord.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#5865F2]/12 text-[#5865F2]">
                <DiscordMark className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {identity ? discord.username : t('settings.discord')}
                {identity ? (
                  <span className="ml-2 text-xs uppercase tracking-[0.12em] text-emerald-600">{t('settings.discordConnected')}</span>
                ) : null}
              </p>
              <p className="text-sm text-slate-500">{identity ? t('settings.discord') : t('settings.discordNotLinked')}</p>
            </div>
            {identity ? (
              <button type="button" className={btnGhost} disabled={!canUnlink} onClick={handleUnlinkDiscord}>
                {t('settings.discordUnlink')}
              </button>
            ) : (
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#5865F2] px-4 text-sm font-semibold text-white" disabled={busy} onClick={handleLinkDiscord}>
                <DiscordMark className="h-4 w-4" />
                {t('settings.discordLink')}
              </button>
            )}
          </div>
        </article>

        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.profiles')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.profilesHint')}</p>
          <div className="mt-4 grid gap-3">
            {profiles.length ? (
              profiles.map((row) => {
                const name = formatPersonnelName(row) || t('profiles.empty');
                const active = row.id === activePersonnel?.id;
                return (
                  <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 p-3 dark:border-white/10">
                    {row.avatar_url ? (
                      <img src={row.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-xs font-semibold dark:bg-slate-800">
                        {initialsFromName(name) || 'WLR'}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {name}
                        {active ? <span className="ml-2 text-xs uppercase tracking-[0.12em] text-emerald-600">{t('settings.activeProfile')}</span> : null}
                      </p>
                      <p className="text-sm text-slate-500">{row.military_rank || row.organization_role}</p>
                    </div>
                    {!active ? (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          await setActivePersonnel(row.id);
                          await refresh?.();
                        }}
                      >
                        {t('settings.switchProfile')}
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">{t('profiles.empty')}</p>
            )}
          </div>
          <form
            className="mt-4 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (creating) {
                return;
              }
              setCreating(true);
              try {
                const created = await createPersonnelProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
                await setActivePersonnel(created.id);
                await refresh?.();
                setFirstName('');
                setLastName('');
                toast.success(t('profiles.register'));
              } catch (error) {
                toast.alert(error.message);
              } finally {
                setCreating(false);
              }
            }}
          >
            <h3 className="text-sm font-semibold">{t('profiles.register')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} required maxLength={80} placeholder={t('profiles.firstName')} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              <input className={fieldClass} maxLength={80} placeholder={t('profiles.lastName')} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <button type="submit" className={btnPrimary} disabled={creating}>
              {t('profiles.register')}
            </button>
          </form>
        </article>

        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.theme')}</h2>
          <div className="mt-4 grid gap-3">
            <SpringToggle
              on={theme === 'dark'}
              onToggle={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')}
              label={lang === 'th' ? 'ธีมเข้ม' : 'Dark theme'}
              hint={lang === 'th' ? 'ใช้โทนหินชนวนสำหรับเวรยามค่ำ' : 'Use the deep slate command palette for evening watches.'}
            />
            <SpringToggle
              on={lang === 'th'}
              onToggle={() => setLang?.(lang === 'th' ? 'en' : 'th')}
              label={lang === 'th' ? 'ภาษาไทย' : 'Thai language'}
              hint={lang === 'th' ? 'แสดงข้อความราชการเป็นภาษาไทยทั้งพอร์ทัล' : 'Display official copy in Thai across the portal.'}
            />
            <SpringToggle
              on={Boolean(rain)}
              onToggle={() => setRain?.(!rain)}
              label={t('settings.rain')}
              hint={t('settings.rainHint')}
            />
            <SpringToggle
              on={Boolean(glassVisible)}
              onToggle={() => setGlassVisible?.(!glassVisible)}
              label={t('settings.glass')}
              hint={t('settings.glassHint')}
            />
            <SpringToggle
              on={Boolean(glassMotion)}
              onToggle={() => setGlassMotion?.(!glassMotion)}
              label={t('settings.glassMotion')}
              hint={t('settings.glassMotionHint')}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className={btnGhost} onClick={() => setPickerOpen((value) => !value)}>
              +
            </button>
            <span className="text-sm text-slate-500">{t('settings.createTheme')}</span>
          </div>
          {pickerOpen ? (
            <div className="mt-4 grid gap-3">
              <canvas
                ref={canvasRef}
                width={220}
                height={220}
                className="justify-self-start rounded-full"
                onPointerDown={pickFromWheel}
                onPointerMove={(event) => {
                  if (event.buttons) {
                    pickFromWheel(event);
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-8 w-8 rounded-full border border-slate-200" style={{ background: accent }} />
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Hex
                  <input
                    className={fieldClass}
                    maxLength={7}
                    value={accent}
                    onChange={(event) => {
                      const hex = event.target.value.trim();
                      setAccent(hex);
                      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                        applyAccent(hex);
                      }
                    }}
                    placeholder="#1E4E8C"
                  />
                </label>
                <button type="button" className={btnPrimary} onClick={saveTheme}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : null}
        </article>

        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.uiScale')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.uiScaleHint')}</p>
          <button
            type="button"
            onClick={() => setUiScale?.('auto')}
            className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
              uiScale === 'auto'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-slate-200/80 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">{t('settings.uiScaleAuto')}</span>
              <span className="mt-1 block text-sm text-slate-500">{t('settings.uiScaleAutoHint')}</span>
            </span>
          </button>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {['1', '2', '3', '4', '5'].map((level) => {
              const active = uiScale === level;
              const preview = uiScale === 'auto' && resolvedScale === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUiScale?.(level)}
                  className={`grid min-h-14 gap-0.5 rounded-2xl border px-1 py-2 text-center ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-slate-200/80 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                  } ${preview && !active ? 'ring-1 ring-[var(--accent)]' : ''}`}
                >
                  <strong className="text-lg">{level}</strong>
                  <small className="text-[0.62rem] font-bold uppercase tracking-wide text-slate-500">
                    {t(`settings.uiScale${level}`)}
                  </small>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {t('settings.uiScaleNow').replace('{level}', uiScale === 'auto' ? resolvedScale : uiScale)}
          </p>
        </article>

        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.ui')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.uiHint')}</p>
          {!reactUiAvailable() ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('settings.uiUnavailable')}</p> : null}
          <div className="mt-4 grid gap-2">
            {[
              { id: 'html', label: t('settings.uiHtml') },
              { id: 'jsx', label: t('settings.uiJsx') }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setUiMode(option.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  uiMode === option.id
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-slate-200/80 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className={`${btnPrimary} mt-4`} onClick={saveUiMode}>
            {t('settings.uiSave')}
          </button>
        </article>

        <article className={`${glassClass} p-5`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('settings.privacy')}</h2>
          <CommandCheck className="mt-4" checked={bioPublic} onChange={savePrivacy}>
            {t('settings.bioPublic')}
          </CommandCheck>
        </article>
      </div>
    </section>
  );
}
