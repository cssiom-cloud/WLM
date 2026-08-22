import { Link } from 'react-router-dom';
import { formatPersonnelName } from '../../js/domain.js';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function AnnouncementRoster({ people = [], t, compact = false }) {
  if (!people.length) {
    return <p className="mt-3 text-sm text-slate-500">{t('ann.noSignups')}</p>;
  }

  if (compact) {
    return (
      <div className="ann-roster-faces mt-3" aria-label={t('ann.participants')}>
        {people.slice(0, 8).map((person) => {
          const name = formatPersonnelName(person) || t('profiles.empty');
          return person.avatar_url ? (
            <img key={person.id} src={person.avatar_url} alt={name} title={name} className="ann-roster-face" />
          ) : (
            <span key={person.id} title={name} className="ann-roster-face ann-roster-fallback">
              {initials(name) || 'WLR'}
            </span>
          );
        })}
        {people.length > 8 ? (
          <span className="ann-roster-face ann-roster-fallback">+{people.length - 8}</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{t('ann.participants')}</h3>
      <ul className="ann-roster mt-3">
        {people.map((person) => {
          const name = formatPersonnelName(person) || t('profiles.empty');
          return (
            <li key={person.id}>
              <Link to={`/directory?dossier=${encodeURIComponent(person.id)}`} className="ann-roster-person">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="ann-roster-avatar" />
                ) : (
                  <span className="ann-roster-avatar ann-roster-fallback">{initials(name) || 'WLR'}</span>
                )}
                <span>
                  <p className="ann-roster-name">{name}</p>
                  <p className="ann-roster-rank">{person.military_rank || person.organization_role || '—'}</p>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
