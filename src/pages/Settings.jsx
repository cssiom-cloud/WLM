import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'Command',
    title: 'Settings',
    lead: 'Manage the official appearance of this station and the accounts linked to the personnel file.',
    appearance: 'Station appearance',
    theme: 'Dark theme',
    themeHint: 'Use the deep slate command palette for evening watches.',
    language: 'Thai language',
    languageHint: 'Display official copy in Thai across the portal.',
    accounts: 'Linked accounts',
    accountsLead: 'Discord is the preferred identity channel for command personnel.',
    linked: 'Discord is linked to this file',
    notLinked: 'Discord is not linked to this file',
    link: 'Link Discord account',
    linking: 'Opening Discord authorization',
    unlinkHint: 'Keep at least one other sign-in method before requesting an unlink from administration.',
    personnel: 'Active personnel',
    none: 'No personnel file is selected.'
  },
  th: {
    kicker: 'ศูนย์บัญชาการ',
    title: 'การตั้งค่า',
    lead: 'จัดการลักษณะของสถานีราชการและบัญชีที่เชื่อมกับแฟ้มกำลังพล',
    appearance: 'ลักษณะสถานี',
    theme: 'ธีมเข้ม',
    themeHint: 'ใช้โทนหินชนวนสำหรับเวรยามค่ำ',
    language: 'ภาษาไทย',
    languageHint: 'แสดงข้อความราชการเป็นภาษาไทยทั้งพอร์ทัล',
    accounts: 'บัญชีที่เชื่อมแล้ว',
    accountsLead: 'Discord เป็นช่องทางยืนยันตัวตนหลักสำหรับกำลังพลศูนย์บัญชาการ',
    linked: 'เชื่อม Discord กับแฟ้มนี้แล้ว',
    notLinked: 'ยังไม่ได้เชื่อม Discord กับแฟ้มนี้',
    link: 'เชื่อมบัญชี Discord',
    linking: 'กำลังเปิดการยืนยัน Discord',
    unlinkHint: 'ต้องมีวิธีเข้าสู่ระบบอย่างน้อยอีกหนึ่งวิธีก่อนแจ้งขอยกเลิกการเชื่อมต่อ',
    personnel: 'แฟ้มกำลังพลที่ใช้อยู่',
    none: 'ยังไม่ได้เลือกแฟ้มกำลังพล'
  }
};

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

function isDiscordLinked(session) {
  const user = session?.user;
  if (!user) {
    return false;
  }
  const identities = user.identities || [];
  if (identities.some((item) => item.provider === 'discord')) {
    return true;
  }
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes('discord')) {
    return true;
  }
  return user.app_metadata?.provider === 'discord';
}

function discordDisplay(session) {
  const user = session?.user;
  const identity = (user?.identities || []).find((item) => item.provider === 'discord');
  const data = identity?.identity_data || {};
  const meta = user?.user_metadata || {};
  const claims = data.custom_claims || meta.custom_claims || {};
  return {
    username:
      claims.global_name ||
      data.full_name ||
      data.name ||
      data.preferred_username ||
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      'Discord',
    avatar: data.avatar_url || meta.avatar_url || ''
  };
}

function SpringToggle({ on, onToggle, label, hint }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-4 text-left dark:border-white/10 dark:bg-slate-950/55"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="mt-1 block text-sm text-slate-500">{hint}</span>
      </span>
      <span
        className={`flex h-8 w-14 items-center rounded-full px-1 ${
          on ? 'justify-end bg-indigo-700 dark:bg-indigo-300' : 'justify-start bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className="h-6 w-6 rounded-full bg-white shadow"
        />
      </span>
    </button>
  );
}

function LinkedIdentityPulse({ linked, personName, personAvatar, discordName, discordAvatar }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 px-5 py-6 dark:border-white/10 dark:bg-slate-950/55">
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {personAvatar ? (
            <img src={personAvatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              WLR
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{personName}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Personnel</p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3 text-[#5865F2]">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold">{discordName}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Discord</p>
          </div>
          {discordAvatar ? (
            <img src={discordAvatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#5865F2]/12">
              <DiscordMark className="h-6 w-6" />
            </span>
          )}
        </div>
      </div>

      {linked ? (
        <svg
          className="pointer-events-none absolute inset-x-20 top-1/2 h-16 -translate-y-1/2"
          viewBox="0 0 240 48"
          aria-hidden="true"
        >
          <defs>
            <filter id="wlr-discord-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <motion.path
            d="M 8 24 C 72 8, 168 40, 232 24"
            fill="none"
            stroke="rgba(88,101,242,0.85)"
            strokeWidth="1.8"
            filter="url(#wlr-discord-glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, opacity: [0.4, 1, 0.4] }}
            transition={{
              pathLength: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }}
          />
          <motion.circle
            r="3.4"
            fill="#818cf8"
            filter="url(#wlr-discord-glow)"
            animate={{ cx: [8, 120, 232], cy: [24, 12, 24], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      ) : null}
    </div>
  );
}

export default function Settings() {
  const { session, supabase, lang, setLang, theme, setTheme, activePersonnel, formatPersonnelName } = useCommand();
  const copy = COPY[lang] || COPY.en;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const linked = isDiscordLinked(session);
  const discord = useMemo(() => discordDisplay(session), [session]);
  const personName = formatPersonnelName(activePersonnel) || session?.user?.email || copy.none;
  const personAvatar = activePersonnel?.avatar_url || session?.user?.user_metadata?.avatar_url || '';

  async function handleLinkDiscord() {
    if (busy) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'discord',
        options: {
          redirectTo: window.location.href,
          scopes: 'identify email'
        }
      });
      if (linkError) {
        throw linkError;
      }
    } catch (linkError) {
      setBusy(false);
      setError(linkError?.message || copy.notLinked);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.kicker}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy.lead}</p>
      </header>

      <div className="grid gap-6">
        <section>
          <h2 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.appearance}</h2>
          <div className="grid gap-3">
            <SpringToggle
              on={theme === 'dark'}
              onToggle={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')}
              label={copy.theme}
              hint={copy.themeHint}
            />
            <SpringToggle
              on={lang === 'th'}
              onToggle={() => setLang?.(lang === 'th' ? 'en' : 'th')}
              label={copy.language}
              hint={copy.languageHint}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.accounts}</h2>
          <p className="mb-4 text-sm text-slate-500">{copy.accountsLead}</p>
          <LinkedIdentityPulse
            linked={linked}
            personName={personName}
            personAvatar={personAvatar}
            discordName={linked ? discord.username : 'Discord'}
            discordAvatar={linked ? discord.avatar : ''}
          />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            {linked ? copy.linked : copy.notLinked}
          </p>
          {linked ? (
            <p className="mt-2 text-sm text-slate-500">{copy.unlinkHint}</p>
          ) : (
            <button
              type="button"
              onClick={handleLinkDiscord}
              disabled={busy}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#5865F2] px-4 text-sm font-semibold text-white disabled:opacity-70"
            >
              <DiscordMark className="h-4 w-4" />
              {busy ? copy.linking : copy.link}
            </button>
          )}
          {error ? (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/75 p-5 dark:border-white/10 dark:bg-slate-950/55">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.personnel}</p>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{personName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {activePersonnel?.military_rank || session?.user?.email || copy.none}
          </p>
        </section>
      </div>
    </section>
  );
}
