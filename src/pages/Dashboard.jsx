import { useEffect, useMemo, useState } from 'react';
import AnimatedCard from '../components/AnimatedCard.jsx';
import { useCommand } from '../components/GlobalLayout.jsx';

function visibleName(row) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unassigned name';
}

export default function Dashboard() {
  const { supabase, lang, formatPersonnelName, activePersonnel } = useCommand();
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('oc_personnel')
        .select('id, first_name, middle_name, last_name, military_rank, organization_role, avatar_url, is_dev, owner_user_id')
        .order('first_name', { ascending: true });
      if (cancelled) {
        return;
      }
      if (loadError) {
        setError(loadError.message);
        setRoster([]);
      } else {
        setError('');
        setRoster(
          (data || []).filter(
            (row) => !row.is_dev || row.owner_user_id === activePersonnel?.owner_user_id || row.id === activePersonnel?.id
          )
        );
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activePersonnel, supabase]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return roster;
    }
    return roster.filter((row) =>
      [visibleName(row), row.military_rank, row.organization_role].join(' ').toLowerCase().includes(needle)
    );
  }, [query, roster]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {lang === 'th' ? 'กำลังพล' : 'Personnel'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {lang === 'th' ? 'ทำเนียบกำลังพล' : 'Personnel Directory'}
          </h1>
        </div>
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">{lang === 'th' ? 'ค้นหา' : 'Search personnel'}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lang === 'th' ? 'ค้นหาชื่อ ยศ หน่วยงาน' : 'Search name, rank, role'}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none ring-indigo-400/40 backdrop-blur-xl focus:ring-2 dark:border-white/10 dark:bg-slate-900/70"
          />
        </label>
      </div>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ perspective: 1200 }}>
          {filtered.map((row) => (
            <AnimatedCard
              key={row.id}
              name={formatPersonnelName(row) || visibleName(row)}
              rank={row.military_rank}
              role={row.organization_role}
              avatarUrl={row.avatar_url}
              actionLabel={lang === 'th' ? 'เปิดแฟ้ม' : 'Open dossier'}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{lang === 'th' ? 'ไม่พบกำลังพลที่ตรงกับการค้นหา' : 'No personnel matched the search.'}</p>
      )}
    </section>
  );
}
