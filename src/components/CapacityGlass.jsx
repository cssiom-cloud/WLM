export default function CapacityGlass({ item, t, size = 'md' }) {
  const limited = item?.capacity_limited !== false;
  const count = Number(item?.signed_count || 0);
  const max = Math.max(1, Number(item?.max_capacity || 1));
  const fill = limited ? Math.min(1, count / max) : Math.min(0.62, 0.16 + count * 0.05);
  const full = limited && count >= max;
  const compact = size === 'sm';

  return (
    <div className={`ann-glass ${compact ? 'is-sm' : ''} ${full ? 'is-full' : ''}`}>
      <div
        className="ann-glass-cup"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limited ? max : undefined}
        aria-valuenow={count}
        aria-label={limited ? `${count} / ${max}` : String(count)}
      >
        <div className="ann-glass-water" style={{ '--fill': `${Math.round(fill * 100)}%` }}>
          <span className="ann-glass-wave" aria-hidden="true" />
          <span className="ann-glass-wave is-late" aria-hidden="true" />
        </div>
        <span className="ann-glass-shine" aria-hidden="true" />
      </div>
      <div className="ann-glass-copy">
        <p className="ann-glass-count">
          {limited ? (
            <>
              <strong>{count}</strong>
              <span> / {max}</span>
            </>
          ) : (
            <strong>{count}</strong>
          )}
        </p>
        <p className="ann-glass-label">{limited ? t('ann.signedUp') : t('ann.unlimited')}</p>
      </div>
    </div>
  );
}
