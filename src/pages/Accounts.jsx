import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin, initialsFromName } from '../lib/access.js';
import { fetchLoginAccounts, updateLoginCredentials } from '../lib/services.js';
import { PageHeader, btnGhost, btnPrimary, fieldClass, glassClass } from '../lib/ui.jsx';

export default function Accounts() {
  const { supabase, t, activePersonnel, formatPersonnelName } = useCommand();
  const toast = useToast();
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const admin = isAdmin(activePersonnel);

  const load = useCallback(async () => {
    setRoster(await fetchLoginAccounts(supabase));
  }, [supabase]);

  useEffect(() => {
    if (admin) {
      load().catch((error) => toast.alert(error.message));
    }
  }, [admin, load, toast]);

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  const rows = roster.filter((record) => {
    if (!query.trim()) {
      return true;
    }
    return [formatPersonnelName(record), record.email, record.military_rank].join(' ').toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <section className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t('accounts.kicker')}
        title={t('accounts.title')}
        lead={t('accounts.lead')}
        actions={
          <input className={`${fieldClass} sm:w-64`} type="search" placeholder={t('accounts.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        }
      />
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2">{t('accounts.name')}</th>
                <th className="px-3 py-2">{t('accounts.email')}</th>
                <th className="px-3 py-2">{t('accounts.password')}</th>
                <th className="px-3 py-2">{t('accounts.action')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const name = formatPersonnelName(record) || t('units.unnamed');
                return (
                  <tr key={record.id} className="border-t border-slate-200/80 dark:border-white/10">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {record.avatar_url ? (
                          <img src={record.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-[0.6rem] font-semibold">{initialsFromName(name)}</span>
                        )}
                        {name}
                      </div>
                    </td>
                    <td className="px-3 py-2">{record.email || t('accounts.noLogin')}</td>
                    <td className="px-3 py-2 text-slate-500">{record.has_login ? t('accounts.passwordHidden') : t('accounts.noLogin')}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => {
                          setEditing(record);
                          setEmail(record.email || '');
                          setPassword('');
                        }}
                      >
                        {t('accounts.edit')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('accounts.empty')}</p>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            className={`${glassClass} w-full max-w-lg p-6`}
            onSubmit={async (event) => {
              event.preventDefault();
              if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                toast.alert(t('accounts.invalidEmail'));
                return;
              }
              if (password && password.length < 6) {
                toast.alert(t('accounts.passwordMin'));
                return;
              }
              if (!email && !password) {
                toast.alert(t('accounts.noChanges'));
                return;
              }
              if (!editing.email && !password) {
                toast.alert(t('accounts.createNeedsPassword'));
                return;
              }
              try {
                await updateLoginCredentials(supabase, editing.id, { email, password: password || null });
                toast.success(t('accounts.saved'));
                setEditing(null);
                await load();
              } catch (error) {
                toast.alert(error.message);
              }
            }}
          >
            <h2 className="text-xl font-semibold">{t('accounts.editTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500">{formatPersonnelName(editing) || t('units.unnamed')}</p>
            <label className="mt-4 grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('accounts.email')}
              <input className={fieldClass} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="mt-3 grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('accounts.password')}
              <input className={fieldClass} type="text" autoComplete="new-password" placeholder={t('accounts.newPassword')} value={password} onChange={(event) => setPassword(event.target.value)} />
              <span className="normal-case tracking-normal text-slate-400">{t('accounts.passwordKeep')}</span>
            </label>
            <div className="mt-4 flex gap-2">
              <button type="submit" className={btnPrimary}>
                {t('common.save')}
              </button>
              <button type="button" className={btnGhost} onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
