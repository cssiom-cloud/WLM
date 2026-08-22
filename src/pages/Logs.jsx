import { useCallback, useEffect, useState } from 'react';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { fetchActivityLogs, formatBytes, isAdminLog, isUserLog, measureCommandStatus } from '../lib/services.js';
import { PageHeader, glassClass } from '../lib/ui.jsx';

function LogTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200/80 dark:border-white/10">
              <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">{row.role_snapshot || ''}</td>
              <td className="px-3 py-2">{row.action_type || ''}</td>
              <td className="px-3 py-2">{row.details || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Logs() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const admin = isAdmin(activePersonnel);
  const [tab, setTab] = useState('user');
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);

  const load = useCallback(async () => {
    const [nextStatus, rows] = await Promise.all([
      measureCommandStatus(supabase).catch((error) => ({ error: error.message })),
      fetchActivityLogs(supabase, admin, activePersonnel?.id)
    ]);
    setStatus(nextStatus);
    setLogs(rows);
  }, [activePersonnel, admin, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
    const timer = window.setInterval(() => {
      measureCommandStatus(supabase)
        .then(setStatus)
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, supabase, toast]);

  return (
    <section className="mx-auto max-w-5xl">
      <PageHeader kicker="Operations" title="System Logs" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <article className={`${glassClass} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ping / Latency</p>
          <strong className="mt-2 block text-2xl">{status?.latencyMs != null ? `${status.latencyMs} ms` : status?.error || t('notice.loading')}</strong>
        </article>
        <article className={`${glassClass} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Storage remaining / Limit</p>
          <strong className="mt-2 block text-lg">
            {status?.storage_remaining_bytes != null
              ? `${formatBytes(status.storage_remaining_bytes)} remaining / ${formatBytes(status.storage_limit_bytes)}`
              : t('notice.loading')}
          </strong>
          {status?.storage_used_bytes != null ? <p className="mt-1 text-sm text-slate-500">Used {formatBytes(status.storage_used_bytes)}</p> : null}
        </article>
      </div>
      <div className="mb-4 flex gap-2">
        <button type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === 'user' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-slate-200 dark:border-white/10'}`} onClick={() => setTab('user')}>
          Normal User Logs
        </button>
        {admin ? (
          <button type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === 'admin' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-slate-200 dark:border-white/10'}`} onClick={() => setTab('admin')}>
            Admin Activity Logs
          </button>
        ) : null}
      </div>
      {tab === 'user' ? <LogTable rows={logs.filter((row) => isUserLog(row.action_type))} /> : <LogTable rows={logs.filter((row) => isAdminLog(row.action_type))} />}
    </section>
  );
}
